import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/genome/pulse
//
// The heartbeat of the ingestion pipeline — powers the live v3 dashboard.
// Returns ingestion volume, recency, and weekly-refresh freshness so the UI
// can show ads flowing in and which accounts are overdue for a re-check.
// =============================================================================

export const dynamic = 'force-dynamic';

interface PulseRow {
  totalAds: number;
  totalBrands: number;
  activeAds: number;
  ads7d: number;
  ads24h: number;
  lastAdAt: Date | null;
  brandsDue: number;
  brandsFresh: number;
}

export async function GET() {
  const [row] = await prisma.$queryRawUnsafe<PulseRow[]>(`
    SELECT
      (SELECT COUNT(*)::int FROM "AdLibraryAd")                                              AS "totalAds",
      (SELECT COUNT(*)::int FROM "AdLibraryBrand")                                           AS "totalBrands",
      (SELECT COUNT(*)::int FROM "AdLibraryAd" WHERE "isActive" = true)                      AS "activeAds",
      (SELECT COUNT(*)::int FROM "AdLibraryAd" WHERE "createdAt" > NOW() - INTERVAL '7 days') AS "ads7d",
      (SELECT COUNT(*)::int FROM "AdLibraryAd" WHERE "createdAt" > NOW() - INTERVAL '24 hours') AS "ads24h",
      (SELECT MAX("createdAt") FROM "AdLibraryAd")                                           AS "lastAdAt",
      (SELECT COUNT(*)::int FROM "AdLibraryBrand"
         WHERE "lastCheckedAt" IS NULL OR "lastCheckedAt" < NOW() - INTERVAL '7 days')       AS "brandsDue",
      (SELECT COUNT(*)::int FROM "AdLibraryBrand" WHERE "lastCheckedAt" > NOW() - INTERVAL '7 days') AS "brandsFresh"
  `);

  // 14-day ingestion series for the sparkline.
  const daily = await prisma.$queryRawUnsafe<Array<{ day: string; n: number }>>(`
    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
    FROM "AdLibraryAd"
    WHERE "createdAt" > NOW() - INTERVAL '14 days'
    GROUP BY 1 ORDER BY 1
  `);

  const lastAdAt = row.lastAdAt ? new Date(row.lastAdAt) : null;
  const hoursSince = lastAdAt ? (Date.now() - lastAdAt.getTime()) / 3.6e6 : null;
  // Pipeline is "live" if anything landed in the last ~26h (daily cron + slack).
  const status: 'live' | 'idle' | 'stalled' =
    hoursSince == null ? 'stalled' : hoursSince <= 26 ? 'live' : hoursSince <= 24 * 8 ? 'idle' : 'stalled';

  return NextResponse.json({
    totals: {
      ads: row.totalAds,
      brands: row.totalBrands,
      activeAds: row.activeAds,
    },
    ingestion: {
      last7d: row.ads7d,
      last24h: row.ads24h,
      lastAdAt: lastAdAt?.toISOString() ?? null,
      hoursSinceLastAd: hoursSince == null ? null : Math.round(hoursSince),
      status,
      daily, // [{ day, n }]
    },
    refresh: {
      brandsFresh: row.brandsFresh,
      brandsDue: row.brandsDue,
      coveragePct: row.totalBrands ? Math.round((row.brandsFresh / row.totalBrands) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  });
}
