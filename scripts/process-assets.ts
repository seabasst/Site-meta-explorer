/**
 * Process pending AdAssets: extract media from snapshot URLs and upload to R2.
 *
 * Run this locally after ingestion to process assets while URLs are still fresh.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/process-assets.ts dotenv_config_path=.env.local
 *   npx tsx -r dotenv/config scripts/process-assets.ts dotenv_config_path=.env.local --limit 50
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from '../src/lib/prisma';
import { extractMediaFromSnapshot } from '../src/lib/media-extractor';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

// R2 config - read directly to avoid module caching issues
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL);
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function uploadToR2(key: string, buffer: Buffer, contentType: string) {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: buffer.length,
  };
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes('video/mp4')) return '.mp4';
  if (contentType.includes('video/webm')) return '.webm';
  if (contentType.includes('video')) return '.mp4';
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/gif')) return '.gif';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/svg')) return '.svg';
  return '.jpg';
}

function generateAssetKey(brandId: string, adId: string, assetType: string, position: number, ext: string): string {
  return `ads/${brandId}/${adId}/${assetType}-${position}${ext}`;
}

const CONCURRENCY = 3;
const DEFAULT_LIMIT = 100;

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

async function processAsset(asset: {
  id: string;
  originalUrl: string;
  ad: { id: string; adId: string; brandId: string };
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract actual media URL from snapshot
    console.log(`  Extracting media from snapshot...`);
    const extracted = await extractMediaFromSnapshot(asset.originalUrl);
    if (!extracted) {
      await prisma.adAsset.update({
        where: { id: asset.id },
        data: { downloadStatus: 'failed', downloadError: 'Failed to extract media' },
      });
      return { success: false, error: 'Failed to extract media' };
    }

    // Download media
    console.log(`  Downloading ${extracted.type}...`);
    const downloaded = await downloadMedia(extracted.url);
    if (!downloaded) {
      await prisma.adAsset.update({
        where: { id: asset.id },
        data: { downloadStatus: 'failed', downloadError: 'Failed to download media' },
      });
      return { success: false, error: 'Failed to download media' };
    }

    // Upload to R2
    console.log(`  Uploading to R2 (${(downloaded.buffer.length / 1024).toFixed(1)} KB)...`);
    const extension = extensionFromContentType(downloaded.contentType);
    const key = generateAssetKey(asset.ad.brandId, asset.ad.id, extracted.type, 0, extension);
    const uploadResult = await uploadToR2(key, downloaded.buffer, downloaded.contentType);

    // Update asset record
    await prisma.adAsset.update({
      where: { id: asset.id },
      data: {
        originalUrl: extracted.url,
        assetType: extracted.type,
        storedUrl: uploadResult.url,
        storedKey: uploadResult.key,
        fileExtension: extension,
        fileSizeBytes: uploadResult.size,
        downloadStatus: 'completed',
        downloadError: null,
      },
    });

    // Update ad displayFormat if video detected
    if (extracted.type === 'video') {
      await prisma.adLibraryAd.update({
        where: { id: asset.ad.id },
        data: { displayFormat: 'video' },
      });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await prisma.adAsset.update({
      where: { id: asset.id },
      data: { downloadStatus: 'failed', downloadError: errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

async function main() {
  // Parse args
  const limitArg = process.argv.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || process.argv[process.argv.indexOf('--limit') + 1]) : DEFAULT_LIMIT;
  const brandArg = process.argv.find(a => a.startsWith('--brand'));
  const brandName = brandArg ? (brandArg.split('=')[1] || process.argv[process.argv.indexOf('--brand') + 1]) : undefined;
  const minAdsArg = process.argv.find(a => a.startsWith('--min-ads'));
  const minAds = minAdsArg ? parseInt(minAdsArg.split('=')[1] || process.argv[process.argv.indexOf('--min-ads') + 1]) : undefined;
  const maxAdsArg = process.argv.find(a => a.startsWith('--max-ads'));
  const maxAds = maxAdsArg ? parseInt(maxAdsArg.split('=')[1] || process.argv[process.argv.indexOf('--max-ads') + 1]) : undefined;

  console.log('Asset Processor');
  console.log('===============\n');

  // Check R2 config
  if (!isR2Configured()) {
    console.error('❌ R2 is not configured. Set R2_* environment variables.');
    process.exit(1);
  }
  console.log('✓ R2 configured\n');

  // Build brand filter
  let brandIds: string[] | undefined;
  if (brandName) {
    const brand = await prisma.adLibraryBrand.findFirst({ where: { pageName: { contains: brandName, mode: 'insensitive' } } });
    if (!brand) { console.error(`Brand "${brandName}" not found`); process.exit(1); }
    brandIds = [brand.id];
    console.log(`Filtering to brand: ${brand.pageName}\n`);
  } else if (minAds !== undefined || maxAds !== undefined) {
    const brands = await prisma.adLibraryBrand.findMany({
      select: { id: true, pageName: true, _count: { select: { ads: true } } },
    });
    const filtered = brands.filter(b => {
      if (minAds !== undefined && b._count.ads < minAds) return false;
      if (maxAds !== undefined && b._count.ads > maxAds) return false;
      return true;
    });
    brandIds = filtered.map(b => b.id);
    console.log(`Filtering to ${filtered.length} brands with ${minAds ?? 0}-${maxAds ?? '∞'} ads:`);
    filtered.forEach(b => console.log(`  ${b.pageName}: ${b._count.ads} ads`));
    console.log();
  }

  // Get pending assets — ACTIVE-ADS-ONLY.
  // This script runs locally against shared prod. Previously it downloaded
  // any pending asset regardless of the ad's live status, silently re-burning
  // R2 + fbcdn on dead ads. See: .planning/review-2026-04-18/03-ingestion-pipeline.md
  // (P0 active-ads audit).
  const pendingAssets = await prisma.adAsset.findMany({
    where: {
      downloadStatus: 'pending',
      ad: {
        isActive: true,
        ...(brandIds ? { brandId: { in: brandIds } } : {}),
      },
    },
    include: {
      ad: { select: { id: true, adId: true, brandId: true } },
    },
    take: limit,
    orderBy: { createdAt: 'desc' }, // Process newest first (freshest URLs)
  });

  console.log(`Found ${pendingAssets.length} pending assets\n`);

  if (pendingAssets.length === 0) {
    console.log('Nothing to process.');
    process.exit(0);
  }

  let succeeded = 0;
  let failed = 0;

  // Process in batches with concurrency
  for (let i = 0; i < pendingAssets.length; i += CONCURRENCY) {
    const batch = pendingAssets.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (asset) => {
        console.log(`[${i + batch.indexOf(asset) + 1}/${pendingAssets.length}] Processing ${asset.ad.adId}...`);

        // Mark as downloading
        await prisma.adAsset.update({
          where: { id: asset.id },
          data: { downloadStatus: 'downloading' },
        });

        const result = await processAsset(asset);

        if (result.success) {
          console.log(`  ✓ Uploaded successfully\n`);
          succeeded++;
        } else {
          console.log(`  ✗ ${result.error}\n`);
          failed++;
        }

        return result;
      })
    );
  }

  // Final stats
  console.log('\n===============');
  console.log(`Processed: ${pendingAssets.length}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);

  // Show storage stats
  const stats = await prisma.adAsset.aggregate({
    where: { downloadStatus: 'completed' },
    _sum: { fileSizeBytes: true },
    _count: true,
  });

  console.log(`\nTotal assets in R2: ${stats._count}`);
  console.log(`Total storage: ${((stats._sum.fileSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
