import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ad-library/saved/check
 * Check which ads from a list are saved by the current user.
 * Body: { adIds: string[] }
 * Returns: { savedAdIds: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ savedAdIds: [] });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ savedAdIds: [] });
  }

  const { adIds } = await request.json();
  if (!Array.isArray(adIds) || adIds.length === 0) {
    return NextResponse.json({ savedAdIds: [] });
  }

  const saved = await prisma.savedAd.findMany({
    where: { userId: user.id, adId: { in: adIds } },
    select: { adId: true },
  });

  return NextResponse.json({ savedAdIds: saved.map((s) => s.adId) });
}
