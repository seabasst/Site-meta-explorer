/**
 * Shared query helpers for the /api/ad-library/ads and
 * /api/ad-library/ads/stats endpoints.
 *
 * Phase 6.8-extended of the 2026-04-18 audit: stats were previously computed
 * on EVERY /api/ad-library/ads call (5 extra queries per pagination request),
 * even though they don't change when the user just scrolls. Splitting lets
 * us run stats once per filter-change instead of once per page.
 *
 * Both endpoints call `parseAdsQueryParams` so they accept the exact same
 * filter / sort / pagination inputs. `buildAdsWhereClause` produces a single
 * Prisma where clause so the two endpoints can't drift.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdsFilters {
  brandId?: string;
  brandPageId?: string;
  displayFormat?: string;
  displayFormats?: string[];
  excludeFormats?: string[];
  publisherPlatforms?: string[];
  isActive?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
  category?: string;
  minDaysActive?: number;
  maxDaysActive?: number;
  hasBylines?: boolean;
}

export interface AdsSort {
  sortBy?:
    | 'startDate'
    | 'reachEstimate'
    | 'createdAt'
    | 'spendLower'
    | 'adDurationDays';
  sortOrder?: 'asc' | 'desc';
}

export interface AdsPagination {
  page?: number;
  limit?: number;
}

export interface FilteredStats {
  totalReach: number;
  activeCount: number;
  formatBreakdown: { format: string; count: number }[];
  topCategories: { category: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Param parsing
// ---------------------------------------------------------------------------

export function parseAdsQueryParams(searchParams: URLSearchParams): {
  filters: AdsFilters;
  sort: AdsSort;
  pagination: AdsPagination;
} {
  const brandId = searchParams.get('brandId') || undefined;
  const brandPageId = searchParams.get('brandPageId') || undefined;
  const displayFormat = searchParams.get('displayFormat') || undefined;

  const publisherPlatformsRaw = searchParams.get('publisherPlatforms');
  const publisherPlatforms = publisherPlatformsRaw
    ? publisherPlatformsRaw.split(',').map((p) => p.trim())
    : undefined;

  const isActiveRaw = searchParams.get('isActive');
  const isActive = isActiveRaw !== null ? isActiveRaw === 'true' : undefined;

  const startDateFrom = searchParams.get('startDateFrom') || undefined;
  const startDateTo = searchParams.get('startDateTo') || undefined;
  const search =
    searchParams.get('search') || searchParams.get('q') || undefined;
  const category = searchParams.get('category') || undefined;

  const displayFormatsRaw = searchParams.get('displayFormats');
  const displayFormats = displayFormatsRaw
    ? displayFormatsRaw.split(',').map((f) => f.trim())
    : undefined;

  const excludeFormatsRaw = searchParams.get('excludeFormats');
  const excludeFormats = excludeFormatsRaw
    ? excludeFormatsRaw.split(',').map((f) => f.trim())
    : undefined;

  const minDaysActiveRaw = searchParams.get('minDaysActive');
  const minDaysActive = minDaysActiveRaw
    ? parseInt(minDaysActiveRaw, 10)
    : undefined;

  const maxDaysActiveRaw = searchParams.get('maxDaysActive');
  const maxDaysActive = maxDaysActiveRaw
    ? parseInt(maxDaysActiveRaw, 10)
    : undefined;

  const hasBylinesRaw = searchParams.get('hasBylines');
  const hasBylines =
    hasBylinesRaw !== null ? hasBylinesRaw === 'true' : undefined;

  const sortByRaw = searchParams.get('sortBy');
  const validSortFields = [
    'startDate',
    'reachEstimate',
    'createdAt',
    'spendLower',
    'adDurationDays',
  ];
  const sortBy =
    sortByRaw && validSortFields.includes(sortByRaw)
      ? (sortByRaw as AdsSort['sortBy'])
      : 'createdAt';
  const sortOrderRaw = searchParams.get('sortOrder');
  const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
  const limit =
    isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(limitRaw, 100);

  return {
    filters: {
      brandId,
      brandPageId,
      displayFormat,
      publisherPlatforms,
      isActive,
      startDateFrom,
      startDateTo,
      search,
      category,
      displayFormats,
      excludeFormats,
      minDaysActive:
        minDaysActive !== undefined && !isNaN(minDaysActive)
          ? minDaysActive
          : undefined,
      maxDaysActive:
        maxDaysActive !== undefined && !isNaN(maxDaysActive)
          ? maxDaysActive
          : undefined,
      hasBylines,
    },
    sort: { sortBy, sortOrder },
    pagination: { page, limit },
  };
}

// ---------------------------------------------------------------------------
// Where clause
// ---------------------------------------------------------------------------

export function buildAdsWhereClause(
  filters: AdsFilters,
): Prisma.AdLibraryAdWhereInput {
  const where: Prisma.AdLibraryAdWhereInput = {
    // Only show ads that have at least one downloaded asset (the UI can't
    // render anything without a creative). Bylines branch below relaxes this.
    assets: { some: { downloadStatus: 'completed' } },
  };

  if (filters.brandId) {
    where.brandId = filters.brandId;
  } else if (filters.brandPageId) {
    where.brand = { pageId: filters.brandPageId };
  }

  if (filters.displayFormats && filters.displayFormats.length > 0) {
    where.displayFormat = { in: filters.displayFormats };
  } else if (filters.displayFormat) {
    where.displayFormat = filters.displayFormat;
  } else if (filters.excludeFormats && filters.excludeFormats.length > 0) {
    where.displayFormat = { notIn: filters.excludeFormats };
  }

  if (filters.publisherPlatforms && filters.publisherPlatforms.length > 0) {
    where.publisherPlatforms = { hasSome: filters.publisherPlatforms };
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {};
    if (filters.startDateFrom) {
      where.startDate.gte = new Date(filters.startDateFrom);
    }
    if (filters.startDateTo) {
      where.startDate.lte = new Date(filters.startDateTo);
    }
  }

  if (filters.category) {
    where.brand = {
      ...((where.brand as Prisma.AdLibraryBrandWhereInput) || {}),
      category: { equals: filters.category, mode: 'insensitive' },
    };
  }

  if (
    filters.minDaysActive !== undefined ||
    filters.maxDaysActive !== undefined
  ) {
    const now = new Date();
    if (filters.maxDaysActive !== undefined) {
      const from = new Date(now.getTime() - filters.maxDaysActive * 86400000);
      where.startDate = { ...((where.startDate as object) || {}), gte: from };
    }
    if (filters.minDaysActive !== undefined) {
      const to = new Date(now.getTime() - filters.minDaysActive * 86400000);
      where.startDate = { ...((where.startDate as object) || {}), lte: to };
    }
  }

  if (filters.hasBylines === true) {
    where.bylines = { not: null };
    // Partnership ads may not have downloaded assets yet — relax the asset req.
    delete where.assets;
  } else if (filters.hasBylines === false) {
    where.bylines = null;
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { body: { contains: searchTerm, mode: 'insensitive' } },
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { caption: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  return where;
}

export function buildAdsOrderBy(
  sort: AdsSort,
): Prisma.AdLibraryAdOrderByWithRelationInput {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = sort;
  // createdAt is non-nullable — Prisma requires plain SortOrder for it
  const nonNullableFields = ['createdAt'];
  if (nonNullableFields.includes(sortBy)) {
    return { [sortBy]: sortOrder };
  }
  return { [sortBy]: { sort: sortOrder, nulls: 'last' } };
}

// ---------------------------------------------------------------------------
// Stats computation (5 queries)
//
// Extracted into a helper so the dedicated stats endpoint and the main
// endpoint's backward-compat path can share the same implementation.
// ---------------------------------------------------------------------------

export async function computeAdsStats(
  filters: AdsFilters,
): Promise<FilteredStats> {
  const where = buildAdsWhereClause(filters);

  const [total, reachAgg, activeInFiltered, formatGrouped, brandIdsResult] =
    await Promise.all([
      prisma.adLibraryAd.count({ where }),
      prisma.adLibraryAd.aggregate({
        where,
        _sum: { reachEstimate: true },
      }),
      // If already filtering to active-only, skip the extra count query
      filters.isActive === true
        ? Promise.resolve(null)
        : prisma.adLibraryAd.count({
            where: { ...where, isActive: true },
          }),
      prisma.adLibraryAd.groupBy({
        by: ['displayFormat'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Distinct brand ids in the filtered set — drives the top-categories
      // query below. This is the single heaviest query in the stats block;
      // it's effectively a table scan distinct on brandId. If this becomes
      // a problem at scale, consider denormalizing top-categories onto a
      // per-filter materialized view.
      prisma.adLibraryAd.findMany({
        where,
        select: { brandId: true },
        distinct: ['brandId'],
      }),
    ]);

  const brandIds = brandIdsResult.map((r) => r.brandId);
  const topCats =
    brandIds.length > 0
      ? await prisma.adLibraryBrand.groupBy({
          by: ['category'],
          where: { id: { in: brandIds }, category: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        })
      : [];

  return {
    totalReach: Number(reachAgg._sum.reachEstimate || 0),
    activeCount: filters.isActive === true ? total : (activeInFiltered ?? 0),
    formatBreakdown: formatGrouped.map((r) => ({
      format: r.displayFormat || 'unknown',
      count: r._count.id,
    })),
    topCategories: topCats.map((r) => ({
      category: r.category!,
      count: r._count.id,
    })),
  };
}

// ---------------------------------------------------------------------------
// BigInt-safe serializer (shared)
//
// Returns `unknown` rather than `T` because JSON.parse(JSON.stringify(...))
// flattens Date instances to strings, which `T` doesn't model. Callers
// should cast the result to their API-response interface (which uses
// string for Date fields) via `as unknown as MyResponseType`.
// ---------------------------------------------------------------------------

export function serializeAd(ad: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ad, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    }),
  );
}
