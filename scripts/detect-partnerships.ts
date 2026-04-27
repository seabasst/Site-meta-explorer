/**
 * Detect partnership ads by rendering ad snapshots with Puppeteer.
 *
 * Partnership ads show "Creator Name with Brand Name" in the rendered UI.
 * This is NOT available via API — only visible in the rendered HTML.
 *
 * Usage:
 *   npx tsx scripts/detect-partnerships.ts                        # Brands with 100+ ads
 *   npx tsx scripts/detect-partnerships.ts --brand "Ninepine"      # Single brand
 *   npx tsx scripts/detect-partnerships.ts --min-ads 50            # Custom threshold
 *   npx tsx scripts/detect-partnerships.ts --dry-run               # Don't save to DB
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CONCURRENCY = 3;
const TIMEOUT_MS = 12000;
const DELAY_BETWEEN_CHUNKS_MS = 300;
const MAX_CONSECUTIVE_ERRORS = 30; // restart browser after this many errors in a row
const BATCH_SIZE = 50;

interface PartnershipResult {
  adId: string;
  isPartnership: boolean;
  creatorName: string | null;
  brandName: string | null;
  rawText: string | null;
}

async function detectPartnership(
  browser: Browser,
  adId: string,
  snapshotUrl: string,
  retries = 1,
): Promise<PartnershipResult> {
  let page: Page | null = null;
  try {
    page = await browser.newPage();

    // Block images/media/fonts to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT_MS });
    await page.waitForSelector('body', { timeout: 3000 }).catch(() => {});

    // Extract text from the header area only (top 100px)
    const headerText = await page.evaluate(() => {
      const elements = document.querySelectorAll('span, a, div');
      const texts: string[] = [];
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 100 && rect.height < 40) {
          const t = el.textContent?.trim();
          if (t && t.length < 100) texts.push(t);
        }
      }
      return texts.join('\n');
    });

    // Look for "X with Y" pattern in header
    const withMatch = headerText.match(/^(.{2,40})\nwith\n(.{2,40})$/m)
      || headerText.match(/\b(.{2,40})\s+with\s+(.{2,40})\b/m);

    if (withMatch) {
      const creator = withMatch[1]?.trim();
      const brand = withMatch[2]?.trim();

      const looksLikeName = (s: string) =>
        s.length <= 40 &&
        (!s.includes('.') || !!s.match(/^[\w._]+$/)) &&
        s.split(/\s+/).length <= 4;

      const isNoise = (s: string) =>
        /cookie|browser|setting|essentials|comfort|stretch|fabric|discover|crafted|controlling|accept/i.test(s);

      if (creator && brand && looksLikeName(creator) && looksLikeName(brand) && !isNoise(creator) && !isNoise(brand)) {
        return {
          adId,
          isPartnership: true,
          creatorName: creator,
          brandName: brand,
          rawText: `${creator} with ${brand}`,
        };
      }
    }

    // Check "Paid partnership with X"
    const paidMatch = headerText.match(/Paid partnership with\s+(.{2,40})/i);
    if (paidMatch) {
      return {
        adId,
        isPartnership: true,
        creatorName: null,
        brandName: paidMatch[1]?.trim() || null,
        rawText: paidMatch[0].trim(),
      };
    }

    return { adId, isPartnership: false, creatorName: null, brandName: null, rawText: null };
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return detectPartnership(browser, adId, snapshotUrl, retries - 1);
    }
    return {
      adId,
      isPartnership: false,
      creatorName: null,
      brandName: null,
      rawText: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
}

async function main() {
  const args = process.argv.slice(2);
  const brandArg = args.find(a => a.startsWith('--brand='))?.split('=')[1];
  const minAdsArg = args.find(a => a.startsWith('--min-ads='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const minAds = minAdsArg ? parseInt(minAdsArg) : 100;

  console.log('═'.repeat(60));
  console.log('Partnership Ad Detection (Puppeteer)');
  console.log('═'.repeat(60));
  if (dryRun) console.log('DRY RUN — not saving to DB');

  // Get brands to process
  const brandWhere: any = { ingestionStatus: 'active' };
  if (brandArg) {
    brandWhere.pageName = { contains: brandArg, mode: 'insensitive' };
  } else {
    brandWhere.activeAdCount = { gte: minAds };
  }

  const brands = await prisma.adLibraryBrand.findMany({
    where: brandWhere,
    orderBy: { activeAdCount: 'desc' },
    select: { id: true, pageId: true, pageName: true, activeAdCount: true },
  });

  const totalAds = brands.reduce((s, b) => s + (b.activeAdCount || 0), 0);
  console.log(`Brands: ${brands.length} (${minAds}+ active ads)`);
  console.log(`Total ads to scan: ~${totalAds}`);
  const estHours = Math.ceil((totalAds / CONCURRENCY) * 3.5 / 3600);
  console.log(`Estimated time: ~${estHours} hours`);
  console.log();

  let browser = await launchBrowser();

  let grandTotalChecked = 0;
  let grandTotalPartnerships = 0;
  let grandTotalErrors = 0;
  const allCreators = new Map<string, { name: string; brands: Set<string>; adCount: number }>();

  for (let bi = 0; bi < brands.length; bi++) {
    const brand = brands[bi];
    const brandLabel = `[${bi + 1}/${brands.length}]`;

    // Get all active ads for this brand
    const ads = await prisma.adLibraryAd.findMany({
      where: { brandId: brand.id, isActive: true, snapshotUrl: { not: null } },
      select: { adId: true, snapshotUrl: true },
      orderBy: { reachEstimate: 'desc' },
    });

    let brandPartnerships = 0;
    let brandErrors = 0;
    let consecutiveErrors = 0;

    for (let i = 0; i < ads.length; i += CONCURRENCY) {
      const chunk = ads.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(ad => detectPartnership(browser, ad.adId, ad.snapshotUrl!))
      );

      for (const result of results) {
        grandTotalChecked++;
        if (result.rawText?.startsWith('ERROR:')) {
          brandErrors++;
          grandTotalErrors++;
          consecutiveErrors++;
        } else {
          consecutiveErrors = 0;
          if (result.isPartnership) {
            brandPartnerships++;
            grandTotalPartnerships++;

            // Track creator
            const key = result.creatorName || 'unknown';
            const existing = allCreators.get(key);
            if (existing) {
              existing.brands.add(brand.pageName);
              existing.adCount++;
            } else {
              allCreators.set(key, { name: key, brands: new Set([brand.pageName]), adCount: 1 });
            }

            if (!dryRun) {
              await prisma.adLibraryAd.update({
                where: { adId: result.adId },
                data: { bylines: result.rawText },
              }).catch(() => {}); // Don't crash on DB errors
            }
          }
        }
      }

      // Restart browser if too many consecutive errors (Facebook rate limiting)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`\n    ⚠ ${consecutiveErrors} consecutive errors — restarting browser & waiting 30s...`);
        await browser.close().catch(() => {});
        await new Promise(r => setTimeout(r, 30000));
        browser = await launchBrowser();
        consecutiveErrors = 0;
      }

      // Throttle between chunks
      if (i + CONCURRENCY < ads.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
      }
    }

    console.log(`${brandLabel} ${brand.pageName}: ${ads.length} ads → ${brandPartnerships} partnerships, ${brandErrors} errors`);
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('DETECTION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Brands scanned: ${brands.length}`);
  console.log(`Ads checked: ${grandTotalChecked}`);
  console.log(`Partnerships found: ${grandTotalPartnerships}`);
  console.log(`Errors: ${grandTotalErrors}`);

  if (allCreators.size > 0) {
    console.log(`\nUnique creators: ${allCreators.size}`);
    console.log('\nTop 30 creators by ad volume:');
    console.log('─'.repeat(60));
    const sorted = Array.from(allCreators.values()).sort((a, b) => b.adCount - a.adCount);
    for (const c of sorted.slice(0, 30)) {
      const brandNames = Array.from(c.brands).join(', ');
      console.log(`  ${c.name}: ${c.adCount} ads (${c.brands.size} brands: ${brandNames})`);
    }
  }

  await browser.close().catch(() => {});
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
