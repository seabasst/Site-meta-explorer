/**
 * Backfill adBodies and adTitles on existing CreatorPartnership records
 * by visiting the stored snapshotUrls and extracting text with Puppeteer.
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CONCURRENCY = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

async function extractAdText(page: Page, snapshotUrl: string): Promise<{ body: string; title: string }> {
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['stylesheet', 'font', 'image', 'media'].includes(type)) req.abort(); else req.continue();
    });

    await page.goto(snapshotUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForFunction(() => (document.body.innerText || '').length > 50, { timeout: 8000 }).catch(() => {});
    await dismissCookieDialog(page);

    return await page.evaluate(() => {
      const text = document.body.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Find the "Creator with Brand" or "Sponsored" header to locate where ad content starts
      let contentStart = 0;
      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        if (lines[i].includes('Sponsored') || /with\s+/i.test(lines[i])) {
          contentStart = i + 1;
          break;
        }
      }

      // Primary text: the main paragraph after the header, before any link/button
      let body = '';
      const bodyLines: string[] = [];
      for (let i = contentStart; i < Math.min(lines.length, contentStart + 20); i++) {
        const line = lines[i];
        // Stop at common footer elements
        if (/^(Learn More|Shop Now|Sign Up|Download|Get Offer|Book Now|Contact Us|Apply Now|See More|Like|Comment|Share)$/i.test(line)) break;
        if (/^https?:\/\//.test(line)) break;
        // Stop at very short lines that look like buttons or links
        if (line.length < 3 && bodyLines.length > 0) break;
        bodyLines.push(line);
      }
      body = bodyLines.join('\n').trim();

      // Headline/title: typically appears after the media, right before the CTA button
      // In Facebook ads it's usually a bold line near the bottom
      let title = '';
      const ctaPatterns = /^(Learn More|Shop Now|Sign Up|Download|Get Offer|Book Now|Contact Us|Apply Now|Subscribe|Order Now|See Menu)$/i;
      for (let i = lines.length - 1; i >= contentStart; i--) {
        if (ctaPatterns.test(lines[i]) && i > 0) {
          // The line(s) just before the CTA are usually the headline + description
          // Walk backwards to find the headline
          for (let j = i - 1; j >= contentStart; j--) {
            const candidate = lines[j];
            if (candidate.length > 5 && candidate.length < 120 && !candidate.startsWith('http')) {
              title = candidate;
              break;
            }
          }
          break;
        }
      }

      return { body: body.slice(0, 500), title: title.slice(0, 200) };
    });
  } catch {
    return { body: '', title: '' };
  }
}

async function main() {
  const partnerships = await prisma.creatorPartnership.findMany({
    where: { snapshotUrls: { isEmpty: false } },
    select: { id: true, snapshotUrls: true, adBodies: true },
  });

  // Only process partnerships that don't have text yet
  const toProcess = partnerships.filter(p => p.adBodies.length === 0);
  console.log(`Partnerships to backfill: ${toProcess.length} (${partnerships.length} total)\n`);

  const b = await getBrowser();
  let done = 0;

  for (const partnership of toProcess) {
    const bodies: string[] = [];
    const titles: string[] = [];

    for (let i = 0; i < partnership.snapshotUrls.length; i += CONCURRENCY) {
      const batch = partnership.snapshotUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(async (url) => {
        const page = await b.newPage();
        try {
          return await extractAdText(page, url);
        } finally {
          await page.close().catch(() => {});
        }
      }));

      for (const r of results) {
        if (r.status === 'fulfilled') {
          bodies.push(r.value.body);
          titles.push(r.value.title);
        } else {
          bodies.push('');
          titles.push('');
        }
      }
    }

    await prisma.creatorPartnership.update({
      where: { id: partnership.id },
      data: { adBodies: bodies, adTitles: titles },
    });

    done++;
    if (done % 5 === 0 || done === toProcess.length) {
      process.stdout.write(`\r  Backfilled ${done}/${toProcess.length}`);
    }
  }

  console.log(`\n\nDone! Backfilled text for ${done} partnerships.`);
  if (browser?.connected) await browser.close().catch(() => {});
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  if (browser?.connected) await browser.close().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
