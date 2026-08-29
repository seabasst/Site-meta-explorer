/**
 * Swedish political parties → TikTok Commercial Content API.
 *
 * NOT RUNNABLE YET. TikTok's official ad-transparency API requires a TikTok
 * Developer account with an approved "research client" — register at
 * https://developers.tiktok.com, then apply for Commercial Content API
 * access via https://developers.tiktok.com/doc/commercial-content-api-getting-started.
 * Approval generates a Client key + Client secret; exchange those for a
 * bearer access token (TikTok's client-credentials flow) and set it below.
 *
 * Why an API and not a scraper: TikTok's public web tool (library.tiktok.com/ads,
 * no login required) is a DSA-mandated transparency library like Meta's, but its
 * backend endpoint is protected by anti-bot request signing — a direct fetch
 * against it was rejected outright (HTTP 421). The documented Commercial
 * Content API is the sanctioned path; it just needs the approval step above
 * before this script can run.
 *
 * Contract (per TikTok's docs, mirrors Meta's ads_archive shape closely):
 *   POST https://open.tiktokapis.com/v2/research/adlib/ad/query/
 *   Authorization: Bearer <client access token>
 *   { filters: { ad_published_date_range: { min: YYYYMMDD, max: YYYYMMDD }, country_code },
 *     search_term, max_count, search_id? }
 *   → { data: { has_more, search_id, ads: [...] } }
 *
 * Usage once TIKTOK_ACCESS_TOKEN is set:
 *   TIKTOK_ACCESS_TOKEN=clt.xxx npx tsx scripts/tiktok-party-ads.ts discover
 *   TIKTOK_ACCESS_TOKEN=clt.xxx npx tsx scripts/tiktok-party-ads.ts discover --party M
 *
 * Output: data/swedish-parties-tiktok.json, one row per ad, grouped by the
 * party search term that surfaced it (same discovery approach as
 * swedish-parties.ts — advertiser attribution needs the same manual review
 * once real data exists, since a party name in ad copy doesn't guarantee the
 * advertiser IS that party).
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const PARTIES_FILE = path.join(DATA_DIR, 'swedish-parties.json');
const OUT_FILE = path.join(DATA_DIR, 'swedish-parties-tiktok.json');

const API = 'https://open.tiktokapis.com/v2/research/adlib/ad/query/';
const COUNTRY = 'SE';
const MONTHS_BACK = 12;
const MAX_COUNT = 20; // ads per page, per TikTok's documented example

const token = process.env.TIKTOK_ACCESS_TOKEN;

interface Party { abbr: string; name: string; search: string[] }

interface TikTokAd {
  ad_id?: string;
  advertiser_name?: string;
  first_shown_date?: string;
  last_shown_date?: string;
  status?: string;
  [key: string]: unknown; // full field set isn't documented publicly; capture whatever comes back
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function windowRange(): { min: string; max: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - MONTHS_BACK);
  return { min: ymd(start), max: ymd(end) };
}

function loadParties(): Party[] {
  return JSON.parse(fs.readFileSync(PARTIES_FILE, 'utf-8')).parties;
}

interface StoredAd extends TikTokAd { party: string; searchTerm: string; discoveredAt: string }

function readOutput(): StoredAd[] {
  if (!fs.existsSync(OUT_FILE)) return [];
  return JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')).ads ?? [];
}

function writeOutput(ads: StoredAd[]) {
  const byParty: Record<string, number> = {};
  for (const a of ads) byParty[a.party] = (byParty[a.party] ?? 0) + 1;
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(), country: COUNTRY, adsByParty: byParty, ads,
  }, null, 1));
}

async function queryAds(searchTerm: string, range: { min: string; max: string }, searchId?: string): Promise<{ ads: TikTokAd[]; hasMore: boolean; nextSearchId?: string }> {
  const res = await fetch(`${API}?fields=ad.id,advertiser_name,first_shown_date,last_shown_date,status,reach,spend`, {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      filters: { ad_published_date_range: { min: range.min, max: range.max }, country_code: COUNTRY },
      search_term: searchTerm,
      max_count: MAX_COUNT,
      ...(searchId ? { search_id: searchId } : {}),
    }),
  });
  const body = await res.json();
  if (!res.ok || body.error?.code) {
    throw new Error(`TikTok API error: ${body.error?.message ?? res.statusText} (${body.error?.code ?? res.status})`);
  }
  return { ads: body.data?.ads ?? [], hasMore: !!body.data?.has_more, nextSearchId: body.data?.search_id };
}

async function discover(partyFilter?: string) {
  const parties = loadParties().filter((p) => !partyFilter || p.abbr === partyFilter.toUpperCase());
  const range = windowRange();
  const known = readOutput();
  const seen = new Set(known.map((a) => a.ad_id));

  for (const party of parties) {
    console.log(`\n▸ ${party.name} (${party.abbr})`);
    for (const term of party.search) {
      let searchId: string | undefined;
      let page = 0;
      let found = 0;
      do {
        page++;
        const { ads, hasMore, nextSearchId } = await queryAds(term, range, searchId);
        for (const ad of ads) {
          if (ad.ad_id && seen.has(ad.ad_id)) continue;
          if (ad.ad_id) seen.add(ad.ad_id);
          known.push({ ...ad, party: party.abbr, searchTerm: term, discoveredAt: new Date().toISOString() });
          found++;
        }
        searchId = hasMore ? nextSearchId : undefined;
        if (searchId) await sleep(1000);
      } while (searchId && page < 50);
      console.log(`  "${term}": ${found} new ads`);
      writeOutput(known);
    }
  }
  console.log(`\n✓ ${known.length} TikTok ads total → ${path.relative(process.cwd(), OUT_FILE)}`);
}

async function main() {
  if (!token) {
    console.error('No TIKTOK_ACCESS_TOKEN in env.');
    console.error('This script needs an approved TikTok Commercial Content API client — see the file header for how to apply.');
    console.error('Once approved: TIKTOK_ACCESS_TOKEN=clt.xxx npx tsx scripts/tiktok-party-ads.ts discover');
    process.exit(1);
  }
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (flag: string) => { const i = rest.indexOf(flag); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'discover') await discover(arg('--party'));
  else { console.log('Usage: tiktok-party-ads.ts discover [--party ABBR]'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
