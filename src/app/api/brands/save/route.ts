import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSubscriptionStatus } from '@/lib/subscription';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { facebookPageId, pageName, adLibraryUrl, snapshot, hookGroups } = body as {
    facebookPageId: string;
    pageName: string;
    adLibraryUrl: string;
    snapshot?: Record<string, unknown>;
    hookGroups?: Array<{
      hookText: string;
      normalizedText: string;
      frequency: number;
      totalReach: number;
      avgReachPerAd: number;
      adIds: string[];
    }>;
  };

  if (!facebookPageId || !pageName || !adLibraryUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Tier limit: free = 3, pro = 10
  const status = await getSubscriptionStatus(session.user.email);
  const maxBrands = status === 'pro' || status === 'past_due' ? 10 : 3;

  const count = await prisma.trackedBrand.count({
    where: { trackerId: session.user.id },
  });

  if (count >= maxBrands) {
    return NextResponse.json(
      { error: `Brand limit reached (${maxBrands}). ${status !== 'pro' ? 'Upgrade to Pro for up to 10.' : ''}` },
      { status: 403 },
    );
  }

  // Check duplicate
  const existing = await prisma.trackedBrand.findUnique({
    where: {
      trackerId_facebookPageId: {
        trackerId: session.user.id,
        facebookPageId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: 'Brand already saved' }, { status: 409 });
  }

  // Create brand + snapshot in a single transaction
  const brand = await prisma.$transaction(async (tx) => {
    const newBrand = await tx.trackedBrand.create({
      data: {
        facebookPageId,
        pageName,
        adLibraryUrl,
        trackerId: session.user.id,
      },
    });

    if (snapshot) {
      const createdSnapshot = await tx.brandSnapshot.create({
        data: {
          totalAdsFound: snapshot.totalAdsFound as number,
          activeAdsCount: snapshot.activeAdsCount as number,
          totalReach: BigInt(snapshot.totalReach as number),
          avgReachPerAd: snapshot.avgReachPerAd as number,
          estimatedSpendUsd: snapshot.estimatedSpendUsd as number,
          videoCount: snapshot.videoCount as number,
          imageCount: snapshot.imageCount as number,
          videoPercentage: snapshot.videoPercentage as number,
          imagePercentage: snapshot.imagePercentage as number,
          avgAdAgeDays: snapshot.avgAdAgeDays as number,
          dominantGender: snapshot.dominantGender as string | null,
          dominantGenderPct: snapshot.dominantGenderPct as number | null,
          dominantAgeRange: snapshot.dominantAgeRange as string | null,
          dominantAgePct: snapshot.dominantAgePct as number | null,
          topCountry1Code: snapshot.topCountry1Code as string | null,
          topCountry1Pct: snapshot.topCountry1Pct as number | null,
          topCountry2Code: snapshot.topCountry2Code as string | null,
          topCountry2Pct: snapshot.topCountry2Pct as number | null,
          topCountry3Code: snapshot.topCountry3Code as string | null,
          topCountry3Pct: snapshot.topCountry3Pct as number | null,
          demographicsJson: (snapshot.demographicsJson as object) ?? Prisma.JsonNull,
          spendByCountryJson: (snapshot.spendByCountryJson as object) ?? Prisma.JsonNull,
          trackedBrandId: newBrand.id,
          userId: session.user!.id!,
        },
      });

      if (hookGroups && hookGroups.length > 0) {
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
    }

    return newBrand;
  });

  return NextResponse.json({ brand });
}
