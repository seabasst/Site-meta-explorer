/**
 * Bulk classification backfill via Kimi (Moonshot).
 *
 * Clears the unclassified-ad backlog with high concurrency and no serverless
 * timeout — run it on any machine (laptop/server) with the env set. The daily
 * cron then keeps NEW ads classified incrementally.
 *
 * Run (Node 22.6+ strips TS types):
 *   node --env-file=.env.local scripts/classify-kimi.ts --limit=5000 --concurrency=12
 *   node --env-file=.env.local scripts/classify-kimi.ts            # whole backlog
 *
 * Flags: --limit=<n> (default: all), --concurrency=<n> (default 12),
 *        --brand=<brandId> (only that brand)
 *
 * Requires: DATABASE_URL and KIMI_API_KEY (+ optional KIMI_MODEL, KIMI_BASE_URL).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { classifyManyWithKimi, kimiConfigured } from '../src/lib/classification/classify-kimi';

const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; })
);
const LIMIT = flags.limit ? Number(flags.limit) : Infinity;
const CONC = Number(flags.concurrency ?? 12);
const PAGE = 200; // ads fetched per DB round

async function main() {
  if (!kimiConfigured()) { console.error('KIMI_API_KEY not set.'); process.exit(1); }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  let done = 0, ok = 0, failed = 0;
  console.log(`Backfill classification via Kimi — concurrency ${CONC}${flags.brand ? `, brand ${flags.brand}` : ''}${LIMIT !== Infinity ? `, limit ${LIMIT}` : ''}`);

  while (done < LIMIT) {
    const take = Math.min(PAGE, LIMIT - done);
    const ads = await prisma.adLibraryAd.findMany({
      where: { classification: null, ...(flags.brand ? { brandId: String(flags.brand) } : {}) },
      include: { brand: { select: { pageName: true, category: true } } },
      orderBy: { reachEstimate: 'desc' }, // highest-impact ads first
      take,
    });
    if (ads.length === 0) { console.log('No more unclassified ads.'); break; }

    const inputs = ads.map((a) => ({
      id: a.id, brandName: a.brand.pageName, category: a.brand.category ?? undefined,
      body: a.body ?? undefined, title: a.title ?? undefined, ctaText: a.ctaText ?? undefined, displayFormat: a.displayFormat ?? undefined,
    }));
    const results = await classifyManyWithKimi(inputs, CONC);

    const rows = results.filter((r) => r.ok && r.output).map((r) => ({
      adId: r.adId,
      assetType: r.output!.assetType, visualFormat: r.output!.visualFormat, hookTactic: r.output!.hookTactic,
      messagingAngle: r.output!.messagingAngle, awarenessStage: r.output!.awarenessStage, creativeMechanic: r.output!.creativeMechanic,
      offerType: r.output!.offerType, intendedAudience: r.output!.intendedAudience,
      hookScore: Math.round(r.output!.hookScore), conceptCluster: r.output!.conceptCluster, confidence: r.output!.confidence,
      classifiedBy: 'kimi', classificationSource: 'text',
    }));
    if (rows.length) await prisma.adClassification.createMany({ data: rows, skipDuplicates: true });

    ok += rows.length; failed += results.length - rows.length; done += ads.length;
    const firstErr = results.find((r) => !r.ok)?.error;
    console.log(`  +${rows.length} classified (${ads.length} in round) · total ok ${ok}, failed ${failed}${firstErr ? ` · e.g. "${firstErr.slice(0, 80)}"` : ''}`);
    if (ok === 0 && failed >= results.length && done >= results.length) { console.error('All failing — stopping. Check KIMI_MODEL/key.'); break; }
  }

  const remaining = await prisma.adLibraryAd.count({ where: { classification: null } });
  console.log(`\nDone. Classified ${ok}, failed ${failed}. Remaining unclassified: ${remaining.toLocaleString()}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error('Backfill failed:', e); process.exit(1); });
