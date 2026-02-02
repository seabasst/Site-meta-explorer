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

// DELETE — remove competitor(s) by id (single: ?id=xxx, bulk: ?ids=xxx,yyy,zzz)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  const idParam = searchParams.get('id');

  const idArray: string[] = idsParam
    ? idsParam.split(',').map(s => s.trim()).filter(Boolean)
    : idParam
      ? [idParam]
      : [];

  if (idArray.length === 0) {
    return NextResponse.json({ error: 'Missing id or ids parameter' }, { status: 400 });
  }

  // Only delete if they belong to this user
  const result = await prisma.trackedBrand.deleteMany({
    where: { id: { in: idArray }, trackerId: session.user.id },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
