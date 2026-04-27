/**
 * Authenticated Puppeteer scrape for API-blocked brands.
 *
 * Usage:
 *   npx tsx scripts/scrape-brand-authed.ts --login
 *     → Opens headful Chrome. Log into facebook.com, then press Enter in the terminal.
 *       Cookies are persisted to .puppeteer-meta-profile/ for future runs.
 *
 *   npx tsx scripts/scrape-brand-authed.ts <pageId>
 *     → Runs headless using the persisted session, scrapes all ads,
 *       upserts brand + ads + assets, uploads media to R2.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import puppeteer, { Browser } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uploadToR2, isR2Configured, generateAssetKey } from '../src/lib/r2';
import readline from 'readline';
import { resolve } from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const PROFILE_DIR = resolve(process.cwd(), '.puppeteer-meta-profile');

function urlFor(pageId: string) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&sort_data[direction]=desc&sort_data[mode]=total_impressions&view_all_page_id=${pageId}`;
}

async function promptEnter(msg: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>(r => rl.question(msg, () => { rl.close(); r(); }));
}

async function launch(headless: boolean): Promise<Browser> {
  return puppeteer.launch({
    headless,
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: headless ? { width: 1400, height: 1000 } : null,
  });
}

async function loginFlow() {
  const browser = await launch(false);
  const page = await browser.newPage();
  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
  console.log('\n→ A Chrome window has opened. Log into Facebook, then come back here.');
  await promptEnter('   Press Enter when you\'re logged in… ');
  await browser.close();
  console.log('✓ Session persisted to .puppeteer-meta-profile/');
}

interface ScrapedAd {
  adId: string;
  snapshotUrl: string | null;
  startedOn: string | null;
  platforms: string[];
  cta: string | null;
  bodyText: string;
  title: string | null;
  mediaType: 'image' | 'video' | 'carousel' | 'unknown';
  mediaUrls: string[];
  landingUrl: string | null;
}

async function scrapeBrand(pageId: string) {
  if (!isR2Configured()) throw new Error('R2 not configured in env');

  const browser = await launch(true);
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => { (globalThis as any).__name = (fn: any) => fn; });

  console.log(`→ Loading ${urlFor(pageId)}`);
  await page.goto(urlFor(pageId), { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Sanity: are we logged in?
  const loggedIn = await page.evaluate(() => !document.body.innerText.includes('Log in to Facebook'));
  if (!loggedIn) {
    await browser.close();
    throw new Error('Session not authenticated. Run `npx tsx scripts/scrape-brand-authed.ts --login` first.');
  }

  // Header says "~670 results"
  const totalHeader = await page.evaluate(() => {
    const m = document.body.innerText.match(/(~?\d+[\d,]*)\s+(results|ads?)/i);
    return m ? m[0] : null;
  });
  console.log(`  ${totalHeader}`);

  // Scroll to load all ad cards
  let prev = 0, stable = 0;
  for (let i = 0; i < 400; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, 2000);
      const sc = Array.from(document.querySelectorAll('div')).filter(
        el => el.scrollHeight > el.clientHeight + 100
      );
      for (const el of sc) el.scrollTop = el.scrollHeight;
    });
    await new Promise(r => setTimeout(r, 1500));
    const count = await page.evaluate(() =>
      (document.body.innerText.match(/Library ID[:\s]+\d+/g) || []).length
    );
    process.stdout.write(`\r  loaded: ${count} ads (iter ${i + 1})   `);
    if (count === prev) {
      stable++;
      if (stable >= 8) break;
    } else {
      stable = 0;
      prev = count;
    }
  }
  console.log('');

  // Extract ad cards
  const ads = await page.evaluate((): any[] => {
    const results: any[] = [];
    const libIdNodes = Array.from(document.querySelectorAll('span, div')).filter(
      el => /^Library ID:/.test((el as HTMLElement).innerText || '')
    );
    const seenCards = new Set<Element>();
    for (const libEl of libIdNodes) {
      let card: Element | null = libEl;
      for (let i = 0; i < 12; i++) {
        card = card.parentElement;
        if (!card) break;
        const txt = (card as HTMLElement).innerText || '';
        if (txt.includes('Library ID:') && txt.length > 200 && txt.length < 6000) break;
      }
      if (!card || seenCards.has(card)) continue;
      seenCards.add(card);
      const txt = (card as HTMLElement).innerText || '';
      const adIdMatch = txt.match(/Library ID:\s*(\d+)/);
      if (!adIdMatch) continue;
      const startedMatch = txt.match(/Started running on\s+([A-Za-z0-9, ]+?)(?:\n|$)/);
      const platformsMatch = txt.match(/Platforms\s+([A-Za-z, ]+)/);

      const snapLink = card.querySelector('a[href*="/ads/library/?id="]') as HTMLAnchorElement | null;
      const extLinks = Array.from(card.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
      const landing = extLinks.find(a => !a.href.includes('facebook.com'))?.href || null;

      const videos = card.querySelectorAll('video');
      const imgs = Array.from(card.querySelectorAll('img')).filter(
        i => /scontent|fbcdn/.test(i.src) && i.width > 100
      );
      let mediaType: string = 'unknown';
      const mediaUrls: string[] = [];
      if (videos.length > 0) {
        mediaType = 'video';
        videos.forEach(v => { if (v.poster) mediaUrls.push(v.poster); if (v.src) mediaUrls.push(v.src); });
      } else if (imgs.length > 1) {
        mediaType = 'carousel';
        imgs.forEach(i => mediaUrls.push(i.src));
      } else if (imgs.length === 1) {
        mediaType = 'image';
        mediaUrls.push(imgs[0].src);
      }

      const ctaEl = Array.from(card.querySelectorAll('[role="button"], a')).find(el => {
        const t = (el as HTMLElement).innerText?.trim() || '';
        return /^(Shop now|Learn more|Sign up|Get offer|Order now|Buy now|Subscribe|Book now|Download|Apply now|Contact us|Get quote|Watch more)$/i.test(t);
      });
      const cta = ctaEl ? (ctaEl as HTMLElement).innerText.trim() : null;

      const lines = txt.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      const skip = (l: string) =>
        /Library ID|Started running|Platforms|See summary|Open Drop|This ad has multiple|^(Sponsored|Active|Shop now|Learn more|Get offer|Sign up|Order now|Subscribe|Book now|Apply now|Contact us|Get quote|Watch more|\d+ ads? use)/i.test(l);
      const cand = lines.filter(l => !skip(l));
      cand.sort((a, b) => b.length - a.length);
      const bodyText = cand[0] || '';
      const title = cand[1] && cand[1].length < 120 ? cand[1] : null;

      results.push({
        adId: adIdMatch[1],
        snapshotUrl: snapLink?.href || null,
        startedOn: startedMatch?.[1]?.trim() || null,
        platforms: platformsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
        cta, bodyText, title, mediaType,
        mediaUrls: Array.from(new Set(mediaUrls)),
        landingUrl: landing,
      });
    }
    return results;
  });

  // Try to grab brand display info too
  const brandInfo = await page.evaluate(() => {
    const h1 = document.querySelector('h1, h2') as HTMLElement | null;
    const imgs = Array.from(document.querySelectorAll('img')).filter(
      i => /^https:\/\/scontent/.test(i.src) && i.width <= 200 && i.width >= 40
    );
    return { name: h1?.innerText || '', profilePic: imgs[0]?.src || null };
  });

  await browser.close();

  const byId = new Map<string, ScrapedAd>();
  for (const a of ads) if (a.adId) byId.set(a.adId, a);
  const unique = Array.from(byId.values());
  console.log(`  extracted: ${unique.length} unique ads`);

  return { ads: unique, totalHeader, brandInfo };
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function upsertAds(
  pageId: string,
  brandName: string,
  profilePicUrl: string | null,
  ads: ScrapedAd[]
) {
  // Upsert brand
  const brand = await prisma.adLibraryBrand.upsert({
    where: { pageId },
    create: {
      pageId, pageName: brandName || pageId,
      profilePicUrl: profilePicUrl || undefined,
      ingestionStatus: 'active',
      activeAdCount: ads.length,
      lastCheckedAt: new Date(),
    },
    update: {
      pageName: brandName || undefined,
      profilePicUrl: profilePicUrl || undefined,
      ingestionStatus: 'active',
      activeAdCount: ads.length,
      lastCheckedAt: new Date(),
    },
  });
  console.log(`  brand: ${brand.pageName} (${brand.id})`);

  let created = 0, updated = 0, assetsUp = 0, assetsSkipped = 0, assetsFailed = 0;

  for (const [i, ad] of ads.entries()) {
    const start = parseDate(ad.startedOn);
    const adRow = await prisma.adLibraryAd.upsert({
      where: { adId: ad.adId },
      create: {
        adId: ad.adId,
        brandId: brand.id,
        displayFormat: ad.mediaType === 'unknown' ? null : ad.mediaType,
        publisherPlatforms: ad.platforms.map(p => p.toLowerCase()),
        body: ad.bodyText || null,
        title: ad.title,
        linkUrl: ad.landingUrl,
        ctaText: ad.cta,
        snapshotUrl: ad.snapshotUrl,
        startDate: start,
        isActive: true,
      },
      update: {
        displayFormat: ad.mediaType === 'unknown' ? null : ad.mediaType,
        publisherPlatforms: ad.platforms.map(p => p.toLowerCase()),
        body: ad.bodyText || null,
        title: ad.title,
        linkUrl: ad.landingUrl,
        ctaText: ad.cta,
        snapshotUrl: ad.snapshotUrl,
        startDate: start,
        isActive: true,
      },
    });
    const existed = adRow.createdAt < new Date(Date.now() - 5000);
    if (existed) updated++; else created++;

    // Upload each media URL to R2, create AdAsset
    for (let pos = 0; pos < ad.mediaUrls.length; pos++) {
      const url = ad.mediaUrls[pos];
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) continue;
      // Skip if asset already exists for this position
      const existing = await prisma.adAsset.findFirst({
        where: { adId: adRow.id, position: pos },
        select: { id: true, downloadStatus: true },
      });
      if (existing?.downloadStatus === 'completed') { assetsSkipped++; continue; }

      try {
        const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) throw new Error('too small');
        const ct = res.headers.get('content-type') || '';
        const isVideo = ct.includes('video') || /\.mp4/i.test(url);
        const ext = isVideo ? '.mp4' : (ct.includes('png') ? '.png' : '.jpg');
        const assetType = isVideo ? 'video' : 'image';
        const key = generateAssetKey(brand.id, ad.adId, assetType, pos, ext);
        const up = await uploadToR2(key, buf, isVideo ? 'video/mp4' : 'image/jpeg');

        if (existing) {
          await prisma.adAsset.update({
            where: { id: existing.id },
            data: { storedUrl: up.url, storedKey: up.key, originalUrl: url, downloadStatus: 'completed', fileSizeBytes: buf.length, fileExtension: ext, assetType },
          });
        } else {
          await prisma.adAsset.create({
            data: {
              adId: adRow.id, assetType, position: pos,
              originalUrl: url, storedUrl: up.url, storedKey: up.key,
              downloadStatus: 'completed', fileSizeBytes: buf.length, fileExtension: ext,
            },
          });
        }
        assetsUp++;
      } catch (e) {
        assetsFailed++;
      }
    }

    if ((i + 1) % 25 === 0 || i === ads.length - 1) {
      process.stdout.write(`\r  ads: ${i + 1}/${ads.length} | new: ${created} upd: ${updated} | assets up: ${assetsUp} skip: ${assetsSkipped} fail: ${assetsFailed}   `);
    }
  }
  console.log('');

  // Mark ads no longer seen as inactive
  const seenIds = new Set(ads.map(a => a.adId));
  const missing = await prisma.adLibraryAd.findMany({
    where: { brandId: brand.id, isActive: true, adId: { notIn: Array.from(seenIds) } },
    select: { id: true },
  });
  if (missing.length) {
    await prisma.adLibraryAd.updateMany({
      where: { id: { in: missing.map(m => m.id) } },
      data: { isActive: false },
    });
    console.log(`  marked ${missing.length} previously-seen ads as inactive`);
  }

  return { brand, created, updated, assetsUp, assetsFailed };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--login')) {
    await loginFlow();
    return;
  }
  const pageId = args.find(a => /^\d+$/.test(a));
  if (!pageId) {
    console.error('Usage: npx tsx scripts/scrape-brand-authed.ts [--login | <pageId>]');
    process.exit(1);
  }

  const { ads, totalHeader, brandInfo } = await scrapeBrand(pageId);
  if (!ads.length) {
    console.log('No ads extracted.');
    return;
  }
  const result = await upsertAds(pageId, brandInfo.name || `Page ${pageId}`, brandInfo.profilePic, ads);
  console.log(`\n✓ Done. Brand ${result.brand.pageName} — ${ads.length} ads (${totalHeader} reported by Meta)`);
  console.log(`  created: ${result.created}, updated: ${result.updated}, assets uploaded: ${result.assetsUp}`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
