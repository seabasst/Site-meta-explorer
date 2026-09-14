// Manual trigger for the Neon → BigQuery raw sync (P1).
//   npx tsx --env-file=.env.local scripts/bq-sync.ts [--prune]
// Needs BQ_DATASET (+ BQ_PROJECT) and GOOGLE_APPLICATION_CREDENTIALS[_JSON].
import { syncToBigQuery, pruneDeletedFromBigQuery } from '../src/lib/bq-sync';
import { prisma } from '../src/lib/prisma';

(async () => {
  const r = await syncToBigQuery();
  if (!r.synced) { console.error(`Sync skipped: ${r.reason}`); process.exit(1); }
  for (const t of r.results ?? []) console.log(`  ${t.table}: ${t.rows.toLocaleString()} rows`);
  console.log('BigQuery raw sync complete.');
  // Opt-in: the prune deletes, so it never runs as a side effect of a manual sync.
  if (process.argv.includes('--prune')) {
    const p = await pruneDeletedFromBigQuery();
    if (!p.pruned) console.error(`Prune skipped: ${p.reason}`);
    else console.log(`Prune: ${Object.entries(p.deleted ?? {}).map(([k, n]) => `${k}=-${n}`).join(', ') || 'nothing to remove'}`);
  }
})().catch((e) => { console.error('Sync failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
