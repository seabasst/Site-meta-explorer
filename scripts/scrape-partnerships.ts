/**
 * Partnership Ad Scraper
 *
 * Renders ad snapshot URLs with Puppeteer and extracts "Creator with Brand"
 * partnership headers from the rendered page. Creates AdCreator and
 * CreatorPartnership records from the discovered relationships.
 *
 * Meta's API doesn't expose creator collaboration data as a structured field.
 * The only way to detect it is by rendering the ad_snapshot_url and reading
 * the header which shows "CreatorPage with BrandPage" on partnership ads.
 *
 * Usage:
 *   npx tsx scripts/scrape-partnerships.ts                     # All active brands
 *   npx tsx scripts/scrape-partnerships.ts --brand Ninepine    # Single brand
 *   npx tsx scripts/scrape-partnerships.ts --limit 10          # Top 10 brands by ad count
 *   npx tsx scripts/scrape-partnerships.ts --dry-run           # Preview, don't write to DB
 *   npx tsx scripts/scrape-partnerships.ts --sample 100        # Ads to sample per brand (default 100)
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const brandArg = args.find(a => a.startsWith('--brand='))?.split('=')[1]
  || (args.includes('--brand') ? args[args.indexOf('--brand') + 1] : '');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const sampleSize = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] || '100');
const dryRun = args.includes('--dry-run');
const CONCURRENCY = 5; // parallel Puppeteer pages

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim() && !tokens.includes(single.trim())) tokens.push(single.trim());
  if (tokens.length === 0) throw new Error('No Facebook access token found');
  return tokens;
}

const TOKENS = getTokens();
let tokenIdx = 0;
function getToken(): string { return TOKENS[tokenIdx % TOKENS.length]; }
function rotateToken(): void { tokenIdx++; }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartnershipHit {
  adId: string;
  snapshotUrl: string;
  creatorName: string;
  brandName: string;
  brandPageId: string;
  reach: number;
}

interface ScrapedAd {
  adId: string;
  snapshotUrl: string;
  reach: number;
  brandPageId: string;
  brandName: string;
}

// ---------------------------------------------------------------------------
// Puppeteer
// ---------------------------------------------------------------------------

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

async function closeBrowser() {
  if (browser?.connected) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

/**
 * Render a snapshot and extract the "Creator with Brand" header.
 * Uses domcontentloaded + short delay instead of networkidle2 for speed.
 */
async function dismissCookieDialog(page: Page): Promise<void> {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.toLowerCase() || '';
      if (text.includes('decline optional') || text.includes('allow essential')) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    // Fallback: allow all cookies
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.toLowerCase() || '';
      if (text.includes('allow all')) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });
  if (clicked) {
    // Wait for cookie dialog to dismiss and ad content to render
    await sleep(2000);
  }
}

async function scrapePartnership(
  page: Page,
  snapshotUrl: string,
): Promise<string | null> {
  try {
    await page.goto(snapshotUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    // Wait a bit for JS to render
    await page.waitForFunction(
      () => (document.body.innerText || '').length > 50,
      { timeout: 8000 },
    ).catch(() => {});

    // Dismiss Facebook cookie consent wall if present
    await dismissCookieDialog(page);

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

    return creatorName;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch snapshot URLs from Meta API
// ---------------------------------------------------------------------------

async function fetchAdsWithSnapshots(
  brandPageId: string,
  maxAds: number,
): Promise<ScrapedAd[]> {
  const ads: ScrapedAd[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const maxPages = Math.ceil(maxAds / 250);

  do {
    const token = getToken();
    const params = new URLSearchParams({
      access_token: token,
      search_terms: '*',
      ad_reached_countries: JSON.stringify(['SE', 'NO', 'DK', 'FI', 'GB', 'US', 'DE', 'FR', 'NL', 'AT', 'BE', 'ES', 'IT']),
      ad_active_status: 'ALL',
      fields: 'id,page_id,page_name,ad_snapshot_url,eu_total_reach',
      search_page_ids: brandPageId,
      limit: '250',
    });
    if (cursor) params.set('after', cursor);

    try {
      const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();

      if (data.error) {
        const rateLimitCodes = [2, 4, 17, 613, 80004];
        if (rateLimitCodes.includes(data.error.code)) {
          rotateToken();
          await sleep(10000);
          continue;
        }
        console.log(`    API error: ${data.error.message}`);
        break;
      }

      for (const ad of data.data || []) {
        if (ad.ad_snapshot_url) {
          ads.push({
            adId: ad.id,
            snapshotUrl: ad.ad_snapshot_url,
            reach: ad.eu_total_reach || 0,
            brandPageId,
            brandName: ad.page_name,
          });
        }
      }

      cursor = data.paging?.cursors?.after;
      pages++;
      if (cursor && pages < maxPages) await sleep(1500);
    } catch {
      break;
    }
  } while (cursor && pages < maxPages);

  return ads;
}

// ---------------------------------------------------------------------------
// Process ads with parallel Puppeteer pages
// ---------------------------------------------------------------------------

async function processAds(ads: ScrapedAd[]): Promise<PartnershipHit[]> {
  const hits: PartnershipHit[] = [];
  const b = await getBrowser();

  for (let i = 0; i < ads.length; i += CONCURRENCY) {
    const batch = ads.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (ad) => {
        const page = await b.newPage();
        try {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const type = req.resourceType();
            if (['stylesheet', 'font', 'image', 'media'].includes(type)) {
              req.abort();
            } else {
              req.continue();
            }
          });

          const creatorName = await scrapePartnership(page, ad.snapshotUrl);

          if (creatorName && creatorName !== ad.brandName) {
            return {
              adId: ad.adId,
              snapshotUrl: ad.snapshotUrl,
              creatorName,
              brandName: ad.brandName,
              brandPageId: ad.brandPageId,
              reach: ad.reach,
            } as PartnershipHit;
          }
          return null;
        } finally {
          await page.close().catch(() => {});
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        hits.push(r.value);
      }
    }

    const done = Math.min(i + CONCURRENCY, ads.length);
    process.stdout.write(`\r    Scraped ${done}/${ads.length} — ${hits.length} partnerships`);
  }

  process.stdout.write('\n');
  return hits;
}

// ---------------------------------------------------------------------------
// Batch DB writes
// ---------------------------------------------------------------------------

async function writePartnershipsToDB(allHits: PartnershipHit[]) {
  // Group by creator name
  const byCreator = new Map<string, { brands: Map<string, { adCount: number; totalReach: number; adIds: string[]; snapshotUrls: string[] }>; totalAds: number; totalReach: number }>();

  for (const hit of allHits) {
    let entry = byCreator.get(hit.creatorName);
    if (!entry) {
      entry = { brands: new Map(), totalAds: 0, totalReach: 0 };
      byCreator.set(hit.creatorName, entry);
    }
    entry.totalAds++;
    entry.totalReach += hit.reach;

    let brand = entry.brands.get(hit.brandPageId);
    if (!brand) {
      brand = { adCount: 0, totalReach: 0, adIds: [], snapshotUrls: [] };
      entry.brands.set(hit.brandPageId, brand);
    }
    brand.adCount++;
    brand.totalReach += hit.reach;
    brand.adIds.push(hit.adId);
    brand.snapshotUrls.push(hit.snapshotUrl);
  }

  let created = 0;
  let updated = 0;

  for (const [creatorName, data] of byCreator) {
    const stableId = `scraped_${creatorName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Upsert creator
    const creator = await prisma.adCreator.upsert({
      where: { pageId: stableId },
      create: {
        pageId: stableId,
        pageName: creatorName,
        totalAds: data.totalAds,
        totalReach: data.totalReach,
        brandCount: data.brands.size,
        tier: 'confirmed',
        score: 50 + data.brands.size * 10,
        creatorType: 'person',
        categories: [],
        signals: ['partnership-ad-scraped'],
      },
      update: {
        totalAds: data.totalAds,
        totalReach: data.totalReach,
        brandCount: data.brands.size,
        tier: 'confirmed',
        creatorType: 'person',
      },
    });

    // Upsert partnerships
    for (const [brandPageId, pData] of data.brands) {
      const brand = await prisma.adLibraryBrand.findFirst({
        where: { pageId: brandPageId },
        select: { id: true },
      });
      if (!brand) continue;

      await prisma.creatorPartnership.upsert({
        where: {
          creatorId_brandId: { creatorId: creator.id, brandId: brand.id },
        },
        create: {
          creatorId: creator.id,
          brandId: brand.id,
          adCount: pData.adCount,
          totalReach: pData.totalReach,
          metaAdIds: pData.adIds,
          snapshotUrls: pData.snapshotUrls,
        },
        update: {
          adCount: pData.adCount,
          totalReach: pData.totalReach,
          metaAdIds: pData.adIds,
          snapshotUrls: pData.snapshotUrls,
        },
      });
    }

    created++;
    if (created % 10 === 0) process.stdout.write(`\r  Written ${created}/${byCreator.size} creators`);
  }

  console.log(`\n  Done — ${created} creators, ${allHits.length} partnership ads written`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═'.repeat(60));
  console.log('Partnership Ad Scraper');
  console.log('═'.repeat(60));
  console.log(`Tokens: ${TOKENS.length} | Sample: ${sampleSize}/brand | Dry run: ${dryRun}`);

  const where: Record<string, unknown> = { ingestionStatus: 'active' };
  if (brandArg) {
    where.pageName = { contains: brandArg, mode: 'insensitive' };
  }

  let brands = await prisma.adLibraryBrand.findMany({
    where: where as any,
    orderBy: { activeAdCount: 'desc' },
    select: { id: true, pageId: true, pageName: true, activeAdCount: true },
  });

  if (limitArg > 0) brands = brands.slice(0, limitArg);

  console.log(`Brands to scan: ${brands.length}\n`);

  const allHits: PartnershipHit[] = [];

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const label = `[${i + 1}/${brands.length}]`;

    // Fetch snapshot URLs
    const ads = await fetchAdsWithSnapshots(brand.pageId, sampleSize);
    if (ads.length === 0) {
      console.log(`${label} ${brand.pageName} — no ads`);
      continue;
    }

    // Sample randomly if we got more than needed
    const sampled = ads.length > sampleSize
      ? ads.sort(() => Math.random() - 0.5).slice(0, sampleSize)
      : ads;

    console.log(`${label} ${brand.pageName} — scraping ${sampled.length} ads`);
    const hits = await processAds(sampled);
    allHits.push(...hits);

    if (hits.length > 0) {
      const names = [...new Set(hits.map(h => h.creatorName))];
      console.log(`    → ${names.length} creators: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` +${names.length - 5}` : ''}`);
    }

    if (i < brands.length - 1) await sleep(1000);
  }

  // Summary
  const creatorNames = [...new Set(allHits.map(h => h.creatorName))];
  console.log('\n' + '═'.repeat(60));
  console.log('COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Brands scanned: ${brands.length}`);
  console.log(`Partnership ads: ${allHits.length}`);
  console.log(`Unique creators: ${creatorNames.length}`);

  if (creatorNames.length > 0) {
    // Group for display
    const grouped = new Map<string, { brands: Set<string>; ads: number; reach: number }>();
    for (const h of allHits) {
      let e = grouped.get(h.creatorName);
      if (!e) { e = { brands: new Set(), ads: 0, reach: 0 }; grouped.set(h.creatorName, e); }
      e.brands.add(h.brandName);
      e.ads++;
      e.reach += h.reach;
    }
    console.log('\nTop creators:');
    const sorted = [...grouped.entries()].sort((a, b) => b[1].ads - a[1].ads).slice(0, 30);
    for (const [name, d] of sorted) {
      console.log(`  ${name} — ${d.ads} ads, ${d.reach.toLocaleString()} reach | ${[...d.brands].join(', ')}`);
    }
  }

  // Write to DB
  if (!dryRun && allHits.length > 0) {
    console.log('\nWriting to database...');
    await writePartnershipsToDB(allHits);
  } else if (dryRun) {
    console.log('\n[DRY RUN] Skipping database writes');
  }

  await closeBrowser();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(1);
});
