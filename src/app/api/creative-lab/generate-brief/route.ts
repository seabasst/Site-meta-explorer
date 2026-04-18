import { NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { UGCBrief } from '@/lib/creative-lab-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic();

const requestSchema = z.object({
  pageId: z.string().min(1, 'pageId is required'),
});

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-brief
// Generates a structured UGC creator brief from brand analysis data.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    // 3. Fetch top-performing ads for real copy examples
    // ------------------------------------------------------------------
    const topAds = await prisma.adLibraryAd.findMany({
      where: { brandId: brand.id, isActive: true, body: { not: null } },
      orderBy: { reachEstimate: 'desc' },
      take: 10,
      select: { body: true, title: true, ctaText: true, displayFormat: true },
    });

    // ------------------------------------------------------------------
    // 4. Optionally fetch brand profile (auth-gated, non-blocking)
    // ------------------------------------------------------------------
    let brandVoice: string | null = null;
    let brandColors: string[] = [];
    let brandAudience: string[] = [];

    try {
      const session = await auth();
      if (session?.user?.id) {
        const profile = await prisma.brandProfile.findFirst({
          where: { userId: session.user.id, isActive: true },
        });
        if (profile) {
          brandVoice = profile.brandVoice?.slice(0, 200) ?? null;
          brandColors = [
            profile.primaryColor,
            profile.secondaryColor,
            profile.accentColor,
          ].filter((c): c is string => !!c);
          brandAudience = [
            ...(profile.demographics || []),
            ...(profile.interests || []),
          ];
        }
      }
    } catch {
      // Non-blocking: proceed without brand profile
    }

    // ------------------------------------------------------------------
    // 5. Build diversity scores and distribution for prompt
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

    // ------------------------------------------------------------------
    // 6. Build prompt sections
    // ------------------------------------------------------------------
    const brandProfileBlock = brandVoice || brandColors.length > 0 || brandAudience.length > 0
      ? `\n**Brand Profile (use to tailor the brief):**
- Voice: ${brandVoice || 'Not specified'}
- Brand colors: ${brandColors.length > 0 ? brandColors.join(', ') : 'Not specified'}
- Target audience: ${brandAudience.length > 0 ? brandAudience.slice(0, 10).join(', ') : 'Not specified'}`
      : '';

    const topAdsBlock = topAds.length > 0
      ? `\n**Top-performing ad copy examples (by reach):**\n${topAds.map((ad, i) => {
          const parts = [`${i + 1}.`];
          if (ad.body) parts.push(`Body: "${ad.body.slice(0, 200)}"`);
          if (ad.title) parts.push(`Title: "${ad.title}"`);
          if (ad.ctaText) parts.push(`CTA: "${ad.ctaText}"`);
          if (ad.displayFormat) parts.push(`Format: ${ad.displayFormat}`);
          return parts.join(' | ');
        }).join('\n')}`
      : '';

    const prompt = `You are an expert UGC content strategist. Based on this brand's ad library data and creative analysis, generate a structured UGC creator brief.

**Brand:** ${brand.pageName}
**Category:** ${brand.category || 'Unknown'}
**Total ads analyzed:** ${cache.totalAdsAnalyzed}

**Diversity Scores (0-100):**
${JSON.stringify(scores, null, 2)}

**Distribution Data:**
${distribution ? JSON.stringify(distribution, null, 2) : 'No distribution data available'}

**Andromeda Metrics:**
- Refresh rate: ${cache.avgRefreshRate} new ads/week
- Stale percentage: ${cache.stalePercentage}%
- Hook quality avg: ${cache.hookQualityAvg}/10
- Unique concepts: ${cache.uniqueConcepts}
- Funnel balance: ${cache.funnelAwareness}% awareness / ${cache.funnelConsideration}% consideration / ${cache.funnelConversion}% conversion
${brandProfileBlock}
${topAdsBlock}

Generate a UGC creator brief as a JSON object with EXACTLY this structure:
{
  "brandName": "${brand.pageName}",
  "category": "${brand.category || 'Unknown'}",
  "briefTitle": "string - creative title for the brief (e.g. 'Unboxing + First Impressions')",
  "contentType": "string - type of content (e.g. 'Review Video', 'Testimonial', 'How-To', 'Day in My Life')",
  "platform": "string - target platform (e.g. 'TikTok/Reels', 'Stories', 'Feed')",
  "duration": "string - target duration (e.g. '30-60 seconds')",
  "aspectRatio": "string - aspect ratio (e.g. '9:16')",
  "hooks": ["3 hook options, each 1-2 sentences, designed to stop scrolling in the first 2-3 seconds"],
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "2-3s",
      "shotType": "Close-up | Wide shot | POV | Over-the-shoulder | etc.",
      "description": "What happens in this scene (1-2 sentences)",
      "visualNotes": "Lighting, setting, mood notes",
      "audioNotes": "What to say or sound effects"
    }
  ],
  "talkingPoints": ["3-5 key messages to hit, each 1 sentence, NOT a full script"],
  "brollSuggestions": ["4-6 B-roll shot ideas tailored to the brand's category"],
  "callToAction": "string - what the creator should say/show at the end",
  "tone": "string - overall feel of the content (e.g. 'Casual, authentic, excited but not over-the-top')",
  "dosAndDonts": {
    "dos": ["3-5 do's for the creator"],
    "donts": ["3-5 don'ts for the creator"]
  },
  "keyProductInfo": "1-2 sentences about the product/brand for creator reference",
  "targetAudience": "Who this content should resonate with"
}

Requirements:
- hooks: exactly 3 options, each 1-2 sentences
- scenes: 5-8 scenes, each with all 6 fields (sceneNumber, duration, shotType, description, visualNotes, audioNotes)
- talkingPoints: 3-5 key messages, each 1 sentence
- brollSuggestions: 4-6 suggestions tailored to the "${brand.category || 'Unknown'}" category. For reference:
  - Fashion/Apparel: outfit transitions, mirror shots, detail close-ups, street style
  - Beauty/Skincare: application process, before/after, texture shots, packaging
  - Food/Beverage: preparation, pour shots, ingredients, eating/drinking
  - Tech/Electronics: unboxing, screen demos, daily carry, setup process
  - Fitness/Health: workout clips, progress shots, supplement routine, meal prep
  - Home/Lifestyle: room styling, organization, product in use, ambiance shots
- dos: 3-5 items
- donts: 3-5 items
- Use the brand's actual ad copy, tone, and messaging patterns from the examples above
- Make it feel specific to THIS brand, not generic

Return ONLY valid JSON. No markdown fences, no explanation, no commentary.`;

    // ------------------------------------------------------------------
    // 7. Call Claude
    // ------------------------------------------------------------------
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // ------------------------------------------------------------------
    // 8. Parse and return
    // ------------------------------------------------------------------
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let brief: UGCBrief;
    try {
      brief = JSON.parse(cleanJson) as UGCBrief;
    } catch {
      console.error('Failed to parse UGC brief JSON:', cleanJson.slice(0, 500));
      return Response.json(
        { error: 'Failed to parse brief from AI response. Please try again.' },
        { status: 500 }
      );
    }

    return Response.json(brief);
  } catch (error) {
    console.error('Generate brief error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate brief' },
      { status: 500 }
    );
  }
}
