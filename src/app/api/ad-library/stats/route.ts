import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Simple In-Memory Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// =============================================================================
// Types
// =============================================================================

interface BrandStatusCount {
  status: string;
  count: number;
}

interface AdFormatCount {
  format: string;
  count: number;
}

interface AdPlatformCount {
  platform: string;
  count: number;
}

interface IngestionJobSummary {
  id: string;
  brandId: string;
  brandName: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  assetsQueued: number;
  assetsDownloaded: number;
  assetsFailed: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface TopBrand {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  adCount: number;
  activeAdCount: number;
  totalReach: string;
}

interface AdsByDatePoint {
  date: string;
  count: number;
  activeCount: number;
}

interface AdLibraryStats {
  // Brand statistics
  totalBrands: number;
  brandsByStatus: BrandStatusCount[];

  // Ad statistics
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  adsByFormat: AdFormatCount[];
  adsByPlatform: AdPlatformCount[];

  // Reach statistics
  totalReach: string;
  avgReachPerAd: number;

  // Ingestion statistics
  recentJobs: IngestionJobSummary[];
  jobStats: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
  };

  // Top brands
  topBrandsByAdCount: TopBrand[];

  // Time series
  adsByDate: AdsByDatePoint[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Serialize BigInt values to strings for JSON response
 */
function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

/**
 * Parse date range from query params
 */
function parseDateRange(
  startDate: string | null,
  endDate: string | null
): { start?: Date; end?: Date } {
  const result: { start?: Date; end?: Date } = {};

  if (startDate) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) {
      result.start = parsed;
    }
  }

  if (endDate) {
    const parsed = new Date(endDate);
    if (!isNaN(parsed.getTime())) {
      result.end = parsed;
    }
  }

  return result;
}

// =============================================================================
// GET Handler
// =============================================================================

/**
 * GET /api/ad-library/stats
 *
 * Returns aggregated statistics for the Ad Library pipeline.
 *
 * Query Parameters:
 * - brandId: Filter stats for a single brand (optional)
 * - startDate: ISO date string for date range filter (optional)
 * - endDate: ISO date string for date range filter (optional)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const fastMode = searchParams.get('fast') === 'true';
    const { start: startDate, end: endDate } = parseDateRange(
      searchParams.get('startDate'),
      searchParams.get('endDate')
    );

    // Check cache first
    const cacheKey = `stats:${fastMode ? 'fast' : 'full'}:${brandId || 'all'}:${startDate?.toISOString() || ''}:${endDate?.toISOString() || ''}`;
    const cached = getCached<AdLibraryStats>(cacheKey);
    if (cached) {
      return NextResponse.json(serializeBigInt(cached));
    }

    // Build date filter for ads
    const dateFilter: { startDate?: { gte?: Date; lte?: Date } } = {};
    if (startDate || endDate) {
      dateFilter.startDate = {};
      if (startDate) dateFilter.startDate.gte = startDate;
      if (endDate) dateFilter.startDate.lte = endDate;
    }

    // Build brand filter
    const brandFilter = brandId ? { brandId } : {};

    // ==========================================================================
    // Brand Statistics
    // ==========================================================================

    const [totalBrands, brandsByStatusRaw] = await Promise.all([
      brandId
        ? prisma.adLibraryBrand.count({ where: { id: brandId } })
        : prisma.adLibraryBrand.count(),
      prisma.adLibraryBrand.groupBy({
        by: ['ingestionStatus'],
        _count: { id: true },
        ...(brandId ? { where: { id: brandId } } : {}),
      }),
    ]);

    const brandsByStatus: BrandStatusCount[] = brandsByStatusRaw.map((row) => ({
      status: row.ingestionStatus,
      count: row._count.id,
    }));

    // ==========================================================================
    // Ad Statistics
    // ==========================================================================

    const adWhereClause = { ...brandFilter, ...dateFilter };

    const [
      totalAds,
      activeAds,
      adsByFormatRaw,
    ] = await Promise.all([
      prisma.adLibraryAd.count({ where: adWhereClause }),
      prisma.adLibraryAd.count({ where: { ...adWhereClause, isActive: true } }),
      prisma.adLibraryAd.groupBy({
        by: ['displayFormat'],
        _count: { id: true },
        where: adWhereClause,
      }),
    ]);

    const inactiveAds = totalAds - activeAds;

    const adsByFormat: AdFormatCount[] = adsByFormatRaw.map((row) => ({
      format: row.displayFormat || 'unknown',
      count: row._count.id,
    }));

    // Platform breakdown - skip in fast mode (too slow)
    let adsByPlatform: AdPlatformCount[] = [];
    if (!fastMode) {
      const adsWithPlatforms = await prisma.adLibraryAd.findMany({
        where: adWhereClause,
        select: { publisherPlatforms: true },
        take: 10000,
      });

      const platformCounts: Record<string, number> = {};
      for (const ad of adsWithPlatforms) {
        for (const platform of ad.publisherPlatforms) {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        }
      }

      adsByPlatform = Object.entries(platformCounts)
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count);
    }

    // ==========================================================================
    // Reach Statistics - skip in fast mode
    // ==========================================================================

    let totalReach = BigInt(0);
    let avgReachPerAd = 0;
    if (!fastMode) {
      const reachAggregation = await prisma.adLibraryAd.aggregate({
        where: adWhereClause,
        _sum: { reachEstimate: true },
        _avg: { reachEstimate: true },
      });

      totalReach = BigInt(reachAggregation._sum.reachEstimate || 0);
      avgReachPerAd = reachAggregation._avg.reachEstimate || 0;
    }

    // ==========================================================================
    // Ingestion Job Statistics - skip in fast mode
    // ==========================================================================

    let recentJobs: IngestionJobSummary[] = [];
    const jobStats = {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      queued: 0,
    };

    if (!fastMode) {
      const jobWhereClause = brandId ? { brandId } : {};

      const [recentJobsRaw, jobStatusCounts] = await Promise.all([
        prisma.ingestionJob.findMany({
          where: jobWhereClause,
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            brand: {
              select: { pageName: true },
            },
          },
        }),
        prisma.ingestionJob.groupBy({
          by: ['status'],
          _count: { id: true },
          where: jobWhereClause,
        }),
      ]);

      recentJobs = recentJobsRaw.map((job) => ({
        id: job.id,
        brandId: job.brandId,
        brandName: job.brand.pageName,
        jobType: job.jobType,
        status: job.status,
        adsFetched: job.adsFetched,
        adsCreated: job.adsCreated,
        adsUpdated: job.adsUpdated,
        assetsQueued: job.assetsQueued,
        assetsDownloaded: job.assetsDownloaded,
        assetsFailed: job.assetsFailed,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        createdAt: job.createdAt.toISOString(),
      }));

      for (const row of jobStatusCounts) {
        jobStats.total += row._count.id;
        switch (row.status) {
          case 'completed':
            jobStats.completed = row._count.id;
            break;
          case 'failed':
            jobStats.failed = row._count.id;
            break;
          case 'running':
            jobStats.running = row._count.id;
            break;
          case 'queued':
            jobStats.queued = row._count.id;
            break;
        }
      }
    }

    // ==========================================================================
    // Top Brands by Ad Count - skip in fast mode
    // ==========================================================================

    let topBrandsByAdCount: TopBrand[] = [];
    if (!fastMode) {
      const topBrandsRaw = await prisma.adLibraryBrand.findMany({
        where: brandId ? { id: brandId } : {},
        orderBy: { activeAdCount: 'desc' },
        take: 10,
        select: {
          id: true,
          pageId: true,
          pageName: true,
          category: true,
          totalReach: true,
          activeAdCount: true,
          _count: {
            select: { ads: true },
          },
        },
      });

      topBrandsByAdCount = topBrandsRaw.map((brand) => ({
        id: brand.id,
        pageId: brand.pageId,
        pageName: brand.pageName,
        category: brand.category,
        adCount: brand._count.ads,
        activeAdCount: brand.activeAdCount,
        totalReach: brand.totalReach.toString(),
      }));
    }

    // ==========================================================================
    // Ads by Date (for trend charts) - skip in fast mode
    // ==========================================================================

    let adsByDate: AdsByDatePoint[] = [];
    if (!fastMode) {
      // Get ads grouped by start date for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Limit to 20000 ads to prevent memory issues - sufficient for trend visualization
      const adsWithDates = await prisma.adLibraryAd.findMany({
        where: {
          ...brandFilter,
          startDate: {
            gte: startDate || thirtyDaysAgo,
            ...(endDate ? { lte: endDate } : {}),
          },
        },
        select: {
          startDate: true,
          isActive: true,
        },
        orderBy: { startDate: 'desc' },
        take: 20000,
      });

      // Aggregate by date
      const dateMap: Record<string, { count: number; activeCount: number }> = {};

      for (const ad of adsWithDates) {
        if (ad.startDate) {
          const dateKey = ad.startDate.toISOString().split('T')[0];
          if (!dateMap[dateKey]) {
            dateMap[dateKey] = { count: 0, activeCount: 0 };
          }
          dateMap[dateKey].count++;
          if (ad.isActive) {
            dateMap[dateKey].activeCount++;
          }
        }
      }

      adsByDate = Object.entries(dateMap)
        .map(([date, stats]) => ({
          date,
          count: stats.count,
          activeCount: stats.activeCount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // ==========================================================================
    // Build Response
    // ==========================================================================

    const stats: AdLibraryStats = {
      totalBrands,
      brandsByStatus,
      totalAds,
      activeAds,
      inactiveAds,
      adsByFormat,
      adsByPlatform,
      totalReach: totalReach.toString(),
      avgReachPerAd,
      recentJobs,
      jobStats,
      topBrandsByAdCount,
      adsByDate,
    };

    // Cache the result
    setCache(cacheKey, stats);

    return NextResponse.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Ad Library stats error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
      },
      { status: 500 }
    );
  }
}
