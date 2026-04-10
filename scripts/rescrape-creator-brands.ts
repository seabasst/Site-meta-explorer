/**
 * Re-scrape only brands that already have creator partnerships.
 * Extracts partnership info + downloads the actual ad creative (image/video) to R2.
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// R2 setup
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC = process.env.R2_PUBLIC_URL!;

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';
const args = process.argv.slice(2);
const BRAND_LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const CONCURRENCY = 3;
const SAMPLE_SIZE = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] || '50');
const FRESH = args.includes('--fresh'); // Clear existing data before scraping
const NEW_ONLY = args.includes('--new'); // Only scan brands without existing partnerships

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

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
    for (const btn of buttons) {
      const text = (btn as HTMLElement).innerText?.toLowerCase() || '';
      if (text.includes('allow all')) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });
  if (clicked) await sleep(2000);
}

const NOISE_PATTERNS = [/hsts-pixel/, /cookie_info_card/, /spacer/i, /pixel\.gif/i, /tr\?/, /beacon/i, /\/images\/cookies\//];

/** Render snapshot, detect partnership, and extract media URL */
async function scrapePartnershipAndMedia(page: Page, snapshotUrl: string): Promise<{ creatorName: string; mediaUrl: string; mediaType: 'image' | 'video' } | null> {
  try {
    // DON'T block images/media — we need them to extract the creative
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['stylesheet', 'font'].includes(type)) req.abort(); else req.continue();
    });

    await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await dismissCookieDialog(page);

    // Extract creator name AND media in one evaluate
    const result = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Detect creator name
      let creatorName: string | null = null;

      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const m = lines[i].match(/^(.+?)\s+with\s+(.+?)$/i);
        if (m && m[1].length < 60 && m[2].length < 60 && m[1].length > 1 && m[2].length > 1) {
          const nearby = lines.slice(Math.max(0, i - 3), i + 4).join(' ');
          if (nearby.includes('Sponsored') || nearby.includes('sponsored') || i < 5) {
            creatorName = m[1].trim();
            break;
          }
        }
      }

      if (!creatorName) {
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          if (lines[i + 1] && /^with\s+/i.test(lines[i + 1])) {
            const candidate = lines[i];
            if (candidate.length < 60 && candidate.length > 1) { creatorName = candidate; break; }
          }
        }
      }

      if (!creatorName) {
        const paidMatch = text.match(/Paid partnership with\s+([^\n]+)/i);
        if (paidMatch) creatorName = paidMatch[1].trim();
      }

      if (!creatorName) return null;

      // Extract media — videos first, then largest image
      const media: { src: string; tag: string; w: number; h: number }[] = [];

      for (const v of document.querySelectorAll('video')) {
        const src = v.src || v.querySelector('source')?.src;
        if (src) media.push({ src, tag: 'video', w: 0, h: 0 });
      }

      for (const img of document.querySelectorAll('img')) {
        if (img.src) media.push({ src: img.src, tag: 'img', w: img.naturalWidth, h: img.naturalHeight });
      }

      return { creatorName, media };
    });

    if (!result) return null;

    // Pick best media
    const { creatorName, media } = result;

    // Try video first
    for (const m of media) {
      if (m.tag === 'video' && m.src && !NOISE_PATTERNS.some(p => p.test(m.src))) {
        return { creatorName, mediaUrl: m.src, mediaType: 'video' };
      }
    }

    // Then largest fbcdn image
    const images = media
      .filter(m => m.tag === 'img' && m.src && !NOISE_PATTERNS.some(p => p.test(m.src)))
      .filter(m => m.w > 50 && m.h > 50)
      .sort((a, b) => {
        const aFb = a.src.includes('fbcdn') ? 10000 : 0;
        const bFb = b.src.includes('fbcdn') ? 10000 : 0;
        return (bFb + b.w * b.h) - (aFb + a.w * a.h);
      });

    if (images.length > 0) {
      return { creatorName, mediaUrl: images[0].src, mediaType: 'image' };
    }

    // Partnership found but no media
    return { creatorName, mediaUrl: '', mediaType: 'image' };
  } catch {
    return null;
  }
}

/** Download media from URL and upload to R2 */
async function downloadAndUploadToR2(mediaUrl: string, adId: string, mediaType: 'image' | 'video'): Promise<string | null> {
  if (!mediaUrl) return null;
  try {
    const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return null; // Too small, likely a tracking pixel

    const contentType = res.headers.get('content-type') || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('mp4') || contentType.includes('video')) ext = '.mp4';

    const key = `creators/${adId}${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return `${R2_PUBLIC}/${key}`;
  } catch {
    return null;
  }
}

interface Hit {
  adId: string;
  snapshotUrl: string;
  creatorName: string;
  brandPageId: string;
  brandName: string;
  reach: number;
  mediaUrl: string;    // R2 URL of downloaded creative
  mediaType: 'image' | 'video';
}

async function fetchAndScrape(brandPageId: string, maxAds: number): Promise<Hit[]> {
  const ads: { adId: string; snapshotUrl: string; reach: number; brandName: string }[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const maxPages = Math.ceil(maxAds / 250);

  do {
    const token = getToken();
    const params = new URLSearchParams({
      access_token: token,
      search_terms: '*',
      ad_reached_countries: JSON.stringify(['SE','NO','DK','FI','GB','US','DE','FR','NL','AT','BE','ES','IT']),
      ad_active_status: 'ALL',
      fields: 'id,page_id,page_name,ad_snapshot_url,eu_total_reach',
      search_page_ids: brandPageId,
      limit: '250',
    });
    if (cursor) params.set('after', cursor);

    try {
      const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.error) {
        if ([2,4,17,613,80004].includes(data.error.code)) { rotateToken(); await sleep(10000); continue; }
        break;
      }
      for (const ad of data.data || []) {
        if (ad.ad_snapshot_url) ads.push({ adId: ad.id, snapshotUrl: ad.ad_snapshot_url, reach: ad.eu_total_reach || 0, brandName: ad.page_name });
      }
      cursor = data.paging?.cursors?.after;
      pages++;
      if (cursor && pages < maxPages) await sleep(1500);
    } catch { break; }
  } while (cursor && pages < maxPages);

  if (ads.length === 0) return [];

  const sampled = ads.length > maxAds ? ads.sort(() => Math.random() - 0.5).slice(0, maxAds) : ads;
  const hits: Hit[] = [];
  const b = await getBrowser();

  for (let i = 0; i < sampled.length; i += CONCURRENCY) {
    const batch = sampled.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(async (ad) => {
      const page = await b.newPage();
      try {
        const scraped = await scrapePartnershipAndMedia(page, ad.snapshotUrl);
        if (!scraped || scraped.creatorName === ad.brandName) return null;

        // Download the actual creative and upload to R2
        const r2Url = await downloadAndUploadToR2(scraped.mediaUrl, ad.adId, scraped.mediaType);

        return {
          adId: ad.adId,
          snapshotUrl: ad.snapshotUrl,
          creatorName: scraped.creatorName,
          brandPageId,
          brandName: ad.brandName,
          reach: ad.reach,
          mediaUrl: r2Url || '',
          mediaType: scraped.mediaType,
        } as Hit;
      } finally { await page.close().catch(() => {}); }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) hits.push(r.value);
    }
    const done = Math.min(i + CONCURRENCY, sampled.length);
    const withMedia = hits.filter(h => h.mediaUrl).length;
    process.stdout.write(`\r    Scraped ${done}/${sampled.length} — ${hits.length} partnerships (${withMedia} with media)`);
  }
  process.stdout.write('\n');
  return hits;
}

async function main() {
  console.log(`Re-scraping creator brands with media download (sample=${SAMPLE_SIZE}, limit=${BRAND_LIMIT || 'all'})...\n`);

  // Get brands that already have partnerships
  const existingBrandIds = new Set(
    (await prisma.creatorPartnership.findMany({ select: { brandId: true }, distinct: ['brandId'] }))
      .map(b => b.brandId)
  );

  let brands;
  if (NEW_ONLY) {
    // Only brands we haven't scraped yet
    brands = await prisma.adLibraryBrand.findMany({
      where: { ingestionStatus: 'active', id: { notIn: [...existingBrandIds] } },
      select: { id: true, pageId: true, pageName: true },
      orderBy: { activeAdCount: 'desc' },
    });
    if (BRAND_LIMIT > 0) brands = brands.slice(0, BRAND_LIMIT);
    console.log(`New brands to scan (not yet scraped): ${brands.length}\n`);
  } else if (existingBrandIds.size > 0 && !FRESH) {
    brands = await prisma.adLibraryBrand.findMany({
      where: { id: { in: [...existingBrandIds] } },
      select: { id: true, pageId: true, pageName: true },
      orderBy: { pageName: 'asc' },
    });
    if (BRAND_LIMIT > 0) brands = brands.slice(0, BRAND_LIMIT);
    console.log(`Brands to re-scrape (from existing partnerships): ${brands.length}\n`);
  } else {
    brands = await prisma.adLibraryBrand.findMany({
      where: { ingestionStatus: 'active' },
      select: { id: true, pageId: true, pageName: true },
      orderBy: { activeAdCount: 'desc' },
    });
    if (BRAND_LIMIT > 0) brands = brands.slice(0, BRAND_LIMIT);
    console.log(`Scanning all active brands: ${brands.length}\n`);
  }

  if (FRESH) {
    await prisma.creatorPartnership.deleteMany({});
    await prisma.adCreator.deleteMany({});
    console.log('Cleared old creator data.\n');
  }

  const allHits: Hit[] = [];

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    console.log(`[${i + 1}/${brands.length}] ${brand.pageName}`);
    const hits = await fetchAndScrape(brand.pageId, SAMPLE_SIZE);
    allHits.push(...hits);
    if (hits.length > 0) {
      const names = [...new Set(hits.map(h => h.creatorName))];
      console.log(`    → ${names.length} creators: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` +${names.length - 5}` : ''}`);
    }
    if (i < brands.length - 1) await sleep(500);
  }

  // Aggregate by creator
  const byCreator = new Map<string, {
    brands: Map<string, { adCount: number; totalReach: number; adIds: string[]; snapshotUrls: string[]; mediaUrls: string[]; mediaTypes: string[] }>;
    totalAds: number; totalReach: number;
  }>();

  for (const hit of allHits) {
    let entry = byCreator.get(hit.creatorName);
    if (!entry) { entry = { brands: new Map(), totalAds: 0, totalReach: 0 }; byCreator.set(hit.creatorName, entry); }
    entry.totalAds++;
    entry.totalReach += hit.reach;
    let brand = entry.brands.get(hit.brandPageId);
    if (!brand) { brand = { adCount: 0, totalReach: 0, adIds: [], snapshotUrls: [], mediaUrls: [], mediaTypes: [] }; entry.brands.set(hit.brandPageId, brand); }
    brand.adCount++;
    brand.totalReach += hit.reach;
    brand.adIds.push(hit.adId);
    brand.snapshotUrls.push(hit.snapshotUrl);
    brand.mediaUrls.push(hit.mediaUrl);
    brand.mediaTypes.push(hit.mediaType);
  }

  // Reconnect DB (Neon may have timed out during long scrape)
  await prisma.$disconnect();
  await sleep(1000);
  await prisma.$connect();

  console.log(`\nWriting ${byCreator.size} creators to database...`);

  let written = 0;
  for (const [creatorName, data] of byCreator) {
    const stableId = `scraped_${creatorName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const creator = await prisma.adCreator.upsert({
      where: { pageId: stableId },
      create: {
        pageId: stableId, pageName: creatorName,
        totalAds: data.totalAds, totalReach: data.totalReach,
        brandCount: data.brands.size,
        tier: 'confirmed', score: 50 + data.brands.size * 10,
        creatorType: 'person', categories: [], signals: ['partnership-ad-scraped'],
      },
      update: {
        totalAds: data.totalAds, totalReach: data.totalReach,
        brandCount: data.brands.size, tier: 'confirmed', creatorType: 'person',
      },
    });

    for (const [brandPageId, pData] of data.brands) {
      const brand = await prisma.adLibraryBrand.findFirst({ where: { pageId: brandPageId }, select: { id: true } });
      if (!brand) continue;
      await prisma.creatorPartnership.upsert({
        where: { creatorId_brandId: { creatorId: creator.id, brandId: brand.id } },
        create: {
          creatorId: creator.id, brandId: brand.id,
          adCount: pData.adCount, totalReach: pData.totalReach,
          metaAdIds: pData.adIds, snapshotUrls: pData.snapshotUrls,
          mediaUrls: pData.mediaUrls, mediaTypes: pData.mediaTypes,
        },
        update: {
          adCount: pData.adCount, totalReach: pData.totalReach,
          metaAdIds: pData.adIds, snapshotUrls: pData.snapshotUrls,
          mediaUrls: pData.mediaUrls, mediaTypes: pData.mediaTypes,
        },
      });
    }
    written++;
    if (written % 10 === 0) process.stdout.write(`\r  Written ${written}/${byCreator.size}`);
  }

  const withMedia = allHits.filter(h => h.mediaUrl).length;
  console.log(`\n\nDone! ${byCreator.size} creators, ${allHits.length} partnership ads (${withMedia} with downloaded media).`);

  if (browser?.connected) await browser.close().catch(() => {});
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  if (browser?.connected) await browser.close().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
