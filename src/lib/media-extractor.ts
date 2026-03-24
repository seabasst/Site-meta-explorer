/**
 * Uses Puppeteer to load a Facebook ad snapshot URL and extract the primary media.
 * Facebook blocks server-side fetch() with 400, so a headless browser is required.
 */

import puppeteer, { type Browser } from 'puppeteer';

export interface ExtractedMedia {
  url: string;
  type: 'image' | 'video';
  bylines?: string;
}

// Reuse a single browser instance across requests
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;

  // Deduplicate concurrent launch attempts
  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = puppeteer.launch({
    headless: true,
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

export async function extractMediaFromSnapshot(
  snapshotUrl: string,
): Promise<ExtractedMedia | null> {
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

    await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 15000 });

    const extracted = await page.evaluate(() => {
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

      return { media, bylines };
    });

    const { media, bylines } = extracted;

    // Filter noise and pick best candidate
    // Prefer videos, then largest image from fbcdn
    for (const m of media) {
      if (m.tag === 'video' && m.src && !isNoiseUrl(m.src)) {
        return { url: m.src, type: 'video', bylines: bylines || undefined };
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
      return { url: imagesCandidates[0].src, type: 'image', bylines: bylines || undefined };
    }

    // No media found but we might still have bylines
    if (bylines) {
      return { url: '', type: 'image', bylines };
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
