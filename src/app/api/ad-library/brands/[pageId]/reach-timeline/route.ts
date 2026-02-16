import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Types
// =============================================================================

interface ReachTimelinePoint {
  month: string;
  monthKey: string;
  adsStarted: number;
  totalReach: number;
  activeAds: number;
  inactiveAds: number;
}

interface FormatDistribution {
  format: string;
  count: number;
  reach: number;
  percentage: number;
}

interface ReachTimelineResponse {
  timeline: ReachTimelinePoint[];
  summary: {
    totalAds: number;
    totalReach: number;
    avgReachPerAd: number;
    peakMonth: string;
    peakReach: number;
  };
  formatDistribution: FormatDistribution[];
}

// =============================================================================
// GET /api/ad-library/brands/[pageId]/reach-timeline
// Get reach over time data for a brand's ads by start date
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(req.url);

    // Optional: limit to last N months (default 12)
    const months = Math.min(24, Math.max(1, parseInt(searchParams.get('months') ?? '12', 10)));

    // Find brand by pageId
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Fetch all ads with start dates and format
    const ads = await prisma.adLibraryAd.findMany({
      where: {
        brandId: brand.id,
      },
      select: {
        startDate: true,
        reachEstimate: true,
        isActive: true,
        displayFormat: true,
      },
    });

    // Initialize month map for the last N months
    const now = new Date();
    const monthMap = new Map<string, ReachTimelinePoint>();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      monthMap.set(monthKey, {
        month: monthLabel,
        monthKey,
        adsStarted: 0,
        totalReach: 0,
        activeAds: 0,
        inactiveAds: 0,
      });
    }

    // Aggregate ads by month and format
    let totalReach = 0;
    let totalAds = 0;
    let peakMonth = '';
    let peakReach = 0;
    const formatMap = new Map<string, { count: number; reach: number }>();

    for (const ad of ads) {
      // Track format distribution for all ads
      const format = ad.displayFormat || 'unknown';
      const formatEntry = formatMap.get(format) || { count: 0, reach: 0 };
      formatEntry.count += 1;
      formatEntry.reach += ad.reachEstimate || 0;
      formatMap.set(format, formatEntry);

      // Only track timeline for ads with start dates
      if (!ad.startDate) continue;

      const date = new Date(ad.startDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const entry = monthMap.get(monthKey);
      if (entry) {
        entry.adsStarted += 1;
        entry.totalReach += ad.reachEstimate || 0;

        if (ad.isActive) {
          entry.activeAds += 1;
        } else {
          entry.inactiveAds += 1;
        }

        totalAds += 1;
        totalReach += ad.reachEstimate || 0;
      }
    }

    // Find peak month
    for (const [, entry] of monthMap.entries()) {
      if (entry.totalReach > peakReach) {
        peakReach = entry.totalReach;
        peakMonth = entry.month;
      }
    }

    // Build format distribution
    const totalAdsAll = ads.length;
    const formatDistribution: FormatDistribution[] = Array.from(formatMap.entries())
      .map(([format, data]) => ({
        format,
        count: data.count,
        reach: data.reach,
        percentage: totalAdsAll > 0 ? Math.round((data.count / totalAdsAll) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Convert map to sorted array
    const timeline = Array.from(monthMap.values());

    const response: ReachTimelineResponse = {
      timeline,
      summary: {
        totalAds,
        totalReach,
        avgReachPerAd: totalAds > 0 ? Math.round(totalReach / totalAds) : 0,
        peakMonth: peakMonth || 'N/A',
        peakReach,
      },
      formatDistribution,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/ad-library/brands/[pageId]/reach-timeline] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reach timeline' },
      { status: 500 }
    );
  }
}
