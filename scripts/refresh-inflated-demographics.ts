/**
 * Re-aggregate brands whose stored demographics were inflated by the pre-fix
 * per-country weighting (breakdowns summing to >100%).
 *
 *   npx tsx scripts/refresh-inflated-demographics.ts [--limit=200] [--dry]
 *
 * The stored JSON only holds the aggregate, not the per-ad country breakdown,
 * so the numbers cannot be recomputed offline — each brand needs one
 * ads_archive call. The ingestion worker refreshes demographics anyway on its
 * 7-day cycle; this only front-runs it for the brands that are visibly wrong.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';
import { fetchAndStoreDemographics, sleep } from '../src/lib/ingestion/ingest-core';

const limit = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 200);
const dryRun = process.argv.includes('--dry');

async function main() {
  const brands = await prisma.$queryRawUnsafe<{ id: string; pageId: string; pageName: string; pct_sum: number }[]>(`
    SELECT id, "pageId", "pageName", round(s, 1)::float8 AS pct_sum
    FROM (
      SELECT id, "pageId", "pageName",
             (SELECT sum((e->>'percentage')::numeric)
              FROM jsonb_array_elements("demographicsJson"->'genderBreakdown') e) AS s
      FROM "AdLibraryBrand"
      WHERE "demographicsJson" IS NOT NULL
        AND jsonb_typeof("demographicsJson"->'genderBreakdown') = 'array'
        AND "pageId" ~ '^[0-9]+$'
    ) t
    WHERE s > 101
    ORDER BY s DESC
    LIMIT ${Math.max(1, Math.trunc(limit))};
  `);

  console.log(`${brands.length} brands with inflated demographics${dryRun ? ' (dry run)' : ''}\n`);
  if (dryRun) {
    for (const b of brands.slice(0, 20)) console.log(`  ${b.pageName}: ${b.pct_sum}%`);
    return;
  }

  let ok = 0;
  for (const [i, b] of brands.entries()) {
    console.log(`${i + 1}/${brands.length} ${b.pageName} (was ${b.pct_sum}%)`);
    if (await fetchAndStoreDemographics(b.id, b.pageId, b.pageName)) ok++;
    await sleep(2000); // ponytail: fixed pace, share one app-level Meta quota with the worker
  }

  console.log(`\nRefreshed ${ok}/${brands.length}. Re-run until the count reaches 0.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
