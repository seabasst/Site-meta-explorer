import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Admin allowlist for sensitive agency features (e.g. "Decode my account",
// which exposes the ad accounts the app's system token manages). Only these
// emails may list/decode connected accounts.
//
// Defaults include the account owner so it works on deploy with no extra config;
// add more via the GENOME_ADMIN_EMAILS env var (comma-separated).
const DEFAULT_ADMINS = ['sebastian@kirimedia.co'];

export function adminEmails(): string[] {
  const env = (process.env.GENOME_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ADMINS.map((e) => e.toLowerCase()), ...env]));
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// Gate for admin-only route handlers. Returns the 401/403 response to send, or
// null when the caller is a signed-in admin.
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  return null;
}
