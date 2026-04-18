import { prisma } from '@/lib/prisma';
import {
  uploadToR2,
  generateAssetKey,
  extensionFromContentType,
  isR2Configured,
} from './r2';
import { extractMediaFromSnapshot } from './media-extractor';

interface DownloadResult {
  buffer: Buffer;
  contentType: string;
}

/**
 * Download media from a URL with retry logic.
 */
async function downloadMedia(
  url: string,
  maxRetries = 3
): Promise<DownloadResult | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      if (!res.ok) {
        if (attempt === maxRetries) return null;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await res.arrayBuffer();
      return { buffer: Buffer.from(arrayBuf), contentType };
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Failed to download ${url}:`, error);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

interface ProcessAssetResult {
  success: boolean;
  assetId: string;
  storedUrl?: string;
  storedKey?: string;
  error?: string;
}

/**
 * Process a single AdAsset: download from originalUrl and upload to R2.
 */
export async function processAsset(assetId: string): Promise<ProcessAssetResult> {
  // Get asset with ad and brand info
  const asset = await prisma.adAsset.findUnique({
    where: { id: assetId },
    include: {
      ad: {
        select: {
          id: true,
          brandId: true,
          displayFormat: true,
        },
      },
    },
  });

  if (!asset) {
    return { success: false, assetId, error: 'Asset not found' };
  }

  if (asset.downloadStatus === 'completed' && asset.storedUrl) {
    return {
      success: true,
      assetId,
      storedUrl: asset.storedUrl,
      storedKey: asset.storedKey || undefined,
    };
  }

  // Mark as downloading
  await prisma.adAsset.update({
    where: { id: assetId },
    data: { downloadStatus: 'downloading' },
  });

  try {
    let mediaUrl = asset.originalUrl;
    let mediaType = asset.assetType;

    // If originalUrl is a snapshot URL, extract actual media first
    if (asset.originalUrl.includes('facebook.com/ads/archive/render_ad')) {
      const extracted = await extractMediaFromSnapshot(asset.originalUrl);
      if (!extracted) {
        await prisma.adAsset.update({
          where: { id: assetId },
          data: {
            downloadStatus: 'failed',
            downloadError: 'Failed to extract media from snapshot',
          },
        });
        return { success: false, assetId, error: 'Failed to extract media from snapshot' };
      }
      mediaUrl = extracted.url;
      mediaType = extracted.type;

      // Update asset with actual URL and type
      await prisma.adAsset.update({
        where: { id: assetId },
        data: {
          originalUrl: mediaUrl,
          assetType: mediaType,
        },
      });

      // Also update the ad's displayFormat if it differs
      if (mediaType === 'video' && asset.ad.displayFormat !== 'video') {
        await prisma.adLibraryAd.update({
          where: { id: asset.ad.id },
          data: { displayFormat: 'video' },
        });
      }

      // Save bylines (partnership detection) if found
      if (extracted.bylines) {
        await prisma.adLibraryAd.update({
          where: { id: asset.ad.id },
          data: { bylines: extracted.bylines },
        });
      }
    }

    // Download from Meta CDN
    const downloaded = await downloadMedia(mediaUrl);
    if (!downloaded) {
      await prisma.adAsset.update({
        where: { id: assetId },
        data: {
          downloadStatus: 'failed',
          downloadError: 'Failed to download from source',
        },
      });
      return { success: false, assetId, error: 'Failed to download from source' };
    }

    // Generate storage key
    const extension = extensionFromContentType(downloaded.contentType);
    const key = generateAssetKey(
      asset.ad.brandId,
      asset.ad.id,
      asset.assetType,
      asset.position,
      extension
    );

    // Upload to R2
    const result = await uploadToR2(key, downloaded.buffer, downloaded.contentType);

    // Update asset record
    await prisma.adAsset.update({
      where: { id: assetId },
      data: {
        storedUrl: result.url,
        storedKey: result.key,
        fileExtension: extension,
        fileSizeBytes: result.size,
        downloadStatus: 'completed',
        downloadError: null,
      },
    });

    return {
      success: true,
      assetId,
      storedUrl: result.url,
      storedKey: result.key,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prisma.adAsset.update({
      where: { id: assetId },
      data: {
        downloadStatus: 'failed',
        downloadError: errorMessage,
      },
    });
    return { success: false, assetId, error: errorMessage };
  }
}

interface BatchProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessAssetResult[];
}

/**
 * Canonical query for "assets we should download from fbcdn into R2."
 *
 * This is the ONLY approved way to read pending AdAsset rows for download
 * purposes. It enforces the project's active-ads-only invariant in code so
 * no caller can forget it.
 *
 * The invariant:
 *   Metadata (ad bodies, reach, timing, classifications) is fine for all ads.
 *   Assets (image/video/snapshot blobs) must ONLY be downloaded for ads
 *   that are still running (`AdLibraryAd.isActive = true`).
 *
 * Before this helper existed, 10+ code paths re-implemented the query with
 * subtly different shapes, several of which skipped the activity filter and
 * re-downloaded dead ads forever — scaling the R2 + fbcdn bill with
 * historical volume instead of live volume. See scope 3 of the audit:
 * .planning/review-2026-04-18/03-ingestion-pipeline.md.
 *
 * Any new caller that needs "pending assets" should call this helper.
 * Grep rule: `adAsset.findMany` that filters on `downloadStatus: 'pending'`
 * without going through this helper is a bug.
 */
export async function getDownloadableAssets(
  limit: number,
  brandId?: string,
): Promise<{ id: string }[]> {
  return prisma.adAsset.findMany({
    where: {
      downloadStatus: 'pending',
      ad: {
        isActive: true,
        ...(brandId ? { brandId } : {}),
      },
    },
    select: { id: true },
    take: limit,
  });
}

/**
 * Process a batch of pending assets.
 * @param limit - Maximum number of assets to process
 * @param brandId - Optional: only process assets for a specific brand
 */
export async function processPendingAssets(
  limit = 50,
  brandId?: string
): Promise<BatchProcessResult> {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured. Set R2_* environment variables.');
  }

  // Active-ads-only rule enforced inside the helper.
  const pendingAssets = await getDownloadableAssets(limit, brandId);

  const results: ProcessAssetResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process assets with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < pendingAssets.length; i += CONCURRENCY) {
    const batch = pendingAssets.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((asset) => processAsset(asset.id))
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }
  }

  return {
    processed: pendingAssets.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Retry failed assets.
 * @param limit - Maximum number of assets to retry
 */
export async function retryFailedAssets(limit = 50): Promise<BatchProcessResult> {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured. Set R2_* environment variables.');
  }

  // Reset failed assets to pending
  const failedAssets = await prisma.adAsset.findMany({
    where: { downloadStatus: 'failed' },
    select: { id: true },
    take: limit,
  });

  await prisma.adAsset.updateMany({
    where: {
      id: { in: failedAssets.map((a) => a.id) },
    },
    data: {
      downloadStatus: 'pending',
      downloadError: null,
    },
  });

  // Process them
  return processPendingAssets(limit);
}

/**
 * Get asset processing stats.
 */
export async function getAssetStats(brandId?: string) {
  const where = brandId ? { ad: { brandId } } : {};

  const [pending, downloading, completed, failed, total] = await Promise.all([
    prisma.adAsset.count({ where: { ...where, downloadStatus: 'pending' } }),
    prisma.adAsset.count({ where: { ...where, downloadStatus: 'downloading' } }),
    prisma.adAsset.count({ where: { ...where, downloadStatus: 'completed' } }),
    prisma.adAsset.count({ where: { ...where, downloadStatus: 'failed' } }),
    prisma.adAsset.count({ where }),
  ]);

  // Calculate storage size for completed assets
  const storageStats = await prisma.adAsset.aggregate({
    where: { ...where, downloadStatus: 'completed' },
    _sum: { fileSizeBytes: true },
  });

  return {
    pending,
    downloading,
    completed,
    failed,
    total,
    storageSizeBytes: storageStats._sum.fileSizeBytes || 0,
    storageSizeMB: Math.round((storageStats._sum.fileSizeBytes || 0) / 1024 / 1024),
  };
}
