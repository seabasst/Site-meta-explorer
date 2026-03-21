import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PillarIndex {
  brand: number;
  category: number;
  diff: number;
  status: 'strength' | 'gap' | 'neutral';
}

interface Recommendation {
  pillar: string;
  brandScore: number;
  categoryAvg: number;
  diff: number;
  status: 'strength' | 'gap';
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeIndex(brandScore: number, categoryAvg: number): PillarIndex {
  const diff = brandScore - categoryAvg;
  const status = diff > 5 ? 'strength' : diff < -5 ? 'gap' : 'neutral';
  return { brand: brandScore, category: categoryAvg, diff: Math.round(diff), status };
}

function avgInt(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function avgFloat(values: number[], decimals = 1): number {
  if (values.length === 0) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * factor) / factor;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, category } = body;

    if (!pageId || typeof pageId !== 'string') {
      return Response.json({ error: 'pageId is required' }, { status: 400 });
    }
    if (!category || typeof category !== 'string') {
      return Response.json({ error: 'category is required' }, { status: 400 });
    }

    // 1. Look up the brand
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand) {
      return Response.json({ error: 'Brand not found' }, { status: 404 });
    }

    // 2. Check for cached analysis for the selected brand
    const brandCache = await prisma.brandAnalysisCache.findUnique({
      where: { brandId: brand.id },
    });

    if (!brandCache) {
      return Response.json({
        needsAnalysis: true,
        brandName: brand.pageName,
        message: 'Run Andromeda analysis for this brand first',
      });
    }

    // 3. Fetch all cached analyses for the category
    const categoryAnalyses = await prisma.brandAnalysisCache.findMany({
      where: {
        brand: { category: { equals: category, mode: 'insensitive' } },
      },
      include: { brand: { select: { pageName: true } } },
    });

    // 4. Count total brands in category
    const totalBrandsInCategory = await prisma.adLibraryBrand.count({
      where: { category: { equals: category, mode: 'insensitive' } },
    });

    // 5. Compute category averages (excluding user's brand unless it's the only one)
    const otherAnalyses = categoryAnalyses.filter((a) => a.brandId !== brand.id);
    const poolForAverages = otherAnalyses.length > 0 ? otherAnalyses : categoryAnalyses;

    const avgScores = {
      format: avgInt(poolForAverages.map((a) => a.formatScore)),
      tone: avgInt(poolForAverages.map((a) => a.toneScore)),
      journeyPhase: avgInt(poolForAverages.map((a) => a.journeyPhaseScore)),
      visualStyle: avgInt(poolForAverages.map((a) => a.visualStyleScore)),
      messenger: avgInt(poolForAverages.map((a) => a.messengerScore)),
      overall: avgInt(poolForAverages.map((a) => a.overallScore)),
    };

    const avgAndromedaScore = avgInt(poolForAverages.map((a) => a.andromedaScore));

    const avgMetrics = {
      avgRefreshRate: avgFloat(poolForAverages.map((a) => a.avgRefreshRate)),
      stalePercentage: avgInt(poolForAverages.map((a) => a.stalePercentage)),
      hookQualityAvg: avgFloat(poolForAverages.map((a) => a.hookQualityAvg)),
      uniqueConcepts: avgInt(poolForAverages.map((a) => a.uniqueConcepts)),
      uniqueCtas: avgInt(poolForAverages.map((a) => a.uniqueCtas)),
      funnelAwareness: avgInt(poolForAverages.map((a) => a.funnelAwareness)),
      funnelConsideration: avgInt(poolForAverages.map((a) => a.funnelConsideration)),
      funnelConversion: avgInt(poolForAverages.map((a) => a.funnelConversion)),
    };

    // 6. Compute per-pillar indexing
    const indexing = {
      format: computeIndex(brandCache.formatScore, avgScores.format),
      tone: computeIndex(brandCache.toneScore, avgScores.tone),
      journeyPhase: computeIndex(brandCache.journeyPhaseScore, avgScores.journeyPhase),
      visualStyle: computeIndex(brandCache.visualStyleScore, avgScores.visualStyle),
      messenger: computeIndex(brandCache.messengerScore, avgScores.messenger),
      overall: computeIndex(brandCache.overallScore, avgScores.overall),
      andromeda: computeIndex(brandCache.andromedaScore, avgAndromedaScore),
    };

    // 7. Generate recommendations based on indexing
    const pillarLabels: Record<string, { brandScore: number; categoryAvg: number }> = {
      format: { brandScore: brandCache.formatScore, categoryAvg: avgScores.format },
      tone: { brandScore: brandCache.toneScore, categoryAvg: avgScores.tone },
      journeyPhase: { brandScore: brandCache.journeyPhaseScore, categoryAvg: avgScores.journeyPhase },
      visualStyle: { brandScore: brandCache.visualStyleScore, categoryAvg: avgScores.visualStyle },
      messenger: { brandScore: brandCache.messengerScore, categoryAvg: avgScores.messenger },
      overall: { brandScore: brandCache.overallScore, categoryAvg: avgScores.overall },
      andromeda: { brandScore: brandCache.andromedaScore, categoryAvg: avgAndromedaScore },
    };

    const gaps: Recommendation[] = [];
    const strengths: Recommendation[] = [];

    for (const [pillar, scores] of Object.entries(pillarLabels)) {
      const diff = scores.brandScore - scores.categoryAvg;
      if (diff < -5) {
        gaps.push({
          pillar,
          brandScore: scores.brandScore,
          categoryAvg: scores.categoryAvg,
          diff: Math.round(diff),
          status: 'gap',
          message: `Your ${pillar} diversity score (${scores.brandScore}) is ${Math.abs(Math.round(diff))} points below the ${category} average (${scores.categoryAvg}). Consider diversifying your ${pillar} mix.`,
        });
      } else if (diff > 5) {
        strengths.push({
          pillar,
          brandScore: scores.brandScore,
          categoryAvg: scores.categoryAvg,
          diff: Math.round(diff),
          status: 'strength',
          message: `Your ${pillar} score (${scores.brandScore}) outperforms the ${category} average (${scores.categoryAvg}) by ${Math.round(diff)} points.`,
        });
      }
    }

    // Sort: biggest gaps first, biggest strengths first
    gaps.sort((a, b) => a.diff - b.diff);
    strengths.sort((a, b) => b.diff - a.diff);

    // 8. Build response
    const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return Response.json({
      brand: {
        name: brand.pageName,
        scores: {
          format: brandCache.formatScore,
          tone: brandCache.toneScore,
          journeyPhase: brandCache.journeyPhaseScore,
          visualStyle: brandCache.visualStyleScore,
          messenger: brandCache.messengerScore,
          overall: brandCache.overallScore,
        },
        andromedaScore: brandCache.andromedaScore,
        metrics: {
          avgRefreshRate: brandCache.avgRefreshRate,
          stalePercentage: brandCache.stalePercentage,
          hookQualityAvg: brandCache.hookQualityAvg,
          uniqueConcepts: brandCache.uniqueConcepts,
          uniqueCtas: brandCache.uniqueCtas,
          funnelAwareness: brandCache.funnelAwareness,
          funnelConsideration: brandCache.funnelConsideration,
          funnelConversion: brandCache.funnelConversion,
        },
      },
      category: {
        name: category,
        slug: categorySlug,
        totalBrands: totalBrandsInCategory,
        analyzedBrands: categoryAnalyses.length,
        avgScores,
        avgAndromedaScore,
        avgMetrics,
      },
      indexing,
      gaps,
      strengths,
      analyzedAt: brandCache.analyzedAt.toISOString(),
    });
  } catch (error) {
    console.error('Benchmark analysis error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Benchmark analysis failed' },
      { status: 500 }
    );
  }
}
