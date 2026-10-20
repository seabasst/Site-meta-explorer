import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JUNK_BRAND_SQL } from '@/lib/junk-brands';

// =============================================================================
// GET /api/genome/trends
//
// Everything below the search box on the Genome front page, from our own
// database only. Windows are anchored on the newest ad we ingested, not NOW():
// when ingestion pauses, the page shows the last real day/week with its date
// instead of empty lists.
//
// A "launch" is an ad we first saw (createdAt) inside the window whose startDate
// is also inside it, so a brand ingested for the first time doesn't count its
// whole back catalogue as launches.
//
// Scam-shop and app networks are filtered out of every list (see junk-brands.ts).
//
// All date maths stays in SQL: these columns are timestamp WITHOUT time zone and
// node-pg would shift them to local time if they round-tripped through JS.
// =============================================================================

export const dynamic = 'force-dynamic';

const ANCHOR = `(SELECT max("createdAt") FROM "AdLibraryAd")`;

type LaunchRow = {
  pageId: string; pageName: string; category: string | null; liveAds: number;
  week: number; day: number; lastLaunch: string; firstAd: string | null; isNew: boolean;
};

export async function GET() {
  const [meta, launches, mostActive, categories] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ anchor: string | null; brands: number }>>(
      `SELECT to_char(${ANCHOR}, 'YYYY-MM-DD') AS anchor, (SELECT count(*) FROM "AdLibraryBrand")::int AS brands`
    ),
    prisma.$queryRawUnsafe<LaunchRow[]>(
      `WITH a AS (SELECT ${ANCHOR} AS t),
      w AS (
        SELECT x."brandId", count(*)::int AS week,
          (count(*) FILTER (WHERE x."createdAt" > a.t - interval '1 day' AND x."startDate" > a.t - interval '2 days'))::int AS day,
          to_char(max(x."startDate"), 'YYYY-MM-DD') AS "lastLaunch"
        FROM "AdLibraryAd" x, a
        WHERE x."createdAt" > a.t - interval '7 days' AND x."startDate" > a.t - interval '8 days'
        GROUP BY 1
      ),
      -- Junk is dropped here, not in w: filtering the ad scan makes the planner seq-scan 2.4M rows.
      ok AS (SELECT w.* FROM w JOIN "AdLibraryBrand" jb ON jb.id = w."brandId" WHERE NOT ${JUNK_BRAND_SQL}),
      top AS ((SELECT * FROM ok ORDER BY week DESC LIMIT 200) UNION (SELECT * FROM ok ORDER BY day DESC LIMIT 1))
      SELECT b."pageId", b."pageName", b.category, b."activeAdCount" AS "liveAds",
        top.week, top.day, top."lastLaunch",
        to_char(f.first, 'YYYY-MM-DD') AS "firstAd",
        COALESCE(f.first > a.t - interval '30 days', false) AS "isNew"
      FROM top
      JOIN "AdLibraryBrand" b ON b.id = top."brandId"
      CROSS JOIN LATERAL (SELECT min(y."startDate") AS first FROM "AdLibraryAd" y WHERE y."brandId" = top."brandId") f, a
      ORDER BY top.week DESC`
    ),
    prisma.$queryRawUnsafe<Array<{ pageId: string; pageName: string; category: string | null; liveAds: number }>>(
      `SELECT "pageId", "pageName", category, "activeAdCount" AS "liveAds"
       FROM "AdLibraryBrand" WHERE "lastCheckedAt" > ${ANCHOR} - interval '30 days' AND NOT ${JUNK_BRAND_SQL}
       ORDER BY "activeAdCount" DESC LIMIT 10`
    ),
    // category = the discovery term that brought the account in; 'auto-sweep' and
    // the 'party-*' political tags aren't industries, and one-brand categories
    // say more about that brand than about a sector.
    prisma.$queryRawUnsafe<Array<{ category: string; brands: number; liveAds: number }>>(
      `SELECT category, count(*)::int AS brands, sum("activeAdCount")::int AS "liveAds"
       FROM "AdLibraryBrand"
       WHERE category IS NOT NULL AND category <> 'auto-sweep' AND category NOT LIKE 'party-%'
         AND "lastCheckedAt" > ${ANCHOR} - interval '30 days' AND NOT ${JUNK_BRAND_SQL}
       GROUP BY 1 HAVING count(*) >= 3 ORDER BY 3 DESC LIMIT 10`
    ),
  ]);

  const rocketDay = [...launches].sort((a, b) => b.day - a.day)[0];

  return NextResponse.json(
    {
      anchor: meta[0]?.anchor ?? null,
      brands: meta[0]?.brands ?? 0,
      rocketDay: rocketDay?.day ? rocketDay : null,
      rocketWeek: launches[0] ?? null,
      launches: launches.slice(1, 11),
      newAccounts: launches.filter((l) => l.isNew).slice(0, 8),
      mostActive,
      categories,
    },
    // Front-page data moves at ingest speed; let the CDN absorb the traffic.
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
