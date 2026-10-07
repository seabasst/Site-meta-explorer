/**
 * Where an ad sends people. The ads_archive API has no link-URL field, so the
 * destination is read from the public Ad Library modal
 * (facebook.com/ads/library/?id=<adId>), which needs no login or token and
 * renders the CTA as an l.facebook.com/l.php?u=<dest> redirect.
 *
 * Only the modal whose text carries "Library ID: <adId>" belongs to the ad. The
 * page behind it lists the advertiser's OTHER ads, and an id Meta no longer
 * serves shows "Ad isn't in the Ad Library" over an unrelated grid, so reading
 * the whole page attaches another ad's URL (seen 2026-10-08 on Desenio/Mjuk).
 */
import type { Browser } from 'puppeteer';
import { prisma } from './prisma';
import { getBrowser } from './media-extractor';

export type DestinationResult =
  // multipleVersions: flexible/catalog ad; Meta shows a different version per load, so
  // url is ONE sampled version (seen on Mjuk 2026-10-08: same ad, new product each load)
  | { status: 'ok'; url: string; multipleVersions: boolean }
  | { status: 'no_link' } // ad found, no outbound link (lead form, Messenger, page like)
  | { status: 'not_in_library' } // Meta no longer serves this id
  | { status: 'error' }; // blocked, login wall, timeout: not the ad's fault, retry later

/** l.facebook.com redirect -> destination, or null if it isn't one / points back into Meta. */
export function destinationFromHref(href: string): string | null {
  try {
    const u = new URL(href);
    if (!u.hostname.endsWith('l.facebook.com')) return null;
    const dest = u.searchParams.get('u');
    if (!dest) return null;
    const host = new URL(dest).hostname;
    // fb.com/canvas_doc is an Instant Experience, a real destination; other Meta hosts are chrome
    if (/(^|\.)(facebook\.com|instagram\.com|messenger\.com|metastatus\.com|meta\.com)$/.test(host)) return null;
    if (host.endsWith('fb.com') && !dest.includes('/canvas_doc/')) return null;
    return dest;
  } catch {
    return null;
  }
}

export async function resolveDestination(adId: string, browser?: Browser): Promise<DestinationResult> {
  const page = await (browser ?? (await getBrowser())).newPage();
  try {
    await page.goto(`https://www.facebook.com/ads/library/?id=${adId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const found = await page
      .waitForFunction(
        (id: string) => [...document.querySelectorAll('[role="dialog"]')].some((d) => {
          const t = (d as HTMLElement).innerText;
          return t.includes(`Library ID: ${id}`) || t.includes("isn't in the Ad Library");
        }),
        { timeout: 15000 },
        adId,
      )
      .then(() => true, () => false);
    if (!found) return { status: 'error' };
    await new Promise((r) => setTimeout(r, 800)); // CTA anchors hydrate just after the modal text
    const modal = await page.evaluate((id: string) => {
      const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x as HTMLElement).innerText.includes(`Library ID: ${id}`));
      if (!d) return null;
      return {
        hrefs: [...d.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).href),
        multipleVersions: (d as HTMLElement).innerText.includes('This ad has multiple versions'),
      };
    }, adId);
    if (!modal) return { status: 'not_in_library' };
    // Carousel/catalog ads carry one link per card; the first card's is the ad's lead destination.
    const url = modal.hrefs.map(destinationFromHref).find((u): u is string => !!u);
    return url ? { status: 'ok', url, multipleVersions: modal.multipleVersions } : { status: 'no_link' };
  } catch {
    return { status: 'error' };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Resolve destinations for ads never checked, newest first (the fetchable window is
 * the recent past). Errors leave the row unchecked so it is retried.
 * ponytail: no index on linkCheckedAt; the createdAt-desc scan walks past checked
 * rows. Add @@index([linkCheckedAt, createdAt]) if batch selection gets slow.
 */
export async function resolvePendingDestinations(limit: number, opts: { brandId?: string } = {}) {
  const ads = await prisma.adLibraryAd.findMany({
    where: { linkCheckedAt: null, ...(opts.brandId && { brandId: opts.brandId }) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, adId: true },
  });
  const CONCURRENCY = Math.max(1, Number(process.env.LINK_CONCURRENCY ?? 2));
  const PACE_MS = Math.max(0, Number(process.env.LINK_PACE_MS ?? 2000));
  const counts = { processed: ads.length, ok: 0, no_link: 0, not_in_library: 0, error: 0 };
  for (let i = 0; i < ads.length; i += CONCURRENCY) {
    await Promise.all(ads.slice(i, i + CONCURRENCY).map(async (ad) => {
      const r = await resolveDestination(ad.adId);
      counts[r.status]++;
      if (r.status === 'error') return;
      await prisma.adLibraryAd.update({
        where: { id: ad.id },
        data: { linkCheckedAt: new Date(), ...(r.status === 'ok' && { linkUrl: r.url }) },
      });
    }));
    if (PACE_MS && i + CONCURRENCY < ads.length) await new Promise((r) => setTimeout(r, PACE_MS));
  }
  return counts;
}
