import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ad-library/brands/monitor/check
 * Check which brands from a list are monitored by the current user.
 * Body: { brandIds: string[] }
 * Returns: { monitoredBrandIds: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ monitoredBrandIds: [] });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ monitoredBrandIds: [] });
  }

  const { brandIds } = await request.json();
  if (!Array.isArray(brandIds) || brandIds.length === 0) {
    return NextResponse.json({ monitoredBrandIds: [] });
  }

  const monitored = await prisma.monitoredBrand.findMany({
    where: { userId: user.id, brandId: { in: brandIds } },
    select: { brandId: true },
  });

  return NextResponse.json({ monitoredBrandIds: monitored.map((m) => m.brandId) });
}
