import { NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { GenerationSuggestion, GenerationConfig } from '@/lib/creative-lab-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic();

const requestSchema = z.object({
  pageId: z.string().min(1, 'pageId is required'),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-config
// Synthesizes analysis cache + brand guidelines into generation suggestions.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { pageId } = parsed.data;

    // ------------------------------------------------------------------
    // 1. Find brand
    // ------------------------------------------------------------------
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand) {
      return Response.json({ error: 'Brand not found' }, { status: 404 });
    }

    // ------------------------------------------------------------------
    // 2. Fetch cached analysis (required)
    // ------------------------------------------------------------------
    const cache = await prisma.brandAnalysisCache.findUnique({
      where: { brandId: brand.id },
    });

    if (!cache) {
      return Response.json(
        { error: 'Run analysis first. No cached analysis found for this brand.' },
        { status: 404 }
      );
    }

    // ------------------------------------------------------------------
    // 3. Optionally fetch brand guidelines (auth-gated, non-blocking)
    // ------------------------------------------------------------------
    let brandVoice: string | null = null;
    let brandColors: string[] = [];
    let brandAudience: string[] = [];

    try {
      const session = await auth();
      if (session?.user?.id) {
        const guidelines = await prisma.brandGuidelines.findUnique({
          where: { userId: session.user.id },
        });
        if (guidelines) {
          brandVoice = guidelines.brandVoice?.slice(0, 200) ?? null;
          brandColors = [
            guidelines.primaryColor,
            guidelines.secondaryColor,
            guidelines.accentColor,
          ].filter((c): c is string => !!c);
          brandAudience = [
            ...(guidelines.demographics || []),
            ...(guidelines.interests || []),
          ];
        }
      }
    } catch {
      // Non-blocking: proceed without brand guidelines
    }

    // ------------------------------------------------------------------
    // 4. Build diversity scores and distribution for prompt
    // ------------------------------------------------------------------
    const scores = {
      assetType: cache.assetTypeScore,
      visualFormat: cache.visualFormatScore,
      hookTactic: cache.hookTacticScore,
      messagingAngle: cache.messagingAngleScore,
      awarenessStage: cache.awarenessStageScore,
      creativeMechanic: cache.creativeMechanicScore,
      offerType: cache.offerTypeScore,
      intendedAudience: cache.intendedAudienceScore,
      overall: cache.overallScore,
    };

    const distribution = cache.distributionJson as Record<string, Record<string, number>> | null;

    // Identify gaps: categories scoring below 60
    const gapCategories = Object.entries(scores)
      .filter(([key, score]) => key !== 'overall' && score < 60)
      .sort((a, b) => a[1] - b[1])
      .map(([category, score]) => `${category}: ${score}/100`);

    // ------------------------------------------------------------------
    // 5. Call Claude for structured suggestions
    // ------------------------------------------------------------------
    const brandGuidelinesBlock = brandVoice || brandColors.length > 0 || brandAudience.length > 0
      ? `\n**Brand Guidelines (use to tailor suggestions):**
- Voice: ${brandVoice || 'Not specified'}
- Colors: ${brandColors.length > 0 ? brandColors.join(', ') : 'Not specified'}
- Target audience: ${brandAudience.length > 0 ? brandAudience.slice(0, 10).join(', ') : 'Not specified'}`
      : '';

    const prompt = `You are an expert Meta Ads creative strategist. Based on this brand's creative diversity analysis, generate ad creative suggestions to fill identified gaps.

**Brand:** ${brand.pageName}
**Category:** ${brand.category || 'Unknown'}
**Total ads analyzed:** ${cache.totalAdsAnalyzed}

**Diversity Scores (0-100, lower = bigger gap):**
${JSON.stringify(scores, null, 2)}

**Gap Categories (scoring below 60):**
${gapCategories.length > 0 ? gapCategories.join('\n') : 'No major gaps (all categories above 60)'}

**Distribution Data:**
${distribution ? JSON.stringify(distribution, null, 2) : 'No distribution data available'}

**Andromeda Metrics:**
- Refresh rate: ${cache.avgRefreshRate} new ads/week
- Stale percentage: ${cache.stalePercentage}%
- Hook quality avg: ${cache.hookQualityAvg}/10
- Unique concepts: ${cache.uniqueConcepts}
- Funnel balance: ${cache.funnelAwareness}% awareness / ${cache.funnelConsideration}% consideration / ${cache.funnelConversion}% conversion
${brandGuidelinesBlock}

Generate 5-7 ad creative suggestions. Each suggestion should address a specific gap or weakness. Prioritize the weakest pillars.

For each suggestion provide:
- pillar: which category or metric this addresses (assetType, visualFormat, hookTactic, messagingAngle, awarenessStage, creativeMechanic, offerType, intendedAudience, refreshRate, hookQuality, conceptDiversity, funnelBalance)
- reasoning: 1 sentence user-facing explanation of WHY this fills a gap
- format: ad format (static-image, video, carousel, reel, story)
- aspectRatio: recommended aspect ratio (1:1, 9:16, 4:5, 16:9)
- tone: emotional tone (aspirational, problem-solving, educational, social-proof, humor, urgency, price-focused, emotional)
- visualStyle: visual approach (studio, ugc, minimal, lifestyle, before-after, product-shot, illustration, selfie)
- journeyPhase: funnel stage (awareness, consideration, conversion)
- copyAngle: 1 sentence describing the copy direction
- imagePrompt: Detailed prompt for Flux Schnell image generation. Must be photographic/illustration style, NO text in images. 2-3 sentences describing scene, lighting, composition, colors, subjects.
- priority: high (biggest gaps), medium, or low

Return ONLY a valid JSON array of suggestion objects. No markdown, no explanation.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const rawSuggestions = JSON.parse(cleanJson) as Array<Record<string, unknown>>;

    // Assign UUIDs and default selected=true
    const suggestions: GenerationSuggestion[] = rawSuggestions.map((s, i) => ({
      id: crypto.randomUUID(),
      pillar: String(s.pillar || 'format'),
      reasoning: String(s.reasoning || ''),
      format: String(s.format || 'static-image'),
      aspectRatio: String(s.aspectRatio || '1:1'),
      tone: String(s.tone || 'aspirational'),
      visualStyle: String(s.visualStyle || 'studio'),
      journeyPhase: String(s.journeyPhase || 'awareness'),
      copyAngle: String(s.copyAngle || ''),
      imagePrompt: String(s.imagePrompt || ''),
      priority: (['high', 'medium', 'low'].includes(String(s.priority)) ? String(s.priority) : 'medium') as 'high' | 'medium' | 'low',
      selected: true,
    }));

    // Build gap summary
    const gapSummary = gapCategories.length > 0
      ? `${brand.pageName} has gaps in ${gapCategories.length} categor${gapCategories.length > 1 ? 'ies' : 'y'}: ${gapCategories.join(', ')}. Overall diversity score is ${scores.overall}/100.`
      : `${brand.pageName} has solid diversity across all categories (overall ${scores.overall}/100). Suggestions focus on refreshing stale formats and improving Andromeda metrics.`;

    const config: GenerationConfig = {
      brandName: brand.pageName,
      suggestions,
      brandContext: {
        colors: brandColors,
        voice: brandVoice,
        audience: brandAudience,
      },
      gapSummary,
    };

    return Response.json(config);
  } catch (error) {
    console.error('Generate config error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate config' },
      { status: 500 }
    );
  }
}
