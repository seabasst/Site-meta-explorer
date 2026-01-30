import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET — combined dashboard payload: own brand + competitors + latest snapshots + trends
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch own brand with latest snapshot
  const ownBrand = await prisma.trackedBrand.findUnique({
    where: { ownerId: userId },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
      },
    },
  });

  // Fetch competitors with latest snapshots
  const competitors = await prisma.trackedBrand.findMany({
    where: { trackerId: userId },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch trend data (last 30 snapshots per brand)
  const allBrandIds = [
    ...(ownBrand ? [ownBrand.id] : []),
    ...competitors.map(c => c.id),
  ];

  const trendSnapshots = allBrandIds.length > 0
    ? await prisma.brandSnapshot.findMany({
        where: { trackedBrandId: { in: allBrandIds } },
        orderBy: { snapshotDate: 'asc' },
        take: 300, // up to 30 per brand × 10 brands max
        select: {
          id: true,
          snapshotDate: true,
          trackedBrandId: true,
          totalAdsFound: true,
          activeAdsCount: true,
          totalReach: true,
          estimatedSpendUsd: true,
        },
      })
    : [];

  return NextResponse.json(
    serialize({
      ownBrand,
      competitors,
      trendSnapshots,
    })
  );
}

function serialize(obj: unknown) {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
