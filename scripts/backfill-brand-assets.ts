/**
 * Backfill media assets for ads that have a snapshotUrl but no completed AdAsset.
 * Navigates each snapshot URL individually and captures media via network response
 * interception (bypasses fbcdn CORS).
 *
 * Usage: npx tsx scripts/backfill-brand-assets.ts <pageId> [--limit N]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import puppeteer, { HTTPResponse } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'path';
// r2 is imported dynamically below so env is loaded first

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);
const PROFILE_DIR = resolve(process.cwd(), '.puppeteer-meta-profile');

interface Captured {
  url: string;
  type: 'image' | 'video';
  buf: Buffer;
}

async function main() {
  const { uploadToR2, isR2Configured, generateAssetKey } = await import('../src/lib/r2');
  if (!isR2Configured()) throw new Error('R2 not configured');
  const args = process.argv.slice(2);
  const pageId = args.find(a => /^\d+$/.test(a));
  const limit = parseInt(args[args.indexOf('--limit') + 1] || '0') || Infinity;
  if (!pageId) {
    console.error('Usage: npx tsx scripts/backfill-brand-assets.ts <pageId> [--limit N]');
    process.exit(1);
  }

  const brand = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
  if (!brand) throw new Error(`Brand ${pageId} not found`);

  // ACTIVE-ADS-ONLY: don't download assets for dead ads. See scope 3 of
  // .planning/review-2026-04-18/03-ingestion-pipeline.md.
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      brandId: brand.id,
      isActive: true,
      assets: { none: { downloadStatus: 'completed' } },
    },
    select: { id: true, adId: true, snapshotUrl: true },
    take: isFinite(limit) ? limit : undefined,
  });
  for (const a of ads) {
    a.snapshotUrl = `https://www.facebook.com/ads/library/?id=${a.adId}&country=ALL&active_status=all`;
  }
  console.log(`${ads.length} ads need assets for ${brand.pageName}`);
  if (!ads.length) return;

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1400, height: 1000 },
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => { (globalThis as any).__name = (fn: any) => fn; });

  let ok = 0, skip = 0, fail = 0, totalAssets = 0;

  for (const [idx, ad] of ads.entries()) {
    const captured = new Map<string, Captured>();
    const graphqlBodies: string[] = [];

    // Response listener captures fbcdn images + graphql bodies (for video URL extraction)
    const onResponse = async (res: HTTPResponse) => {
      try {
        const url = res.url();
        if (url.includes('/api/graphql') || url.includes('/ads/library')) {
          try { graphqlBodies.push(await res.text()); } catch {}
          return;
        }
        if (!/scontent|fbcdn/.test(url)) return;
        if (!res.ok()) return;
        const ct = res.headers()['content-type'] || '';
        const isImage = ct.includes('image');
        if (!isImage) return;
        const cl = parseInt(res.headers()['content-length'] || '0');
        if (cl && cl < 5000) return;
        const buf = Buffer.from(await res.buffer());
        if (buf.length < 5000) return;
        if (captured.has(url)) return;
        captured.set(url, { url, type: 'image', buf });
      } catch {}
    };
    page.on('response', onResponse);

    try {
      // Persist snapshotUrl if it was missing
      await prisma.adLibraryAd.update({
        where: { id: ad.id },
        data: { snapshotUrl: ad.snapshotUrl! },
      }).catch(() => {});

      await page.goto(ad.snapshotUrl!, { waitUntil: 'networkidle2', timeout: 45000 });
      // Linger so lazy-loaded media finishes
      await new Promise(r => setTimeout(r, 2500));

      page.off('response', onResponse);

      // Extract video URLs that belong to THIS ad only.
      // The page payload contains "ad_archive_id":"<id>" followed by the ad's
      // video/image data. For each ad_archive_id, collect nearby video URLs.
      const allBodies = graphqlBodies.join('\n');
      const adIdRe = new RegExp(`"ad_archive_id":"${ad.adId}"`, 'g');
      const seenVideos = new Set<string>();
      const videoUrls: string[] = [];
      let am: RegExpExecArray | null;
      while ((am = adIdRe.exec(allBodies)) !== null) {
        // Scan forward up to 20KB for video URLs, stopping at next ad_archive_id
        const start = am.index;
        const slice = allBodies.slice(start, start + 20000);
        const nextAd = slice.slice(50).indexOf('"ad_archive_id"');
        const end = nextAd === -1 ? slice.length : 50 + nextAd;
        const windowText = slice.slice(0, end);
        const vm = windowText.matchAll(/"(video_hd_url|video_sd_url)":"([^"]+)"/g);
        for (const v of vm) {
          const raw = v[2].replace(/\\\//g, '/');
          if (!raw || seenVideos.has(raw)) continue;
          seenVideos.add(raw);
          videoUrls.push(raw);
        }
      }
      // Prefer HD (first match per ad typically HD), cap to 2 videos per ad
      for (const vurl of videoUrls.slice(0, 2)) {
        try {
          const res = await fetch(vurl, {
            headers: {
              'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'referer': 'https://www.facebook.com/',
              'accept': '*/*',
            },
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 10000) continue;
          if (captured.has(vurl)) continue;
          captured.set(vurl, { url: vurl, type: 'video', buf });
        } catch {}
      }

      if (!captured.size) { skip++; continue; }

      // Filter: prefer largest image per host, keep all videos
      const items = Array.from(captured.values());
      // Sort so videos come first, then images by size desc
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'video' ? -1 : 1;
        return b.buf.length - a.buf.length;
      });

      let savedForThisAd = 0;
      for (let pos = 0; pos < items.length; pos++) {
        const m = items[pos];
        // Keep max 6 assets per ad (videos + poster/stills)
        if (savedForThisAd >= 6) break;
        try {
          const isVideo = m.type === 'video';
          const ext = isVideo ? '.mp4' : '.jpg';
          const key = generateAssetKey(brand.id, ad.adId, m.type, savedForThisAd, ext);
          const up = await uploadToR2(key, m.buf, isVideo ? 'video/mp4' : 'image/jpeg');

          const existing = await prisma.adAsset.findFirst({
            where: { adId: ad.id, position: savedForThisAd },
            select: { id: true },
          });
          if (existing) {
            await prisma.adAsset.update({
              where: { id: existing.id },
              data: { storedUrl: up.url, storedKey: up.key, originalUrl: m.url, assetType: m.type, downloadStatus: 'completed', fileSizeBytes: m.buf.length, fileExtension: ext },
            });
          } else {
            await prisma.adAsset.create({
              data: { adId: ad.id, assetType: m.type, position: savedForThisAd, originalUrl: m.url, storedUrl: up.url, storedKey: up.key, downloadStatus: 'completed', fileSizeBytes: m.buf.length, fileExtension: ext },
            });
          }
          totalAssets++;
          savedForThisAd++;
        } catch { fail++; }
      }
      if (savedForThisAd > 0) ok++; else skip++;
    } catch (e) {
      page.off('response', onResponse);
      fail++;
    }
    if ((idx + 1) % 5 === 0 || idx === ads.length - 1) {
      process.stdout.write(`\r  ${idx + 1}/${ads.length} | ads w/ media: ${ok}, no media: ${skip}, errors: ${fail}, assets uploaded: ${totalAssets}   `);
    }
  }
  console.log('');
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
