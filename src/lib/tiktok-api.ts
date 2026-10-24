// TikTok Commercial Content API (EU ad library).
// Docs: developers.tiktok.com/doc/commercial-content-api-getting-started
//
// TikTok business and ad ids live in the same unique columns as Meta's
// (AdLibraryBrand.pageId, AdLibraryAd.adId). Both are numeric, so TikTok's carry a
// prefix: the columns stay unique without a compound key, and the 88 files that
// look brands up by pageId keep working unchanged.
import { fetchWithRetry } from './retry';

export const TIKTOK_ID_PREFIX = 'tiktok-';

export const toTikTokId = (id: string | number) => `${TIKTOK_ID_PREFIX}${id}`;

export const isTikTokId = (id: string) => id.startsWith(TIKTOK_ID_PREFIX);

const API = 'https://open.tiktokapis.com/v2';

// TikTok's docs contradict their own examples on several names (videos vs ad_videos,
// paid_for_by in the request vs paid_by in the response, country_code vs
// country_code_list). The types below follow the response examples; check them
// against the first live response before trusting them.
const QUERY_FIELDS = [
  'ad.id', 'ad.first_shown_date', 'ad.last_shown_date', 'ad.status', 'ad.videos',
  'ad.image_urls', 'ad.reach', 'advertiser.business_id', 'advertiser.business_name',
  'advertiser.paid_for_by',
].join(',');

const DETAIL_FIELDS = [
  QUERY_FIELDS, 'ad.title', 'ad.external_url', 'ad.call_to_action', 'ad.advertising_objective',
  'advertiser.country_code', 'advertiser.follower_count', 'advertiser.avatar_url',
  'advertiser.profile_url', 'ad_group.targeting_info',
].join(',');

export interface TikTokAdvertiser {
  business_id: string;
  business_name: string;
  country_code?: string;
  paid_by?: string;
  tiktok_account?: { avatar_url?: string; follower_count?: number; profile_url?: string };
}

export interface TikTokAd {
  id: string;
  first_shown_date: string | number; // yyyymmdd
  last_shown_date: string | number;
  status?: string;
  videos?: { url: string }[];
  image_urls?: string[];
  reach?: { unique_users_seen?: string; unique_users_seen_breakdowns?: unknown }; // rounded, e.g. "30K"
  title?: string;
  external_url?: string;
  call_to_action?: string;
  advertising_objective?: string;
}

export interface TikTokAdItem {
  ad: TikTokAd;
  advertiser: TikTokAdvertiser;
}

export interface TikTokAdDetail extends TikTokAdItem {
  ad_group?: { targeting_info?: Record<string, unknown> };
}

export class TikTokApiError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

// TikTok ids are i64 and pass Number.MAX_SAFE_INTEGER, so JSON would silently round
// them. Node 22's JSON source-text access reads and writes them as raw digits.
// Returns null for a non-JSON body (a gateway's HTML 502), which then surfaces as a
// retryable HTTP error instead of a SyntaxError.
function parseKeepingIds(text: string) {
  try {
    return JSON.parse(text, ((key: string, value: unknown, ctx: { source: string }) =>
      typeof value === 'number' && /id$/.test(key) ? ctx.source : value) as never);
  } catch {
    return null;
  }
}
const i64 = (id: string) => (JSON as unknown as { rawJSON(text: string): unknown }).rawJSON(id);

let token: { value: string; expiresAt: number } | null = null;

// Client credentials: no user login, valid 2 hours.
async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set');

  const res = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  const json = await res.json().catch(() => ({}));
  // Plain Error, not TikTokApiError: bad credentials must not be retried.
  if (!res.ok || !json.access_token) throw new Error(`TikTok token: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 300) * 1000 };
  return token.value;
}

async function post<T>(path: string, fields: string, body: object): Promise<T> {
  return fetchWithRetry(async () => {
    const res = await fetch(`${API}${path}?fields=${fields}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = parseKeepingIds(await res.text());
    const code: string = json?.error?.code ?? 'unknown';
    if (res.status === 401) token = null; // the retry mints a fresh one
    if (!res.ok || code !== 'ok') throw new TikTokApiError(json?.error?.message || `HTTP ${res.status}`, res.status, code);
    return json.data as T;
  }, {
    // ponytail: TikTok publishes no quota for these endpoints. 2+4+8+16+32s covers a
    // one-minute window; tune once phase 77 has measured the real limit.
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    shouldRetry: (e) => e instanceof TikTokApiError && (e.status === 429 || e.status === 401 || e.status >= 500),
  });
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function searchAdvertisers(term: string): Promise<TikTokAdvertiser[]> {
  const data = await post<{ advertisers?: TikTokAdvertiser[] }>(
    '/research/adlib/advertiser/query/',
    'business_id,business_name,country_code',
    { search_term: term.slice(0, 50), max_count: 50 },
  );
  return data.advertisers ?? [];
}

// Every ad first published in the last year (TikTok's retention window), 10 per call.
// Pass advertiserIds, or searchTerm (exact phrase), not both: TikTok ignores the
// advertiser filter when a search term is present.
export async function fetchAllAds(
  filter: { advertiserIds: string[] } | { searchTerm: string },
): Promise<TikTokAdItem[]> {
  const now = new Date();
  const filters = {
    ad_published_date_range: { min: yyyymmdd(new Date(now.getTime() - 364 * 86400e3)), max: yyyymmdd(now) },
    // Not in TikTok's current reference, only in older docs. If the first live call
    // rejects it, fall back to searchTerm and keep the ads whose business_id matches.
    ...('advertiserIds' in filter && { advertiser_business_ids: filter.advertiserIds.map(i64) }),
  };

  const ads: TikTokAdItem[] = [];
  let searchId: string | undefined;
  do {
    const page = await post<{ ads?: TikTokAdItem[]; has_more?: boolean | string; search_id?: string }>(
      '/research/adlib/ad/query/',
      QUERY_FIELDS,
      { filters, ...('searchTerm' in filter && { search_term: filter.searchTerm }), max_count: 10, search_id: searchId },
    );
    ads.push(...(page.ads ?? []));
    // has_more is documented as bool but shown as "true" in the examples.
    const more = page.has_more === true || page.has_more === 'true';
    searchId = more && page.ads?.length ? page.search_id : undefined;
  } while (searchId);
  return ads;
}

// Targeting, landing URL, CTA and objective are only on the detail endpoint: one call per ad.
export async function fetchAdDetail(adId: string): Promise<TikTokAdDetail> {
  return post<TikTokAdDetail>('/research/adlib/ad/detail/', DETAIL_FIELDS, { ad_id: i64(adId) });
}
