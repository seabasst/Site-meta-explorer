import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { TAXONOMY, CATEGORY_KEYS, type CategoryKey } from '@/lib/classification/taxonomy';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryDistribution = Record<CategoryKey, Record<string, number>>;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { pageId, pageName, category } = await request.json();

    if (!pageId) {
      return Response.json({ error: 'pageId required' }, { status: 400 });
    }

    // Find or create brand (handles brands discovered via Facebook API search)
    let brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand && pageName) {
      brand = await prisma.adLibraryBrand.create({
        data: {
          pageId,
          pageName,
          category: category || null,
          ingestionStatus: 'pending',
        },
        select: { id: true, pageName: true, category: true },
      });
    }

    if (!brand) {
      return Response.json({ error: 'Brand not found in database. Try searching again.' }, { status: 404 });
    }

    // Fetch all active ads
    const ads = await prisma.adLibraryAd.findMany({
      where: { brandId: brand.id, isActive: true },
      select: {
        id: true,
        adId: true,
        body: true,
        title: true,
        displayFormat: true,
        ctaType: true,
        ctaText: true,
        linkUrl: true,
        startDate: true,
        publisherPlatforms: true,
      },
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    if (ads.length === 0) {
      return Response.json({ error: 'No active ads found for this brand' }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // Read stored classifications from AdClassification table
    // -----------------------------------------------------------------------

    const adDbIds = ads.map((a) => a.id);
    const classifications = await prisma.adClassification.findMany({
      where: { adId: { in: adDbIds } },
    });

    if (classifications.length < 3) {
      return Response.json({
        error: `Only ${classifications.length} of ${ads.length} ads are classified. Run classification first (need at least 3).`,
        classifiedCount: classifications.length,
        totalAds: ads.length,
        needsClassification: true,
        brandId: brand.id,
      }, { status: 422 });
    }

    // -----------------------------------------------------------------------
    // Local metrics (no AI needed)
    // -----------------------------------------------------------------------

    const now = new Date();
    const threeWeeksMs = 21 * 24 * 60 * 60 * 1000;

    // Ad Fatigue
    const staleAds = ads.filter(
      (a) => a.startDate && now.getTime() - a.startDate.getTime() > threeWeeksMs
    );
    const oldestAdDays = ads.reduce((max, a) => {
      if (!a.startDate) return max;
      const days = Math.floor((now.getTime() - a.startDate.getTime()) / (24 * 60 * 60 * 1000));
      return Math.max(max, days);
    }, 0);
    const stalePercentage = Math.round((staleAds.length / ads.length) * 100);

    // Creative Volume & Refresh Rate (weekly bins from startDate)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const weeklyBins: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(eightWeeksAgo);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const key = weekStart.toISOString().split('T')[0];
      weeklyBins[key] = 0;
    }
    for (const ad of ads) {
      if (!ad.startDate || ad.startDate < eightWeeksAgo) continue;
      // Find which week bin
      const daysSinceStart = Math.floor(
        (ad.startDate.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const binIndex = Math.min(daysSinceStart, 7);
      const binKey = Object.keys(weeklyBins)[binIndex];
      if (binKey) weeklyBins[binKey]++;
    }
    const weeklyNewAds = Object.entries(weeklyBins).map(([week, count]) => ({ week, count }));
    const totalWeeksWithAds = weeklyNewAds.filter((w) => w.count > 0).length;
    const avgRefreshRate =
      totalWeeksWithAds > 0
        ? Math.round(
            (weeklyNewAds.reduce((s, w) => s + w.count, 0) / Math.max(totalWeeksWithAds, 1)) * 10
          ) / 10
        : 0;

    // CTA Diversity
    const ctaCounts: Record<string, number> = {};
    for (const ad of ads) {
      const cta = ad.ctaType || ad.ctaText || 'none';
      ctaCounts[cta] = (ctaCounts[cta] || 0) + 1;
    }
    const uniqueCtas = Object.keys(ctaCounts).filter((k) => k !== 'none').length;

    // Copy Length Distribution (use full body length, not truncated)
    let copyShort = 0,
      copyMedium = 0,
      copyLong = 0;
    for (const ad of ads) {
      const len = (ad.body || '').length;
      if (len < 50) copyShort++;
      else if (len <= 200) copyMedium++;
      else copyLong++;
    }

    // -----------------------------------------------------------------------
    // Build 8-category distribution from DB classifications
    // -----------------------------------------------------------------------

    const distribution: CategoryDistribution = {
      assetType: {},
      visualFormat: {},
      hookTactic: {},
      messagingAngle: {},
      awarenessStage: {},
      creativeMechanic: {},
      offerType: {},
      intendedAudience: {},
    };

    for (const c of classifications) {
      for (const key of CATEGORY_KEYS) {
        const value = c[key];
        if (value) {
          distribution[key][value] = (distribution[key][value] || 0) + 1;
        }
      }
    }

    // Diversity scores (Shannon entropy normalized)
    const calcDiversityScore = (counts: Record<string, number>, maxCategories: number): number => {
      const values = Object.values(counts);
      if (values.length <= 1) return 0;
      const total = values.reduce((s, v) => s + v, 0);
      let entropy = 0;
      for (const v of values) {
        if (v > 0) {
          const p = v / total;
          entropy -= p * Math.log2(p);
        }
      }
      const maxEntropy = Math.log2(maxCategories);
      return Math.round((entropy / maxEntropy) * 100);
    };

    const diversityScores: Record<CategoryKey | 'overall', number> = {} as Record<CategoryKey | 'overall', number>;
    for (const key of CATEGORY_KEYS) {
      const maxCats = TAXONOMY[key].values.length;
      diversityScores[key] = calcDiversityScore(distribution[key], maxCats);
    }
    diversityScores.overall = Math.round(
      CATEGORY_KEYS.reduce((sum, k) => sum + diversityScores[k], 0) / CATEGORY_KEYS.length
    );

    // -----------------------------------------------------------------------
    // Compute metrics from stored classifications
    // -----------------------------------------------------------------------

    // Hook Quality
    const hookScores = classifications.map((c) => {
      const ad = ads.find((a) => a.id === c.adId);
      const firstLine = (ad?.body || '').split(/[.\n!?]/)[0]?.trim() || '';
      return { adId: c.adId, score: c.hookScore || 3, firstLine };
    });
    const avgHookScore =
      hookScores.length > 0
        ? Math.round((hookScores.reduce((s, h) => s + h.score, 0) / hookScores.length) * 10) / 10
        : 0;
    const hookDistribution = { weak: 0, average: 0, strong: 0 };
    for (const h of hookScores) {
      if (h.score <= 3) hookDistribution.weak++;
      else if (h.score <= 6) hookDistribution.average++;
      else hookDistribution.strong++;
    }
    const topHooks = [...hookScores].sort((a, b) => b.score - a.score).slice(0, 3);
    const bottomHooks = [...hookScores].sort((a, b) => a.score - b.score).slice(0, 3);

    // Concept Diversity / Creative Similarity
    const clusterCounts: Record<string, { count: number; adIds: string[] }> = {};
    for (const c of classifications) {
      const cluster = c.conceptCluster || 'uncategorized';
      if (!clusterCounts[cluster]) clusterCounts[cluster] = { count: 0, adIds: [] };
      clusterCounts[cluster].count++;
      clusterCounts[cluster].adIds.push(c.adId);
    }
    const clusters = Object.entries(clusterCounts)
      .map(([concept, data]) => ({ concept, ...data }))
      .sort((a, b) => b.count - a.count);
    const dominantCluster = clusters[0];
    const dominantPercentage = dominantCluster
      ? Math.round((dominantCluster.count / classifications.length) * 100)
      : 0;
    const redundancyFlag = dominantPercentage > 60;

    // Funnel Balance (map 5 Schwartz awareness stages to 3 funnel buckets)
    const funnelMap: Record<string, 'awareness' | 'consideration' | 'conversion'> = {
      'unaware': 'awareness',
      'problem-aware': 'awareness',
      'solution-aware': 'consideration',
      'product-aware': 'consideration',
      'most-aware': 'conversion',
    };
    let awarenessCount = 0, considerationCount = 0, conversionCount = 0;
    for (const c of classifications) {
      const bucket = funnelMap[c.awarenessStage] || 'awareness';
      if (bucket === 'awareness') awarenessCount++;
      else if (bucket === 'consideration') considerationCount++;
      else conversionCount++;
    }
    const total = classifications.length;
    const awarenessRatio = total > 0 ? awarenessCount / total : 0;
    const considerationRatio = total > 0 ? considerationCount / total : 0;
    const conversionRatio = total > 0 ? conversionCount / total : 0;
    // Ideal ~40/30/30, compute deviation (0 = perfect, 1 = terrible)
    const funnelDeviation =
      Math.abs(awarenessRatio - 0.4) + Math.abs(considerationRatio - 0.3) + Math.abs(conversionRatio - 0.3);

    // Status helpers
    const refreshStatus = avgRefreshRate >= 3 ? 'healthy' : avgRefreshRate >= 1 ? 'warning' : 'critical';
    const fatigueStatus = stalePercentage < 30 ? 'healthy' : stalePercentage < 60 ? 'warning' : 'critical';
    const funnelStatus = funnelDeviation < 0.3 ? 'healthy' : funnelDeviation < 0.6 ? 'warning' : 'critical';
    const ctaStatus = uniqueCtas >= 3 ? 'healthy' : uniqueCtas >= 2 ? 'warning' : 'critical';
    const copyStatus =
      copyShort > 0 && copyMedium > 0 && copyLong > 0
        ? 'healthy'
        : (copyShort > 0 ? 1 : 0) + (copyMedium > 0 ? 1 : 0) + (copyLong > 0 ? 1 : 0) >= 2
          ? 'warning'
          : 'critical';

    const andromedaMetrics = {
      creativeVolume: {
        totalActive: ads.length,
        weeklyNewAds,
        avgRefreshRate,
        status: refreshStatus,
      },
      adFatigue: {
        staleAds: staleAds.length,
        stalePercentage,
        oldestAdDays,
        status: fatigueStatus,
      },
      funnelBalance: {
        awareness: Math.round(awarenessRatio * 100),
        consideration: Math.round(considerationRatio * 100),
        conversion: Math.round(conversionRatio * 100),
        idealDeviation: Math.round(funnelDeviation * 100),
        status: funnelStatus,
      },
      hookQuality: {
        avgScore: avgHookScore,
        distribution: hookDistribution,
        topHooks,
        bottomHooks,
      },
      ctaDiversity: {
        uniqueCtas,
        totalAds: ads.length,
        ratio: Math.round((uniqueCtas / Math.max(ads.length, 1)) * 100),
        distribution: ctaCounts,
        status: ctaStatus,
      },
      copyLength: {
        short: copyShort,
        medium: copyMedium,
        long: copyLong,
        status: copyStatus,
      },
      conceptDiversity: {
        uniqueConcepts: clusters.length,
        totalAds: classifications.length,
        ratio: Math.round((clusters.length / Math.max(classifications.length, 1)) * 100),
        clusters: clusters.slice(0, 10),
        redundancyFlag,
        dominantConcept: dominantCluster?.concept || null,
        dominantPercentage,
      },
    };

    // -----------------------------------------------------------------------
    // Claude Call: Recommendations (with 8-category taxonomy context)
    // -----------------------------------------------------------------------

    const distributionSummary = CATEGORY_KEYS.map((key) => {
      const label = TAXONOMY[key].description;
      return `- ${key} (${label}): ${JSON.stringify(distribution[key])}`;
    }).join('\n');

    const recResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [
        {
          role: 'user',
          content: `You are an expert Meta Ads strategist specializing in Andromeda optimization. Based on this comprehensive creative analysis for "${brand.pageName}", identify gaps and recommend new creatives.

**Creative Taxonomy Distribution — 8 dimensions (${classifications.length} ads analyzed):**
${distributionSummary}

**Diversity Scores (0-100):**
${JSON.stringify(diversityScores, null, 2)}

**Andromeda Metrics:**
- Creative Volume: ${ads.length} active ads, avg ${avgRefreshRate} new/week (last 8 weeks)
- Ad Fatigue: ${stalePercentage}% of ads running 3+ weeks (${staleAds.length}/${ads.length})
- Funnel Balance: ${Math.round(awarenessRatio * 100)}% awareness / ${Math.round(considerationRatio * 100)}% consideration / ${Math.round(conversionRatio * 100)}% conversion
- Hook Quality: avg ${avgHookScore}/10 (${hookDistribution.weak} weak, ${hookDistribution.average} average, ${hookDistribution.strong} strong)
- CTA Diversity: ${uniqueCtas} unique CTAs across ${ads.length} ads
- Copy Length: ${copyShort} short / ${copyMedium} medium / ${copyLong} long
- Concept Diversity: ${clusters.length} unique concepts across ${classifications.length} ads${redundancyFlag ? ` — WARNING: ${dominantPercentage}% clustered in "${dominantCluster?.concept}"` : ''}

**Andromeda Best Practices to evaluate against:**
- Aim for 10-15 unique creative concepts per campaign
- Creative Similarity >60% triggers retrieval suppression
- Refresh every 1-3 weeks to avoid fatigue
- Balance funnel: ~40% awareness, 30% consideration, 30% conversion
- Average hook score should be 6+ for competitive accounts
- Use 3+ different CTA types
- Mix short and long copy for different placements

Generate exactly 7 recommendations. At least 2 should address Andromeda-specific issues (refresh rate, hook quality, concept redundancy, funnel balance, etc.) and the rest should address taxonomy dimension gaps.

Return JSON:
{
  "summary": "2-3 sentence overview of creative health AND Andromeda readiness",
  "biggestGap": "The single most important gap to fill (1 sentence)",
  "andromedaScore": 0-100 score for overall Andromeda best practice compliance,
  "recommendations": [
    {
      "pillar": "assetType | visualFormat | hookTactic | messagingAngle | awarenessStage | creativeMechanic | offerType | intendedAudience | refreshRate | hookQuality | conceptDiversity | funnelBalance | ctaDiversity | copyLength",
      "gap": "what's missing (1 sentence)",
      "suggestion": "what to create (1 sentence)",
      "briefTitle": "creative brief title",
      "briefDescription": "Full creative brief: ad concept, visual direction, copy angle, target audience, platform. 3-5 sentences.",
      "imagePrompt": "Detailed AI image prompt: scene, photography style, lighting, colors, subjects. No text in image. 2-3 sentences.",
      "priority": "high | medium | low"
    }
  ]
}

Return ONLY valid JSON, no markdown.`,
        },
      ],
    });

    const recText = recResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const recJson = recText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recommendations = JSON.parse(recJson);

    // Cache analysis results for category benchmarking
    try {
      await prisma.brandAnalysisCache.upsert({
        where: { brandId: brand.id },
        update: {
          assetTypeScore: diversityScores.assetType,
          visualFormatScore: diversityScores.visualFormat,
          hookTacticScore: diversityScores.hookTactic,
          messagingAngleScore: diversityScores.messagingAngle,
          awarenessStageScore: diversityScores.awarenessStage,
          creativeMechanicScore: diversityScores.creativeMechanic,
          offerTypeScore: diversityScores.offerType,
          intendedAudienceScore: diversityScores.intendedAudience,
          overallScore: diversityScores.overall,
          andromedaScore: recommendations.andromedaScore || 0,
          avgRefreshRate,
          stalePercentage,
          hookQualityAvg: avgHookScore,
          uniqueConcepts: clusters.length,
          uniqueCtas,
          funnelAwareness: Math.round(awarenessRatio * 100),
          funnelConsideration: Math.round(considerationRatio * 100),
          funnelConversion: Math.round(conversionRatio * 100),
          distributionJson: distribution as object,
          totalAdsAnalyzed: classifications.length,
          analyzedAt: new Date(),
        },
        create: {
          brandId: brand.id,
          assetTypeScore: diversityScores.assetType,
          visualFormatScore: diversityScores.visualFormat,
          hookTacticScore: diversityScores.hookTactic,
          messagingAngleScore: diversityScores.messagingAngle,
          awarenessStageScore: diversityScores.awarenessStage,
          creativeMechanicScore: diversityScores.creativeMechanic,
          offerTypeScore: diversityScores.offerType,
          intendedAudienceScore: diversityScores.intendedAudience,
          overallScore: diversityScores.overall,
          andromedaScore: recommendations.andromedaScore || 0,
          avgRefreshRate,
          stalePercentage,
          hookQualityAvg: avgHookScore,
          uniqueConcepts: clusters.length,
          uniqueCtas,
          funnelAwareness: Math.round(awarenessRatio * 100),
          funnelConsideration: Math.round(considerationRatio * 100),
          funnelConversion: Math.round(conversionRatio * 100),
          distributionJson: distribution as object,
          totalAdsAnalyzed: classifications.length,
        },
      });
    } catch (cacheError) {
      console.error('Failed to cache analysis results:', cacheError);
    }

    return Response.json({
      brandName: brand.pageName,
      category: brand.category,
      totalAdsAnalyzed: classifications.length,
      classifiedCount: classifications.length,
      totalAds: ads.length,
      distribution,
      diversityScores,
      andromedaMetrics,
      andromedaScore: recommendations.andromedaScore || 0,
      summary: recommendations.summary,
      biggestGap: recommendations.biggestGap,
      recommendations: recommendations.recommendations,
    });
  } catch (error) {
    console.error('Diversity analysis error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Diversity analysis failed' },
      { status: 500 }
    );
  }
}
