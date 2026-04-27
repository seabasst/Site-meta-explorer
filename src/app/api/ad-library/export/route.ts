import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

interface ExportFilters {
  brandId?: string;
  pageId?: string;
  displayFormat?: string;
  publisherPlatforms?: string[];
  isActive?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
  category?: string;
}

interface ExportAd {
  adId: string;
  brandPageId: string;
  brandName: string;
  brandCategory: string | null;
  displayFormat: string | null;
  publisherPlatforms: string;
  body: string | null;
  title: string | null;
  caption: string | null;
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
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseExportParams(searchParams: URLSearchParams): {
  filters: ExportFilters;
  format: 'csv' | 'json';
  limit: number;
} {
  const brandId = searchParams.get('brandId') || undefined;
  const pageId = searchParams.get('pageId') || undefined;
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

  const formatRaw = searchParams.get('format');
  const format = formatRaw === 'csv' ? 'csv' : 'json';

  // Limit export to prevent memory issues (max 10,000 rows)
  const limitRaw = parseInt(searchParams.get('limit') || '10000', 10);
  const limit = Math.min(Math.max(1, limitRaw), 10000);

  return {
    filters: {
      brandId,
      pageId,
      displayFormat,
      publisherPlatforms,
      isActive,
      startDateFrom,
      startDateTo,
      search,
      category,
    },
    format,
    limit,
  };
}

function buildWhereClause(filters: ExportFilters): Prisma.AdLibraryAdWhereInput {
  const where: Prisma.AdLibraryAdWhereInput = {};

  // Brand filter by internal ID
  if (filters.brandId) {
    where.brandId = filters.brandId;
  }

  // Brand filter by pageId
  if (filters.pageId) {
    where.brand = { pageId: filters.pageId };
  }

  // Category filter
  if (filters.category) {
    where.brand = {
      ...where.brand as Prisma.AdLibraryBrandWhereInput,
      category: { equals: filters.category, mode: 'insensitive' },
    };
  }

  // Display format filter
  if (filters.displayFormat) {
    where.displayFormat = filters.displayFormat;
  }

  // Publisher platforms filter
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

  // Full-text search
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

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function transformToExportAd(ad: Record<string, unknown>): ExportAd {
  const brand = ad.brand as Record<string, unknown>;
  return {
    adId: ad.adId as string,
    brandPageId: brand.pageId as string,
    brandName: brand.pageName as string,
    brandCategory: brand.category as string | null,
    displayFormat: ad.displayFormat as string | null,
    publisherPlatforms: (ad.publisherPlatforms as string[]).join(', '),
    body: ad.body as string | null,
    title: ad.title as string | null,
    caption: ad.caption as string | null,
    linkDescription: ad.linkDescription as string | null,
    linkUrl: ad.linkUrl as string | null,
    ctaText: ad.ctaText as string | null,
    ctaType: ad.ctaType as string | null,
    snapshotUrl: ad.snapshotUrl as string | null,
    startDate: formatDate(ad.startDate as Date | null),
    endDate: formatDate(ad.endDate as Date | null),
    adDurationDays: ad.adDurationDays as number | null,
    isActive: ad.isActive as boolean,
    reachEstimate: ad.reachEstimate as number | null,
    impressionsLower: ad.impressionsLower as number | null,
    impressionsUpper: ad.impressionsUpper as number | null,
    spendLower: ad.spendLower as number | null,
    spendUpper: ad.spendUpper as number | null,
    currency: ad.currency as string | null,
  };
}

function generateCSV(ads: ExportAd[]): string {
  const headers = [
    'adId',
    'brandPageId',
    'brandName',
    'brandCategory',
    'displayFormat',
    'publisherPlatforms',
    'body',
    'title',
    'caption',
    'linkDescription',
    'linkUrl',
    'ctaText',
    'ctaType',
    'snapshotUrl',
    'startDate',
    'endDate',
    'adDurationDays',
    'isActive',
    'reachEstimate',
    'impressionsLower',
    'impressionsUpper',
    'spendLower',
    'spendUpper',
    'currency',
  ];

  const rows = ads.map((ad) =>
    headers.map((h) => escapeCSV(String(ad[h as keyof ExportAd] ?? ''))).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// =============================================================================
// GET /api/ad-library/export - Export ads as CSV or JSON
// =============================================================================

/**
 * GET /api/ad-library/export
 *
 * Query parameters:
 * - format: Export format (csv, json) - default: json
 * - brandId: Filter by brand internal ID
 * - pageId: Filter by brand Facebook page ID
 * - category: Filter by brand category
 * - displayFormat: Filter by format (image, video, carousel, dpa)
 * - publisherPlatforms: Filter by platforms (comma-separated)
 * - isActive: Filter by active status (true/false)
 * - startDateFrom: Filter ads starting after this date (ISO string)
 * - startDateTo: Filter ads starting before this date (ISO string)
 * - search / q: Full-text search on body, title, caption
 * - limit: Max rows to export (default: 10000, max: 10000)
 *
 * Response:
 * - CSV: text/csv with filename header
 * - JSON: application/json array of ads
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const { filters, format, limit } = parseExportParams(searchParams);

    // Build query
    const where = buildWhereClause(filters);

    // Fetch ads with brand info
    const ads = await prisma.adLibraryAd.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: limit,
      include: {
        brand: {
          select: {
            pageId: true,
            pageName: true,
            category: true,
          },
        },
      },
    });

    // Transform to export format
    const exportAds = ads.map(transformToExportAd);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filterParts: string[] = [];
    if (filters.pageId) filterParts.push(`brand-${filters.pageId}`);
    if (filters.category) filterParts.push(`cat-${filters.category}`);
    if (filters.displayFormat) filterParts.push(`format-${filters.displayFormat}`);
    if (filters.isActive !== undefined) filterParts.push(filters.isActive ? 'active' : 'inactive');
    const filterSuffix = filterParts.length > 0 ? `-${filterParts.join('-')}` : '';
    const filename = `ad-library-export${filterSuffix}-${timestamp}`;

    if (format === 'csv') {
      const csv = generateCSV(exportAds);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(exportAds, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  } catch (error) {
    console.error('[AdLibrary/Export] GET error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Database error', code: error.code },
        { status: 500 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to export ads';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
