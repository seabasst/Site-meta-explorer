/**
 * Continuously drain the pending AdAsset queue into R2.
 *
 * The long-running local counterpart of the drain the ingest worker now does each tick.
 * Use it to work through the historical backlog; one Puppeteer browser is reused for the
 * whole run, so it is much faster than repeated process-assets.ts invocations.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/drain-assets.ts
 *   BATCH=100 MAX=5000 npx tsx --env-file=.env.local scripts/drain-assets.ts
 */
import { prisma } from '../src/lib/prisma';
import { processPendingAssets } from '../src/lib/asset-pipeline';
import { isR2Configured } from '../src/lib/r2';

const BATCH = Math.max(1, Number(process.env.BATCH ?? 50));
const MAX = Number(process.env.MAX ?? Infinity);
// Consecutive zero-success batches that mean "blocked" rather than "these assets are gone".
const DRY_LIMIT = Math.max(1, Number(process.env.DRY_LIMIT ?? 5));

let running = true;
process.on('SIGINT', () => { console.log('\nStopping after current batch…'); running = false; });

async function main() {
  if (!isR2Configured()) { console.error('R2 not configured.'); process.exit(1); }
  const queued = await prisma.adAsset.count({ where: { downloadStatus: 'pending' } });
  console.log(`Draining asset queue: ${queued.toLocaleString()} pending, batch ${BATCH}`);

  const t0 = Date.now();
  let done = 0, ok = 0, failed = 0, dryBatches = 0;
  while (running && done < MAX) {
    const r = await processPendingAssets(Math.min(BATCH, MAX - done));
    if (r.processed === 0) { console.log('Queue empty.'); break; }
    done += r.processed; ok += r.succeeded; failed += r.failed;

    // Facebook starts refusing render_ad after roughly 10k requests in a session. When
    // that happens every asset "fails" for a reason that is not the asset's fault, and
    // running on would burn the queue. Stop instead, and hand back the rows we marked.
    dryBatches = r.succeeded === 0 ? dryBatches + 1 : 0;
    if (dryBatches >= DRY_LIMIT) {
      const reset = await prisma.adAsset.updateMany({
        where: { downloadStatus: 'failed' },
        data: { downloadStatus: 'pending', downloadError: null },
      });
      console.log(`\n⛔ ${DRY_LIMIT} batches with zero successes — looks blocked, not broken.`);
      console.log(`   Reset ${reset.count} failed rows to pending. Wait it out and start again.`);
      break;
    }
    const mins = (Date.now() - t0) / 60000;
    const rate = done / mins;
    console.log(`  ${done.toLocaleString()} done (${ok} stored, ${failed} failed) · ${rate.toFixed(1)}/min · ${(queued - done).toLocaleString()} left · eta ${(((queued - done) / rate) / 60 / 24).toFixed(1)}d`);
  }
  console.log(`\nStopped. ${done} processed, ${ok} stored, ${failed} failed.`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
