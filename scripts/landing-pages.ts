/**
 * Landing-page analysis: where does each ad send people, and does the page
 * keep the ad's promise?
 *
 *   npx tsx --env-file=.env.local scripts/landing-pages.ts <pageId> [limit=50]
 *
 * 1. Destination. The ads_archive API has no link-URL field (AdLibraryAd.linkUrl
 *    is set on 665 of 2.4M rows, 2026-10-07). The public Ad Library page
 *    (facebook.com/ads/library/?id=) renders the CTA as an l.facebook.com
 *    redirect carrying the real URL, with no login or token. Written back to
 *    AdLibraryAd.linkUrl so the rest of the app sees it.
 * 2. Landing page. Each unique URL (query stripped) is rendered once in the
 *    same browser, so SPAs and redirects resolve like a real visit.
 * 3. Connection. Claude scores ad -> page continuity per unique (copy, page).
 *
 * Output: out/landing-<pageId>.json
 *
 * ponytail: sequential and paced (PACE_MS) because Meta rate-limits page loads;
 * ~5s/ad. Bulk runs over many brands want the worker's concurrency knobs.
 */
import { prisma } from '../src/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import puppeteer, { type Browser } from 'puppeteer';
import fs from 'node:fs';
import assert from 'node:assert';

const PACE_MS = Number(process.env.PACE_MS ?? 3000);
const MODEL = process.env.LP_MODEL ?? 'claude-sonnet-5';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** l.facebook.com/l.php?u=<dest> -> <dest>; anything else unchanged. */
export function unwrapFbRedirect(href: string): string {
  try {
    const u = new URL(href);
    if (u.hostname.endsWith('facebook.com') && u.pathname === '/l.php') return u.searchParams.get('u') ?? href;
  } catch { /* not a URL */ }
  return href;
}

/** Cache key for a landing page: host + path, no query/hash, no trailing slash. */
export function pageKey(url: string): string {
  const u = new URL(url);
  return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '').toLowerCase();
}

async function resolveDestination(browser: Browser, adId: string): Promise<string | null> {
  const page = await browser.newPage();
  try {
    await page.goto(`https://www.facebook.com/ads/library/?id=${adId}`, { waitUntil: 'networkidle2', timeout: 45000 });
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).href));
    const dest = hrefs
      .map((h) => (h.includes('l.facebook.com') ? h : ''))
      .filter(Boolean)
      .map((h) => {
        try { return new URL(h).searchParams.get('u'); } catch { return null; }
      })
      .find((u): u is string => !!u && !/metastatus\.com|facebook\.com|instagram\.com/.test(u));
    return dest ?? null;
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

interface LandingPage {
  requestedUrl: string;
  finalUrl: string | null;
  status: number | null;
  title: string;
  metaDescription: string;
  h1: string[];
  prices: string[];
  text: string;
  error?: string;
}

async function fetchLanding(browser: Browser, url: string): Promise<LandingPage> {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36');
  await page.setViewport({ width: 390, height: 844, isMobile: true }); // Meta traffic is mobile
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
    await sleep(1500);
    const data = await page.evaluate(() => {
      // <main> skips cookie banners and nav that otherwise eat the text budget
      const root = (document.querySelector('main') ?? document.body) as HTMLElement | null;
      const text = (root?.innerText ?? '').replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n');
      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
        h1: [...document.querySelectorAll('h1')].map((h) => (h as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 3),
        prices: [...new Set(text.match(/(\d[\d  .,]*[  ]?(kr|SEK|NOK|DKK|€|EUR|£|\$)|(€|£|\$)[  ]?\d[\d.,]*)/g) ?? [])].slice(0, 10),
        text: text.slice(0, 4000),
      };
    });
    return { requestedUrl: url, finalUrl: page.url(), status: res?.status() ?? null, ...data };
  } catch (e) {
    return { requestedUrl: url, finalUrl: null, status: null, title: '', metaDescription: '', h1: [], prices: [], text: '', error: String(e) };
  } finally {
    await page.close().catch(() => {});
  }
}

const anthropic = new Anthropic();

async function scoreConnection(ad: { body: string | null; title: string | null; linkDescription: string | null; ctaText: string | null }, lp: LandingPage) {
  const prompt = `You audit Meta ads for message match: does the landing page continue what the ad promised?

AD
Primary text: ${ad.body ?? '(none)'}
Headline: ${ad.title ?? '(none)'}
Description: ${ad.linkDescription ?? '(none)'}
CTA: ${ad.ctaText ?? '(none)'}

LANDING PAGE (rendered on mobile)
Final URL: ${lp.finalUrl} (HTTP ${lp.status})
Title: ${lp.title}
Meta description: ${lp.metaDescription}
H1: ${lp.h1.join(' | ')}
Prices seen: ${lp.prices.join(', ') || 'none'}
Visible text (truncated):
${lp.text}

Only judge from what is above; if the page text is a cookie wall or empty, say so in "verdict" and use null scores.
Reply with ONLY this JSON:
{"page_type":"product|collection|home|campaign_landing|article|quiz|signup|other",
 "message_match":1-5 or null,
 "headline_echoed":true|false|null,
 "offer_in_ad":"the concrete offer/price/discount in the ad, or null",
 "offer_on_page":true|false|null,
 "product_match":"same|related|unrelated|n/a",
 "language_match":true|false|null,
 "gaps":["up to 3 concrete breaks between ad and page"],
 "verdict":"one sentence"}`;
  const res = await anthropic.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    .catch((e) => ({ error: String(e?.error?.error?.message ?? e) }));
  if ('error' in res) return { error: res.error }; // keep the destination + page even when scoring fails
  const raw = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  try {
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    return { error: 'unparseable', raw };
  }
}

async function main() {
  const [pageId, limitArg] = process.argv.slice(2);
  if (!pageId) throw new Error('usage: landing-pages.ts <pageId> [limit]');
  const brand = await prisma.adLibraryBrand.findUniqueOrThrow({ where: { pageId } });
  const ads = await prisma.adLibraryAd.findMany({
    where: { brandId: brand.id, isActive: true },
    orderBy: [{ reachEstimate: { sort: 'desc', nulls: 'last' } }],
    take: Number(limitArg ?? 50),
    select: { id: true, adId: true, body: true, title: true, linkDescription: true, ctaText: true, caption: true, linkUrl: true, reachEstimate: true },
  });
  console.log(`${brand.pageName}: ${ads.length} active ads`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const pages = new Map<string, LandingPage>();
  const scores = new Map<string, unknown>();
  const rows = [];
  try {
    for (const [i, ad] of ads.entries()) {
      let url = ad.linkUrl ? unwrapFbRedirect(ad.linkUrl) : null;
      if (!url) {
        url = await resolveDestination(browser, ad.adId);
        await sleep(PACE_MS);
        if (url) await prisma.adLibraryAd.update({ where: { id: ad.id }, data: { linkUrl: url } });
      }
      if (!url) {
        console.log(`[${i + 1}/${ads.length}] ${ad.adId} no destination found`);
        rows.push({ adId: ad.adId, reach: ad.reachEstimate, linkUrl: null });
        continue;
      }
      const key = pageKey(url);
      if (!pages.has(key)) pages.set(key, await fetchLanding(browser, url));
      const lp = pages.get(key)!;
      const scoreKey = `${ad.body}|${ad.title}|${ad.linkDescription}|${key}`;
      if (!scores.has(scoreKey)) scores.set(scoreKey, await scoreConnection(ad, lp));
      const score = scores.get(scoreKey);
      console.log(`[${i + 1}/${ads.length}] ${ad.adId} -> ${key} ${JSON.stringify((score as { message_match?: number }).message_match)}`);
      rows.push({ adId: ad.adId, reach: ad.reachEstimate, caption: ad.caption, linkUrl: url, pageKey: key, ...(score as object) });
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync('out', { recursive: true });
  const outFile = `out/landing-${pageId}.json`;
  fs.writeFileSync(outFile, JSON.stringify({ brand: brand.pageName, pageId, runAt: new Date().toISOString(), model: MODEL, ads: rows, pages: Object.fromEntries(pages) }, null, 2));
  console.log(`${rows.filter((r) => r.linkUrl).length}/${rows.length} resolved, ${pages.size} unique pages, ${scores.size} scored -> ${outFile}`);
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith('landing-pages.ts') && process.argv[2] === '--self-check') {
  assert.equal(unwrapFbRedirect('https://l.facebook.com/l.php?u=https%3A%2F%2Fshop.se%2Fp%3Futm%3Dx&h=1'), 'https://shop.se/p?utm=x');
  assert.equal(unwrapFbRedirect('https://shop.se/a'), 'https://shop.se/a');
  assert.equal(pageKey('https://www.Shop.se/p/Sko/?utm_source=fb#x'), 'shop.se/p/sko');
  console.log('self-check ok');
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
