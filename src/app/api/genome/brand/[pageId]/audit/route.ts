import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/genome/brand/[pageId]/audit
//
// A deep review of one brand's ad account, built entirely from ad-library data:
// growth trajectory (SovSnapshot), reach efficiency, format mix, creative
// velocity, their proven winner, a genome slice, and a rule-based verdict.
// =============================================================================

export const dynamic = 'force-dynamic';

const DURATION_DAYS = `ROUND((EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400)::numeric)::int`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;

  const brand = await prisma.adLibraryBrand.findUnique({
    where: { pageId },
    select: { id: true, pageId: true, pageName: true, category: true, country: true, website: true, activeAdCount: true },
  });
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  const [totals, series, formatMix, winnerRows, genomeRows] = await Promise.all([
    // ad totals + reach + efficiency
    prisma.$queryRawUnsafe<Array<{ totalAds: number; activeAds: number; totalReach: bigint; activeReach: bigint }>>(
      `SELECT COUNT(*)::int AS "totalAds",
        COUNT(*) FILTER (WHERE "isActive")::int AS "activeAds",
        COALESCE(SUM("reachEstimate"),0)::bigint AS "totalReach",
        COALESCE(SUM("reachEstimate") FILTER (WHERE "isActive"),0)::bigint AS "activeReach"
       FROM "AdLibraryAd" WHERE "brandId" = $1`,
      brand.id
    ),
    // weekly trajectory (last ~1y)
    prisma.$queryRawUnsafe<Array<{ week: string; activeAds: number; reach: bigint; newAds: number }>>(
      `SELECT to_char("weekStart",'YYYY-MM-DD') AS week, "activeAds", "totalReach"::bigint AS reach, "newAdsCount" AS "newAds"
       FROM "SovSnapshot" WHERE "brandId" = $1 AND "weekStart" > NOW() - INTERVAL '380 days'
       ORDER BY "weekStart" ASC`,
      brand.id
    ),
    // format mix
    prisma.$queryRawUnsafe<Array<{ format: string | null; n: number }>>(
      `SELECT "displayFormat" AS format, COUNT(*)::int AS n FROM "AdLibraryAd"
       WHERE "brandId" = $1 GROUP BY "displayFormat" ORDER BY n DESC`,
      brand.id
    ),
    // proven winner (longest-running)
    prisma.$queryRawUnsafe<Array<{ days: number; reach: number | null; headline: string | null; body: string | null; isActive: boolean; format: string | null }>>(
      `SELECT ${DURATION_DAYS} AS days, a."reachEstimate" AS reach, a.title AS headline, a.body, a."isActive", a."displayFormat" AS format
       FROM "AdLibraryAd" a WHERE a."brandId" = $1 AND a."startDate" IS NOT NULL AND a."reachEstimate" IS NOT NULL
       ORDER BY days DESC, a."reachEstimate" DESC LIMIT 1`,
      brand.id
    ),
    // genome slice: classified ads by hook tactic (median longevity)
    prisma.$queryRawUnsafe<Array<{ gene: string; n: number; medianDays: number }>>(
      `SELECT c."hookTactic" AS gene, COUNT(*)::int AS n,
        ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DURATION_DAYS}))::numeric)::int AS "medianDays"
       FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId"
       WHERE a."brandId" = $1 AND a."startDate" IS NOT NULL
       GROUP BY c."hookTactic" ORDER BY n DESC`,
      brand.id
    ),
  ]);

  const t = totals[0];
  const totalReach = Number(t.totalReach);
  const activeReach = Number(t.activeReach);
  const reachPerActiveAd = t.activeAds > 0 ? Math.round(activeReach / t.activeAds) : 0;

  // growth: latest vs ~182d earlier from the series
  const s = series.map((r) => ({ week: r.week, activeAds: r.activeAds, reachM: +(Number(r.reach) / 1e6).toFixed(1), newAds: r.newAds }));
  const latest = s[s.length - 1];
  const baseIdx = s.findIndex((p) => new Date(p.week).getTime() >= (latest ? new Date(latest.week).getTime() - 182 * 864e5 : 0));
  const base = baseIdx >= 0 ? s[baseIdx] : s[0];
  const pct = (now?: number, then?: number) => (then && then > 0 && now != null ? Math.round((now / then - 1) * 100) : null);
  const reachPct = pct(latest?.reachM, base?.reachM);
  const adsPct = pct(latest?.activeAds, base?.activeAds);

  const fmtTotal = formatMix.reduce((a, f) => a + f.n, 0) || 1;
  const formats = formatMix.map((f) => ({ format: f.format ?? 'unknown', count: f.n, pct: Math.round((f.n / fmtTotal) * 100) }));
  const topFormat = formats[0];

  const winner = winnerRows[0] ?? null;

  // rule-based verdict — instant, grounded in the numbers (no LLM needed)
  const verdict: { tone: 'good' | 'warn' | 'note'; text: string }[] = [];
  if (reachPct != null && reachPct >= 50)
    verdict.push({ tone: 'good', text: `Scaling hard — reach ${reachPct >= 0 ? '+' : ''}${reachPct}% and active ads ${adsPct != null ? (adsPct >= 0 ? '+' : '') + adsPct + '%' : 'up'} over the last 6 months.` });
  else if (reachPct != null && reachPct <= -20)
    verdict.push({ tone: 'warn', text: `Pulling back — reach down ${reachPct}% over 6 months. Something changed in their strategy.` });
  else verdict.push({ tone: 'note', text: `Steady — reach ${reachPct != null ? (reachPct >= 0 ? '+' : '') + reachPct + '%' : 'flat'} over 6 months.` });

  if (reachPerActiveAd >= 300_000) verdict.push({ tone: 'good', text: `Efficient creative — ${(reachPerActiveAd / 1000).toFixed(0)}K reach per active ad. Their ads are working before spend.` });
  else if (reachPerActiveAd > 0 && reachPerActiveAd < 30_000) verdict.push({ tone: 'warn', text: `Low reach per ad (${(reachPerActiveAd / 1000).toFixed(0)}K) with ${t.activeAds} live ads — volume over proven creative. Beatable on quality.` });

  if (topFormat && topFormat.pct >= 70) verdict.push({ tone: 'warn', text: `Format-concentrated — ${topFormat.pct}% ${topFormat.format}. Thin creative diversity is an opening.` });
  if (winner) verdict.push({ tone: 'note', text: `Their proven winner has run ${winner.days} days${winner.isActive ? ' and is still live' : ''} — the recipe to study first.` });

  return NextResponse.json({
    brand: { name: brand.pageName, pageId: brand.pageId, category: brand.category, country: brand.country, website: brand.website },
    totals: { totalAds: t.totalAds, activeAds: t.activeAds, totalReach, activeReach, reachPerActiveAd },
    growth: { windowDays: 182, reachPct, adsPct, reachNowM: latest?.reachM ?? null, reachThenM: base?.reachM ?? null, series: s },
    formats,
    winner: winner ? { runDays: winner.days, reach: winner.reach, headline: winner.headline, body: winner.body, isActive: winner.isActive, format: winner.format } : null,
    genome: { classifiedAds: genomeRows.reduce((a, g) => a + g.n, 0), hooks: genomeRows.slice(0, 6) },
    verdict,
  });
}
