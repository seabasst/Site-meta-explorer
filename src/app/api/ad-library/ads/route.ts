import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

interface AdLibraryAdFilters {
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
}

interface AdLibraryAdSortOptions {
  sortBy?: 'startDate' | 'reachEstimate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface AdLibraryAdPagination {
  page?: number;
  limit?: number;
}

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
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): {
  filters: AdLibraryAdFilters;
  sort: AdLibraryAdSortOptions;
  pagination: AdLibraryAdPagination;
} {
  // Filters
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
  const search = searchParams.get('search') || searchParams.get('q') || undefined;
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
  const minDaysActive = minDaysActiveRaw ? parseInt(minDaysActiveRaw, 10) : undefined;
  const maxDaysActiveRaw = searchParams.get('maxDaysActive');
  const maxDaysActive = maxDaysActiveRaw ? parseInt(maxDaysActiveRaw, 10) : undefined;

  // Sorting
  const sortByRaw = searchParams.get('sortBy');
  const validSortFields = ['startDate', 'reachEstimate', 'createdAt'];
  const sortBy = sortByRaw && validSortFields.includes(sortByRaw)
    ? (sortByRaw as 'startDate' | 'reachEstimate' | 'createdAt')
    : 'createdAt';
  const sortOrderRaw = searchParams.get('sortOrder');
  const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

  // Pagination
  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
  const limit = isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(limitRaw, 100);

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
      minDaysActive: minDaysActive !== undefined && !isNaN(minDaysActive) ? minDaysActive : undefined,
      maxDaysActive: maxDaysActive !== undefined && !isNaN(maxDaysActive) ? maxDaysActive : undefined,
    },
    sort: { sortBy, sortOrder },
    pagination: { page, limit },
  };
}

/**
 * Build Prisma where clause from filters
 */
function buildWhereClause(filters: AdLibraryAdFilters): Prisma.AdLibraryAdWhereInput {
  const where: Prisma.AdLibraryAdWhereInput = {};

  // Brand filter
  if (filters.brandId) {
    where.brandId = filters.brandId;
  } else if (filters.brandPageId) {
    where.brand = { pageId: filters.brandPageId };
  }

  // Display format filter (single or multi)
  if (filters.displayFormats && filters.displayFormats.length > 0) {
    where.displayFormat = { in: filters.displayFormats };
  } else if (filters.displayFormat) {
    where.displayFormat = filters.displayFormat;
  } else if (filters.excludeFormats && filters.excludeFormats.length > 0) {
    where.displayFormat = { notIn: filters.excludeFormats };
  }

  // Publisher platforms filter (hasSome - at least one platform matches)
  if (filters.publisherPlatforms && filters.publisherPlatforms.length > 0) {
    where.publisherPlatforms = {
      hasSome: filters.publisherPlatforms,
    };
  }

  // Active status filter
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  // Date range filter
  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {};
    if (filters.startDateFrom) {
      where.startDate.gte = new Date(filters.startDateFrom);
    }
    if (filters.startDateTo) {
      where.startDate.lte = new Date(filters.startDateTo);
    }
  }

  // Category (industry) filter — matches on the brand's category
  if (filters.category) {
    where.brand = {
      ...(where.brand as Prisma.AdLibraryBrandWhereInput || {}),
      category: { equals: filters.category, mode: 'insensitive' },
    };
  }

  // Days active filter — calculated from startDate
  if (filters.minDaysActive !== undefined || filters.maxDaysActive !== undefined) {
    const now = new Date();
    if (filters.maxDaysActive !== undefined) {
      // Ad must have started at most maxDaysActive days ago → startDate >= now - maxDays
      const from = new Date(now.getTime() - filters.maxDaysActive * 86400000);
      where.startDate = { ...(where.startDate as object || {}), gte: from };
    }
    if (filters.minDaysActive !== undefined) {
      // Ad must have started at least minDaysActive days ago → startDate <= now - minDays
      const to = new Date(now.getTime() - filters.minDaysActive * 86400000);
      where.startDate = { ...(where.startDate as object || {}), lte: to };
    }
  }

  // Full-text search on body, title, caption
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

/**
 * Build Prisma orderBy clause from sort options
 */
function buildOrderByClause(
  sort: AdLibraryAdSortOptions
): Prisma.AdLibraryAdOrderByWithRelationInput {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = sort;
  return { [sortBy]: { sort: sortOrder, nulls: 'last' } };
}

/**
 * Serialize ad record for JSON response (handle BigInt and Date)
 */
function serializeAd(ad: Record<string, unknown>): AdLibraryAdResponse {
  return JSON.parse(
    JSON.stringify(ad, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    })
  );
}

// =============================================================================
// GET /api/ad-library/ads - Search and list ads
// =============================================================================

/**
 * GET /api/ad-library/ads
 *
 * Query parameters:
 * - brandId: Filter by brand ID
 * - displayFormat: Filter by format (image, video, carousel, dpa)
 * - publisherPlatforms: Filter by platforms (comma-separated: facebook,instagram,messenger,audience_network)
 * - isActive: Filter by active status (true/false)
 * - startDateFrom: Filter ads starting after this date (ISO string)
 * - startDateTo: Filter ads starting before this date (ISO string)
 * - search / q: Full-text search on body, title, caption
 * - sortBy: Sort field (startDate, reachEstimate, createdAt)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Page number (1-indexed)
 * - limit: Items per page (max 100)
 *
 * Response:
 * {
 *   ads: AdLibraryAdResponse[],
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     total: number,
 *     totalPages: number,
 *     hasNext: boolean,
 *     hasPrev: boolean
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, sort, pagination } = parseQueryParams(searchParams);

    // Build query
    const where = buildWhereClause(filters);
    const orderBy = buildOrderByClause(sort);
    const skip = ((pagination.page || 1) - 1) * (pagination.limit || 20);
    const take = pagination.limit || 20;

    // Execute queries in parallel
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
        },
      }),
      prisma.adLibraryAd.count({ where }),
    ]);

    // Calculate pagination metadata
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const totalPages = Math.ceil(total / limit);

    const response: PaginatedResponse = {
      ads: ads.map(serializeAd),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AdLibrary/Ads] GET error:', error);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Record not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Database error', code: error.code },
        { status: 500 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to fetch ads';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
