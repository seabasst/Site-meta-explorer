// Shared accessor for the app's Facebook system-user token(s). Used by the
// agency "Decode my account" flow to read the ad accounts these tokens manage.
// Supports FACEBOOK_ACCESS_TOKEN1..N, comma-separated FACEBOOK_ACCESS_TOKENS,
// or a single FACEBOOK_ACCESS_TOKEN.
export function getMetaToken(): string | null {
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t && t.trim()) return t.trim();
  }
  const list = process.env.FACEBOOK_ACCESS_TOKENS;
  if (list) { const first = list.split(',').map((t) => t.trim()).filter(Boolean)[0]; if (first) return first; }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  return single && single.trim() ? single.trim() : null;
}

export const META_API = 'https://graph.facebook.com/v22.0';

export async function metaGet<T = unknown>(path: string, token: string): Promise<T> {
  const url = `${META_API}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data?.error) throw new Error(`Meta API: ${data.error.message} (code ${data.error.code})`);
  return data as T;
}
