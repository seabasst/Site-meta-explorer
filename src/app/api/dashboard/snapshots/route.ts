import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { fetchFacebookAds } from '@/lib/facebook-api';
import { buildSnapshotFromApiResult } from '@/lib/snapshot-builder';
import { extractHooksFromAds } from '@/lib/hook-extractor';

// POST — create a snapshot for a tracked brand
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { trackedBrandId } = body as { trackedBrandId: string };

  if (!trackedBrandId) {
    return NextResponse.json({ error: 'Missing trackedBrandId' }, { status: 400 });
  }

  // Verify the brand belongs to this user (own brand or competitor)
  const brand = await prisma.trackedBrand.findFirst({
    where: {
      id: trackedBrandId,
      OR: [
        { ownerId: session.user.id },
        { trackerId: session.user.id },
      ],
    },
  });

  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  // Fetch from Facebook API
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'Facebook API not configured' }, { status: 500 });
  }

  // Key EU markets to query - ensures we find ads targeting any EU country
  const euCountries = ['DE', 'FR', 'NL', 'SE', 'FI', 'DK', 'ES', 'IT', 'PL', 'BE'];

  const result = await fetchFacebookAds({
    accessToken,
    pageId: brand.facebookPageId,
    countries: euCountries,
    limit: 500,
    activeStatus: 'ACTIVE',
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const snapshotData = buildSnapshotFromApiResult(result);

  // Extract hooks from raw ad bodies (parallel data path)
  const hookGroups = extractHooksFromAds(result.rawAdBodies);

  // Create snapshot and hook groups in a single transaction
  const snapshot = await prisma.$transaction(async (tx) => {
    const createdSnapshot = await tx.brandSnapshot.create({
      data: {
        totalAdsFound: snapshotData.totalAdsFound,
        activeAdsCount: snapshotData.activeAdsCount,
        totalReach: snapshotData.totalReach,
        avgReachPerAd: snapshotData.avgReachPerAd,
        estimatedSpendUsd: snapshotData.estimatedSpendUsd,
        videoCount: snapshotData.videoCount,
        imageCount: snapshotData.imageCount,
        carouselCount: snapshotData.carouselCount,
        videoPercentage: snapshotData.videoPercentage,
        imagePercentage: snapshotData.imagePercentage,
        carouselPercentage: snapshotData.carouselPercentage,
        avgAdAgeDays: snapshotData.avgAdAgeDays,
        dominantGender: snapshotData.dominantGender,
        dominantGenderPct: snapshotData.dominantGenderPct,
        dominantAgeRange: snapshotData.dominantAgeRange,
        dominantAgePct: snapshotData.dominantAgePct,
        topCountry1Code: snapshotData.topCountry1Code,
        topCountry1Pct: snapshotData.topCountry1Pct,
        topCountry2Code: snapshotData.topCountry2Code,
        topCountry2Pct: snapshotData.topCountry2Pct,
        topCountry3Code: snapshotData.topCountry3Code,
        topCountry3Pct: snapshotData.topCountry3Pct,
        demographicsJson: snapshotData.demographicsJson ?? Prisma.JsonNull,
        spendByCountryJson: snapshotData.spendByCountryJson ?? Prisma.JsonNull,
        trackedBrandId: brand.id,
        userId: session.user.id,
      },
    });

    if (hookGroups.length > 0) {
      await tx.hookGroup.createMany({
        data: hookGroups.map(g => ({
          hookText: g.hookText,
          normalizedText: g.normalizedText,
          frequency: g.frequency,
          totalReach: BigInt(g.totalReach),
          avgReachPerAd: g.avgReachPerAd,
          adIds: g.adIds,
          snapshotId: createdSnapshot.id,
        })),
      });
    }

    return createdSnapshot;
  });

  return NextResponse.json({ snapshot: serializeSnapshot(snapshot) });
}

// GET — fetch historical snapshots for a tracked brand
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trackedBrandId = searchParams.get('trackedBrandId');
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  if (!trackedBrandId) {
    return NextResponse.json({ error: 'Missing trackedBrandId' }, { status: 400 });
  }

  // Verify ownership
  const brand = await prisma.trackedBrand.findFirst({
    where: {
      id: trackedBrandId,
      OR: [
        { ownerId: session.user.id },
        { trackerId: session.user.id },
      ],
    },
  });

  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  const snapshots = await prisma.brandSnapshot.findMany({
    where: { trackedBrandId },
    orderBy: { snapshotDate: 'desc' },
    take: limit,
  });

  return NextResponse.json({ snapshots: snapshots.map(serializeSnapshot) });
}

// BigInt is not JSON-serializable by default
function serializeSnapshot(snapshot: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(snapshot, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
