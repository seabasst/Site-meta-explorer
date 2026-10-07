/**
 * Backfill AdLibraryAd.linkUrl for historic ads, newest first. The long-running
 * local counterpart of the ingest worker's drainLinks(); same function, same knobs.
 *
 *   npx tsx --env-file=.env.local scripts/drain-links.ts
 *   BATCH=60 MAX=20000 LINK_CONCURRENCY=3 npx tsx --env-file=.env.local scripts/drain-links.ts
 *   BRAND=<pageId> npx tsx --env-file=.env.local scripts/drain-links.ts   # one brand
 */
import { prisma } from '../src/lib/prisma';
import { resolvePendingDestinations } from '../src/lib/ad-destination';

const BATCH = Math.max(1, Number(process.env.BATCH ?? 40));
const MAX = Number(process.env.MAX ?? Infinity);
const DRY_LIMIT = Math.max(1, Number(process.env.DRY_LIMIT ?? 3));

let running = true;
process.on('SIGINT', () => { console.log('\nStopping after current batch…'); running = false; });

async function main() {
  const brandId = process.env.BRAND
    ? (await prisma.adLibraryBrand.findUniqueOrThrow({ where: { pageId: process.env.BRAND } })).id
    : undefined;
  const t0 = Date.now();
  const tot = { processed: 0, ok: 0, no_link: 0, not_in_library: 0, error: 0 };
  let dry = 0, dbErrors = 0;
  while (running && tot.processed < MAX) {
    let r;
    try {
      r = await resolvePendingDestinations(Math.min(BATCH, MAX - tot.processed), { brandId });
      dbErrors = 0;
    } catch (e) {
      // Neon drops long connections; back off rather than exit (see drain-assets.ts)
      if (++dbErrors >= 10) { console.log(`⛔ 10 consecutive errors, giving up: ${e}`); break; }
      await new Promise((res) => setTimeout(res, 15000));
      continue;
    }
    if (r.processed === 0) { console.log('Nothing left unchecked.'); break; }
    for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += r[k];
    // Errors leave rows unchecked, so a refusing library page would hand back the same batch forever
    dry = r.error === r.processed ? dry + 1 : 0;
    if (dry >= DRY_LIMIT) { console.log(`⛔ ${DRY_LIMIT} all-error batches: looks blocked. Wait and rerun.`); break; }
    const rate = tot.processed / ((Date.now() - t0) / 60000);
    console.log(`  ${tot.processed} checked · ${tot.ok} links, ${tot.no_link} none, ${tot.not_in_library} gone, ${tot.error} errors · ${rate.toFixed(1)}/min`);
  }
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
