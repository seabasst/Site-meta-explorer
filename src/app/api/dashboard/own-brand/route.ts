import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET — fetch user's own brand
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const brand = await prisma.trackedBrand.findUnique({
    where: { ownerId: session.user.id },
    include: {
      snapshots: {
        orderBy: { snapshotDate: 'desc' },
        take: 1,
      },
    },
  });

  return NextResponse.json({ brand });
}

// PUT — set or update own brand
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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

  const brand = await prisma.trackedBrand.upsert({
    where: { ownerId: session.user.id },
    update: { facebookPageId, pageName, adLibraryUrl },
    create: {
      facebookPageId,
      pageName,
      adLibraryUrl,
      ownerId: session.user.id,
    },
  });

  return NextResponse.json({ brand });
}

// DELETE — remove own brand
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.trackedBrand.deleteMany({
    where: { ownerId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
