import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/genome/brands/growth?window=182&limit=12
//
// Fast-growing brands in Europe, ranked by reach growth over a lookback window,
// computed from the weekly SovSnapshot time-series (latest vs ~window days ago).
// A 6-month default avoids the recent ingestion freeze and surfaces real
// trajectories. Each row carries a compact activeAds series for a sparkline.
// =============================================================================

export const dynamic = 'force-dynamic';

interface Row {
  brandId: string; pageName: string; pageId: string; category: string | null; country: string | null;
  activeNow: number; activeThen: number; reachNow: bigint; reachThen: bigint;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const windowDays = Math.min(400, Math.max(28, Number(sp.get('window') ?? 182)));
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') ?? 12)));

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (s."brandId") s."brandId", s."weekStart", s."totalReach", s."activeAds"
      FROM "SovSnapshot" s ORDER BY s."brandId", s."weekStart" DESC
    ),
    base AS (
      SELECT DISTINCT ON (s."brandId") s."brandId", s."totalReach" AS b_reach, s."activeAds" AS b_active
      FROM "SovSnapshot" s JOIN latest l ON l."brandId" = s."brandId"
      WHERE s."weekStart" <= l."weekStart" - ($1 || ' days')::interval
      ORDER BY s."brandId", s."weekStart" DESC
    )
    SELECT b.id AS "brandId", b."pageName", b."pageId", b.category, b.country,
      l."activeAds" AS "activeNow", base.b_active AS "activeThen",
      l."totalReach"::bigint AS "reachNow", base.b_reach::bigint AS "reachThen"
    FROM latest l
    JOIN base ON base."brandId" = l."brandId"
    JOIN "AdLibraryBrand" b ON b.id = l."brandId"
    WHERE l."activeAds" >= 25 AND base.b_reach > 200000
    ORDER BY (l."totalReach"::float / GREATEST(base.b_reach, 1)) DESC
    LIMIT $2
    `,
    String(windowDays),
    limit
  );

  // Compact activeAds sparkline series for the ranked brands.
  const ids = rows.map((r) => r.brandId);
  const series = new Map<string, number[]>();
  if (ids.length) {
    const pts = await prisma.$queryRawUnsafe<Array<{ brandId: string; activeAds: number }>>(
      `SELECT "brandId", "activeAds" FROM "SovSnapshot"
       WHERE "brandId" = ANY($1::text[]) AND "weekStart" > NOW() - ($2 || ' days')::interval
       ORDER BY "weekStart" ASC`,
      ids,
      String(windowDays + 14)
    );
    for (const p of pts) {
      const arr = series.get(p.brandId) ?? [];
      arr.push(p.activeAds);
      series.set(p.brandId, arr);
    }
  }

  const pct = (now: number, then: number) => (then > 0 ? Math.round((now / then - 1) * 100) : null);
  const downsample = (arr: number[], n = 16) => {
    if (arr.length <= n) return arr;
    const step = arr.length / n;
    return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
  };

  const brands = rows.map((r) => {
    const reachNow = Number(r.reachNow), reachThen = Number(r.reachThen);
    return {
      pageId: r.pageId,
      name: r.pageName,
      category: r.category,
      country: r.country,
      reachNow,
      reachThen,
      reachGrowthPct: pct(reachNow, reachThen),
      adsNow: r.activeNow,
      adsThen: r.activeThen,
      adsGrowthPct: pct(r.activeNow, r.activeThen),
      series: downsample(series.get(r.brandId) ?? []),
    };
  });

  return NextResponse.json({ windowDays, count: brands.length, brands });
}
