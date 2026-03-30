import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/feed
 * Returns personalized dashboard data based on user's monitored brands.
 * Falls back to global stats if unauthenticated or no monitored brands.
 */
export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email;

  let userId: string | null = null;
  let monitoredBrandIds: string[] = [];

  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user) {
      userId = user.id;
      const monitored = await prisma.monitoredBrand.findMany({
        where: { userId: user.id },
        select: { brandId: true },
      });
      monitoredBrandIds = monitored.map((m: { brandId: string }) => m.brandId);
    }
  }

  const hasMonitored = monitoredBrandIds.length > 0;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    kpiData,
    kpiPrevData,
    activityFeed,
    topAds,
    creatorSpotlight,
    industryTrends,
    monitoredBrands,
  ] = await Promise.all([
    // KPI: current period (last 7 days) for monitored brands
    getKpiData(monitoredBrandIds, sevenDaysAgo, now),
    // KPI: previous period (7-14 days ago) for trend calculation
    getKpiData(monitoredBrandIds, fourteenDaysAgo, sevenDaysAgo),
    // Activity feed: recent ads from monitored brands
    getActivityFeed(monitoredBrandIds),
    // Top ads by reach from monitored brands
    getTopAds(monitoredBrandIds),
    // Creator spotlight: top creators partnering with monitored brands
    getCreatorSpotlight(monitoredBrandIds),
    // Industry trends: category-level metrics
    getIndustryTrends(monitoredBrandIds),
    // Monitored brands with basic info
    getMonitoredBrandsInfo(monitoredBrandIds),
  ]);

  // Calculate trends
  const kpis = {
    newAds: kpiData.newAds,
    newAdsTrend: calcTrend(kpiData.newAds, kpiPrevData.newAds),
    activeAds: kpiData.activeAds,
    activeAdsTrend: calcTrend(kpiData.activeAds, kpiPrevData.activeAds),
    totalReach: kpiData.totalReach,
    totalReachTrend: calcTrend(kpiData.totalReach, kpiPrevData.totalReach),
    brandCount: monitoredBrandIds.length,
  };

  return NextResponse.json({
    authenticated: !!userId,
    hasMonitored,
    kpis,
    activityFeed,
    topAds,
    creatorSpotlight,
    industryTrends,
    monitoredBrands,
  });
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function getKpiData(brandIds: string[], from: Date, to: Date) {
  if (brandIds.length === 0) {
    // Global fallback
    const [newAds, activeAds, totalReachResult] = await Promise.all([
      prisma.adLibraryAd.count({
        where: { startDate: { gte: from, lte: to } },
      }),
      prisma.adLibraryAd.count({ where: { isActive: true } }),
      prisma.adLibraryAd.aggregate({
        _sum: { reachEstimate: true },
        where: { startDate: { gte: from, lte: to } },
      }),
    ]);
    return {
      newAds,
      activeAds,
      totalReach: totalReachResult._sum.reachEstimate || 0,
    };
  }

  const [newAds, activeAds, totalReachResult] = await Promise.all([
    prisma.adLibraryAd.count({
      where: { brandId: { in: brandIds }, startDate: { gte: from, lte: to } },
    }),
    prisma.adLibraryAd.count({
      where: { brandId: { in: brandIds }, isActive: true },
    }),
    prisma.adLibraryAd.aggregate({
      _sum: { reachEstimate: true },
      where: { brandId: { in: brandIds }, startDate: { gte: from, lte: to } },
    }),
  ]);

  return {
    newAds,
    activeAds,
    totalReach: totalReachResult._sum.reachEstimate || 0,
  };
}

async function getActivityFeed(brandIds: string[]) {
  const where = brandIds.length > 0
    ? { brandId: { in: brandIds } }
    : {};

  const recentAds = await prisma.adLibraryAd.findMany({
    where: { ...where, startDate: { not: null } },
    orderBy: { startDate: 'desc' },
    take: 20,
    select: {
      id: true,
      adId: true,
      displayFormat: true,
      body: true,
      title: true,
      startDate: true,
      isActive: true,
      reachEstimate: true,
      brand: {
        select: {
          id: true,
          pageName: true,
          pageId: true,
          profilePicUrl: true,
          category: true,
        },
      },
    },
  });

  return recentAds.map((ad) => ({
    id: ad.id,
    adId: ad.adId,
    format: ad.displayFormat,
    body: ad.body ? ad.body.slice(0, 120) : null,
    title: ad.title,
    startDate: ad.startDate,
    isActive: ad.isActive,
    reach: ad.reachEstimate,
    brand: {
      id: ad.brand.id,
      name: ad.brand.pageName,
      pageId: ad.brand.pageId,
      profilePic: ad.brand.profilePicUrl,
      category: ad.brand.category,
    },
  }));
}

async function getTopAds(brandIds: string[]) {
  const where = brandIds.length > 0
    ? { brandId: { in: brandIds }, isActive: true }
    : { isActive: true };

  const ads = await prisma.adLibraryAd.findMany({
    where,
    orderBy: { reachEstimate: 'desc' },
    take: 6,
    select: {
      id: true,
      adId: true,
      displayFormat: true,
      body: true,
      title: true,
      startDate: true,
      reachEstimate: true,
      snapshotUrl: true,
      assets: {
        where: { storedUrl: { not: null } },
        orderBy: { position: 'asc' },
        take: 1,
        select: { storedUrl: true, assetType: true },
      },
      brand: {
        select: {
          id: true,
          pageName: true,
          pageId: true,
          profilePicUrl: true,
        },
      },
    },
  });

  return ads.map((ad) => {
    const asset = ad.assets[0];
    return {
      id: ad.id,
      adId: ad.adId,
      format: ad.displayFormat,
      body: ad.body ? ad.body.slice(0, 200) : null,
      title: ad.title,
      startDate: ad.startDate,
      reach: ad.reachEstimate,
      snapshotUrl: ad.snapshotUrl,
      mediaUrl: asset?.storedUrl || null,
      mediaType: asset?.assetType === 'video' ? 'video' : 'image',
      brand: {
        id: ad.brand.id,
        name: ad.brand.pageName,
        pageId: ad.brand.pageId,
        profilePic: ad.brand.profilePicUrl,
      },
    };
  });
}

async function getCreatorSpotlight(brandIds: string[]) {
  const where = brandIds.length > 0
    ? { partnerships: { some: { brandId: { in: brandIds } } } }
    : {};

  const creators = await prisma.adCreator.findMany({
    where,
    orderBy: { score: 'desc' },
    take: 5,
    select: {
      id: true,
      pageId: true,
      pageName: true,
      totalAds: true,
      brandCount: true,
      tier: true,
      score: true,
      creatorType: true,
      partnerships: {
        take: 3,
        orderBy: { adCount: 'desc' },
        select: {
          adCount: true,
          mediaUrls: true,
          brand: {
            select: { pageName: true, pageId: true, profilePicUrl: true },
          },
        },
      },
    },
  });

  return creators.map((c) => ({
    id: c.id,
    pageId: c.pageId,
    name: c.pageName,
    totalAds: c.totalAds,
    brandCount: c.brandCount,
    tier: c.tier,
    score: c.score,
    type: c.creatorType,
    topBrands: c.partnerships.map((p) => ({
      name: p.brand.pageName,
      pageId: p.brand.pageId,
      profilePic: p.brand.profilePicUrl,
      adCount: p.adCount,
      sampleMedia: p.mediaUrls[0] || null,
    })),
  }));
}

async function getIndustryTrends(brandIds: string[]) {
  // Get category breakdown of monitored brands or all brands
  const where = brandIds.length > 0
    ? { id: { in: brandIds } }
    : {};

  const brands = await prisma.adLibraryBrand.findMany({
    where,
    select: {
      category: true,
      activeAdCount: true,
      totalReach: true,
    },
  });

  const categoryMap = new Map<string, { brands: number; activeAds: number; totalReach: number }>();
  for (const b of brands) {
    const cat = b.category || 'other';
    const entry = categoryMap.get(cat) || { brands: 0, activeAds: 0, totalReach: 0 };
    entry.brands++;
    entry.activeAds += b.activeAdCount || 0;
    entry.totalReach += Number(b.totalReach || 0);
    categoryMap.set(cat, entry);
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.activeAds - a.activeAds)
    .slice(0, 8);
}

async function getMonitoredBrandsInfo(brandIds: string[]) {
  if (brandIds.length === 0) return [];

  const brands = await prisma.adLibraryBrand.findMany({
    where: { id: { in: brandIds } },
    select: {
      id: true,
      pageId: true,
      pageName: true,
      profilePicUrl: true,
      category: true,
      activeAdCount: true,
      totalReach: true,
    },
  });

  return brands.map((b) => ({
    id: b.id,
    pageId: b.pageId,
    name: b.pageName,
    profilePic: b.profilePicUrl,
    category: b.category,
    activeAds: b.activeAdCount || 0,
    totalReach: Number(b.totalReach || 0),
  }));
}
