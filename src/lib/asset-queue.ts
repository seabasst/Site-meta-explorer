import { prisma } from '@/lib/prisma';
import { extractMediaFromSnapshot } from './media-extractor';

/**
 * Create or update an AdAsset record for an ad.
 * This extracts media from the snapshot URL and creates a pending asset record.
 */
export async function queueAssetForAd(
  adDbId: string,
  snapshotUrl: string,
  position = 0
): Promise<{ assetId: string; status: 'created' | 'exists' | 'error'; error?: string }> {
  try {
    // Check if asset already exists for this ad+position
    const existing = await prisma.adAsset.findFirst({
      where: {
        adId: adDbId,
        position,
      },
      select: { id: true, downloadStatus: true },
    });

    if (existing) {
      return { assetId: existing.id, status: 'exists' };
    }

    // Extract actual media URL from snapshot (requires Puppeteer)
    const extracted = await extractMediaFromSnapshot(snapshotUrl);
    if (!extracted) {
      return {
        assetId: '',
        status: 'error',
        error: 'Failed to extract media from snapshot',
      };
    }

    // Create asset record
    const asset = await prisma.adAsset.create({
      data: {
        adId: adDbId,
        assetType: extracted.type,
        position,
        originalUrl: extracted.url,
        downloadStatus: 'pending',
      },
    });

    return { assetId: asset.id, status: 'created' };
  } catch (error) {
    return {
      assetId: '',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch create asset records for ads that don't have them.
 * This version stores the snapshot URL directly and extracts media during processing.
 */
export async function createPendingAssetsFromAds(
  limit = 100
): Promise<{ queued: number; skipped: number; errors: number }> {
  // Find ads with snapshot URLs that don't have assets
  const adsWithoutAssets = await prisma.adLibraryAd.findMany({
    where: {
      snapshotUrl: { not: null },
      assets: { none: {} },
    },
    select: {
      id: true,
      snapshotUrl: true,
    },
    take: limit,
  });

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const ad of adsWithoutAssets) {
    if (!ad.snapshotUrl) {
      skipped++;
      continue;
    }

    try {
      // Create a pending asset with snapshot URL as placeholder
      // The actual media extraction happens during processing
      await prisma.adAsset.create({
        data: {
          adId: ad.id,
          assetType: 'unknown', // Will be determined during extraction
          position: 0,
          originalUrl: ad.snapshotUrl, // Store snapshot URL temporarily
          downloadStatus: 'pending',
        },
      });
      queued++;
    } catch {
      errors++;
    }
  }

  return { queued, skipped, errors };
}

/**
 * Get count of ads without assets.
 */
export async function getAdsWithoutAssetsCount(): Promise<number> {
  return prisma.adLibraryAd.count({
    where: {
      snapshotUrl: { not: null },
      assets: { none: {} },
    },
  });
}
