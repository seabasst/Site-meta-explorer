import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { fetchFacebookAds } from '@/lib/facebook-api';
import { buildSnapshotFromApiResult } from '@/lib/snapshot-builder';

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

  const result = await fetchFacebookAds({
    accessToken,
    pageId: brand.facebookPageId,
    limit: 500,
    activeStatus: 'ACTIVE',
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const snapshotData = buildSnapshotFromApiResult(result);

  const snapshot = await prisma.brandSnapshot.create({
    data: {
      totalAdsFound: snapshotData.totalAdsFound,
      activeAdsCount: snapshotData.activeAdsCount,
      totalReach: snapshotData.totalReach,
      avgReachPerAd: snapshotData.avgReachPerAd,
      estimatedSpendUsd: snapshotData.estimatedSpendUsd,
      videoCount: snapshotData.videoCount,
      imageCount: snapshotData.imageCount,
      videoPercentage: snapshotData.videoPercentage,
      imagePercentage: snapshotData.imagePercentage,
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
