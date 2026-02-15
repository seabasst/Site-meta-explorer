import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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
// Fetch a single brand by pageId with recent ads and stats
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(req.url);

    // Parse query params for ads
    const adsLimit = Math.min(50, Math.max(1, parseInt(searchParams.get('adsLimit') ?? '10', 10)));
    const adsOffset = Math.max(0, parseInt(searchParams.get('adsOffset') ?? '0', 10));
    const activeOnly = searchParams.get('activeOnly') === 'true';

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
      ...(activeOnly ? { isActive: true } : {}),
    };

    // Fetch related data in parallel
    const [
      recentAds,
      recentJobs,
      totalAds,
      activeAds,
      totalAssets,
      pendingAssets,
      completedJobs,
      failedJobs,
    ] = await Promise.all([
      // Recent ads with assets
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
        orderBy: { startDate: 'desc' },
        skip: adsOffset,
        take: adsLimit,
      }),
      // Recent ingestion jobs
      prisma.ingestionJob.findMany({
        where: { brandId: brand.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          jobType: true,
          status: true,
          adsFetched: true,
          adsCreated: true,
          adsUpdated: true,
          assetsQueued: true,
          assetsDownloaded: true,
          assetsFailed: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      // Stats: total ads
      prisma.adLibraryAd.count({ where: { brandId: brand.id } }),
      // Stats: active ads
      prisma.adLibraryAd.count({ where: { brandId: brand.id, isActive: true } }),
      // Stats: total assets
      prisma.adAsset.count({
        where: { ad: { brandId: brand.id } },
      }),
      // Stats: pending assets
      prisma.adAsset.count({
        where: { ad: { brandId: brand.id }, downloadStatus: 'pending' },
      }),
      // Stats: completed jobs
      prisma.ingestionJob.count({
        where: { brandId: brand.id, status: 'completed' },
      }),
      // Stats: failed jobs
      prisma.ingestionJob.count({
        where: { brandId: brand.id, status: 'failed' },
      }),
    ]);

    const response: BrandDetailResponse = {
      brand: serializeBrand(brand),
      recentAds: recentAds.map(serializeAd),
      recentJobs: recentJobs.map(serializeJob),
      stats: {
        totalAds,
        activeAds,
        totalAssets,
        pendingAssets,
        completedJobs,
        failedJobs,
      },
    };

    return NextResponse.json(response);
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
