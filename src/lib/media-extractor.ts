/**
 * Uses Puppeteer to load a Facebook ad snapshot URL and extract the primary media.
 * Facebook blocks server-side fetch() with 400, so a headless browser is required.
 */

import puppeteer, { type Browser } from 'puppeteer';

export interface ExtractedMedia {
  url: string;
  type: 'image' | 'video';
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

    const media = await page.evaluate(() => {
      const results: { src: string; tag: string; w: number; h: number }[] = [];

      // Videos first (higher priority)
      for (const v of document.querySelectorAll('video')) {
        const src = v.src || v.querySelector('source')?.src;
        if (src) results.push({ src, tag: 'video', w: 0, h: 0 });
      }

      // Then images
      for (const img of document.querySelectorAll('img')) {
        if (img.src) {
          results.push({
            src: img.src,
            tag: 'img',
            w: img.naturalWidth,
            h: img.naturalHeight,
          });
        }
      }

      return results;
    });

    // Filter noise and pick best candidate
    // Prefer videos, then largest image from fbcdn
    for (const m of media) {
      if (m.tag === 'video' && m.src && !isNoiseUrl(m.src)) {
        return { url: m.src, type: 'video' };
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
      return { url: imagesCandidates[0].src, type: 'image' };
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
