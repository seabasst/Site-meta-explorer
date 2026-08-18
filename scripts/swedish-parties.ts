/**
 * Swedish political parties → Meta Ad Library
 *
 * Two resumable phases + a report. Political/issue ads in the EU are NOT
 * queryable via ad_type=POLITICAL_AND_ISSUE_ADS (Meta returns "Political ad
 * searches for countries in the European Union aren't available"), so this uses
 * ad_type=ALL. EU DSA still exposes spend + impressions ranges, currency and
 * bylines ("paid for by") on declared political ads, which the commercial
 * pipeline never gets — that is the point of a separate script.
 *
 * It also differs from the standard ingest engine in two ways it needs to:
 *   ad_active_status=ALL     (a 12-month retrospective is mostly stopped ads)
 *   ad_delivery_date_min     (12-month window, SE only)
 *
 * Usage (tokens must be in the env BEFORE import → use --env-file):
 *   npx tsx --env-file=.env.local scripts/swedish-parties.ts discover
 *   npx tsx --env-file=.env.local scripts/swedish-parties.ts discover --party M
 *   npx tsx --env-file=.env.local scripts/swedish-parties.ts ingest
 *   npx tsx --env-file=.env.local scripts/swedish-parties.ts ingest --party S --force
 *   npx tsx --env-file=.env.local scripts/swedish-parties.ts report
 *
 * Both phases are idempotent — re-run to refresh or to resume after a stop.
 * Brands are stored with category `party-<ABBR>` and ingestionStatus `paused`
 * so the weekly commercial worker (selectDueBrands) leaves them alone.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { TokenManager } from '../src/lib/ingestion/ingest-core';

const API = 'https://graph.facebook.com/v22.0/ads_archive';
const COUNTRY = 'SE';
const MONTHS_BACK = 12;
const DATA_DIR = path.join(__dirname, '../data');
const PARTIES_FILE = path.join(DATA_DIR, 'swedish-parties.json');
const PAGES_FILE = path.join(DATA_DIR, 'swedish-party-pages.json');
const REPORT_FILE = path.join(DATA_DIR, 'swedish-party-ads-report.json');

const RATE_LIMIT_CODES = [4, 17, 32, 613, 80004];
// These tokens are shared with the always-on Fly ingest worker, so the app-level
// quota (x-app-usage total_time) is usually already warm. Cooldowns escalate per
// consecutive 613 instead of hammering a fixed interval.
const RATE_LIMIT_WAIT_MS = [10, 20, 30, 45, 60].map((m) => m * 60 * 1000);
const PACE_MS = 3000;                      // between successful requests
const MAX_ATTEMPTS = 6;
const DISCOVER_PAGE_CAP = 40;              // ×250 rows per search term
const REINGEST_AFTER_HOURS = 12;           // skip pages ingested more recently
// A page whose NAME isn't a party org (politicians, party leaders, campaign
// pages) is kept when it runs at least this many declared political/issue ads
// that surfaced under a party's search term. Below it, the page stays a
// 'candidate' in the pages file and is never ingested.
const MIN_AFFILIATE_ADS = 2;

const tm = new TokenManager();

interface Party {
  abbr: string;
  name: string;
  riksdag: boolean;
  search: string[];
  match: string;
  youthMatch: string | null;
  national: string[];
}

// national/youth/branch: the page NAME is a party org.
// affiliate:  page name is not, but a "paid for by" byline names a party org, so
//             the party is funding it (politicians, abbreviation-named branches).
// unverified: runs declared political ads that name a party, but no byline ties it
//             to one. Mixed bucket: self-paying politicians AND non-party
//             advertisers whose copy happens to name a party. Ingested, flagged.
// candidate:  too few declared political ads to judge. Never ingested.
type Level = 'national' | 'youth' | 'branch' | 'affiliate' | 'unverified' | 'candidate';

interface DiscoveredPage {
  pageId: string;
  pageName: string;
  party: string;                          // best-guess abbr
  level: Level;
  orgLevel: 'national' | 'youth' | 'branch' | null; // set when the page NAME is a party org
  payerParty: string | null;              // party whose org name appears in a byline
  adsSeenInSearch: number;
  declaredPoliticalAds: number;           // ads carrying an EU DSA spend range
  partyMentions: Record<string, number>;  // party term → ads by this page that surfaced under it
  bylinesSeen: string[];                  // "paid for by" values, the real payer signal
  discoveredAt: string;
}

interface MetaAd {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
  languages?: string[];
  currency?: string;
  spend?: { lower_bound?: string | number; upper_bound?: string | number };
  impressions?: { lower_bound?: string | number; upper_bound?: string | number };
  estimated_audience_size?: { lower_bound?: number; upper_bound?: number };
  eu_total_reach?: number;
  bylines?: string;
  delivery_by_region?: Array<{ region: string; percentage: string | number }>;
  target_ages?: string[] | string;
  target_gender?: string;
  target_locations?: Array<{ name: string; type: string }>;
}

const AD_FIELDS = [
  'id', 'page_id', 'page_name', 'ad_creation_time',
  'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_creative_bodies', 'ad_creative_link_titles', 'ad_creative_link_captions',
  'ad_creative_link_descriptions', 'ad_snapshot_url', 'publisher_platforms',
  'languages', 'currency', 'spend', 'impressions', 'estimated_audience_size',
  'eu_total_reach', 'bylines', 'delivery_by_region',
  'target_ages', 'target_gender', 'target_locations',
].join(',');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function windowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - MONTHS_BACK);
  return d.toISOString().slice(0, 10);
}

function num(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadParties(): Party[] {
  const raw = JSON.parse(fs.readFileSync(PARTIES_FILE, 'utf-8'));
  return raw.parties as Party[];
}

function loadExcludePattern(): string {
  const raw = JSON.parse(fs.readFileSync(PARTIES_FILE, 'utf-8'));
  return (raw.excludePageNames as string[]).join('|');
}

function readPages(): DiscoveredPage[] {
  if (!fs.existsSync(PAGES_FILE)) return [];
  return JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8')).pages ?? [];
}

function writePages(pages: DiscoveredPage[]) {
  const byParty: Record<string, Record<string, number>> = {};
  for (const p of pages) {
    byParty[p.party] ??= {};
    byParty[p.party][p.level] = (byParty[p.party][p.level] ?? 0) + 1;
  }
  fs.writeFileSync(
    PAGES_FILE,
    JSON.stringify({ updatedAt: new Date().toISOString(), country: COUNTRY, windowStart: windowStart(), pagesByPartyAndLevel: byParty, pages }, null, 2),
  );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

let consecutiveRateLimits = 0;

async function apiGet(params: Record<string, string>, label: string): Promise<{ data: MetaAd[]; after?: string }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (!tm.hasUsableTokens()) throw new Error('No usable Facebook tokens left');
    const token = tm.getBestToken();
    const qs = new URLSearchParams({ ...params, access_token: token });

    let body: { data?: MetaAd[]; paging?: { cursors?: { after?: string } }; error?: { code: number; message: string } };
    try {
      const res = await fetch(`${API}?${qs}`);
      tm.updateUsageFromHeaders(res.headers);
      body = await res.json();
    } catch (e) {
      console.log(`    ⚠️ ${label}: network error (${e instanceof Error ? e.message : 'unknown'}), attempt ${attempt}`);
      await sleep(5000 * attempt);
      continue;
    }

    if (!body.error) {
      consecutiveRateLimits = 0;
      await sleep(PACE_MS);
      return { data: body.data ?? [], after: body.paging?.cursors?.after };
    }

    const { code, message } = body.error;
    if (RATE_LIMIT_CODES.includes(code)) {
      const wait = RATE_LIMIT_WAIT_MS[Math.min(consecutiveRateLimits, RATE_LIMIT_WAIT_MS.length - 1)];
      consecutiveRateLimits++;
      tm.markRateLimited(wait);
      if (tm.allTokensRateLimited()) {
        console.log(`    ⏳ all ${tm.getTotalTokens()} token(s) rate limited — sleeping ${wait / 60000} min (${label})`);
        await sleep(wait);
      }
      continue;
    }
    if (code === 190) { tm.markExpired(message); continue; }
    throw new Error(`${label}: ${message} (code ${code})`);
  }
  throw new Error(`${label}: gave up after ${MAX_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Phase 1 — discover party pages
// ---------------------------------------------------------------------------

function classify(party: Party, pageName: string): 'national' | 'youth' | 'branch' | null {
  const lower = pageName.trim().toLowerCase();
  if (party.youthMatch && new RegExp(party.youthMatch, 'i').test(lower)) return 'youth';
  if (!new RegExp(party.match, 'i').test(lower)) return null;
  if (party.national.some((n) => n.toLowerCase() === lower)) return 'national';
  return 'branch';
}

/** Every search's rows are tested against all parties, not just the one searched
 *  for — "Moderaterna" ads surface Liberalerna branch pages and vice versa. */
function matchAny(all: Party[], preferred: Party, pageName: string): { party: Party; level: 'national' | 'youth' | 'branch' } | null {
  const first = classify(preferred, pageName);
  if (first) return { party: preferred, level: first };
  for (const p of all) {
    if (p.abbr === preferred.abbr) continue;
    const level = classify(p, pageName);
    if (level) return { party: p, level };
  }
  return null;
}

/** Level + party affiliation are recomputed from the accumulated counts on every
 *  write, so a killed run resumes without losing borderline pages. */
function settle(p: DiscoveredPage, parties: Party[]): DiscoveredPage {
  if (p.orgLevel) {
    p.level = p.orgLevel;
    p.payerParty = parties.find((pt) => p.bylinesSeen.some((b) => new RegExp(pt.match, 'i').test(b)))?.abbr ?? null;
    return p;
  }

  // The "paid for by" byline beats both page name and search term. It is what
  // makes "KD Jönköpings län" (byline "Kristdemokraterna Jönköpings län") a KD
  // page, and what keeps a comedian's tour ads (byline "All Things Live Sweden")
  // out of M's numbers however often the copy names the party.
  const payer = parties.find((pt) => p.bylinesSeen.some((b) => new RegExp(pt.match, 'i').test(b)));
  p.payerParty = payer?.abbr ?? null;
  if (payer) {
    p.party = payer.abbr;
    p.level = 'affiliate';
    return p;
  }

  const ranked = Object.entries(p.partyMentions).sort((a, b) => b[1] - a[1]);
  p.party = ranked[0]?.[0] ?? p.party;
  p.level = p.declaredPoliticalAds >= MIN_AFFILIATE_ADS ? 'unverified' : 'candidate';
  return p;
}

async function discover(partyFilter?: string, termFilter?: string) {
  const allParties = loadParties();
  const parties = allParties.filter((p) => !partyFilter || p.abbr === partyFilter.toUpperCase());
  const known = new Map(readPages().map((p) => [p.pageId, p]));
  const excluded = new RegExp(loadExcludePattern(), 'i');
  const dateMin = windowStart();

  // --terms runs just those search terms (still matched against every party), so
  // a recall gap can be patched without re-scanning terms that already ran.
  const jobs: Array<{ term: string; party: Party }> = [];
  if (termFilter) {
    for (const term of termFilter.split(',').map((t) => t.trim()).filter(Boolean)) {
      const owner = allParties.find((p) => p.search.some((s) => s.toLowerCase() === term.toLowerCase()));
      jobs.push({ term, party: owner ?? parties[0] });
    }
  } else {
    for (const party of parties) for (const term of party.search) jobs.push({ term, party });
  }

  let lastParty = '';
  for (const { term, party } of jobs) {
    if (party.abbr !== lastParty) {
      console.log(`\n▸ ${party.name} (${party.abbr})`);
      lastParty = party.abbr;
    }
    {
      let after: string | undefined;
      let pageNum = 0;
      let rows = 0;
      let hits = 0;

      try {
      do {
        pageNum++;
        const { data, after: next } = await apiGet({
          search_terms: term,
          ad_reached_countries: JSON.stringify([COUNTRY]),
          ad_type: 'ALL',
          ad_active_status: 'ALL',
          ad_delivery_date_min: dateMin,
          fields: 'page_id,page_name,bylines,spend',
          limit: '250',
          ...(after ? { after } : {}),
        }, `discover "${term}" p${pageNum}`);

        rows += data.length;
        for (const ad of data) {
          if (!ad.page_id || !ad.page_name) continue;
          if (excluded.test(ad.page_name)) continue;

          const hit = matchAny(allParties, party, ad.page_name);
          const declared = ad.spend?.upper_bound !== undefined;
          // Non-org pages only count when the ad is a declared political/issue ad
          // — that filter is what separates candidates and politicians from news
          // outlets and shops whose copy happens to name a party.
          if (!hit && !declared) continue;
          hits++;

          let page = known.get(ad.page_id);
          if (!page) {
            page = {
              pageId: ad.page_id,
              pageName: ad.page_name,
              party: (hit?.party ?? party).abbr,
              level: 'candidate',
              orgLevel: hit?.level ?? null,
              payerParty: null,
              adsSeenInSearch: 0,
              declaredPoliticalAds: 0,
              partyMentions: {},
              bylinesSeen: [],
              discoveredAt: new Date().toISOString(),
            };
            known.set(ad.page_id, page);
          }
          page.pageName = ad.page_name;
          page.orgLevel = page.orgLevel ?? hit?.level ?? null;
          page.adsSeenInSearch++;
          if (declared) page.declaredPoliticalAds++;
          page.partyMentions[party.abbr] = (page.partyMentions[party.abbr] ?? 0) + 1;
          if (ad.bylines && !page.bylinesSeen.includes(ad.bylines) && page.bylinesSeen.length < 10) {
            page.bylinesSeen.push(ad.bylines);
          }
          settle(page, allParties);
        }
        after = next;
        if (pageNum >= DISCOVER_PAGE_CAP && after) {
          console.log(`    ⚠️ capped "${term}" at ${DISCOVER_PAGE_CAP} pages (${rows} rows) — more results exist, raise DISCOVER_PAGE_CAP to go deeper`);
          break;
        }
      } while (after);
      } catch (e) {
        // Keep what this term already yielded and move on — re-running `discover`
        // restarts the term from page 1 and merges into the same file.
        console.log(`  ✗ "${term}" stopped at page ${pageNum}: ${e instanceof Error ? e.message : String(e)}`);
      }

      const forParty = [...known.values()].filter((p) => p.party === party.abbr && p.level !== 'candidate');
      console.log(`  "${term}": ${rows} rows scanned, ${hits} matched → ${forParty.length} kept pages for ${party.abbr}`);
      writePages([...known.values()]);
    }
  }

  // Upsert into the ad-library brand table so the dashboard can browse them.
  // 'candidate' pages stay in the JSON only — one declared political ad naming a
  // party is not enough to call a page part of that party's advertising.
  let created = 0;
  for (const p of known.values()) {
    if (p.level === 'candidate') continue;
    const before = await prisma.adLibraryBrand.findUnique({ where: { pageId: p.pageId }, select: { id: true } });
    await prisma.adLibraryBrand.upsert({
      where: { pageId: p.pageId },
      update: { pageName: p.pageName, category: `party-${p.party}`, country: COUNTRY },
      create: {
        pageId: p.pageId,
        pageName: p.pageName,
        category: `party-${p.party}`,
        country: COUNTRY,
        // paused → selectDueBrands() in ingest-core skips these; this script owns them
        ingestionStatus: 'paused',
      },
    });
    if (!before) created++;
  }

  // Re-level every known page, not just the ones this pass touched, so tightened
  // name regexes and byline rules apply to the whole file rather than only to
  // fresh rows.
  const all = [...known.values()].map((p) => {
    const hit = allParties.map((pt) => ({ pt, lvl: classify(pt, p.pageName) })).find((x) => x.lvl);
    p.orgLevel = hit?.lvl ?? null;
    if (hit) p.party = hit.pt.abbr;
    return settle(p, allParties);
  });
  writePages(all);

  // A page that a looser earlier rule promoted may now be a 'candidate'. Drop its
  // party category so it leaves the dataset instead of lingering as party spend.
  const demoted = all.filter((p) => p.level === 'candidate');
  let cleared = 0;
  for (const p of demoted) {
    const r = await prisma.adLibraryBrand.updateMany({
      where: { pageId: p.pageId, category: { startsWith: 'party-' } },
      data: { category: null },
    });
    cleared += r.count;
  }
  if (cleared) console.log(`  cleared party category on ${cleared} demoted page(s)`);
  const byLevel = all.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.level]: (acc[p.level] ?? 0) + 1 }), {});
  console.log(`\n✓ ${all.length} pages seen — ${JSON.stringify(byLevel)} (${created} new brands) → ${path.relative(process.cwd(), PAGES_FILE)}`);
  console.log('  Review the `affiliate` entries in that file before analysing: they are attributed by which party term surfaced them, and bylinesSeen shows the actual payer.');
}

// ---------------------------------------------------------------------------
// Phase 2 — ingest ads per page
// ---------------------------------------------------------------------------

async function upsertAd(ad: MetaAd, brandId: string, jobId: string): Promise<'created' | 'updated'> {
  const isActive = !ad.ad_delivery_stop_time;
  const start = ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null;
  const end = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : null;
  const bodies = ad.ad_creative_bodies ?? [];
  const titles = ad.ad_creative_link_titles ?? [];

  const data = {
    brandId,
    ingestionJobId: jobId,
    displayFormat: bodies.length > 1 || titles.length > 1 ? 'carousel' : 'unknown',
    publisherPlatforms: ad.publisher_platforms ?? [],
    body: bodies[0] ?? null,
    title: titles[0] ?? null,
    caption: ad.ad_creative_link_captions?.[0] ?? null,
    linkDescription: ad.ad_creative_link_descriptions?.[0] ?? null,
    snapshotUrl: ad.ad_snapshot_url ?? null,
    startDate: start,
    endDate: end,
    adDurationDays: start ? Math.max(1, Math.ceil(((end ?? new Date()).getTime() - start.getTime()) / 86_400_000)) : null,
    isActive,
    reachEstimate: ad.eu_total_reach ?? null,
    impressionsLower: num(ad.impressions?.lower_bound),
    impressionsUpper: num(ad.impressions?.upper_bound),
    spendLower: num(ad.spend?.lower_bound),
    spendUpper: num(ad.spend?.upper_bound),
    currency: ad.currency ?? null,
    bylines: ad.bylines ?? null,
    targetingJson: {
      deliveryByRegion: ad.delivery_by_region ?? [],
      targetAges: ad.target_ages ?? null,
      targetGender: ad.target_gender ?? null,
      targetLocations: ad.target_locations ?? [],
      languages: ad.languages ?? [],
      estimatedAudienceSize: ad.estimated_audience_size ?? null,
      adCreationTime: ad.ad_creation_time ?? null,
    },
  };

  const existing = await prisma.adLibraryAd.findUnique({ where: { adId: ad.id }, select: { id: true } });
  if (existing) {
    await prisma.adLibraryAd.update({ where: { id: existing.id }, data });
    return 'updated';
  }
  const row = await prisma.adLibraryAd.create({ data: { adId: ad.id, ...data } });

  // Only queue creative downloads for ads still running — snapshot renders of
  // stopped ads are unreliable and the asset pipeline is the expensive part.
  if (isActive && ad.ad_snapshot_url) {
    await prisma.adAsset.create({
      data: { id: `${row.id}-0`, adId: row.id, assetType: 'image', position: 0, originalUrl: ad.ad_snapshot_url, downloadStatus: 'pending' },
    }).catch(() => {});
  }
  return 'created';
}

async function ingest(partyFilter?: string, force = false, limit?: number) {
  const dateMin = windowStart();
  const where = partyFilter
    ? { category: `party-${partyFilter.toUpperCase()}` }
    : { category: { startsWith: 'party-' } };
  const brands = await prisma.adLibraryBrand.findMany({ where, orderBy: { pageName: 'asc' } });

  if (brands.length === 0) {
    console.log('No party pages in the database — run `discover` first.');
    return;
  }

  const cutoff = new Date(Date.now() - REINGEST_AFTER_HOURS * 3600_000);
  const queue = force
    ? brands
    : (await Promise.all(brands.map(async (b) => {
        const done = await prisma.ingestionJob.findFirst({
          where: { brandId: b.id, status: 'completed', completedAt: { gt: cutoff } },
          select: { id: true },
        });
        return done ? null : b;
      }))).filter((b): b is typeof brands[number] => b !== null);

  const todo = limit ? queue.slice(0, limit) : queue;
  console.log(`${brands.length} party pages · ${todo.length} to ingest (window from ${dateMin}, ${COUNTRY} only)\n`);

  const totals = { ads: 0, created: 0, updated: 0, failed: 0 };

  for (let i = 0; i < todo.length; i++) {
    const brand = todo[i];
    const job = await prisma.ingestionJob.create({
      data: { brandId: brand.id, jobType: 'full', status: 'running', startedAt: new Date() },
    });

    try {
      const ads: MetaAd[] = [];
      const seen = new Set<string>();
      let after: string | undefined;
      do {
        const { data, after: next } = await apiGet({
          search_page_ids: brand.pageId,
          ad_reached_countries: JSON.stringify([COUNTRY]),
          ad_type: 'ALL',
          ad_active_status: 'ALL',
          ad_delivery_date_min: dateMin,
          fields: AD_FIELDS,
          limit: '100',
          ...(after ? { after } : {}),
        }, `${brand.pageName} ads`);
        for (const ad of data) if (!seen.has(ad.id)) { seen.add(ad.id); ads.push(ad); }
        after = next;
      } while (after);

      let created = 0, updated = 0;
      for (const ad of ads) {
        if ((await upsertAd(ad, brand.id, job.id)) === 'created') created++; else updated++;
      }

      const active = ads.filter((a) => !a.ad_delivery_stop_time).length;
      const withSpend = ads.filter((a) => a.spend?.upper_bound !== undefined).length;
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: 'completed', adsFetched: ads.length, adsCreated: created, adsUpdated: updated, completedAt: new Date() },
      });
      await prisma.adLibraryBrand.update({
        where: { id: brand.id },
        data: { activeAdCount: active, lastCheckedAt: new Date(), ingestionStatus: 'paused', failCount: 0 },
      });

      totals.ads += ads.length; totals.created += created; totals.updated += updated;
      console.log(`[${i + 1}/${todo.length}] ${brand.pageName}: ${ads.length} ads (${active} active, ${withSpend} with spend data) → +${created}/~${updated}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      totals.failed++;
      await prisma.ingestionJob.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: msg, completedAt: new Date() } });
      await prisma.adLibraryBrand.update({ where: { id: brand.id }, data: { failCount: { increment: 1 }, lastCheckedAt: new Date() } });
      console.log(`[${i + 1}/${todo.length}] ${brand.pageName}: ✗ ${msg}`);
      if (msg.includes('No usable Facebook tokens')) break;
    }
  }

  console.log(`\n✓ ${totals.ads} ads seen · ${totals.created} created · ${totals.updated} updated · ${totals.failed} pages failed`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function report() {
  const parties = loadParties();
  const pages = readPages();
  const dateMin = windowStart();
  const rows: Array<Record<string, unknown>> = [];

  for (const party of parties) {
    const brands = await prisma.adLibraryBrand.findMany({
      where: { category: `party-${party.abbr}` },
      select: { id: true, pageId: true, pageName: true },
    });
    if (brands.length === 0) continue;
    const ids = brands.map((b) => b.id);

    const ads = await prisma.adLibraryAd.findMany({
      where: { brandId: { in: ids }, startDate: { gte: new Date(dateMin) } },
      select: { spendLower: true, spendUpper: true, impressionsLower: true, impressionsUpper: true, currency: true, isActive: true, startDate: true, bylines: true, brandId: true },
    });

    const levels = new Map(pages.map((p) => [p.pageId, p.level]));
    const spendLower = ads.reduce((s, a) => s + (a.spendLower ?? 0), 0);
    const spendUpper = ads.reduce((s, a) => s + (a.spendUpper ?? 0), 0);
    const imprLower = ads.reduce((s, a) => s + (a.impressionsLower ?? 0), 0);
    const imprUpper = ads.reduce((s, a) => s + (a.impressionsUpper ?? 0), 0);
    const dates = ads.map((a) => a.startDate).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
    const currencies = [...new Set(ads.map((a) => a.currency).filter(Boolean))];

    rows.push({
      party: party.name,
      abbr: party.abbr,
      riksdag: party.riksdag,
      pages: brands.length,
      pagesNational: brands.filter((b) => levels.get(b.pageId) === 'national').length,
      pagesYouth: brands.filter((b) => levels.get(b.pageId) === 'youth').length,
      pagesBranch: brands.filter((b) => levels.get(b.pageId) === 'branch').length,
      pagesAffiliate: brands.filter((b) => levels.get(b.pageId) === 'affiliate').length,
      pagesUnverified: brands.filter((b) => levels.get(b.pageId) === 'unverified').length,
      pagesWithAds: new Set(ads.map((a) => a.brandId)).size,
      ads: ads.length,
      adsActive: ads.filter((a) => a.isActive).length,
      adsWithSpendRange: ads.filter((a) => a.spendUpper !== null).length,
      spendLower,
      spendUpper,
      currencies,
      impressionsLower: imprLower,
      impressionsUpper: imprUpper,
      firstAdStart: dates[0]?.toISOString().slice(0, 10) ?? null,
      lastAdStart: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
      distinctBylines: [...new Set(ads.map((a) => a.bylines).filter(Boolean))].length,
    });
  }

  rows.sort((a, b) => (b.spendUpper as number) - (a.spendUpper as number));

  // Absences are findings, not gaps to leave for the reader to spot. A party with
  // no pages ran no ads in SE in the window whose copy names it; a party with
  // branches but no national page advertised locally only, as far as this can see.
  const missing = parties.filter((p) => !rows.some((r) => r.abbr === p.abbr)).map((p) => `${p.abbr} ${p.name}`);
  const noNational = rows.filter((r) => (r.pagesNational as number) === 0).map((r) => `${r.abbr} ${r.party}`);

  const fmt = (n: number) => n.toLocaleString('sv-SE');
  console.log(`\nSwedish party ads · Meta Ad Library · ${COUNTRY} · ads starting ${dateMin} → today`);
  console.log('Spend/impressions are Meta\'s disclosed RANGES, summed as lower and upper bounds — not point values.\n');
  console.log('party'.padEnd(28) + 'pages'.padStart(6) + 'ads'.padStart(7) + 'active'.padStart(7) + 'spend range (SEK)'.padStart(24) + 'impressions range'.padStart(26));
  for (const r of rows) {
    console.log(
      `${r.abbr} ${r.party}`.slice(0, 27).padEnd(28) +
      String(r.pages).padStart(6) +
      String(r.ads).padStart(7) +
      String(r.adsActive).padStart(7) +
      `${fmt(r.spendLower as number)}–${fmt(r.spendUpper as number)}`.padStart(24) +
      `${fmt(r.impressionsLower as number)}–${fmt(r.impressionsUpper as number)}`.padStart(26),
    );
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'Meta Ad Library API (graph.facebook.com/v22.0/ads_archive), ad_type=ALL, ad_active_status=ALL',
    country: COUNTRY,
    window: { adDeliveryDateMin: dateMin, adDeliveryDateMax: new Date().toISOString().slice(0, 10) },
    caveats: [
      'ad_type=POLITICAL_AND_ISSUE_ADS is unavailable for EU countries; ad_type=ALL is used instead.',
      'spend and impressions are EU DSA disclosure ranges per ad; lower/upper bounds are summed separately. No midpoint is implied.',
      'Ads without a spend range were not declared political/issue by the advertiser.',
      'Levels: national/youth/branch = the page name is a party org. affiliate = a "paid for by" byline names a party org (politicians, abbreviation-named branches), which is the strongest attribution signal available. unverified = runs declared political ads naming a party but no byline ties it to one; that bucket mixes self-paying politicians with non-party advertisers, so exclude it for a strict party-only view. candidate pages are never ingested.',
    ],
    partiesWithNoPagesFound: missing,
    partiesWithNoNationalPageFound: noNational,
    parties: rows,
  }, null, 2));
  if (noNational.length) console.log(`\nNo national page found (branches/affiliates only): ${noNational.join(', ')}`);
  if (missing.length) console.log(`No pages found at all: ${missing.join(', ')}`);
  console.log(`\n→ ${path.relative(process.cwd(), REPORT_FILE)}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (flag: string) => {
    const i = rest.indexOf(flag);
    return i >= 0 ? rest[i + 1] : undefined;
  };

  if (!tm.hasTokens() && cmd !== 'report') {
    console.error('No FACEBOOK_ACCESS_TOKEN(S) in env. Run with: npx tsx --env-file=.env.local scripts/swedish-parties.ts ' + (cmd ?? 'discover'));
    process.exit(1);
  }

  switch (cmd) {
    case 'discover': await discover(arg('--party'), arg('--terms')); break;
    case 'ingest': await ingest(arg('--party'), rest.includes('--force'), arg('--limit') ? Number(arg('--limit')) : undefined); break;
    case 'report': await report(); break;
    default:
      console.log('Usage: swedish-parties.ts <discover|ingest|report> [--party ABBR] [--terms "a,b"] [--limit N] [--force]');
      process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
