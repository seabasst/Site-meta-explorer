import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { generateVisualBible } from '@/lib/creative-lab/visual-bible';
import { generateCreativeBriefs } from '@/lib/creative-lab/creative-director';
import type { GenerationSuggestion, GenerationConfig } from '@/lib/creative-lab-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const requestSchema = z.object({
  pageId: z.string().min(1, 'pageId is required'),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-config
//
// 3-step pipeline:
//   1. Visual Bible — Gemini analyzes brand reference images
//   2. Creative Director — Claude produces ad briefs using visual bible + gaps
//   3. Returns config for the frontend to review before image generation
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
    // 3. Fetch brand guidelines (auth-gated, non-blocking)
    // ------------------------------------------------------------------
    let brandVoice: string | null = null;
    let brandColors: string[] = [];
    let brandAudience: string[] = [];
    let referenceImages: { url: string; name?: string }[] = [];
    let logoUrl: string | null = null;
    let primaryColor: string | null = null;
    let secondaryColor: string | null = null;
    let accentColor: string | null = null;

    try {
      const session = await auth();
      if (session?.user?.id) {
        const profile = await prisma.brandProfile.findFirst({
          where: { userId: session.user.id, isActive: true },
        });
        if (profile) {
          brandVoice = profile.brandVoice?.slice(0, 200) ?? null;
          primaryColor = profile.primaryColor;
          secondaryColor = profile.secondaryColor;
          accentColor = profile.accentColor;
          brandColors = [primaryColor, secondaryColor, accentColor].filter(
            (c): c is string => !!c
          );
          brandAudience = [
            ...(profile.demographics || []),
            ...(profile.interests || []),
          ];
          logoUrl = profile.logoUrl;

          // Parse reference images from JSON field
          if (profile.referenceImages) {
            const refs = profile.referenceImages as Array<{
              url: string;
              name?: string;
            }>;
            referenceImages = refs.filter((r) => r.url);
          }
        }
      }
    } catch {
      // Non-blocking: proceed without brand profile
    }

    // ------------------------------------------------------------------
    // 4. Step 1: Generate Visual Bible (Gemini analyzes brand images)
    // ------------------------------------------------------------------
    const visualBible = await generateVisualBible({
      brandName: brand.pageName,
      referenceImages,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      brandVoice,
    });

    // ------------------------------------------------------------------
    // 5. Step 2: Creative Director (Claude produces ad briefs)
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

    const distribution = cache.distributionJson as Record<
      string,
      Record<string, number>
    > | null;

    const briefs = await generateCreativeBriefs({
      brandName: brand.pageName,
      category: brand.category,
      visualBible,
      diversityScores: scores,
      distribution,
      andromedaMetrics: {
        avgRefreshRate: cache.avgRefreshRate,
        stalePercentage: cache.stalePercentage,
        hookQualityAvg: cache.hookQualityAvg,
        uniqueConcepts: cache.uniqueConcepts,
        funnelAwareness: cache.funnelAwareness,
        funnelConsideration: cache.funnelConsideration,
        funnelConversion: cache.funnelConversion,
      },
      brandVoice,
      brandAudience,
      totalAdsAnalyzed: cache.totalAdsAnalyzed,
    });

    // ------------------------------------------------------------------
    // 6. Map briefs to frontend suggestions
    // ------------------------------------------------------------------
    const gapCategories = Object.entries(scores)
      .filter(([key, score]) => key !== 'overall' && score < 60)
      .sort((a, b) => a[1] - b[1])
      .map(([category, score]) => `${category}: ${score}/100`);

    const suggestions: GenerationSuggestion[] = briefs.map((brief) => ({
      id: crypto.randomUUID(),
      pillar: brief.pillar,
      reasoning: brief.reasoning,
      format: brief.format,
      aspectRatio: brief.aspectRatio,
      tone: brief.tone,
      visualStyle: brief.visualStyle,
      journeyPhase: brief.journeyPhase,
      copyAngle: brief.copyAngle,
      imagePrompt: brief.imagePrompt,
      priority: brief.priority,
      selected: true,
    }));

    const gapSummary =
      gapCategories.length > 0
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
      visualBible: visualBible.fullPromptPrefix,
    };

    return Response.json(config);
  } catch (error) {
    console.error('Generate config error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate config',
      },
      { status: 500 }
    );
  }
}
