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
import { sendDailyReport, sendWeeklyReport } from '../src/lib/daily-report';
import { syncToBigQuery } from '../src/lib/bq-sync';
import { processPendingAssets } from '../src/lib/asset-pipeline';
import { isR2Configured } from '../src/lib/r2';

const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2));
const PACE_MS = Math.max(0, Number(process.env.PACE_MS ?? 4000));
const BATCH = Math.max(1, Number(process.env.BATCH ?? 24));
const POLL_MS = Math.max(5000, Number(process.env.POLL_MS ?? 60_000));
const REPORT_HOUR = Math.min(23, Math.max(0, Number(process.env.REPORT_HOUR ?? 7))); // UTC hour to post the daily Slack report
const REPORT_WEEKDAY = Math.min(6, Math.max(0, Number(process.env.REPORT_WEEKDAY ?? 1))); // UTC weekday for the weekly summary (0=Sun, 1=Mon)
const ONCE = process.argv.includes('--once');

// EXPERIMENT: daytime backoff. During the peak-contention UTC window Meta throttles the
// shared app quota hard (13:00–17:00 UTC measured ~5x slower than the overnight peak),
// and burning calls on 429s there can deepen the rolling throttle. Pausing that window
// may preserve quota for the productive hours. Disabled unless both bounds are set.
// Handles a wrap-around window (start > end) too. Set BACKOFF_START_UTC/BACKOFF_END_UTC.
const BACKOFF_START = Number(process.env.BACKOFF_START_UTC ?? -1);
const BACKOFF_END = Number(process.env.BACKOFF_END_UTC ?? -1);
function inBackoffWindow(): boolean {
  if (BACKOFF_START < 0 || BACKOFF_END < 0) return false;
  const h = new Date().getUTCHours();
  return BACKOFF_START <= BACKOFF_END
    ? (h >= BACKOFF_START && h < BACKOFF_END)
    : (h >= BACKOFF_START || h < BACKOFF_END);
}

// Post the daily Slack report once per UTC day, the first loop tick at/after REPORT_HOUR.
// ponytail: in-memory dedupe — a worker restart after REPORT_HOUR can double-post that
// day. Restarts are rare (deploy/crash) and a dup Slack post is harmless; upgrade to a
// DB marker only if it becomes annoying. Prefer catch-up over a strict window so a
// worker down during the exact hour still posts once it's back.
let lastReportYmd = '';
let lastWeeklyYmd = '';
async function maybeSendReports() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  if (now.getUTCHours() < REPORT_HOUR) return;
  // Weekly summary first (Mondays by default), then the daily. Both once per day max.
  if (lastWeeklyYmd !== ymd && now.getUTCDay() === REPORT_WEEKDAY) {
    lastWeeklyYmd = ymd;
    try {
      const r = await sendWeeklyReport();
      console.log(r.posted ? `📅 Weekly report posted to Slack` : `📅 Weekly report skipped: ${r.reason}`);
    } catch (e) {
      console.log(`📅 Weekly report error: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
  if (lastReportYmd !== ymd) {
    lastReportYmd = ymd;
    try {
      const r = await sendDailyReport();
      console.log(r.posted ? `📊 Daily report posted to Slack` : `📊 Daily report skipped: ${r.reason}`);
    } catch (e) {
      console.log(`📊 Daily report error: ${e instanceof Error ? e.message : 'unknown'}`);
    }
    // Nightly BigQuery sync, right after the daily report. Fully isolated in try/catch
    // and a no-op without BQ_DATASET, so it can never disrupt ingestion.
    try {
      const s = await syncToBigQuery();
      console.log(s.synced ? `🗄️ BigQuery sync: ${(s.results ?? []).map((t) => `${t.table}=${t.rows}`).join(', ')}` : `🗄️ BigQuery sync skipped: ${s.reason}`);
    } catch (e) {
      console.log(`🗄️ BigQuery sync error: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
}

// Ingestion only ever queued AdAsset rows as pending; nothing in production drained
// them, so the queue grew to ~1.5M. Drain it on every loop tick, after a brand batch and
// again while idle, so "ingested" always converges on "media stored in R2".
// ponytail: fixed batch per tick, no adaptive sizing — raise ASSET_BATCH if the queue
// outgrows the drain rate.
const ASSET_BATCH = Math.max(0, Number(process.env.ASSET_BATCH ?? 50));
// Facebook stops serving render_ad after roughly 10k requests in a session. Every asset
// then "fails" for a reason that is not the asset's fault, so pause the drain and hand
// the rows back instead of burning through the queue. Ingestion continues either way.
const ASSET_DRY_LIMIT = Math.max(1, Number(process.env.ASSET_DRY_LIMIT ?? 5));
const ASSET_COOLDOWN_MS = Math.max(0, Number(process.env.ASSET_COOLDOWN_MS ?? 3_600_000));
let assetsOk = 0, assetsFailed = 0, assetDryBatches = 0, assetPausedUntil = 0;
async function drainAssets(): Promise<void> {
  if (ASSET_BATCH === 0 || !isR2Configured()) return;
  if (Date.now() < assetPausedUntil) return;
  try {
    const r = await processPendingAssets(ASSET_BATCH);
    if (r.processed === 0) return;
    assetsOk += r.succeeded;
    assetsFailed += r.failed;
    console.log(`  📦 assets: ${r.succeeded} stored, ${r.failed} failed (total ${assetsOk}/${assetsOk + assetsFailed})`);

    assetDryBatches = r.succeeded === 0 ? assetDryBatches + 1 : 0;
    if (assetDryBatches >= ASSET_DRY_LIMIT) {
      const reset = await prisma.adAsset.updateMany({
        where: { downloadStatus: 'failed' },
        data: { downloadStatus: 'pending', downloadError: null },
      });
      assetDryBatches = 0;
      assetPausedUntil = Date.now() + ASSET_COOLDOWN_MS;
      console.log(`  ⛔ asset drain looks blocked — reset ${reset.count} rows, pausing ${ASSET_COOLDOWN_MS / 60000}min.`);
    }
  } catch (e) {
    // Never let R2 or Puppeteer trouble stop ingestion.
    console.log(`  📦 asset drain error: ${e instanceof Error ? e.message : 'error'}`);
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
   try {
    await maybeSendReports();
    if (inBackoffWindow()) {
      // Ingestion is paused because the Graph API quota is spent, but the asset drain
      // goes to render_ad on a separate limit — so spend the quiet hours on the 1.5M
      // asset backlog rather than sleeping through them.
      console.log(`⏸️  Quota backoff (${BACKOFF_START}:00–${BACKOFF_END}:00 UTC) — ingestion paused, draining assets instead.`);
      await drainAssets();
      await sleep(POLL_MS);
      continue;
    }
    const brands = await selectDueBrands(BATCH);
    if (brands.length === 0) {
      if (ONCE) { console.log('Backlog drained.'); break; }
      // No API work to do, so spend the idle tick on the asset queue instead of sleeping.
      await drainAssets();
      const remaining = await prisma.adLibraryBrand.count({ where: { ingestionStatus: { in: ['pending', 'failed'] } } });
      // Deliberately no asset-queue count here: it is a COUNT over ~1.5M rows and this
      // branch runs every POLL_MS. The running totals above already show drain progress.
      console.log(`No brands due. processed=${processed} (ok ${ok}, failed ${failed}) · pending=${remaining} · assets ${assetsOk} stored this run. Polling in ${POLL_MS / 1000}s…`);
      await sleep(POLL_MS);
      continue;
    }
    console.log(`Batch of ${brands.length} due brands (tokens: ${tokenManager.getTotalTokens()})`);
    await processWithConcurrency(brands.map((b) => ({ id: b.id, pageId: b.pageId, pageName: b.pageName })));
    await drainAssets();
    console.log(`  → running total: ${processed} processed (${ok} ok, ${failed} failed)`);
   } catch (e) {
    // Resilience: a transient DB error (e.g. Neon data-transfer quota) must not
    // crash-loop the worker. Back off and retry the loop instead of exiting.
    console.log(`⚠️  Loop error — backing off ${POLL_MS / 1000}s: ${e instanceof Error ? e.message : 'error'}`);
    await sleep(POLL_MS);
   }
  }

  console.log(`\nWorker stopped. Processed ${processed} (ok ${ok}, failed ${failed}).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error('Worker crashed:', e); process.exit(1); });
