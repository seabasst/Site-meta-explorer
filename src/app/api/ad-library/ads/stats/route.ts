import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { parseAdsQueryParams, computeAdsStats } from '@/lib/ads-query';

/**
 * GET /api/ad-library/ads/stats
 *
 * Returns the filtered-stats panel only (totalReach, activeCount,
 * formatBreakdown, topCategories). Same filter query params as
 * /api/ad-library/ads; pagination params are ignored.
 *
 * Split out from /api/ad-library/ads in Phase 6.8-extended so that
 * pagination within a filter doesn't re-run the 5 heavy stats queries.
 * The client calls this endpoint once per filter change, not once per
 * page load.
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 6.8)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { filters } = parseAdsQueryParams(searchParams);

    const filteredStats = await computeAdsStats(filters);

    return NextResponse.json({ filteredStats });
  } catch (error) {
    console.error('[AdLibrary/Ads/Stats] GET error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Database error', code: error.code },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
