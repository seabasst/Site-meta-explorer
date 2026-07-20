import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rankAds, pickBestCopy } from '@/lib/discover/ranking';

export const dynamic = 'force-dynamic';

const AD_SELECT = {
  id: true,
  adId: true,
  displayFormat: true,
  body: true,
  title: true,
  caption: true,
  ctaText: true,
  snapshotUrl: true,
  startDate: true,
  isActive: true,
  adDurationDays: true,
  reachEstimate: true,
  assets: {
    select: {
      id: true,
      assetType: true,
      storedUrl: true,
      thumbnailUrl: true,
      position: true,
      downloadStatus: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!pageId) {
    return Response.json({ error: 'pageId is required' }, { status: 400 });
  }

  try {
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        profilePicUrl: true,
        country: true,
        category: true,
        website: true,
        activeAdCount: true,
      },
    });

    if (!brand) {
      return Response.json({ error: 'Brand not found' }, { status: 404 });
    }

    const [totalAds, reachAgg, formatBreakdown, candidateAds, partnerships, ownCache] = await Promise.all([
      prisma.adLibraryAd.count({ where: { brandId: brand.id } }),
      prisma.adLibraryAd.aggregate({ where: { brandId: brand.id }, _sum: { reachEstimate: true } }),
      prisma.adLibraryAd.groupBy({
        by: ['displayFormat'],
        where: { brandId: brand.id },
        _count: { _all: true },
      }),
      prisma.adLibraryAd.findMany({
        where: { brandId: brand.id },
        select: { ...AD_SELECT, brand: { select: { pageId: true, pageName: true, profilePicUrl: true } } },
        orderBy: { reachEstimate: { sort: 'desc', nulls: 'last' } },
        take: 100,
      }),
      prisma.creatorPartnership.findMany({
        where: { brandId: brand.id },
        select: {
          id: true,
          adCount: true,
          totalReach: true,
          mediaUrls: true,
          mediaTypes: true,
          creator: { select: { pageId: true, pageName: true, tier: true, creatorType: true } },
        },
        orderBy: { totalReach: 'desc' },
        take: 10,
      }),
      prisma.brandAnalysisCache.findUnique({
        where: { brandId: brand.id },
        select: { andromedaScore: true, overallScore: true, totalAdsAnalyzed: true, analyzedAt: true },
      }),
    ]);

    const activeAds = await prisma.adLibraryAd.count({ where: { brandId: brand.id, isActive: true } });

    let categoryPeerAverage: number | null = null;
    if (brand.category && ownCache) {
      const peers = await prisma.brandAnalysisCache.findMany({
        where: { brand: { category: brand.category }, brandId: { not: brand.id } },
        select: { andromedaScore: true },
      });
      if (peers.length > 0) {
        categoryPeerAverage = Math.round(
          peers.reduce((sum, p) => sum + p.andromedaScore, 0) / peers.length,
        );
      }
    }

    const ranked = rankAds(candidateAds);
    const topAds = ranked.slice(0, 12);
    const bestCopy = pickBestCopy(ranked, 8);

    return Response.json({
      brand,
      stats: {
        totalAds,
        activeAds,
        estimatedTotalReach: reachAgg._sum.reachEstimate ?? 0,
        formatBreakdown: formatBreakdown.map((f) => ({ format: f.displayFormat, count: f._count._all })),
      },
      topAds,
      bestCopy,
      creatorPartnerships: partnerships.map((p) => ({
        id: p.id,
        adCount: p.adCount,
        totalReach: p.totalReach,
        thumbnailUrl: p.mediaUrls.find((_, i) => p.mediaTypes[i] === 'image') ?? p.mediaUrls[0] ?? null,
        creator: p.creator,
      })),
      categoryBenchmark: ownCache
        ? {
            andromedaScore: ownCache.andromedaScore,
            overallScore: ownCache.overallScore,
            totalAdsAnalyzed: ownCache.totalAdsAnalyzed,
            analyzedAt: ownCache.analyzedAt,
            categoryPeerAverage,
          }
        : null,
    });
  } catch (error) {
    console.error('Discover brand error:', error);
    return Response.json({ error: 'Failed to load brand analysis' }, { status: 500 });
  }
}
