import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rankAds, pickBestCopy } from '@/lib/discover/ranking';
import { resolveCategory } from '@/lib/discover/categories';

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
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 });
  }

  try {
    // Category is free text on AdLibraryBrand — resolve the slug back to
    // every raw string that canonicalizes to it (see lib/discover/categories).
    const distinctCategories = await prisma.adLibraryBrand.findMany({
      where: { category: { not: null } },
      distinct: ['category'],
      select: { category: true },
    });
    const matched = distinctCategories
      .map((c) => c.category as string)
      .filter((c) => resolveCategory(c).slug === slug);

    if (matched.length === 0) {
      return Response.json({ error: 'Category not found' }, { status: 404 });
    }

    const categoryLabel = resolveCategory(matched[0]).label;

    const brands = await prisma.adLibraryBrand.findMany({
      where: { category: { in: matched } },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        profilePicUrl: true,
        country: true,
        activeAdCount: true,
      },
      orderBy: { activeAdCount: 'desc' },
      take: 30,
    });

    const [brandAgg, reachAgg, perBrandReach, candidateAds, partnerships, caches] = await Promise.all([
      prisma.adLibraryBrand.aggregate({
        where: { category: { in: matched } },
        _count: { _all: true },
        _sum: { activeAdCount: true },
      }),
      prisma.adLibraryAd.aggregate({
        where: { brand: { category: { in: matched } } },
        _sum: { reachEstimate: true },
      }),
      prisma.adLibraryAd.groupBy({
        by: ['brandId'],
        where: { brandId: { in: brands.map((b) => b.id) } },
        _sum: { reachEstimate: true },
      }),
      prisma.adLibraryAd.findMany({
        where: { brand: { category: { in: matched } } },
        select: { ...AD_SELECT, brand: { select: { pageId: true, pageName: true, profilePicUrl: true } } },
        orderBy: { reachEstimate: { sort: 'desc', nulls: 'last' } },
        take: 150,
      }),
      prisma.creatorPartnership.findMany({
        where: { brand: { category: { in: matched } } },
        select: {
          id: true,
          adCount: true,
          totalReach: true,
          mediaUrls: true,
          mediaTypes: true,
          creator: { select: { pageId: true, pageName: true, tier: true, creatorType: true } },
          brand: { select: { pageName: true } },
        },
        orderBy: { totalReach: 'desc' },
        take: 10,
      }),
      prisma.brandAnalysisCache.findMany({
        where: { brand: { category: { in: matched } } },
        select: { andromedaScore: true },
      }),
    ]);

    const reachByBrandId = new Map(perBrandReach.map((r) => [r.brandId, r._sum.reachEstimate ?? 0]));

    const ranked = rankAds(candidateAds);
    const topAds = ranked.slice(0, 12);
    const bestCopy = pickBestCopy(ranked, 8);

    return Response.json({
      category: {
        slug,
        label: categoryLabel,
        variants: matched,
      },
      stats: {
        totalBrands: brandAgg._count._all,
        totalActiveAds: brandAgg._sum.activeAdCount ?? 0,
        estimatedTotalReach: reachAgg._sum.reachEstimate ?? 0,
        avgAndromedaScore:
          caches.length > 0
            ? Math.round(caches.reduce((sum, c) => sum + c.andromedaScore, 0) / caches.length)
            : null,
        brandsAnalyzed: caches.length,
      },
      brands: brands.map(({ id, ...b }) => ({ ...b, estimatedReach: reachByBrandId.get(id) ?? 0 })),
      topAds,
      bestCopy,
      creatorPartnerships: partnerships.map((p) => ({
        id: p.id,
        adCount: p.adCount,
        totalReach: p.totalReach,
        thumbnailUrl: p.mediaUrls.find((_, i) => p.mediaTypes[i] === 'image') ?? p.mediaUrls[0] ?? null,
        creator: p.creator,
        brandName: p.brand.pageName,
      })),
    });
  } catch (error) {
    console.error('Discover category error:', error);
    return Response.json({ error: 'Failed to load category analysis' }, { status: 500 });
  }
}
