// Shared brand-discovery search against Meta's Ad Library (ads_archive).
// Used by the daily discovery cron to find new advertisers to track.
import { META_API } from './meta-token';

export const DISCOVERY_COUNTRIES = ['SE', 'DE', 'FR', 'GB', 'NL', 'IT', 'ES', 'PL', 'DK', 'NO', 'FI', 'BE', 'AT', 'IE', 'PT'];

export interface Advertiser { pageId: string; pageName: string; maxReach: number; ads: number }

interface MetaAd { page_id?: string; page_name?: string; eu_total_reach?: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Search one term, paginating a few pages, and collect distinct advertisers.
export async function searchAdvertisers(
  term: string,
  token: string,
  maxPages = 3,
  countries: string[] = DISCOVERY_COUNTRIES
): Promise<Map<string, Advertiser>> {
  const found = new Map<string, Advertiser>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      access_token: token,
      search_terms: term,
      ad_reached_countries: JSON.stringify(countries),
      ad_type: 'ALL',
      ad_active_status: 'ACTIVE',
      fields: 'page_id,page_name,eu_total_reach',
      limit: '100',
    });
    if (cursor) params.set('after', cursor);

    const res = await fetch(`${META_API}/ads_archive?${params}`);
    const data = await res.json();
    if (data?.error) break; // rate-limit / transient — stop this term, cron retries next run
    for (const ad of (data.data ?? []) as MetaAd[]) {
      if (!ad.page_id || !ad.page_name) continue;
      const prev = found.get(ad.page_id);
      const reach = ad.eu_total_reach ?? 0;
      if (prev) { prev.ads++; prev.maxReach = Math.max(prev.maxReach, reach); }
      else found.set(ad.page_id, { pageId: ad.page_id, pageName: ad.page_name, maxReach: reach, ads: 1 });
    }
    cursor = data.paging?.cursors?.after;
    if (!cursor) break;
    await sleep(1000);
  }
  return found;
}

// reach → priority bucket (higher = the ingest cron processes it sooner)
export function priorityForReach(reach: number): number {
  return reach > 5e6 ? 50 : reach > 1e6 ? 40 : reach > 1e5 ? 30 : reach > 1e4 ? 20 : 10;
}
