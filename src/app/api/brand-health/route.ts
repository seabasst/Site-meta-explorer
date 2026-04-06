import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CATEGORY_KEYS, type CategoryKey } from '@/lib/classification/taxonomy';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScoreKey = CategoryKey | 'overall';

interface PillarComparison {
  user: number;
  competitorAvg: number;
  diff: number;
  status: 'ahead' | 'behind' | 'even';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractScores(cache: {
  assetTypeScore: number;
  visualFormatScore: number;
  hookTacticScore: number;
  messagingAngleScore: number;
  awarenessStageScore: number;
  creativeMechanicScore: number;
  offerTypeScore: number;
  intendedAudienceScore: number;
  overallScore: number;
}): Record<ScoreKey, number> {
  return {
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
}

function extractMetrics(cache: {
  avgRefreshRate: number;
  stalePercentage: number;
  hookQualityAvg: number;
  uniqueConcepts: number;
  uniqueCtas: number;
  funnelAwareness: number;
  funnelConsideration: number;
  funnelConversion: number;
}) {
  return {
    avgRefreshRate: cache.avgRefreshRate,
    stalePercentage: cache.stalePercentage,
    hookQualityAvg: cache.hookQualityAvg,
    uniqueConcepts: cache.uniqueConcepts,
    uniqueCtas: cache.uniqueCtas,
    funnelAwareness: cache.funnelAwareness,
    funnelConsideration: cache.funnelConsideration,
    funnelConversion: cache.funnelConversion,
  };
}

function computePillarComparison(
  userScore: number,
  competitorAvg: number,
): PillarComparison {
  const diff = Math.round(userScore - competitorAvg);
  const status = diff > 5 ? 'ahead' : diff < -5 ? 'behind' : 'even';
  return { user: userScore, competitorAvg: Math.round(competitorAvg), diff, status };
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Category labels for human-readable strengths/gaps
const PILLAR_LABELS: Record<string, string> = {
  assetType: 'Asset Type',
  visualFormat: 'Visual Format',
  hookTactic: 'Hook Tactic',
  messagingAngle: 'Messaging Angle',
  awarenessStage: 'Awareness Stage',
  creativeMechanic: 'Creative Mechanic',
  offerType: 'Offer Type',
  intendedAudience: 'Intended Audience',
  overall: 'Overall',
};

// ---------------------------------------------------------------------------
// GET /api/brand-health?pageId=XXX&profileId=YYY (optional)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const profileId = searchParams.get('profileId');

    if (!pageId) {
      return Response.json({ error: 'pageId query param is required' }, { status: 400 });
    }

    // 1. Look up the user's brand
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: {
        id: true,
        pageName: true,
        pageId: true,
        profilePicUrl: true,
        category: true,
      },
    });

    if (!brand) {
      return Response.json({ error: 'Brand not found' }, { status: 404 });
    }

    // 2. Get user brand's analysis cache
    const userCache = await prisma.brandAnalysisCache.findUnique({
      where: { brandId: brand.id },
    });

    if (!userCache) {
      return Response.json({
        needsAnalysis: true,
        brandName: brand.pageName,
        message: 'Run Andromeda analysis for this brand first',
      });
    }

    // 3. Find a BrandProfile with competitors
    // If profileId provided, use that; otherwise find any profile that has competitors
    let profile;
    if (profileId) {
      profile = await prisma.brandProfile.findUnique({
        where: { id: profileId },
        include: {
          competitors: {
            include: {
              adLibraryBrand: {
                select: {
                  id: true,
                  pageId: true,
                  pageName: true,
                  profilePicUrl: true,
                  category: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Find the first active profile that has competitors
      profile = await prisma.brandProfile.findFirst({
        where: {
          isActive: true,
          competitors: { some: {} },
        },
        include: {
          competitors: {
            include: {
              adLibraryBrand: {
                select: {
                  id: true,
                  pageId: true,
                  pageName: true,
                  profilePicUrl: true,
                  category: true,
                },
              },
            },
          },
        },
      });

      // Fallback: any profile with competitors
      if (!profile) {
        profile = await prisma.brandProfile.findFirst({
          where: {
            competitors: { some: {} },
          },
          include: {
            competitors: {
              include: {
                adLibraryBrand: {
                  select: {
                    id: true,
                    pageId: true,
                    pageName: true,
                    profilePicUrl: true,
                    category: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    // Build user brand response
    const userScores = extractScores(userCache);
    const userMetrics = extractMetrics(userCache);

    const userBrand = {
      name: brand.pageName,
      pageId: brand.pageId,
      iconUrl: brand.profilePicUrl,
      scores: userScores,
      andromedaScore: userCache.andromedaScore,
      metrics: userMetrics,
    };

    // 4. No competitors linked — return user brand only
    if (!profile || profile.competitors.length === 0) {
      return Response.json({
        userBrand,
        competitors: [],
        comparison: null,
      });
    }

    // 5. Batch-fetch competitor analysis caches
    const competitorBrandIds = profile.competitors.map((c) => c.adLibraryBrand.id);
    const competitorCaches = await prisma.brandAnalysisCache.findMany({
      where: { brandId: { in: competitorBrandIds } },
    });

    // Map caches by brandId for O(1) lookup
    const cacheMap = new Map(competitorCaches.map((c) => [c.brandId, c]));

    // 6. Build competitor entries
    const competitors = profile.competitors.map((comp) => {
      const cache = cacheMap.get(comp.adLibraryBrand.id);
      return {
        name: comp.adLibraryBrand.pageName,
        pageId: comp.adLibraryBrand.pageId,
        iconUrl: comp.adLibraryBrand.profilePicUrl,
        notes: comp.notes,
        scores: cache ? extractScores(cache) : null,
        andromedaScore: cache?.andromedaScore ?? null,
        metrics: cache ? extractMetrics(cache) : null,
        hasAnalysis: !!cache,
      };
    });

    // 7. Compute comparison (only using competitors with analysis data)
    const analyzedCompetitors = competitors.filter((c) => c.hasAnalysis && c.scores);

    if (analyzedCompetitors.length === 0) {
      // All competitors unanalyzed — return user brand + competitor list without comparison
      return Response.json({
        userBrand,
        competitors,
        comparison: null,
      });
    }

    // Per-pillar indexing
    const allPillars: ScoreKey[] = [...CATEGORY_KEYS, 'overall'];
    const indexing: Record<string, PillarComparison> = {};

    for (const pillar of allPillars) {
      const userScore = userScores[pillar];
      const compScores = analyzedCompetitors
        .map((c) => c.scores![pillar])
        .filter((s): s is number => s != null);
      const compAvg = avgOf(compScores);
      indexing[pillar] = computePillarComparison(userScore, compAvg);
    }

    // Andromeda comparison
    const compAndromedaScores = analyzedCompetitors
      .map((c) => c.andromedaScore)
      .filter((s): s is number => s != null);
    indexing['andromeda'] = computePillarComparison(
      userCache.andromedaScore,
      avgOf(compAndromedaScores),
    );

    // Derive strengths and gaps
    const strengths: string[] = [];
    const gaps: string[] = [];

    for (const [pillar, comparison] of Object.entries(indexing)) {
      const label = PILLAR_LABELS[pillar] || pillar;
      if (comparison.status === 'ahead') {
        strengths.push(`${label} (+${comparison.diff})`);
      } else if (comparison.status === 'behind') {
        gaps.push(`${label} (${comparison.diff})`);
      }
    }

    return Response.json({
      userBrand,
      competitors,
      comparison: {
        indexing,
        strengths,
        gaps,
        analyzedCompetitorCount: analyzedCompetitors.length,
        totalCompetitorCount: competitors.length,
      },
    });
  } catch (error) {
    console.error('Brand health API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Brand health check failed' },
      { status: 500 },
    );
  }
}
