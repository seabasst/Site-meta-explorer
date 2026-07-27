import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminEmail } from '@/lib/admin';
import { getMetaToken, metaGet } from '@/lib/meta-token';

// =============================================================================
// GET /api/connect/meta/accounts
//
// Lists the Facebook ad accounts the app's system-user token manages, so an
// authenticated user can pick one to decode. Auth-gated — this exposes managed
// client accounts, so it must never be public.
// =============================================================================

export const dynamic = 'force-dynamic';

interface MetaAccount {
  id: string; name: string; account_status: number; currency: string; amount_spent: string; business?: { name?: string };
}

const STATUS: Record<number, string> = { 1: 'active', 2: 'disabled', 3: 'unsettled', 7: 'pending review', 101: 'closed', 100: 'pending' };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to connect an account' }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: 'Your account is not authorized for this feature' }, { status: 403 });

  const token = getMetaToken();
  if (!token) return NextResponse.json({ error: 'No Facebook token configured on the server' }, { status: 503 });

  try {
    const data = await metaGet<{ data: MetaAccount[] }>(
      'me/adaccounts?fields=id,name,account_status,currency,amount_spent,business{name}&limit=100',
      token
    );
    const accounts = (data.data ?? [])
      .map((a) => ({
        id: a.id,
        name: a.name,
        status: STATUS[a.account_status] ?? `status ${a.account_status}`,
        active: a.account_status === 1,
        currency: a.currency,
        lifetimeSpend: Number(a.amount_spent) / 100, // Meta reports minor units
        business: a.business?.name ?? null,
      }))
      // active first, then by lifetime spend
      .sort((x, y) => Number(y.active) - Number(x.active) || y.lifetimeSpend - x.lifetimeSpend);

    return NextResponse.json({ count: accounts.length, accounts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to list accounts' }, { status: 502 });
  }
}
