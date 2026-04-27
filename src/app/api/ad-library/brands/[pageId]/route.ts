import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { CATEGORY_KEYS } from '@/lib/classification/taxonomy';

// =============================================================================
// Types
// =============================================================================

interface SerializedBrand {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  demographicsJson: unknown;
  website: string | null;
  totalReach: string;
  activeAdCount: number;
  lastCheckedAt: Date | null;
  ingestionStatus: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SerializedAd {
  id: string;
  adId: string;
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
  startDate: Date | null;
  endDate: Date | null;
  adDurationDays: number | null;
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  spendLower: number | null;
  spendUpper: number | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
  assets: SerializedAsset[];
}

interface SerializedAsset {
  id: string;
  assetType: string;
  position: number;
  originalUrl: string;
  storedUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  downloadStatus: string;
}

interface SerializedIngestionJob {
  id: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  assetsQueued: number;
  assetsDownloaded: number;
  assetsFailed: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface BrandDetailResponse {
  brand: SerializedBrand;
  recentAds: SerializedAd[];
  recentJobs: SerializedIngestionJob[];
  stats: {
    totalAds: number;
    activeAds: number;
    totalAssets: number;
    pendingAssets: number;
    completedJobs: number;
    failedJobs: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function serializeBrand(brand: {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  demographicsJson?: unknown;
  website: string | null;
  totalReach: bigint;
  activeAdCount: number;
  lastCheckedAt: Date | null;
  ingestionStatus: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): SerializedBrand {
  return {
    ...brand,
    demographicsJson: brand.demographicsJson ?? null,
    totalReach: brand.totalReach.toString(),
  };
}

function serializeAd(ad: {
  id: string;
  adId: string;
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
  startDate: Date | null;
  endDate: Date | null;
  adDurationDays: number | null;
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  spendLower: number | null;
  spendUpper: number | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
  assets: Array<{
    id: string;
    assetType: string;
    position: number;
    originalUrl: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    downloadStatus: string;
  }>;
}): SerializedAd {
  return {
    id: ad.id,
    adId: ad.adId,
    displayFormat: ad.displayFormat,
    publisherPlatforms: ad.publisherPlatforms,
    body: ad.body,
    caption: ad.caption,
    title: ad.title,
    linkDescription: ad.linkDescription,
    linkUrl: ad.linkUrl,
    ctaText: ad.ctaText,
    ctaType: ad.ctaType,
    snapshotUrl: ad.snapshotUrl,
    bylines: ad.bylines,
    startDate: ad.startDate,
    endDate: ad.endDate,
    adDurationDays: ad.adDurationDays,
    isActive: ad.isActive,
    reachEstimate: ad.reachEstimate,
    impressionsLower: ad.impressionsLower,
    impressionsUpper: ad.impressionsUpper,
    spendLower: ad.spendLower,
    spendUpper: ad.spendUpper,
    currency: ad.currency,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    assets: ad.assets.map((asset) => ({
      id: asset.id,
      assetType: asset.assetType,
      position: asset.position,
      originalUrl: asset.originalUrl,
      storedUrl: asset.storedUrl,
      thumbnailUrl: asset.thumbnailUrl,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
      downloadStatus: asset.downloadStatus,
    })),
  };
}

function serializeJob(job: {
  id: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  assetsQueued: number;
  assetsDownloaded: number;
  assetsFailed: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): SerializedIngestionJob {
  return {
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    adsFetched: job.adsFetched,
    adsCreated: job.adsCreated,
    adsUpdated: job.adsUpdated,
    assetsQueued: job.assetsQueued,
    assetsDownloaded: job.assetsDownloaded,
    assetsFailed: job.assetsFailed,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  };
}

// =============================================================================
// GET /api/ad-library/brands/[pageId]
// Fetch a single brand by pageId with paginated ads
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(req.url);

    // Parse pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '24', 10)));
    const skip = (page - 1) * pageSize;

    // Parse filter params
    const search = searchParams.get('search') ?? '';
    const format = searchParams.get('format') ?? '';
    const isActiveParam = searchParams.get('isActive');
    const startDateFrom = searchParams.get('startDateFrom');
    const startDateTo = searchParams.get('startDateTo');

    // Parse sort params
    const sortBy = searchParams.get('sortBy') ?? 'startDate';
    const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc';

    // Find brand by pageId
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Build ads where clause
    const adsWhere: Prisma.AdLibraryAdWhereInput = {
      brandId: brand.id,
    };

    // Filter by format
    if (format) {
      adsWhere.displayFormat = format;
    }

    // Filter by active status
    if (isActiveParam === 'true') {
      adsWhere.isActive = true;
    } else if (isActiveParam === 'false') {
      adsWhere.isActive = false;
    }

    // Filter by date range
    if (startDateFrom || startDateTo) {
      adsWhere.startDate = {};
      if (startDateFrom) {
        adsWhere.startDate.gte = new Date(startDateFrom);
      }
      if (startDateTo) {
        adsWhere.startDate.lte = new Date(startDateTo);
      }
    }

    // Search in text fields
    if (search) {
      adsWhere.OR = [
        { body: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build sort order
    const validSortFields = ['startDate', 'reachEstimate', 'createdAt', 'displayFormat'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'startDate';
    const orderBy: Record<string, 'asc' | 'desc'> = { [orderByField]: sortOrder };

    // Fetch ads, total count, and classification data in parallel
    const [ads, totalAds, classifiedCount, classifications] = await Promise.all([
      prisma.adLibraryAd.findMany({
        where: adsWhere,
        include: {
          assets: {
            select: {
              id: true,
              assetType: true,
              position: true,
              originalUrl: true,
              storedUrl: true,
              thumbnailUrl: true,
              width: true,
              height: true,
              durationMs: true,
              downloadStatus: true,
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.adLibraryAd.count({ where: adsWhere }),
      prisma.adClassification.count({
        where: { ad: { brandId: brand.id } },
      }),
      prisma.adClassification.findMany({
        where: { ad: { brandId: brand.id } },
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
      }),
    ]);

    const totalPages = Math.ceil(totalAds / pageSize);

    // Build classification distribution from DB records
    const distribution: Record<string, Record<string, number>> = {};
    if (classifications.length > 0) {
      for (const key of CATEGORY_KEYS) {
        distribution[key] = {};
      }
      for (const c of classifications) {
        for (const key of CATEGORY_KEYS) {
          const value = c[key as keyof typeof c] as string | null;
          if (value) {
            distribution[key][value] = (distribution[key][value] || 0) + 1;
          }
        }
      }
    }

    // Total ads for the brand (unfiltered) for coverage calculation
    const totalBrandAds = await prisma.adLibraryAd.count({
      where: { brandId: brand.id },
    });

    return NextResponse.json({
      brand: serializeBrand(brand),
      ads: ads.map(serializeAd),
      pagination: {
        total: totalAds,
        page,
        pageSize,
        totalPages,
      },
      classificationCoverage: {
        classified: classifiedCount,
        total: totalBrandAds,
      },
      classificationDistribution: classifications.length > 0 ? distribution : {},
    });
  } catch (error) {
    console.error('[GET /api/ad-library/brands/[pageId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch brand' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/ad-library/brands/[pageId]
// Update a single brand
// =============================================================================

interface UpdateBrandBody {
  pageName?: string;
  profilePicUrl?: string | null;
  country?: string | null;
  category?: string | null;
  website?: string | null;
  ingestionStatus?: 'pending' | 'active' | 'paused' | 'failed';
  priority?: number;
  activeAdCount?: number;
  totalReach?: number;
  lastCheckedAt?: string | null; // ISO date string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { pageId } = await params;
    const body = (await req.json()) as UpdateBrandBody;

    // Find existing brand
    const existing = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Prisma.AdLibraryBrandUpdateInput = {};

    if (body.pageName !== undefined) {
      if (typeof body.pageName !== 'string' || body.pageName.trim().length === 0) {
        return NextResponse.json(
          { error: 'pageName must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.pageName = body.pageName;
    }

    if (body.profilePicUrl !== undefined) {
      updateData.profilePicUrl = body.profilePicUrl;
    }

    if (body.country !== undefined) {
      updateData.country = body.country;
    }

    if (body.category !== undefined) {
      updateData.category = body.category;
    }

    if (body.website !== undefined) {
      updateData.website = body.website;
    }

    if (body.ingestionStatus !== undefined) {
      const validStatuses = ['pending', 'active', 'paused', 'failed'];
      if (!validStatuses.includes(body.ingestionStatus)) {
        return NextResponse.json(
          { error: `ingestionStatus must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.ingestionStatus = body.ingestionStatus;
    }

    if (body.priority !== undefined) {
      if (typeof body.priority !== 'number') {
        return NextResponse.json(
          { error: 'priority must be a number' },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }

    if (body.activeAdCount !== undefined) {
      if (typeof body.activeAdCount !== 'number' || body.activeAdCount < 0) {
        return NextResponse.json(
          { error: 'activeAdCount must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.activeAdCount = body.activeAdCount;
    }

    if (body.totalReach !== undefined) {
      if (typeof body.totalReach !== 'number' || body.totalReach < 0) {
        return NextResponse.json(
          { error: 'totalReach must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.totalReach = BigInt(body.totalReach);
    }

    if (body.lastCheckedAt !== undefined) {
      if (body.lastCheckedAt === null) {
        updateData.lastCheckedAt = null;
      } else {
        const date = new Date(body.lastCheckedAt);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'lastCheckedAt must be a valid ISO date string' },
            { status: 400 }
          );
        }
        updateData.lastCheckedAt = date;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Perform update
    const updated = await prisma.adLibraryBrand.update({
      where: { pageId },
      data: updateData,
    });

    return NextResponse.json({ brand: serializeBrand(updated) });
  } catch (error) {
    console.error('[PATCH /api/ad-library/brands/[pageId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update brand' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/ad-library/brands/[pageId]
// Delete a brand and all related data
// =============================================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { pageId } = await params;

    // Find existing brand
    const existing = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Delete brand (cascades to ads, assets, and jobs due to onDelete: Cascade)
    await prisma.adLibraryBrand.delete({
      where: { pageId },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        pageId,
        pageName: existing.pageName,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/ad-library/brands/[pageId]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete brand' },
      { status: 500 }
    );
  }
}
