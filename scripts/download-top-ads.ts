/**
 * Download top 20 ads (by reach) for each brand to R2 storage
 * Run with: npx tsx scripts/download-top-ads.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ad-assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-25ef069908854da9871d20aea605675a.r2.dev';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

const TOP_ADS_PER_BRAND = 20;
const CONCURRENT_DOWNLOADS = 3;

interface AdToDownload {
  id: string;
  adId: string;
  snapshotUrl: string;
  brandId: string;
  brandName: string;
  reachEstimate: number;
}

async function checkObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

async function captureAdSnapshot(
  browser: puppeteer.Browser,
  snapshotUrl: string,
  adId: string
): Promise<Buffer | null> {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(snapshotUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for ad content to load
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait for dynamic content

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });

    return Buffer.from(screenshot);
  } catch (error) {
    console.error(`Failed to capture ${adId}:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    await page.close();
  }
}

async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<boolean> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return true;
  } catch (error) {
    console.error(`Failed to upload ${key}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function downloadAd(
  browser: puppeteer.Browser,
  ad: AdToDownload
): Promise<boolean> {
  const r2Key = `ads/${ad.brandId}/${ad.adId}.png`;

  // Check if already exists
  if (await checkObjectExists(r2Key)) {
    console.log(`  ✓ Already exists: ${ad.adId}`);
    return true;
  }

  // Capture screenshot
  const screenshot = await captureAdSnapshot(browser, ad.snapshotUrl, ad.adId);
  if (!screenshot) {
    return false;
  }

  // Upload to R2
  const uploaded = await uploadToR2(screenshot, r2Key, 'image/png');
  if (uploaded) {
    // Update database with R2 URL
    const storedUrl = `${R2_PUBLIC_URL}/${r2Key}`;
    await prisma.adAsset.upsert({
      where: { id: `${ad.id}-0` },
      update: {
        storedKey: r2Key,
        storedUrl,
        downloadStatus: 'completed',
      },
      create: {
        id: `${ad.id}-0`,
        adId: ad.id,
        assetType: 'image',
        position: 0,
        originalUrl: ad.snapshotUrl,
        storedKey: r2Key,
        storedUrl,
        downloadStatus: 'completed',
      },
    });
    console.log(`  ✓ Downloaded: ${ad.adId}`);
    return true;
  }

  return false;
}

async function processAdsInBatches(
  browser: puppeteer.Browser,
  ads: AdToDownload[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < ads.length; i += CONCURRENT_DOWNLOADS) {
    const batch = ads.slice(i, i + CONCURRENT_DOWNLOADS);
    const results = await Promise.all(
      batch.map(ad => downloadAd(browser, ad))
    );

    success += results.filter(r => r).length;
    failed += results.filter(r => !r).length;
  }

  return { success, failed };
}

async function main() {
  console.log('Starting top ads download...\n');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('R2 credentials not configured');
    process.exit(1);
  }

  // Get all active brands
  const brands = await prisma.adLibraryBrand.findMany({
    where: { ingestionStatus: 'active' },
    select: { id: true, pageName: true },
  });

  console.log(`Found ${brands.length} active brands\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let totalSuccess = 0;
  let totalFailed = 0;

  try {
    for (const brand of brands) {
      console.log(`\n📦 ${brand.pageName}`);

      // Get top 20 ads by reach (active ads first)
      const topAds = await prisma.adLibraryAd.findMany({
        where: {
          brandId: brand.id,
          snapshotUrl: { not: null },
        },
        orderBy: [
          { isActive: 'desc' },
          { reachEstimate: 'desc' },
        ],
        take: TOP_ADS_PER_BRAND,
        select: {
          id: true,
          adId: true,
          snapshotUrl: true,
          reachEstimate: true,
        },
      });

      if (topAds.length === 0) {
        console.log('  No ads with snapshot URLs');
        continue;
      }

      console.log(`  Found ${topAds.length} top ads to download`);

      const adsToDownload: AdToDownload[] = topAds
        .filter(ad => ad.snapshotUrl)
        .map(ad => ({
          id: ad.id,
          adId: ad.adId,
          snapshotUrl: ad.snapshotUrl!,
          brandId: brand.id,
          brandName: brand.pageName,
          reachEstimate: ad.reachEstimate || 0,
        }));

      const { success, failed } = await processAdsInBatches(browser, adsToDownload);
      totalSuccess += success;
      totalFailed += failed;

      console.log(`  Completed: ${success} success, ${failed} failed`);
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log(`\n✅ Done! ${totalSuccess} downloaded, ${totalFailed} failed`);
}

main().catch(console.error);
