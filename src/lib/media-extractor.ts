/**
 * Uses Puppeteer to load a Facebook ad snapshot URL and extract the primary media.
 * Facebook blocks server-side fetch() with 400, so a headless browser is required.
 */

import puppeteer, { type Browser } from 'puppeteer';
import { getMetaToken } from './meta-token';

export interface ExtractedMedia {
  url: string;
  type: 'image' | 'video';
  bylines?: string;
  /** Display format read off the rendered ad; undefined when the render can't be trusted. */
  format?: 'image' | 'video' | 'carousel';
}

export interface RenderSignals {
  /** Leaf elements reading exactly like a card CTA ("Shop now", "Learn more", ...). */
  ctas: number;
  /** Page says "This ad has multiple versions" (flexible / multi-text ad). */
  multipleVersions: boolean;
  /** Facebook served a login wall instead of the ad. */
  loginWall: boolean;
  hasVideo: boolean;
}

/**
 * A carousel renders one CTA per card; a flexible ad renders one version at a
 * time ("1 of N") with a single CTA. Login-wall pages also show several
 * buttons, so they yield no verdict.
 * ponytail: CTA-count heuristic, verified on IM8 flexible ads only; confirm on a
 * known carousel brand when tokens allow.
 */
export function classifyRender(sig: RenderSignals): ExtractedMedia['format'] {
  if (sig.loginWall) return undefined;
  if (sig.ctas >= 2 && !sig.multipleVersions) return 'carousel';
  return sig.hasVideo ? 'video' : 'image';
}

const CTA_RE = /^(shop now|learn more|order now|buy now|sign up|get offer|subscribe|see more|book now|download|apply now|contact us|get quote|watch more|send message)$/i;

// Reuse a single browser instance across requests
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;

  // Deduplicate concurrent launch attempts
  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = puppeteer.launch({
    headless: true,
    // Set in the worker image, which uses Debian's Chromium instead of Puppeteer's
    // download. Explicit rather than relying on Puppeteer's own env resolution, because
    // a wrong binary path fails on Fly in a way that is awkward to debug remotely.
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  browserInstance = await browserLaunchPromise;
  browserLaunchPromise = null;

  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
}

const IGNORED_PATTERNS = [
  /hsts-pixel/,
  /cookie_info_card/,
  /spacer/i,
  /pixel\.gif/i,
  /tr\?/,
  /beacon/i,
  /\/images\/cookies\//,
];

function isNoiseUrl(url: string): boolean {
  return IGNORED_PATTERNS.some((p) => p.test(url));
}

/**
 * Snapshot URLs are stored with the access token that was current at ingestion time, so
 * a row queued weeks ago carries a dead token and renders an error page instead of the
 * ad. The ad id is the only durable part, so re-stamp the URL with a live token before
 * loading it. Every caller goes through here, so the whole asset backlog benefits.
 */
function withCurrentToken(snapshotUrl: string): string {
  const token = getMetaToken();
  if (!token) return snapshotUrl;
  try {
    const u = new URL(snapshotUrl);
    if (!u.pathname.includes('/ads/archive/render_ad')) return snapshotUrl;
    if (!u.searchParams.get('id')) return snapshotUrl;
    u.searchParams.set('access_token', token);
    return u.toString();
  } catch {
    return snapshotUrl;
  }
}

export async function extractMediaFromSnapshot(
  rawSnapshotUrl: string,
): Promise<ExtractedMedia | null> {
  const snapshotUrl = withCurrentToken(rawSnapshotUrl);
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'stylesheet' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    try {
      await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      // networkidle2 often never settles on heavy video snapshots, but the media
      // element is usually already in the DOM. Extract what rendered instead of
      // throwing the whole asset away.
      await page.waitForSelector('video, img', { timeout: 10000 }).catch(() => {});
    }

    // Dismiss Facebook cookie consent wall if present
    const dismissedCookie = await page.evaluate(() => {
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
    if (dismissedCookie) {
      // Wait for ad content to render after dismissing cookie dialog
      await new Promise((r) => setTimeout(r, 2000));
    }

    const extracted = await page.evaluate((ctaSource: string) => {
      // The cookie banner is a dialog whose "Learn more" buttons look like card CTAs
      document.querySelectorAll('[role="dialog"]').forEach((d) => d.remove());
      const ctaRe = new RegExp(ctaSource, 'i');
      const ctas = Array.from(document.querySelectorAll('div, span, a')).filter(
        (e) => e.children.length === 0 && ctaRe.test(((e as HTMLElement).innerText || '').trim()),
      ).length;

      const media: { src: string; tag: string; w: number; h: number }[] = [];

      // Videos first (higher priority)
      for (const v of document.querySelectorAll('video')) {
        const src = v.src || v.querySelector('source')?.src;
        if (src) media.push({ src, tag: 'video', w: 0, h: 0 });
      }

      // Then images
      for (const img of document.querySelectorAll('img')) {
        if (img.src) {
          media.push({
            src: img.src,
            tag: 'img',
            w: img.naturalWidth,
            h: img.naturalHeight,
          });
        }
      }

      // Extract bylines/partnership text
      // Facebook shows "Creator Name with Brand Name" or "Paid partnership with Brand"
      // in the ad snapshot page. Look for common patterns in the page text.
      let bylines: string | null = null;
      const bodyText = document.body.innerText || '';

      // Pattern 1: "X with Y" partnership format (e.g., "Emma Johnson with Ninepine")
      const withMatch = bodyText.match(/^(.+?)\s+with\s+(.+?)$/m);
      if (withMatch) {
        // Validate it looks like a partnership (not random "with" in ad copy)
        const before = withMatch[1].trim();
        const after = withMatch[2].trim();
        // Short strings on both sides = likely page names, not ad copy
        if (before.length < 80 && after.length < 80 && before.length > 1 && after.length > 1) {
          bylines = withMatch[0].trim();
        }
      }

      // Pattern 2: "Paid partnership with X"
      const paidMatch = bodyText.match(/Paid partnership with\s+(.+?)(?:\n|$)/i);
      if (paidMatch) {
        bylines = paidMatch[0].trim();
      }

      // Pattern 3: Look for "Sponsored" label near a "with" pattern in header area
      // Facebook renders: "PageName · Sponsored" then on partnership ads "with PartnerName"
      const sponsoredWithMatch = bodyText.match(/Sponsored[\s\S]{0,50}?with\s+([^\n]+)/i);
      if (!bylines && sponsoredWithMatch) {
        bylines = sponsoredWithMatch[0].trim();
      }

      return {
        media,
        bylines,
        ctas,
        multipleVersions: /This ad has multiple versions/i.test(bodyText),
        loginWall: /You must log in to continue|Log into Facebook/i.test(bodyText),
      };
    }, CTA_RE.source);

    const { media, bylines } = extracted;
    const format = classifyRender({ ...extracted, hasVideo: media.some((m) => m.tag === 'video') });

    // Filter noise and pick best candidate
    // Prefer videos, then largest image from fbcdn
    for (const m of media) {
      if (m.tag === 'video' && m.src && !isNoiseUrl(m.src)) {
        return { url: m.src, type: 'video', bylines: bylines || undefined, format };
      }
    }

    const imagesCandidates = media
      .filter((m) => m.tag === 'img' && m.src && !isNoiseUrl(m.src))
      .filter((m) => m.w > 50 && m.h > 50) // skip tiny images
      .sort((a, b) => {
        // Prefer fbcdn images
        const aFb = a.src.includes('fbcdn') ? 10 : 0;
        const bFb = b.src.includes('fbcdn') ? 10 : 0;
        // Then by size
        return (bFb + b.w * b.h) - (aFb + a.w * a.h);
      });

    if (imagesCandidates.length > 0) {
      return { url: imagesCandidates[0].src, type: 'image', bylines: bylines || undefined, format };
    }

    // No media found but we might still have bylines
    if (bylines) {
      return { url: '', type: 'image', bylines, format };
    }

    return null;
  } catch {
    return null;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}
