import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeDemographicsJson } from '@/lib/demographics-normalizer';
import { getCPM } from '@/lib/spend-estimator';

// =============================================================================
// GET /api/genome/brand/[pageId]
//
// The quick report behind a search hit: live ads, EU reach, reach by country,
// gender and age, the three live ads with the most reach, and the inputs for the
// spend estimate. Our database only.
//
// "Live" = active at the brand's last check. isActive never flips back for ads
// that stop between runs, so the ad must also have been touched by that run.
//
// Spend is estimated for the 30 days up to that check, in EUR. Meta only gives
// cumulative reach per ad and our delivery log has one point for almost every ad,
// so reach inside the window is estimated: each ad's reach is spread evenly over
// the days it ran (start to last sighting) and the share inside the window counts.
// Ads that stopped during the window are included up to their last sighting.
// =============================================================================

export const dynamic = 'force-dynamic';

// Stored demographics can be inflated by delivery-country count (fix in PR #18,
// rows refresh over time). The shares are still proportional, so rescale to 100.
function toShares<T extends { percentage: number }>(rows: T[]): T[] {
  const sum = rows.reduce((a, r) => a + r.percentage, 0);
  return sum > 0 ? rows.map((r) => ({ ...r, percentage: (r.percentage / sum) * 100 })) : [];
}

// ECB euro reference rate; the CPM benchmark table is in USD.
async function usdPerEur(): Promise<{ rate: number; date: string } | null> {
  try {
    const xml = await (await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { next: { revalidate: 86400 } })).text();
    const rate = Number(xml.match(/currency='USD' rate='([\d.]+)'/)?.[1]);
    const date = xml.match(/time='(\d{4}-\d{2}-\d{2})'/)?.[1];
    return rate > 0 && date ? { rate, date } : null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;

  const brand = await prisma.adLibraryBrand.findUnique({
    where: { pageId },
    select: { id: true, pageId: true, pageName: true, category: true, country: true, website: true, demographicsJson: true },
  });
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

  const LIVE = `a."brandId" = $1 AND a."isActive"
    AND a."updatedAt" >= COALESCE((SELECT "lastCheckedAt" FROM "AdLibraryBrand" WHERE id = $1) - interval '1 day', '-infinity')`;

  const [totals, window30, topAds, dates, fx] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ liveAds: number; reach: bigint }>>(
      `SELECT count(*)::int AS "liveAds", COALESCE(sum(a."reachEstimate"), 0)::bigint AS reach
       FROM "AdLibraryAd" a WHERE ${LIVE}`,
      brand.id
    ),
    prisma.$queryRawUnsafe<Array<{ reach: bigint; ads: number }>>(
      `WITH b AS (SELECT COALESCE("lastCheckedAt", now()::timestamp) AS ref, "lastCheckedAt" AS checked FROM "AdLibraryBrand" WHERE id = $1),
       ads AS (
         SELECT a."reachEstimate" AS reach, COALESCE(a."startDate", a."createdAt") AS start,
           CASE WHEN NOT a."isActive" THEN COALESCE(a."endDate", a."updatedAt")
                WHEN a."updatedAt" >= b.checked - interval '1 day' THEN b.ref
                ELSE a."updatedAt" END AS seen,
           b.ref - interval '30 days' AS win
         FROM "AdLibraryAd" a, b WHERE a."brandId" = $1 AND a."reachEstimate" > 0
       )
       SELECT COALESCE(sum(reach * LEAST(1, GREATEST(0,
                EXTRACT(EPOCH FROM (seen - GREATEST(start, win))) / GREATEST(EXTRACT(EPOCH FROM (seen - start)), 86400)))), 0)::bigint AS reach,
              count(*)::int AS ads
       FROM ads WHERE seen > win`,
      brand.id
    ),
    prisma.$queryRawUnsafe<Array<{
      adId: string; reach: number | null; title: string | null; body: string | null;
      format: string | null; startDate: string | null; image: string | null; video: string | null;
    }>>(
      `SELECT a."adId", a."reachEstimate" AS reach, a.title, a.body, a."displayFormat" AS format,
         to_char(a."startDate", 'YYYY-MM-DD') AS "startDate",
         (SELECT COALESCE(s."thumbnailUrl", CASE WHEN s."assetType" <> 'video' THEN s."storedUrl" END)
          FROM "AdAsset" s
          WHERE s."adId" = a.id AND COALESCE(s."thumbnailUrl", CASE WHEN s."assetType" <> 'video' THEN s."storedUrl" END) IS NOT NULL
          ORDER BY s.position LIMIT 1) AS image,
         (SELECT s."storedUrl" FROM "AdAsset" s
          WHERE s."adId" = a.id AND s."assetType" = 'video' AND s."storedUrl" IS NOT NULL
          ORDER BY s.position LIMIT 1) AS video
       FROM "AdLibraryAd" a WHERE ${LIVE}
       ORDER BY a."reachEstimate" DESC NULLS LAST LIMIT 3`,
      brand.id
    ),
    prisma.$queryRawUnsafe<Array<{ checkedAt: string | null; demographicsAt: string | null }>>(
      `SELECT to_char("lastCheckedAt", 'YYYY-MM-DD') AS "checkedAt", to_char("demographicsUpdatedAt", 'YYYY-MM-DD') AS "demographicsAt"
       FROM "AdLibraryBrand" WHERE id = $1`,
      brand.id
    ),
    usdPerEur(),
  ]);

  const reach = Number(totals[0].reach);
  const demo = normalizeDemographicsJson(brand.demographicsJson);
  const countries = toShares(demo?.regionBreakdown ?? []).map((r) => ({
    code: r.region.toUpperCase(),
    share: r.percentage,
    reach: Math.round((r.percentage / 100) * reach),
  }));
  const sampleAds = (brand.demographicsJson as { adsWithDemographics?: number } | null)?.adsWithDemographics ?? 0;

  // Reach-weighted country CPM as the calculator's starting point; the user edits it.
  const cpmUsd = countries.length
    ? countries.reduce((a, c) => a + (c.share / 100) * getCPM(c.code), 0)
    : getCPM(brand.country ?? '');

  return NextResponse.json({
    brand: { pageId: brand.pageId, name: brand.pageName, category: brand.category, country: brand.country, website: brand.website },
    checkedAt: dates[0]?.checkedAt ?? null,
    liveAds: totals[0].liveAds,
    reach,
    countries,
    genders: toShares(demo?.genderBreakdown ?? []).map((g) => ({ gender: g.gender, share: g.percentage })),
    ages: toShares(demo?.ageBreakdown ?? []).map((g) => ({ age: g.age, share: g.percentage })),
    demographics: { sampleAds, updatedAt: dates[0]?.demographicsAt ?? null },
    topAds,
    spend: {
      reach30: Number(window30[0].reach),
      ads30: window30[0].ads,
      // Without a rate the USD figure is used as-is; the page says so.
      defaultCpmEur: Math.round((fx ? cpmUsd / fx.rate : cpmUsd) * 100) / 100,
      fx,
    },
  });
}
