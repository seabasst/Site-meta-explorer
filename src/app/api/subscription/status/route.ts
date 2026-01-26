import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });
  }

  const status = await getSubscriptionStatus(session.user.email);

  return NextResponse.json({ status });
}
