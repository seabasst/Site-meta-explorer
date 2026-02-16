import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RegionData {
  region: string;
  percentage: string | number;
}

interface ReachByCountry {
  country: string;
  reach: number;
  adCount: number;
}

interface ReachByMonth {
  month: string;
  reach: number;
  adCount: number;
}

/**
 * GET /api/ad-library/analytics
 *
 * Returns aggregated analytics:
 * - Reach by country/region
 * - Reach by month
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const pageId = searchParams.get('pageId');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (brandId) {
      where.brandId = brandId;
    } else if (pageId) {
      where.brand = { pageId };
    }

    // Fetch ads with targeting data and dates
    const ads = await prisma.adLibraryAd.findMany({
      where,
      select: {
        id: true,
        reachEstimate: true,
        startDate: true,
        targetingJson: true,
      },
    });

    // Aggregate reach by region/country
    const regionReach: Record<string, { reach: number; adCount: number }> = {};

    for (const ad of ads) {
      const reach = ad.reachEstimate || 0;
      const targeting = ad.targetingJson as { deliveryByRegion?: RegionData[] } | null;
      const regions = targeting?.deliveryByRegion || [];

      for (const region of regions) {
        const percentage = typeof region.percentage === 'string'
          ? parseFloat(region.percentage)
          : region.percentage;

        const regionReachValue = Math.round(reach * percentage);
        const regionName = region.region || 'Unknown';

        if (!regionReach[regionName]) {
          regionReach[regionName] = { reach: 0, adCount: 0 };
        }
        regionReach[regionName].reach += regionReachValue;
        regionReach[regionName].adCount += 1;
      }
    }

    // Convert to sorted array
    const reachByCountry: ReachByCountry[] = Object.entries(regionReach)
      .map(([country, data]) => ({
        country,
        reach: data.reach,
        adCount: data.adCount,
      }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 20); // Top 20 regions

    // Aggregate reach by month
    const monthReach: Record<string, { reach: number; adCount: number }> = {};

    for (const ad of ads) {
      if (!ad.startDate) continue;

      const date = new Date(ad.startDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthReach[monthKey]) {
        monthReach[monthKey] = { reach: 0, adCount: 0 };
      }
      monthReach[monthKey].reach += ad.reachEstimate || 0;
      monthReach[monthKey].adCount += 1;
    }

    // Convert to sorted array (chronological)
    const reachByMonth: ReachByMonth[] = Object.entries(monthReach)
      .map(([month, data]) => ({
        month,
        reach: data.reach,
        adCount: data.adCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Summary stats
    const totalReach = ads.reduce((sum, ad) => sum + (ad.reachEstimate || 0), 0);
    const totalAds = ads.length;

    return NextResponse.json({
      reachByCountry,
      reachByMonth,
      summary: {
        totalReach,
        totalAds,
        countriesTracked: reachByCountry.length,
        monthsTracked: reachByMonth.length,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
