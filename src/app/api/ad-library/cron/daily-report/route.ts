import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/ad-library/cron/daily-report
//
// Posts a daily ingestion summary to Slack (incoming webhook):
//   • total ads ingested (and active) across all brands
//   • ads added in the last 24h + how many distinct brands they came from
//   • top brands by ads added (24h ingest delta)
//   • highest ad velocity in Europe = brand launching the most NEW ads (by the
//     ad's own startDate) over the last 7 days. Our dataset is EU-reached, so
//     "velocity in Europe" is inherent to the corpus.
//
// Set SLACK_WEBHOOK_URL. Guarded by CRON_SECRET like the other crons.
// =============================================================================

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!SLACK_WEBHOOK_URL) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL not configured' }, { status: 503 });
  }

  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  // Totals + 24h ingest delta (grouped by brand) + 7d launch velocity (by startDate).
  const [totalAds, activeAds, totalBrands, new24hByBrand, launched7dByBrand] = await Promise.all([
    prisma.adLibraryAd.count(),
    prisma.adLibraryAd.count({ where: { isActive: true } }),
    prisma.adLibraryBrand.count({ where: { ingestionStatus: 'active' } }),
    prisma.adLibraryAd.groupBy({
      by: ['brandId'],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.adLibraryAd.groupBy({
      by: ['brandId'],
      where: { startDate: { gte: since7d } },
      _count: { _all: true },
    }),
  ]);

  const new24hTotal = new24hByBrand.reduce((s, g) => s + g._count._all, 0);

  // Resolve brand names for everything we'll display.
  const ids = [...new Set([...new24hByBrand, ...launched7dByBrand].map((g) => g.brandId))];
  const brands = await prisma.adLibraryBrand.findMany({
    where: { id: { in: ids } },
    select: { id: true, pageName: true, totalReach: true },
  });
  const nameOf = new Map(brands.map((b) => [b.id, b.pageName] as const));
  const reachOf = new Map(brands.map((b) => [b.id, b.totalReach] as const));

  const topNew = [...new24hByBrand]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8);
  const topVelocity = [...launched7dByBrand]
    .sort((a, b) => b._count._all - a._count._all)[0];

  // ── Build the Slack message (mrkdwn) ──────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`*📊 Ad Ingestion — ${today}*`);
  lines.push(`Total: *${totalAds.toLocaleString()}* ads (${activeAds.toLocaleString()} active) across ${totalBrands.toLocaleString()} active brands`);
  lines.push(`Last 24h: *+${new24hTotal.toLocaleString()}* ads from *${new24hByBrand.length}* brands`);

  if (topNew.length) {
    lines.push('');
    lines.push('*Top brands by new ads (24h):*');
    topNew.forEach((g, i) => {
      lines.push(`${i + 1}. ${nameOf.get(g.brandId) ?? g.brandId} — +${g._count._all}`);
    });
  }

  if (topVelocity) {
    const reachM = Number(reachOf.get(topVelocity.brandId) ?? 0) / 1e6;
    lines.push('');
    lines.push(`*🏎️ Highest ad velocity in Europe (7d launches):*`);
    lines.push(`${nameOf.get(topVelocity.brandId) ?? topVelocity.brandId} — *${topVelocity._count._all}* new ads/week${reachM ? ` (reach ≈ ${reachM.toFixed(1)}M)` : ''}`);
  }

  const text = lines.join('\n');

  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Slack post failed: ${res.status} ${await res.text()}` }, { status: 502 });
  }

  return NextResponse.json({
    posted: true,
    totalAds, activeAds, new24hTotal,
    brandsWithNewAds: new24hByBrand.length,
    topVelocity: topVelocity ? { brand: nameOf.get(topVelocity.brandId), newAds7d: topVelocity._count._all } : null,
  });
}
