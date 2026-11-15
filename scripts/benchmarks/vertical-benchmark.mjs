// Industry benchmark for Meta ad lifespans, built from a hand-reviewed panel per vertical.
//
//   node scripts/benchmarks/vertical-benchmark.mjs candidates <vertical>   # list pages to review (DB)
//   node scripts/benchmarks/vertical-benchmark.mjs pull <vertical>         # ads_archive ALL per page, resumable
//   node scripts/benchmarks/vertical-benchmark.mjs build <vertical>        # -> VerticalBenchmark row (DB)
//
// Load env first: set -a && . ../../../.env.local && set +a (FACEBOOK_ACCESS_TOKEN1..3, DATABASE_URL).
// The reviewed panel goes in data/benchmark-panels/<vertical>.json; build copies it into the DB row.
// Panels, pulls and results stay out of git: the repo is public and they are Meta Platform Data.
// Why pull instead of reading AdLibraryAd: the worker only fetches ACTIVE ads, so the DB never
// learns when an ad stops. ad_active_status=ALL returns Meta's own stop date.
import fs from 'node:fs';
import path from 'node:path';

const [cmd, vertical] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.join('data', 'benchmarks-raw', vertical ?? '');
const COHORT_START = process.env.COHORT_START ?? '2026-06-01';
const COUNTRIES = (process.env.COUNTRIES ?? 'SE,NO,DK,FI,DE,GB,FR,NL').split(','); // ALL over 30 countries times out
const MIN_COHORT_ADS = 10;
const OBSERVE_DAYS = 60;
const DAY = 86_400_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const panel = () => readJson(path.join('data', 'benchmark-panels', `${vertical}.json`));

async function candidates() {
  const { Client } = await import('pg');
  const keywords = readJson(path.join(HERE, 'verticals.json'))[vertical];
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rows } = await db.query(
    `select b."pageId", b."pageName", b."activeAdCount",
       (select left(a.body, 90) from "AdLibraryAd" a where a."brandId" = b.id and a.body is not null limit 1) body
     from "AdLibraryBrand" b
     where b.category = any($1) and b.platform = 'meta' and b."activeAdCount" >= 10
     order by b."activeAdCount" desc`, [keywords]);
  for (const r of rows) console.log([r.pageId, r.pageName, r.activeAdCount, (r.body ?? '').replace(/\s+/g, ' ')].join(' | '));
  await db.end();
}

async function liveTokens() {
  const all = [1, 2, 3].map(i => process.env[`FACEBOOK_ACCESS_TOKEN${i}`]).filter(Boolean);
  const ok = [];
  for (const t of all) {
    const me = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${t}`).then(r => r.json()).catch(() => ({}));
    if (me.id) ok.push(t);
  }
  if (!ok.length) throw new Error('No valid FACEBOOK_ACCESS_TOKEN1..3');
  console.error(`${ok.length} of ${all.length} tokens valid`);
  return ok;
}

async function pull() {
  const tokens = await liveTokens();
  fs.mkdirSync(RAW, { recursive: true });
  let t = 0;
  for (const { pageId, pageName } of panel().pages) {
    const file = path.join(RAW, `${pageId}.json`);
    const state = fs.existsSync(file) ? readJson(file) : null;
    if (state?.complete) continue;
    const s = state ?? { pageId, pageName, pulledAt: new Date().toISOString(), complete: false, ads: [], next: null };
    if (!s.next) {
      const params = new URLSearchParams({
        search_page_ids: JSON.stringify([pageId]),
        ad_reached_countries: JSON.stringify(COUNTRIES),
        ad_type: 'ALL',
        ad_active_status: 'ALL',
        ad_delivery_date_min: COHORT_START,
        fields: 'id,page_id,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms',
        limit: '250',
      });
      s.next = `https://graph.facebook.com/v22.0/ads_archive?${params}`;
    }
    while (s.next) {
      let json;
      for (let attempt = 0; ; attempt++) {
        const u = new URL(s.next);
        u.searchParams.set('access_token', tokens[t++ % tokens.length]);
        try {
          json = await fetch(u, { signal: AbortSignal.timeout(240_000) }).then(r => r.json());
        } catch (e) { json = { error: { message: String(e) } }; }
        if (!json.error) break;
        console.error(`[${pageName}] attempt ${attempt}: ${json.error.message}`);
        // ponytail: linear backoff capped at 10 min; the shared quota resets overnight, rerun resumes from s.next
        if (attempt >= 12) { fs.writeFileSync(file, JSON.stringify(s)); throw new Error(`Gave up on ${pageName}; rerun to resume`); }
        await sleep(Math.min(60_000 * (attempt + 1), 600_000));
      }
      s.ads.push(...json.data);
      s.next = json.paging?.next ?? null;
      fs.writeFileSync(file, JSON.stringify(s));
    }
    s.complete = true;
    fs.writeFileSync(file, JSON.stringify(s));
    console.error(`[${pageName}] ${s.ads.length} ads`);
  }
}

// Calendar day index, so date-only and datetime values from the API compare the same way.
const day = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;

// Metrics for one brand. Lifespan = delivery days inclusive (start..stop, or ..pull day if still live),
// the same definition the skill uses on an advertiser's own daily delivery data.
export function brandMetrics(ads, pulledDay, cohortStartDay) {
  const lifespans = [];
  let liveNow = 0, launched13w = 0;
  for (const a of ads) {
    const start = day(a.ad_delivery_start_time);
    const stop = a.ad_delivery_stop_time ? day(a.ad_delivery_stop_time) : null;
    if (stop === null) liveNow++;
    if (start > pulledDay - 91) launched13w++;
    if (start >= cohortStartDay && start <= pulledDay - OBSERVE_DAYS) {
      lifespans.push(stop === null ? Infinity : stop - start + 1);
    }
  }
  if (lifespans.length < MIN_COHORT_ADS) return null;
  const stoppedBy = d => lifespans.filter(l => l <= d).length / lifespans.length;
  let median = null;
  for (let d = 1; d <= OBSERVE_DAYS; d++) if (stoppedBy(d) >= 0.5) { median = d; break; }
  return {
    cohort_ads: lifespans.length,
    stopped_by_day_3: stoppedBy(3),
    stopped_by_day_7: stoppedBy(7),
    stopped_by_day_14: stoppedBy(14),
    stopped_by_day_30: stoppedBy(30),
    running_after_day_60: 1 - stoppedBy(OBSERVE_DAYS),
    median_lifespan_days: median, // null = more than half still running at day 60
    launches_per_week: launched13w / 13,
    live_ads_now: liveNow,
  };
}

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const round = x => Math.round(x * 1000) / 1000;
const METRICS = ['stopped_by_day_3', 'stopped_by_day_7', 'stopped_by_day_14', 'stopped_by_day_30', 'running_after_day_60', 'median_lifespan_days', 'launches_per_week', 'live_ads_now', 'cohort_ads'];

function distribution(rows) {
  const out = { brands: rows.length };
  for (const m of METRICS) {
    // median_lifespan_days null means ">60"; count them at 61 so they sort last, and say so.
    const xs = rows.map(r => r[m] ?? OBSERVE_DAYS + 1);
    out[m] = Object.fromEntries([10, 25, 50, 75, 90].map(p => [`p${p}`, round(quantile(xs, p / 100))]));
  }
  return out;
}

async function build() {
  const p = panel();
  const byBrand = new Map();
  for (const { pageId, brand } of p.pages) {
    const file = path.join(RAW, `${pageId}.json`);
    if (!fs.existsSync(file) || !readJson(file).complete) throw new Error(`Pull not complete for ${pageId}; run pull first`);
    const s = readJson(file);
    const b = byBrand.get(brand) ?? { ads: new Map(), pulled: [] };
    for (const a of s.ads) b.ads.set(a.id, a);
    b.pulled.push(day(s.pulledAt));
    byBrand.set(brand, b);
  }
  const rows = [];
  let pulledFrom = Infinity, pulledTo = -Infinity;
  for (const b of byBrand.values()) {
    const pulledDay = Math.min(...b.pulled);
    pulledFrom = Math.min(pulledFrom, pulledDay);
    pulledTo = Math.max(pulledTo, pulledDay);
    const m = brandMetrics([...b.ads.values()], pulledDay, day(COHORT_START));
    if (m) rows.push(m);
  }
  // Size tiers by launch volume terciles, so a small advertiser is compared with small advertisers.
  const lpw = rows.map(r => r.launches_per_week);
  const t1 = quantile(lpw, 1 / 3), t2 = quantile(lpw, 2 / 3);
  const iso = d => new Date(d * DAY).toISOString().slice(0, 10);
  const out = {
    vertical,
    built_at: new Date().toISOString().slice(0, 10),
    source: 'Meta Ad Library API, ads_archive, ad_type=ALL, ad_active_status=ALL',
    countries: COUNTRIES,
    pulled: { from: iso(pulledFrom), to: iso(pulledTo) },
    cohort: { started_from: COHORT_START, started_until: `${OBSERVE_DAYS} days before each brand's pull`, min_ads_per_brand: MIN_COHORT_ADS },
    panel: { reviewed: p.reviewed, pages: p.pages.length, brands_in_panel: byBrand.size, brands_with_enough_ads: rows.length, criteria: p.criteria },
    definitions: {
      lifespan_days: 'Days of delivery, inclusive: first delivery day to last delivery day, or to the pull day if still running.',
      stopped_by_day_N: 'Share of a brand\'s cohort ads that had stopped delivering within N days.',
      running_after_day_60: 'Share of a brand\'s cohort ads still delivering after 60 days.',
      median_lifespan_days: `Day by which half the cohort had stopped. ${OBSERVE_DAYS + 1} in the quantiles means more than half were still running at day ${OBSERVE_DAYS}.`,
      launches_per_week: 'New ads that started delivering in the 13 weeks before the pull, per week.',
      live_ads_now: 'Ads still delivering on the pull day.',
      quantiles: 'Each metric is computed per brand; pN is the Nth percentile across brands. Brands weigh equally regardless of size.',
    },
    caveats: [
      'Lifespan shows what the advertiser kept running and Meta kept delivering. It is not a measure of profit.',
      'Only ads that reached the listed countries are counted. The Ad Library API has no commercial ads outside the EU and UK.',
      'An ad in the Ad Library is one creative; a relaunch of the same creative counts as a new ad.',
    ],
    tiers: {
      small: { launches_per_week_below: round(t1), ...distribution(rows.filter(r => r.launches_per_week < t1)) },
      medium: { launches_per_week_from: round(t1), launches_per_week_below: round(t2), ...distribution(rows.filter(r => r.launches_per_week >= t1 && r.launches_per_week < t2)) },
      large: { launches_per_week_from: round(t2), ...distribution(rows.filter(r => r.launches_per_week >= t2)) },
    },
    all: distribution(rows),
  };
  fs.writeFileSync(path.join(RAW, '..', `${vertical}.benchmark.json`), JSON.stringify(out, null, 1) + '\n');
  // Additive and idempotent; mirrors the VerticalBenchmark model so `prisma db push` keeps it.
  const { Client } = await import('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`CREATE TABLE IF NOT EXISTS "VerticalBenchmark" (
    "vertical" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "panel" JSONB NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.query(
    `INSERT INTO "VerticalBenchmark" ("vertical", "data", "panel") VALUES ($1, $2, $3)
     ON CONFLICT ("vertical") DO UPDATE SET "data" = $2, "panel" = $3, "builtAt" = CURRENT_TIMESTAMP`,
    [vertical, out, p]);
  await db.end();
  console.log(`VerticalBenchmark "${vertical}": ${rows.length} brands`);
}

if (cmd === 'candidates') await candidates();
else if (cmd === 'pull') await pull();
else if (cmd === 'build') await build();
else if (cmd === 'selftest') {
  // Cohort window ends 60 days before the pull: ads 1-3 are in it, ad 4 is too young, ad 5 too old.
  const ads = [
    ['2026-07-01', '2026-07-02'], ['2026-07-01', '2026-07-20'], ['2026-07-01', null],
    ['2026-10-01', null], ['2026-05-01', '2026-05-03'],
    ...Array.from({ length: 7 }, () => ['2026-07-05', '2026-07-05']),
  ].map(([s, e], i) => ({ id: String(i), ad_delivery_start_time: s, ad_delivery_stop_time: e }));
  const m = brandMetrics(ads, day('2026-11-10'), day('2026-06-01'));
  const assert = (c, msg) => { if (!c) { console.error('FAIL', msg, m); process.exit(1); } };
  assert(m.cohort_ads === 10, 'cohort excludes too-young and pre-cohort ads');
  assert(Math.abs(m.stopped_by_day_3 - 0.8) < 1e-9, 'stopped_by_day_3 = 8/10 (7 one-day ads + a 2-day ad)');
  assert(Math.abs(m.stopped_by_day_30 - 0.9) < 1e-9, '20-day ad stops by day 30');
  assert(Math.abs(m.running_after_day_60 - 0.1) < 1e-9, 'one ad still running');
  assert(m.median_lifespan_days === 1, 'half stopped on day 1');
  assert(m.live_ads_now === 2, 'two ads without stop date');
  assert(Math.abs(m.launches_per_week - 1 / 13) < 1e-9, 'one launch in the last 13 weeks');
  assert(brandMetrics(ads.slice(0, 3), day('2026-11-10'), day('2026-06-01')) === null, 'too few cohort ads');
  console.log('selftest ok');
} else console.error('usage: vertical-benchmark.mjs candidates|pull|build|selftest <vertical>');
