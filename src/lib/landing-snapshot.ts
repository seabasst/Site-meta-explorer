/**
 * What a landing page said at a point in time. Pages get redirected, rewritten or
 * deleted after a campaign (IM8 2026-10-08: angle URLs now redirect to a generic
 * PDP, a whole funnel subdomain is gone), so a page read today cannot tell what an
 * ad's audience saw. Capturing it while the ad is fresh is the only record.
 *
 * Text only (title, meta, h1, prices, main text), rendered on a mobile viewport.
 * ponytail: no screenshot; add an R2-stored above-the-fold JPEG if visual
 * comparison of pages becomes a need.
 */
import type { Browser } from 'puppeteer';
import { prisma } from './prisma';
import { getBrowser } from './media-extractor';

/** One page = host + path, no query/hash/trailing slash, so utm variants collapse. */
export function pageKey(url: string): string {
  const u = new URL(url);
  return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, '').toLowerCase();
}

export interface LandingPage {
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

export async function fetchLanding(url: string, browser?: Browser): Promise<LandingPage> {
  const page = await (browser ?? (await getBrowser())).newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 390, height: 844, isMobile: true }); // Meta traffic is mobile
    // Text is all we keep, so skip the heavy assets
    await page.setRequestInterception(true);
    page.on('request', (req) => (['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue()));
    // DOM-ready gives the HTTP status; full network idle never comes on tracker-heavy
    // Shopify pages (Vanan Herbal 2026-10-08), so give it a bounded wait, not a gate.
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 8000 }).catch(() => {});
    const failed = page.url().startsWith('chrome-error://'); // DNS failure, refused, ...
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
    if (failed) return { requestedUrl: url, finalUrl: null, status: null, title: '', metaDescription: '', h1: [], prices: [], text: '', error: data.h1[0] || data.title || 'load failed' };
    // res is null when DOM-ready timed out but the page still rendered: keep the content, status unknown
    return { requestedUrl: url, finalUrl: page.url(), status: res?.status() ?? null, ...data };
  } catch (e) {
    return { requestedUrl: url, finalUrl: null, status: null, title: '', metaDescription: '', h1: [], prices: [], text: '', error: String(e).slice(0, 300) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Latest snapshot of the page if it is younger than maxAgeDays, else capture and store
 * a new one. Failed loads are stored too: "the page was down while the ad ran" is a finding.
 */
export async function snapshotLanding(url: string, maxAgeDays: number, browser?: Browser) {
  const key = pageKey(url);
  const fresh = await prisma.landingPageSnapshot.findFirst({
    where: { pageKey: key, capturedAt: { gte: new Date(Date.now() - maxAgeDays * 86_400_000) } },
    orderBy: { capturedAt: 'desc' },
  });
  if (fresh) return { snapshot: fresh, created: false };
  const lp = await fetchLanding(url, browser);
  const snapshot = await prisma.landingPageSnapshot.create({
    data: {
      pageKey: key, url, finalUrl: lp.finalUrl, status: lp.status, title: lp.title || null,
      metaDescription: lp.metaDescription || null, h1: lp.h1, prices: lp.prices, text: lp.text || null, error: lp.error ?? null,
    },
  });
  return { snapshot, created: true };
}
