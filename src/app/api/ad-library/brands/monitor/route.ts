import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ad-library/brands/monitor
 * List the current user's monitored brands.
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

  const [monitored, total] = await Promise.all([
    prisma.monitoredBrand.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        brand: {
          select: {
            id: true,
            pageId: true,
            pageName: true,
            profilePicUrl: true,
            category: true,
            country: true,
            activeAdCount: true,
            totalReach: true,
            website: true,
          },
        },
      },
    }),
    prisma.monitoredBrand.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    brands: monitored.map((m) => ({
      ...serializeBrand(m.brand),
      monitoredSince: m.createdAt,
    })),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
}

/**
 * POST /api/ad-library/brands/monitor
 * Monitor a brand. Body: { brandId: string }
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

  const { brandId } = await request.json();
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
  }

  const result = await prisma.monitoredBrand.upsert({
    where: { userId_brandId: { userId: user.id, brandId } },
    create: { userId: user.id, brandId },
    update: {},
  });

  return NextResponse.json({ monitored: true, id: result.id });
}

/**
 * DELETE /api/ad-library/brands/monitor
 * Stop monitoring a brand. Body: { brandId: string }
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

  const { brandId } = await request.json();
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
  }

  await prisma.monitoredBrand.deleteMany({
    where: { userId: user.id, brandId },
  });

  return NextResponse.json({ monitored: false });
}

function serializeBrand(brand: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(brand, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
