/**
 * Backfill missing videos + landing URLs for a brand.
 *
 * Navigates individual ad snapshot URLs to:
 * - Extract video_hd_url/video_sd_url from embedded JSON
 * - Extract landing URLs from the ad page DOM/JSON
 *
 * Usage: npx tsx scripts/backfill-videos-and-links.ts <pageId> [--limit N] [--links-only] [--videos-only]
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import puppeteer, { HTTPResponse } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);
const PROFILE_DIR = resolve(process.cwd(), '.puppeteer-meta-profile');

async function main() {
  const { uploadToR2, isR2Configured, generateAssetKey } = await import('../src/lib/r2');
  if (!isR2Configured()) throw new Error('R2 not configured');

  const args = process.argv.slice(2);
  const pageId = args.find(a => /^\d+$/.test(a));
  const limit = parseInt(args[args.indexOf('--limit') + 1] || '0') || Infinity;
  const linksOnly = args.includes('--links-only');
  const videosOnly = args.includes('--videos-only');

  if (!pageId) {
    console.error('Usage: npx tsx scripts/backfill-videos-and-links.ts <pageId> [--limit N] [--links-only] [--videos-only]');
    process.exit(1);
  }

  const brand = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
  if (!brand) throw new Error(`Brand ${pageId} not found`);

  // Build query: find ads that need video OR link
  const conditions: any[] = [];
  if (!linksOnly) {
    conditions.push({
      displayFormat: 'video',
      assets: { none: { assetType: 'video', downloadStatus: 'completed' } },
    });
  }
  if (!videosOnly) {
    conditions.push({ linkUrl: null });
  }

  // ACTIVE-ADS-ONLY: don't re-download video creatives or re-fetch landing
  // URLs for ads that have already ended. See scope 3 of the audit.
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      brandId: brand.id,
      isActive: true,
      OR: conditions,
    },
    select: {
      id: true,
      adId: true,
      displayFormat: true,
      linkUrl: true,
      assets: {
        where: { assetType: 'video', downloadStatus: 'completed' },
        select: { id: true },
      },
    },
    take: isFinite(limit) ? limit : undefined,
  });

  const needsVideo = ads.filter(a => a.displayFormat === 'video' && a.assets.length === 0);
  const needsLink = ads.filter(a => !a.linkUrl);
  console.log(`${brand.pageName}: ${ads.length} ads to process`);
  console.log(`  Need video: ${needsVideo.length}, Need landing URL: ${needsLink.length}`);
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

  let videosUploaded = 0, linksFound = 0, errors = 0;

  for (const [idx, ad] of ads.entries()) {
    const snapshotUrl = `https://www.facebook.com/ads/library/?id=${ad.adId}&country=ALL&active_status=all`;
    const wantsVideo = !linksOnly && ad.displayFormat === 'video' && ad.assets.length === 0;
    const wantsLink = !videosOnly && !ad.linkUrl;

    const graphqlBodies: string[] = [];

    const onResponse = async (res: HTTPResponse) => {
      try {
        const url = res.url();
        if (url.includes('/api/graphql') || url.includes('/ads/library')) {
          try { graphqlBodies.push(await res.text()); } catch {}
        }
      } catch {}
    };
    page.on('response', onResponse);

    try {
      await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 2500));
      page.off('response', onResponse);

      const allBodies = graphqlBodies.join('\n');

      // -- Extract landing URL --
      if (wantsLink) {
        let landingUrl: string | null = null;

        // Method 1: From DOM — look for CTA button link or external link
        const domLink = await page.evaluate(() => {
          // Look for the CTA button's anchor
          const ctaTexts = ['Shop now', 'Learn more', 'Sign up', 'Order now', 'Buy now', 'Subscribe', 'Book now', 'Get offer', 'Download', 'Apply now'];
          for (const ctaText of ctaTexts) {
            const btns = Array.from(document.querySelectorAll('a, [role="link"]'));
            for (const b of btns) {
              const t = (b as HTMLElement).innerText?.trim() || '';
              if (t.toLowerCase() === ctaText.toLowerCase()) {
                const href = (b as HTMLAnchorElement).href;
                if (href && !href.includes('facebook.com') && !href.includes('fb.com') && href.startsWith('http')) {
                  return href;
                }
              }
            }
          }
          // Fallback: any external link on the page
          const links = Array.from(document.querySelectorAll('a[href^="https://"]')) as HTMLAnchorElement[];
          for (const link of links) {
            const h = link.href;
            if (h.includes('facebook.com') || h.includes('fb.com') || h.includes('fb.me') ||
                h.includes('instagram.com') || h.includes('fbcdn.net') || h.includes('metastatus.com') ||
                h.includes('transparency')) continue;
            if (link.offsetWidth > 0 && link.offsetHeight > 0) return h;
          }
          return null;
        });

        if (domLink) {
          landingUrl = domLink;
        }

        // Method 2: From JSON body — look for link_url or similar fields near ad data
        if (!landingUrl) {
          // Try various patterns
          const patterns = [
            /"link_url":"(https?:[^"]+)"/,
            /"cta_link":"(https?:[^"]+)"/,
            /"website_destination":"(https?:[^"]+)"/,
            /"landing_page_url":"(https?:[^"]+)"/,
          ];
          for (const re of patterns) {
            const match = allBodies.match(re);
            if (match) {
              const url = match[1].replace(/\\\//g, '/');
              if (!url.includes('facebook.com') && !url.includes('fb.com')) {
                landingUrl = url;
                break;
              }
            }
          }
        }

        if (landingUrl) {
          await prisma.adLibraryAd.update({
            where: { id: ad.id },
            data: { linkUrl: landingUrl },
          });
          linksFound++;
        }
      }

      // -- Extract video URLs --
      if (wantsVideo) {
        const seenVideos = new Set<string>();
        const videoUrls: string[] = [];

        // Method 1: Look near ad_archive_id
        const adIdRe = new RegExp(`"ad_archive_id":"${ad.adId}"`, 'g');
        let am: RegExpExecArray | null;
        while ((am = adIdRe.exec(allBodies)) !== null) {
          const start = am.index;
          const slice = allBodies.slice(start, start + 20000);
          const nextAd = slice.slice(50).indexOf('"ad_archive_id"');
          const end = nextAd === -1 ? slice.length : 50 + nextAd;
          const windowText = slice.slice(0, end);
          const vm = windowText.matchAll(/"(video_hd_url|video_sd_url)":"([^"]+)"/g);
          for (const v of vm) {
            const raw = v[2].replace(/\\\//g, '/');
            if (raw && !seenVideos.has(raw)) { seenVideos.add(raw); videoUrls.push(raw); }
          }
        }

        // Method 2: Search entire body (single-ad view)
        if (videoUrls.length === 0) {
          const allVideoMatches = allBodies.matchAll(/"(video_hd_url|video_sd_url)":"([^"]+)"/g);
          for (const v of allVideoMatches) {
            const raw = v[2].replace(/\\\//g, '/');
            if (raw && !seenVideos.has(raw)) { seenVideos.add(raw); videoUrls.push(raw); }
          }
        }

        let downloaded = false;
        for (const vurl of videoUrls.slice(0, 2)) {
          if (downloaded) break;
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

            const maxPos = await prisma.adAsset.findFirst({
              where: { adId: ad.id },
              orderBy: { position: 'desc' },
              select: { position: true },
            });
            const nextPos = (maxPos?.position ?? -1) + 1;

            const key = generateAssetKey(brand.id, ad.adId, 'video', nextPos, '.mp4');
            const up = await uploadToR2(key, buf, 'video/mp4');

            await prisma.adAsset.create({
              data: {
                adId: ad.id,
                assetType: 'video',
                position: nextPos,
                originalUrl: vurl,
                storedUrl: up.url,
                storedKey: up.key,
                downloadStatus: 'completed',
                fileSizeBytes: buf.length,
                fileExtension: '.mp4',
              },
            });
            videosUploaded++;
            downloaded = true;
          } catch {}
        }
        if (!downloaded && wantsVideo) errors++;
      }
    } catch (e) {
      page.off('response', onResponse);
      errors++;
    }

    if ((idx + 1) % 5 === 0 || idx === ads.length - 1) {
      process.stdout.write(`\r  ${idx + 1}/${ads.length} | videos: ${videosUploaded}, links: ${linksFound}, errors: ${errors}   `);
    }
  }

  console.log('');
  console.log(`Done. Videos: ${videosUploaded}, Links: ${linksFound}, Errors: ${errors}`);
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
