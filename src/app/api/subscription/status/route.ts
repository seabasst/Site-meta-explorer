import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getTierFromStatus, TIERS } from '@/lib/tiers';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    // Unauthenticated users get free tier info
    return NextResponse.json({
      status: 'unauthenticated',
      tier: 'free',
      maxAds: TIERS.free.maxAds,
      availableDepths: TIERS.free.availableDepths,
    });
  }

  const status = await getSubscriptionStatus(session.user.email);
  const tier = getTierFromStatus(status);
  const config = TIERS[tier];

  return NextResponse.json({
    status,
    tier,
    maxAds: config.maxAds,
    availableDepths: config.availableDepths,
  });
}
