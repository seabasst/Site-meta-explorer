/**
 * Combined: Download ad screenshots to R2 + detect partnership ads
 *
 * Single Puppeteer pass that:
 * 1. Renders the ad snapshot
 * 2. Checks for "Creator with Brand" partnership header
 * 3. Takes a screenshot and uploads to R2
 *
 * Usage:
 *   npx tsx scripts/download-and-detect.ts                  # All active brands, top 20
 *   npx tsx scripts/download-and-detect.ts --limit 50       # Top 50 brands by ad count
 *   npx tsx scripts/download-and-detect.ts --ads 50         # Top 50 ads per brand
 *   npx tsx scripts/download-and-detect.ts --brand Ninepine # Single brand
 *   npx tsx scripts/download-and-detect.ts --skip-existing  # Skip brands with all assets downloaded
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

// CLI args
const args = process.argv.slice(2);
const brandFilter = args.find(a => a.startsWith('--brand='))?.split('=')[1]
  || (args.includes('--brand') ? args[args.indexOf('--brand') + 1] : '');
const brandLimit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const adsPerBrand = parseInt(args.find(a => a.startsWith('--ads='))?.split('=')[1] || '20');
const skipExisting = args.includes('--skip-existing');
const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Partnership detection (runs inside Puppeteer page)
// ---------------------------------------------------------------------------

async function detectPartnership(page: Page, brandName: string): Promise<string | null> {
  try {
    const creatorName = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Strategy 1: "X with Y" on a single line near the top
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const m = lines[i].match(/^(.+?)\s+with\s+(.+?)$/i);
        if (m && m[1].length < 60 && m[2].length < 60 && m[1].length > 1 && m[2].length > 1) {
          const nearby = lines.slice(Math.max(0, i - 3), i + 4).join(' ');
          if (nearby.includes('Sponsored') || nearby.includes('sponsored') || i < 5) {
            return m[1].trim();
          }
        }
      }

      // Strategy 2: "CreatorName" then "with BrandName" on next line
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        if (lines[i + 1] && /^with\s+/i.test(lines[i + 1])) {
          const candidate = lines[i];
          if (candidate.length < 60 && candidate.length > 1) {
            return candidate;
          }
        }
      }

      // Strategy 3: "Paid partnership with X"
      const paidMatch = text.match(/Paid partnership with\s+([^\n]+)/i);
      if (paidMatch) return paidMatch[1].trim();

      return null;
    });

    // Filter out false positives where "creator" matches the brand name
    if (creatorName && creatorName.toLowerCase() !== brandName.toLowerCase()) {
      return creatorName;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// R2 helpers
// ---------------------------------------------------------------------------

async function checkObjectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<boolean> {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return true;
  } catch (error) {
    console.error(`  Upload failed ${key}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Combined download + detect for a single ad
// ---------------------------------------------------------------------------

interface AdJob {
  id: string;
  adId: string;
  snapshotUrl: string;
  brandId: string;
  brandName: string;
  reachEstimate: number;
}

interface AdResult {
  downloaded: boolean;
  skipped: boolean;
  creatorName: string | null;
}

async function processAd(browser: Browser, ad: AdJob): Promise<AdResult> {
  const r2Key = `ads/${ad.brandId}/${ad.adId}.png`;

  // Check if asset already exists in R2
  const exists = await checkObjectExists(r2Key);
  if (exists) {
    // Still need to check for partnership — open the page
    // But skip if we already have this ad's asset
    return { downloaded: false, skipped: true, creatorName: null };
  }

  const page = await browser.newPage();
  try {
    // Block heavy resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(ad.snapshotUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
    // Wait for JS rendering
    await page.waitForFunction(
      () => (document.body.innerText || '').length > 50,
      { timeout: 8000 },
    ).catch(() => {});

    // Detect partnership while page is loaded
    const creatorName = await detectPartnership(page, ad.brandName);

    // Take screenshot
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const buffer = Buffer.from(screenshot);

    // Upload to R2
    const uploaded = await uploadToR2(buffer, r2Key, 'image/png');
    if (uploaded) {
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
    }

    return { downloaded: uploaded, skipped: false, creatorName };
  } catch (error) {
    console.error(`  Failed ${ad.adId}:`, error instanceof Error ? error.message : '');
    return { downloaded: false, skipped: false, creatorName: null };
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Write partnerships to DB (batch at end of each brand)
// ---------------------------------------------------------------------------

interface PartnershipHit {
  creatorName: string;
  brandId: string;
  brandName: string;
  adCount: number;
  totalReach: number;
}

async function writePartnerships(hits: PartnershipHit[]): Promise<number> {
  let written = 0;
  for (const hit of hits) {
    const stableId = `scraped_${hit.creatorName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const creator = await prisma.adCreator.upsert({
      where: { pageId: stableId },
      create: {
        pageId: stableId,
        pageName: hit.creatorName,
        totalAds: hit.adCount,
        totalReach: hit.totalReach,
        brandCount: 1,
        tier: 'confirmed',
        score: 50 + 10,
        creatorType: 'person',
        categories: [],
        signals: ['partnership-ad-detected'],
      },
      update: {
        totalAds: { increment: hit.adCount },
        totalReach: { increment: hit.totalReach },
        tier: 'confirmed',
      },
    });

    await prisma.creatorPartnership.upsert({
      where: {
        creatorId_brandId: { creatorId: creator.id, brandId: hit.brandId },
      },
      create: {
        creatorId: creator.id,
        brandId: hit.brandId,
        adCount: hit.adCount,
        totalReach: hit.totalReach,
      },
      update: {
        adCount: { increment: hit.adCount },
        totalReach: { increment: hit.totalReach },
      },
    });

    written++;
  }
  return written;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═'.repeat(60));
  console.log('Download + Partnership Detection (Combined)');
  console.log('═'.repeat(60));

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('R2 credentials not configured');
    process.exit(1);
  }

  // Fetch brands
  const where: Record<string, unknown> = { ingestionStatus: 'active' };
  if (brandFilter) {
    where.pageName = { contains: brandFilter, mode: 'insensitive' };
  }

  let brands = await prisma.adLibraryBrand.findMany({
    where: where as any,
    orderBy: { activeAdCount: 'desc' },
    select: { id: true, pageId: true, pageName: true, activeAdCount: true },
  });

  if (brandLimit > 0) brands = brands.slice(0, brandLimit);

  console.log(`Brands: ${brands.length} | Ads/brand: ${adsPerBrand} | Concurrency: ${CONCURRENCY}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalPartnerships = 0;
  const allCreators = new Set<string>();

  try {
    for (let bi = 0; bi < brands.length; bi++) {
      const brand = brands[bi];
      const label = `[${bi + 1}/${brands.length}]`;

      // Get top ads for this brand — ACTIVE ONLY.
      // Same pattern fix as download-media / download-top-ads: the orderBy
      // sorted active first but still admitted inactive ads; they'd get
      // creatives downloaded AND produce stale CreatorPartnership rows.
      // See scope 3 of the audit.
      const ads = await prisma.adLibraryAd.findMany({
        where: {
          brandId: brand.id,
          isActive: true,
          snapshotUrl: { not: null },
        },
        orderBy: [
          { reachEstimate: 'desc' },
        ],
        take: adsPerBrand,
        select: { id: true, adId: true, snapshotUrl: true, reachEstimate: true },
      });

      if (ads.length === 0) {
        console.log(`${label} ${brand.pageName} — no ads`);
        continue;
      }

      console.log(`${label} ${brand.pageName} — ${ads.length} ads`);

      const jobs: AdJob[] = ads.filter(a => a.snapshotUrl).map(a => ({
        id: a.id,
        adId: a.adId,
        snapshotUrl: a.snapshotUrl!,
        brandId: brand.id,
        brandName: brand.pageName,
        reachEstimate: a.reachEstimate || 0,
      }));

      // Process in batches
      let downloaded = 0, skipped = 0, failed = 0;
      const creatorHits = new Map<string, { count: number; reach: number }>();

      for (let i = 0; i < jobs.length; i += CONCURRENCY) {
        const batch = jobs.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((job) => processAd(browser, job))
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled') {
            if (r.value.skipped) skipped++;
            else if (r.value.downloaded) downloaded++;
            else failed++;

            if (r.value.creatorName) {
              const existing = creatorHits.get(r.value.creatorName) || { count: 0, reach: 0 };
              existing.count++;
              existing.reach += batch[j].reachEstimate;
              creatorHits.set(r.value.creatorName, existing);
            }
          } else {
            failed++;
          }
        }

        const done = Math.min(i + CONCURRENCY, jobs.length);
        process.stdout.write(`\r    ${done}/${jobs.length} — ${downloaded} new, ${skipped} exist, ${failed} fail`);
      }
      process.stdout.write('\n');

      totalDownloaded += downloaded;
      totalSkipped += skipped;
      totalFailed += failed;

      // Write partnerships for this brand
      if (creatorHits.size > 0) {
        const hits: PartnershipHit[] = [...creatorHits.entries()].map(([name, data]) => ({
          creatorName: name,
          brandId: brand.id,
          brandName: brand.pageName,
          adCount: data.count,
          totalReach: data.reach,
        }));

        const names = hits.map(h => h.creatorName);
        console.log(`    Partnerships: ${names.join(', ')}`);

        await writePartnerships(hits);
        totalPartnerships += hits.length;
        for (const n of names) allCreators.add(n);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log('\n' + '═'.repeat(60));
  console.log('COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Assets: ${totalDownloaded} downloaded, ${totalSkipped} existed, ${totalFailed} failed`);
  console.log(`Partnerships: ${totalPartnerships} new, ${allCreators.size} unique creators`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
