import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSubscriptionStatus } from '@/lib/subscription';

// GET — list tracked competitors
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const competitors = await prisma.trackedBrand.findMany({
    where: { trackerId: session.user.id },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ competitors });
}

// POST — add a competitor
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { facebookPageId, pageName, adLibraryUrl } = body as {
    facebookPageId: string;
    pageName: string;
    adLibraryUrl: string;
  };

  if (!facebookPageId || !pageName || !adLibraryUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Tier limit: free = 3, pro = 10
  const status = await getSubscriptionStatus(session.user.email);
  const maxCompetitors = status === 'pro' ? 10 : 3;

  const count = await prisma.trackedBrand.count({
    where: { trackerId: session.user.id },
  });

  if (count >= maxCompetitors) {
    return NextResponse.json(
      { error: `Competitor limit reached (${maxCompetitors}). ${status !== 'pro' ? 'Upgrade to Pro for up to 10.' : ''}` },
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
    return NextResponse.json({ error: 'Already tracking this brand' }, { status: 409 });
  }

  const competitor = await prisma.trackedBrand.create({
    data: {
      facebookPageId,
      pageName,
      adLibraryUrl,
      trackerId: session.user.id,
    },
  });

  return NextResponse.json({ competitor });
}

// DELETE — remove a competitor by id (passed as query param)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  // Only delete if it belongs to this user
  await prisma.trackedBrand.deleteMany({
    where: { id, trackerId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
