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
