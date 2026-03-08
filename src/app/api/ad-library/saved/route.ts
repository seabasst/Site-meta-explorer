import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ad-library/saved
 * List the current user's saved ads (paginated).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));
  const skip = (page - 1) * limit;

  const [savedAds, total] = await Promise.all([
    prisma.savedAd.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        ad: {
          include: {
            brand: {
              select: {
                id: true,
                pageId: true,
                pageName: true,
                profilePicUrl: true,
                category: true,
                country: true,
              },
            },
            assets: {
              select: {
                id: true,
                assetType: true,
                storedUrl: true,
                thumbnailUrl: true,
                originalUrl: true,
                downloadStatus: true,
                position: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    }),
    prisma.savedAd.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    ads: savedAds.map((s) => ({
      ...serializeAd(s.ad),
      savedAt: s.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

/**
 * POST /api/ad-library/saved
 * Save an ad. Body: { adId: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { adId } = await request.json();
  if (!adId) {
    return NextResponse.json({ error: 'adId is required' }, { status: 400 });
  }

  const saved = await prisma.savedAd.upsert({
    where: { userId_adId: { userId: user.id, adId } },
    create: { userId: user.id, adId },
    update: {},
  });

  return NextResponse.json({ saved: true, id: saved.id });
}

/**
 * DELETE /api/ad-library/saved
 * Unsave an ad. Body: { adId: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { adId } = await request.json();
  if (!adId) {
    return NextResponse.json({ error: 'adId is required' }, { status: 400 });
  }

  await prisma.savedAd.deleteMany({
    where: { userId: user.id, adId },
  });

  return NextResponse.json({ saved: false });
}

// Handle BigInt serialization
function serializeAd(ad: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(ad, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
