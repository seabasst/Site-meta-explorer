import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { classifyManyWithKimi, kimiConfigured } from '@/lib/classification/classify-kimi';

// =============================================================================
// GET /api/ad-library/cron/classify-kimi
//
// Incremental classification of newly-ingested ads via Kimi (Moonshot). Keeps
// coverage fresh day-to-day. For the large one-time backlog, run
// scripts/classify-kimi.ts instead (no serverless timeout).
//
// Batch size is capped for the plan's function limit; raise KIMI_CRON_BATCH on
// a plan with longer function durations.
// =============================================================================

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!kimiConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'KIMI_API_KEY not configured' });
  }

  const batch = Math.min(400, Math.max(20, Number(process.env.KIMI_CRON_BATCH ?? 120)));
  const concurrency = Math.min(12, Math.max(2, Number(process.env.KIMI_CONCURRENCY ?? 6)));

  const ads = await prisma.adLibraryAd.findMany({
    where: { classification: null },
    include: { brand: { select: { pageName: true, category: true } } },
    orderBy: { reachEstimate: 'desc' },
    take: batch,
  });
  if (ads.length === 0) return NextResponse.json({ message: 'No unclassified ads', classified: 0 });

  const inputs = ads.map((a) => ({
    id: a.id, brandName: a.brand.pageName, category: a.brand.category ?? undefined,
    body: a.body ?? undefined, title: a.title ?? undefined, ctaText: a.ctaText ?? undefined, displayFormat: a.displayFormat ?? undefined,
  }));
  const results = await classifyManyWithKimi(inputs, concurrency);
  const rows = results.filter((r) => r.ok && r.output).map((r) => ({
    adId: r.adId,
    assetType: r.output!.assetType, visualFormat: r.output!.visualFormat, hookTactic: r.output!.hookTactic,
    messagingAngle: r.output!.messagingAngle, awarenessStage: r.output!.awarenessStage, creativeMechanic: r.output!.creativeMechanic,
    offerType: r.output!.offerType, intendedAudience: r.output!.intendedAudience,
    hookScore: Math.round(r.output!.hookScore), conceptCluster: r.output!.conceptCluster, confidence: r.output!.confidence,
    classifiedBy: 'kimi', classificationSource: 'text',
  }));
  if (rows.length) await prisma.adClassification.createMany({ data: rows, skipDuplicates: true });

  const remaining = await prisma.adLibraryAd.count({ where: { classification: null } });
  return NextResponse.json({ processed: ads.length, classified: rows.length, failed: results.length - rows.length, remaining });
}
