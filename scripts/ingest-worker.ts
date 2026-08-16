/**
 * Continuous ingestion worker (for real scale).
 *
 * Runs the SAME ingestion engine as the Vercel cron (src/lib/ingestion/
 * ingest-core.ts), but as a long-running loop with no serverless timeout — so it
 * can mill through thousands of brands and keep them refreshed weekly. Deploy it
 * on any always-on host (Railway / Render / Fly.io / a small VPS / pm2).
 *
 * It selects "due" brands (pending/failed + active brands overdue for their
 * weekly re-check, overdue-first), processes them with bounded concurrency and a
 * pace delay (token rotation + rate-limit backoff live inside the engine), then
 * polls again when the queue is empty. Idempotent — safe to run one instance.
 *
 * Run (Node 22.6+ strips TS types):
 *   npx tsx --env-file=.env.local scripts/ingest-worker.ts
 *   CONCURRENCY=3 PACE_MS=3000 npx tsx --env-file=.env.local scripts/ingest-worker.ts
 *   (runs via tsx — plain `node` can't resolve the app's TS lib imports)
 *   npx tsx --env-file=.env.local scripts/ingest-worker.ts --once   # drain then exit
 *
 * Env / flags:
 *   CONCURRENCY (default 2)   brands processed in parallel
 *   PACE_MS     (default 4000) delay between dispatching brands (rate-limit safety)
 *   BATCH       (default 24)   due-brands fetched per DB round
 *   POLL_MS     (default 60000) sleep when no brands are due
 *   --once                     process the current backlog once, then exit
 *
 * Requires DATABASE_URL + FACEBOOK_ACCESS_TOKEN(S) in the environment.
 */
import { prisma } from '../src/lib/prisma';
import { selectDueBrands, processBrand, tokenManager, sleep } from '../src/lib/ingestion/ingest-core';
import { sendDailyReport } from '../src/lib/daily-report';

const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2));
const PACE_MS = Math.max(0, Number(process.env.PACE_MS ?? 4000));
const BATCH = Math.max(1, Number(process.env.BATCH ?? 24));
const POLL_MS = Math.max(5000, Number(process.env.POLL_MS ?? 60_000));
const REPORT_HOUR = Math.min(23, Math.max(0, Number(process.env.REPORT_HOUR ?? 7))); // UTC hour to post the daily Slack report
const ONCE = process.argv.includes('--once');

// Post the daily Slack report once per UTC day, the first loop tick at/after REPORT_HOUR.
// ponytail: in-memory dedupe — a worker restart after REPORT_HOUR can double-post that
// day. Restarts are rare (deploy/crash) and a dup Slack post is harmless; upgrade to a
// DB marker only if it becomes annoying. Prefer catch-up over a strict window so a
// worker down during the exact hour still posts once it's back.
let lastReportYmd = '';
async function maybeSendDailyReport() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  if (lastReportYmd === ymd || now.getUTCHours() < REPORT_HOUR) return;
  lastReportYmd = ymd;
  try {
    const r = await sendDailyReport();
    console.log(r.posted ? `📊 Daily report posted to Slack` : `📊 Daily report skipped: ${r.reason}`);
  } catch (e) {
    console.log(`📊 Daily report error: ${e instanceof Error ? e.message : 'unknown'}`);
  }
}

let running = true;
let processed = 0, ok = 0, failed = 0;
process.on('SIGINT', () => { console.log('\nStopping after current brands…'); running = false; });

async function processWithConcurrency(brands: { id: string; pageId: string; pageName: string }[]) {
  let i = 0;
  async function worker() {
    while (running) {
      const idx = i++;
      if (idx >= brands.length) return;
      const b = brands[idx];
      if (idx > 0 && PACE_MS) await sleep(PACE_MS); // stagger dispatch
      try {
        const r = await processBrand(b.id, b.pageId, b.pageName);
        const good = (r as { success?: boolean })?.success !== false;
        good ? ok++ : failed++;
        console.log(`  ${good ? '✓' : '✗'} ${b.pageName}`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${b.pageName} — ${e instanceof Error ? e.message : 'error'}`);
      }
      processed++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, brands.length) }, worker));
}

async function main() {
  if (!tokenManager.hasTokens()) { console.error('No FACEBOOK_ACCESS_TOKEN(S) configured.'); process.exit(1); }
  console.log(`Ingest worker started — concurrency ${CONCURRENCY}, pace ${PACE_MS}ms, batch ${BATCH}${ONCE ? ', --once' : ''}`);

  while (running) {
    await maybeSendDailyReport();
    const brands = await selectDueBrands(BATCH);
    if (brands.length === 0) {
      if (ONCE) { console.log('Backlog drained.'); break; }
      const remaining = await prisma.adLibraryBrand.count({ where: { ingestionStatus: { in: ['pending', 'failed'] } } });
      console.log(`No brands due. processed=${processed} (ok ${ok}, failed ${failed}) · pending=${remaining}. Polling in ${POLL_MS / 1000}s…`);
      await sleep(POLL_MS);
      continue;
    }
    console.log(`Batch of ${brands.length} due brands (tokens: ${tokenManager.getTotalTokens()})`);
    await processWithConcurrency(brands.map((b) => ({ id: b.id, pageId: b.pageId, pageName: b.pageName })));
    console.log(`  → running total: ${processed} processed (${ok} ok, ${failed} failed)`);
  }

  console.log(`\nWorker stopped. Processed ${processed} (ok ${ok}, failed ${failed}).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error('Worker crashed:', e); process.exit(1); });
