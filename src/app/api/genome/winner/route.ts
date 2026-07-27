import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/genome/winner?brand=<name|pageId>
//
// Exposes a competitor's PROVEN WINNER: their single longest-running ad.
// Longevity is the only public performance signal Meta can't hide — brands
// kill losers in days and let winners run for months. The longest-running
// creative is, with very high probability, the one that's printing money.
//
// Returns the winning ad + (if present) its decoded genome. Longevity is
// computed live from startDate -> COALESCE(endDate, now()) because
// AdLibraryAd.adDurationDays is not reliably populated.
// =============================================================================

const DURATION_DAYS = `ROUND((EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400)::numeric)::int`;

interface WinnerRow {
  brandName: string;
  pageId: string;
  category: string | null;
  brandAds: number;
  adId: string;
  days: number;
  reach: number | null;
  body: string | null;
  title: string | null;
  ctaText: string | null;
  linkUrl: string | null;
  displayFormat: string | null;
  isActive: boolean;
  image: string | null;
  hookTactic: string | null;
  messagingAngle: string | null;
  creativeMechanic: string | null;
  visualFormat: string | null;
  offerType: string | null;
  awarenessStage: string | null;
  hookScore: number | null;
}

export async function GET(request: NextRequest) {
  const brand = request.nextUrl.searchParams.get('brand')?.trim();
  if (!brand) {
    return NextResponse.json({ error: 'brand query param is required' }, { status: 400 });
  }

  // Match by exact pageId first, else case-insensitive name (supports % wildcards).
  const rows = await prisma.$queryRawUnsafe<WinnerRow[]>(
    `
    SELECT b."pageName" AS "brandName", b."pageId", b.category, a."adId",
      ${DURATION_DAYS} AS days, a."reachEstimate" AS reach,
      a.body, a.title, a."ctaText", a."linkUrl", a."displayFormat", a."isActive",
      (SELECT COALESCE(asset."storedUrl", asset."thumbnailUrl", asset."originalUrl")
         FROM "AdAsset" asset
         WHERE asset."adId" = a.id AND asset."assetType" IN ('image','thumbnail')
         ORDER BY asset.position ASC LIMIT 1) AS image,
      c."hookTactic", c."messagingAngle", c."creativeMechanic", c."visualFormat",
      c."offerType", c."awarenessStage", c."hookScore",
      (SELECT COUNT(*)::int FROM "AdLibraryAd" x WHERE x."brandId" = b.id) AS "brandAds"
    FROM "AdLibraryAd" a
    JOIN "AdLibraryBrand" b ON b.id = a."brandId"
    LEFT JOIN "AdClassification" c ON c."adId" = a.id
    WHERE (b."pageId" = $1 OR b."pageName" ILIKE $2)
      AND a."startDate" IS NOT NULL AND a."reachEstimate" IS NOT NULL
    ORDER BY days DESC, a."reachEstimate" DESC
    LIMIT 1
    `,
    brand,
    brand
  );

  const w = rows[0];
  if (!w) {
    return NextResponse.json({ error: `No ads found for "${brand}"` }, { status: 404 });
  }

  const classified = Boolean(w.hookTactic);
  return NextResponse.json({
    brand: { name: w.brandName, pageId: w.pageId, category: w.category, totalAds: w.brandAds },
    winner: {
      adId: w.adId,
      runDays: w.days,
      isActive: w.isActive,
      reach: w.reach,
      format: w.displayFormat,
      headline: w.title,
      body: w.body,
      cta: w.ctaText,
      landingUrl: w.linkUrl,
      image: w.image,
    },
    // If the winner isn't in the classified subset, the /remix route classifies
    // it on the fly. We surface whichever genome we already have here.
    genome: classified
      ? {
          hookTactic: w.hookTactic,
          messagingAngle: w.messagingAngle,
          creativeMechanic: w.creativeMechanic,
          visualFormat: w.visualFormat,
          offerType: w.offerType,
          awarenessStage: w.awarenessStage,
          hookScore: w.hookScore,
          source: 'precomputed',
        }
      : null,
    signal:
      `This is ${w.brandName}'s longest continuously-running ad (${w.days} days` +
      `${w.isActive ? ', still live' : ''}). Longevity is the strongest public proxy for performance — ` +
      `it is almost certainly one of their best performers.`,
  });
}
