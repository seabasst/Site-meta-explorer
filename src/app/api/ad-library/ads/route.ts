import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  parseAdsQueryParams,
  buildAdsWhereClause,
  buildAdsOrderBy,
  computeAdsStats,
  serializeAd,
  type FilteredStats,
} from '@/lib/ads-query';

// =============================================================================
// Types
// =============================================================================

interface AdLibraryAdResponse {
  id: string;
  adId: string;
  brandId: string;
  displayFormat: string | null;
  publisherPlatforms: string[];
  body: string | null;
  caption: string | null;
  title: string | null;
  linkDescription: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  ctaType: string | null;
  snapshotUrl: string | null;
  bylines: string | null;
  startDate: string | null;
  endDate: string | null;
  adDurationDays: number | null;
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  spendLower: number | null;
  spendUpper: number | null;
  currency: string | null;
  targetingJson: unknown;
  createdAt: string;
  updatedAt: string;
  brand: {
    id: string;
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    category: string | null;
    country: string | null;
  };
  assets: {
    id: string;
    assetType: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    originalUrl: string;
    downloadStatus: string;
    position: number;
  }[];
  classification: {
    assetType: string;
    visualFormat: string;
    hookTactic: string;
    messagingAngle: string;
    awarenessStage: string;
    creativeMechanic: string;
    offerType: string;
    intendedAudience: string;
  } | null;
}

interface PaginatedResponse {
  ads: AdLibraryAdResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  /**
   * Only present when the caller did NOT set `includeStats=false`.
   * Prefer calling /api/ad-library/ads/stats separately and passing
   * `includeStats=false` on pagination requests for faster pagination.
   */
  filteredStats?: FilteredStats;
}

// =============================================================================
// GET /api/ad-library/ads
// =============================================================================

/**
 * GET /api/ad-library/ads
 *
 * Query parameters (filters + sort + pagination are all parsed by
 * `parseAdsQueryParams` in src/lib/ads-query.ts — see that file for the
 * full list).
 *
 * Response-shape control:
 * - `includeStats=false` (default: true for backward compat) — skips the 5
 *   expensive stats queries (totalReach, activeCount, formatBreakdown,
 *   topCategories). Use this on pagination requests. Initial load + filter
 *   changes should hit /api/ad-library/ads/stats separately in parallel.
 *
 * Total Prisma queries per call:
 *   - With stats (legacy):   7  (2 ads + 5 stats)
 *   - Without stats (fast):  2  (ads findMany + count)
 *
 * Phase 6.8-extended of the 2026-04-18 audit.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, sort, pagination } = parseAdsQueryParams(searchParams);
    const includeStatsRaw = searchParams.get('includeStats');
    // Default TRUE for backward compatibility with existing v1 + external callers.
    const includeStats = includeStatsRaw !== 'false';

    const where = buildAdsWhereClause(filters);
    const orderBy = buildAdsOrderBy(sort);
    const skip = ((pagination.page || 1) - 1) * (pagination.limit || 20);
    const take = pagination.limit || 20;

    // Core 2 queries — always run.
    const [ads, total] = await Promise.all([
      prisma.adLibraryAd.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          brand: {
            select: {
              id: true,
              pageId: true,
              pageName: true,
              profilePicUrl: true,
              category: true,
              country: true,
            },
          },
          assets: {
            select: {
              id: true,
              assetType: true,
              storedUrl: true,
              thumbnailUrl: true,
              originalUrl: true,
              downloadStatus: true,
              position: true,
            },
            orderBy: { position: 'asc' },
          },
          classification: {
            select: {
              assetType: true,
              visualFormat: true,
              hookTactic: true,
              messagingAngle: true,
              awarenessStage: true,
              creativeMechanic: true,
              offerType: true,
              intendedAudience: true,
            },
          },
        },
      }),
      prisma.adLibraryAd.count({ where }),
    ]);

    // Stats — opt-out. Kept for backward compat; new callers should prefer
    // the dedicated /api/ad-library/ads/stats endpoint.
    const filteredStats = includeStats
      ? await computeAdsStats(filters)
      : undefined;

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse = {
      ads: ads.map((ad) => serializeAd(ad) as unknown as AdLibraryAdResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      ...(filteredStats !== undefined ? { filteredStats } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AdLibrary/Ads] GET error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Record not found' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: 'Database error', code: error.code },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch ads' },
      { status: 500 },
    );
  }
}
