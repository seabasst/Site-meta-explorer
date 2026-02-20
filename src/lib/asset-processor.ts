/**
 * Asset processor that fetches fresh snapshot URLs from Meta API
 * before extracting and uploading to R2.
 */

import { prisma } from '@/lib/prisma';
import { extractMediaFromSnapshot } from './media-extractor';
import { uploadToR2, generateAssetKey, extensionFromContentType, isR2Configured } from './r2';

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

interface MetaAdResponse {
  data: Array<{
    id: string;
    ad_snapshot_url?: string;
  }>;
}

/**
 * Fetch fresh snapshot URL from Meta API for a single ad.
 */
async function fetchFreshSnapshotUrl(adId: string): Promise<string | null> {
  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  const params = new URLSearchParams({
    access_token: FACEBOOK_ACCESS_TOKEN,
    ids: adId,
    fields: 'ad_snapshot_url',
  });

  try {
    const response = await fetch(`${BASE_URL}/${API_VERSION}/?${params}`);
    const data = await response.json();

    if (data.error) {
      console.error(`Meta API error for ${adId}:`, data.error.message);
      return null;
    }

    return data[adId]?.ad_snapshot_url || null;
  } catch (error) {
    console.error(`Failed to fetch snapshot URL for ${adId}:`, error);
    return null;
  }
}

/**
 * Download media from URL.
 */
async function downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf), contentType };
  } catch {
    return null;
  }
}

interface ProcessResult {
  adId: string;
  success: boolean;
  storedUrl?: string;
  error?: string;
}

/**
 * Process a single ad: fetch fresh URL, extract media, upload to R2.
 */
export async function processAdAsset(adDbId: string): Promise<ProcessResult> {
  // Get ad info
  const ad = await prisma.adLibraryAd.findUnique({
    where: { id: adDbId },
    select: { id: true, adId: true, brandId: true },
  });

  if (!ad) {
    return { adId: adDbId, success: false, error: 'Ad not found' };
  }

  // Check if already has completed asset
  const existingAsset = await prisma.adAsset.findFirst({
    where: { adId: adDbId, downloadStatus: 'completed' },
    select: { storedUrl: true },
  });

  if (existingAsset?.storedUrl) {
    return { adId: ad.adId, success: true, storedUrl: existingAsset.storedUrl };
  }

  // Fetch fresh snapshot URL from Meta
  const snapshotUrl = await fetchFreshSnapshotUrl(ad.adId);
  if (!snapshotUrl) {
    return { adId: ad.adId, success: false, error: 'Failed to get fresh snapshot URL' };
  }

  // Extract actual media URL using Puppeteer
  const extracted = await extractMediaFromSnapshot(snapshotUrl);
  if (!extracted) {
    return { adId: ad.adId, success: false, error: 'Failed to extract media from snapshot' };
  }

  // Download media
  const downloaded = await downloadMedia(extracted.url);
  if (!downloaded) {
    return { adId: ad.adId, success: false, error: 'Failed to download media' };
  }

  // Upload to R2
  const extension = extensionFromContentType(downloaded.contentType);
  const key = generateAssetKey(ad.brandId, ad.id, extracted.type, 0, extension);

  const uploadResult = await uploadToR2(key, downloaded.buffer, downloaded.contentType);

  // Create or update AdAsset record
  await prisma.adAsset.upsert({
    where: {
      id: `${adDbId}-0`, // Use composite key
    },
    create: {
      id: `${adDbId}-0`,
      adId: adDbId,
      assetType: extracted.type,
      position: 0,
      originalUrl: extracted.url,
      storedUrl: uploadResult.url,
      storedKey: uploadResult.key,
      fileExtension: extension,
      fileSizeBytes: uploadResult.size,
      downloadStatus: 'completed',
    },
    update: {
      originalUrl: extracted.url,
      storedUrl: uploadResult.url,
      storedKey: uploadResult.key,
      fileExtension: extension,
      fileSizeBytes: uploadResult.size,
      downloadStatus: 'completed',
      downloadError: null,
    },
  });

  return { adId: ad.adId, success: true, storedUrl: uploadResult.url };
}

/**
 * Process multiple ads in batch.
 */
export async function processAdsToR2(limit = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessResult[];
}> {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured');
  }

  if (!FACEBOOK_ACCESS_TOKEN) {
    throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
  }

  // Find ads without completed assets
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      snapshotUrl: { not: null },
      assets: {
        none: { downloadStatus: 'completed' },
      },
    },
    select: { id: true },
    take: limit,
  });

  const results: ProcessResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const ad of ads) {
    const result = await processAdAsset(ad.id);
    results.push(result);
    if (result.success) {
      succeeded++;
      console.log(`✓ ${result.adId} -> ${result.storedUrl}`);
    } else {
      failed++;
      console.log(`✗ ${result.adId}: ${result.error}`);
    }

    // Small delay between ads to avoid rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { processed: ads.length, succeeded, failed, results };
}
