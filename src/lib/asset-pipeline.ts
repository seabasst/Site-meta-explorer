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

  // Find pending assets, NEWEST FIRST.
  //
  // Meta serves render_ad only while an ad is still in the archive. An ad ingested
  // months ago returns "Error: invalid ID" and can never be fetched again, no matter
  // how many times it is retried. findMany with no orderBy returns rows in physical
  // order, which on an append-only table is oldest-first, so every batch was spent on
  // the dead head of a 1.75M-row queue and stored nothing. The drain then looked
  // blocked, the circuit breaker reset those same dead rows to pending, and the next
  // cycle served them straight back: an infinite loop on rows that can never succeed.
  //
  // Measured 2026-09-20: 0 of 100 stored draining the queue as-is, from both Fly and a
  // residential IP, against 14 of 15 stored when the same code was pointed at assets
  // from ads ingested in the last 7 days.
  //
  // Newest-first is the fix and also the right policy: an asset's fetchable window is
  // short, so fresh ads are the only ones worth spending the render_ad budget on.
  // ponytail: this sorts ~1.75M rows in ~2.9s per batch, against a batch that takes
  // ~2.5min to process, so ~2% overhead. Add @@index([downloadStatus, createdAt]) if
  // that ratio ever stops being acceptable.
  const pendingAssets = await prisma.adAsset.findMany({
    where: {
      downloadStatus: 'pending',
      ...(brandId && {
        ad: {
          brandId,
        },
      }),
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const results: ProcessAssetResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process assets with concurrency limit. Both knobs are env-tunable because Facebook
  // starts refusing render_ad under sustained load, and the refusal is indistinguishable
  // from a missing ad at the row level — so pacing is the only defence.
  const CONCURRENCY = Math.max(1, Number(process.env.ASSET_CONCURRENCY ?? 5));
  const PACE_MS = Math.max(0, Number(process.env.ASSET_PACE_MS ?? 0));
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

    if (PACE_MS && i + CONCURRENCY < pendingAssets.length) {
      await new Promise((r) => setTimeout(r, PACE_MS));
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
