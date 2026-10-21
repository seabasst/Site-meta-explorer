/**
 * Builds src/data/black-week-2025.json, the dataset behind /dashboard/v3/black-week.
 *
 * Pulls every ad 35 brands delivered in SE, NO, DK, FI, DE or GB between 1 Oct and
 * 5 Dec 2025 (ads_archive, ad_active_status=ALL), tags Black Week copy, aggregates per
 * brand and industry, and stores media for each brand's top 3 Black Week ads in R2.
 * Brands and page IDs come from the 2026-10-12 Black Week analysis.
 *
 *   BW_TOKEN=<token> npx tsx --env-file=.env.local scripts/black-week-2025.ts
 *
 * NO_MEDIA=1 skips the R2 step while iterating on the numbers.
 * The raw pull is cached in the OS temp dir (BW_CACHE) so the aggregation can be re-run
 * without hitting the API. EU ads leave the Library ~12 months after they last ran, so
 * a pull after early December 2026 starts losing Black Week 2025.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { getMetaToken } from '../src/lib/meta-token';
import { extractMediaFromSnapshot } from '../src/lib/media-extractor';
import { uploadToR2, extensionFromContentType, isR2Configured } from '../src/lib/r2';

const TOKEN = process.env.BW_TOKEN ?? getMetaToken();
const CACHE = process.env.BW_CACHE ?? path.join(os.tmpdir(), 'bw2025-raw.json');
const OUT = path.join(__dirname, '../src/data/black-week-2025.json');

const WINDOW = ['2025-10-01', '2025-12-05'] as const;
const MARKETS = ['SE', 'NO', 'DK', 'FI', 'DE', 'GB'];
// Baseline starts after Meta's 12-month retention cutoff (pull date minus a year), so it
// isn't missing ads that stopped early in October.
const BASELINE = ['2025-10-22', '2025-11-09'] as const;
const BW_PERIOD = ['2025-11-17', '2025-12-01'] as const; // two weeks to Cyber Monday
const BLACK_FRIDAY = '2025-11-28', CYBER_MONDAY = '2025-12-01';

const INDUSTRIES: Record<string, string> = {
  electronics: 'Consumer electronics',
  marketplaces: 'Marketplaces & department stores',
  fashion: 'Fashion',
  beauty: 'Beauty & personal care',
  health: 'Health & supplements',
  sport: 'Sport & activewear',
  home: 'Home & kids',
  accessories: 'Accessories & wearables',
};

const BRANDS: Array<[name: string, industry: keyof typeof INDUSTRIES, pages: string[]]> = [
  ['Elgiganten', 'electronics', ['150548735017115', '935855953228175']],
  ['NetOnNet', 'electronics', ['127976550548060']],
  ['Webhallen', 'electronics', ['184635401558095', '105371465230459']],
  ['CDON', 'marketplaces', ['143570738993914']],
  ['Boozt', 'marketplaces', ['139215459265']],
  ['Zalando', 'marketplaces', ['365604620536', '397006504808', '168351709688855']],
  ['Ellos', 'marketplaces', ['126305934102858']],
  ['H&M', 'fashion', ['588845131248209', '976271015858532', '1500573333514248', '134860227051166', '109641640656519', '100295562199192']],
  ['Nelly', 'fashion', ['73674709527']],
  ['Björn Borg', 'fashion', ['146418154596']],
  ['Happy Socks', 'fashion', ['487571865601']],
  ['Represent', 'fashion', ['104048763008842', '212578748604973', '527571043778583']],
  ['Snocks', 'fashion', ['109806077081081']],
  ['Lyko', 'beauty', ['107235932667377']],
  ['Kicks', 'beauty', ['969446293155710']],
  ['Caia Cosmetics', 'beauty', ['1653880254721745']],
  ['Hairlust', 'beauty', ['333149603692242']],
  ['Hismile', 'beauty', ['1573441899601646']],
  ['Apotea', 'health', ['377340125679269']],
  ['AG1', 'health', ['183869772601']],
  ['IM8', 'health', ['345914995276546', '696753946860832', '635362669669865', '683327568197335']],
  ['Spacegoods', 'health', ['104163495557745']],
  ['Huel', 'health', ['282592881929497']],
  ['Holy', 'health', ['103604591655541']],
  ['Gymshark', 'sport', ['129669023798560', '102590181603009']],
  ['ICANIWILL', 'sport', ['505427296149709']],
  ['Stronger', 'sport', ['1836637016477201']],
  ['Clas Ohlson', 'home', ['39689513719', '170933122004', '204523789610530']],
  ['Rusta', 'home', ['1704195749867464', '1474320456115831']],
  ['Jollyroom', 'home', ['181547415206863']],
  ['Mini Rodini', 'home', ['122903324946']],
  ['Daniel Wellington', 'accessories', ['215640775127795']],
  ['Nordgreen', 'accessories', ['1445157938907465']],
  ['Nudient', 'accessories', ['281454815587222']],
  ['Oura', 'accessories', ['753245374771837']],
];

// Copy rules, six languages. Catalogue ads with product-only text read as neither.
// A brand's Black Week campaign = ads that name it, plus offer ads started in the Black
// Week period: Lyko ran "REA", Kicks "dagens deal", Mini Rodini an early-access sale,
// none of them saying Black Week.
const BW_RE = /black\s*-?\s*(friday|week|weekend|days?|deals?|sale|month|fri)|blackweek|blackfriday|cyber\s*-?\s*(monday|week)|svart(a)?\s*(fredag|veckan)|musta\s*(perjantai|viikko)|\bBF\b/i;
// A percentage only counts as a discount in discount context ("-30%", "30% off",
// "upp till 50%"), so claims like "absorbs 50% better" or a quoted "- 85% of
// customers" (AG1) don't.
const PCT_RE = /(?:^|[\s(])-(\d{1,2})\s?%(?!\s*(?:of|av|der|af)\b)|(\d{1,2})\s?%\s?(?:off|rabatt|rabat|rea|sale|discount|alennus|reduziert|korting|på allt|auf alles|on everything)|(?:upp till|up to|bis zu|opp til|op til|jopa|save|spar|spara|spare)\s*-?\s?(\d{1,2})\s?%/gi;
const PROMO_RE = new RegExp(`${PCT_RE.source}|\\b(rea|sale|rabatt|rabat|deals?|angebote?|reduziert|tilbud|udsalg|salg|tarjous|alennus|ale|discount)\\b`, 'i');
const MECH: Record<string, RegExp> = {
  upTo: /\b(upp till|up to|bis zu|opp til|op til|jopa)\b/i,
  freeShip: /(fri|gratis)\s*frakt|free\s*(shipping|delivery)|kostenlose[rn]?\s*versand|versandkostenfrei|ilmainen\s*toimitus|(fri|gratis)\s*levering/i,
  code: /\b(rabattkod|discount code|promo code|code|kod|gutschein|kode|koodi)\b/i,
  early: /early\s*access|förtur|tidig tillgång|vorab|før alle andre|early bird/i,
};

type RawAd = {
  id: string; page_id: string; ad_delivery_start_time?: string; ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[]; ad_creative_link_titles?: string[]; ad_snapshot_url?: string; eu_total_reach?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pullPages(pages: string[]): Promise<RawAd[]> {
  const ads: RawAd[] = [];
  let limit = 100;
  let url: string | null = `https://graph.facebook.com/v22.0/ads_archive?${new URLSearchParams({
    search_page_ids: JSON.stringify(pages), ad_reached_countries: JSON.stringify(MARKETS),
    ad_active_status: 'ALL', ad_type: 'ALL', ad_delivery_date_min: WINDOW[0], ad_delivery_date_max: WINDOW[1],
    fields: 'id,page_id,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url,eu_total_reach',
    limit: String(limit), access_token: TOKEN!,
  })}`;
  while (url) {
    const d = await fetch(url).then((r) => r.json());
    if (d.error) {
      if (d.error.code === 613 || d.error.code === 4) { console.log('  rate limited, waiting 60s'); await sleep(60_000); continue; }
      // One oversized ad can fail a 100-row page ("reduce the amount of data").
      if (/reduce the amount of data/i.test(d.error.message) && limit > 10) {
        limit = limit === 100 ? 25 : 10;
        url = url.replace(/limit=\d+/, `limit=${limit}`);
        continue;
      }
      throw new Error(d.error.message);
    }
    ads.push(...d.data);
    url = d.paging?.next ?? null;
  }
  return ads;
}

const day = (s: string) => s.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const medianDate = (ds: string[]) => (ds.length ? [...ds].sort()[ds.length >> 1] : null);
const round = (x: number | null, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DAYS: string[] = [];
for (let t = Date.parse(WINDOW[0]); t <= Date.parse(WINDOW[1]); t += 864e5) DAYS.push(new Date(t).toISOString().slice(0, 10));
const inRange = (d: string, [a, b]: readonly [string, string]) => d >= a && d <= b;

// Media already in R2 from an earlier build is reused, so re-running the numbers is cheap.
const previous: Map<string, { url: string; type: 'image' | 'video' }> = new Map(
  fs.existsSync(OUT)
    ? (JSON.parse(fs.readFileSync(OUT, 'utf8')).brands as Array<{ topAds: Array<{ adId: string; media: { url: string; type: 'image' | 'video' } | null }> }>)
        .flatMap((b) => b.topAds).filter((t) => t.media).map((t) => [t.adId, t.media!])
    : [],
);

async function storeMedia(ad: RawAd): Promise<{ url: string; type: 'image' | 'video' } | null> {
  if (previous.has(ad.id)) return previous.get(ad.id)!;
  if (process.env.NO_MEDIA || !ad.ad_snapshot_url || !isR2Configured()) return null;
  try {
    const m = await extractMediaFromSnapshot(ad.ad_snapshot_url);
    if (!m) return null;
    const res = await fetch(m.url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? (m.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const up = await uploadToR2(`black-week-2025/${ad.id}.${extensionFromContentType(type)}`, Buffer.from(await res.arrayBuffer()), type);
    return { url: up.url, type: m.type };
  } catch (e) {
    console.log(`  media failed for ${ad.id}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function main() {
  if (!TOKEN) throw new Error('No token: set BW_TOKEN or FACEBOOK_ACCESS_TOKEN1');

  let raw: Record<string, RawAd[]> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  for (const [name, , pages] of BRANDS) {
    if (raw[name]) continue;
    const t = Date.now();
    raw[name] = await pullPages(pages);
    console.log(`pulled ${name}: ${raw[name].length} ads in ${Math.round((Date.now() - t) / 1000)}s`);
    fs.writeFileSync(CACHE, JSON.stringify(raw));
  }
  raw = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.filter((a) => a.ad_delivery_start_time)]));

  const inDb = new Set((await prisma.adLibraryBrand.findMany({
    where: { pageId: { in: BRANDS.flatMap(([, , p]) => p) } }, select: { pageId: true },
  })).map((b) => b.pageId));

  const brands = [];
  for (const [name, industry, pages] of BRANDS) {
    const ads = raw[name];
    const text = (a: RawAd) => [...(a.ad_creative_link_titles ?? []), ...(a.ad_creative_bodies ?? [])].join(' \n ');
    const named = ads.filter((a) => BW_RE.test(text(a)));
    const startedIn = (a: RawAd, range: readonly [string, string]) => inRange(day(a.ad_delivery_start_time!), range);
    const bw = ads.filter((a) => BW_RE.test(text(a)) || (PROMO_RE.test(text(a)) && startedIn(a, BW_PERIOD)));
    const promoShare = (range: readonly [string, string]) => {
      const xs = ads.filter((a) => startedIn(a, range));
      return xs.length ? round(xs.filter((a) => PROMO_RE.test(text(a))).length / xs.length) : null;
    };
    const starts = (xs: RawAd[]) => DAYS.map((d) => xs.filter((a) => day(a.ad_delivery_start_time!) === d).length);
    const all = starts(ads), bwSeries = starts(bw);
    const rate = (series: number[], range: readonly [string, string]) => {
      const idx = DAYS.map((d, i) => (inRange(d, range) ? i : -1)).filter((i) => i >= 0);
      return idx.reduce((s, i) => s + series[i], 0) / idx.length;
    };
    const baselineRate = rate(all, BASELINE), bwRate = rate(all, BW_PERIOD);
    const bwStarts = bw.map((a) => day(a.ad_delivery_start_time!)).filter((d) => inRange(d, WINDOW));
    const pcts = bw.map((a) => Math.max(0, ...[...text(a).matchAll(PCT_RE)].map((m) => Number(m[1] ?? m[2] ?? m[3])).filter((p) => p >= 5 && p <= 90)));
    const withPct = pcts.filter((p) => p > 0);
    const share = (re: RegExp) => (bw.length ? round(bw.filter((a) => re.test(text(a))).length / bw.length) : null);
    const ranFor = bw.map((a) => daysBetween(a.ad_delivery_start_time!, a.ad_delivery_stop_time ?? WINDOW[1]) + 1);
    const top = [...bw].sort((a, b) => (b.eu_total_reach ?? 0) - (a.eu_total_reach ?? 0)).slice(0, 3);

    const topAds = [];
    for (const a of top) {
      topAds.push({
        adId: a.id, reach: a.eu_total_reach ?? null, named: BW_RE.test(text(a)),
        title: a.ad_creative_link_titles?.[0] ?? null, body: a.ad_creative_bodies?.[0] ?? null,
        start: day(a.ad_delivery_start_time!), stop: a.ad_delivery_stop_time ? day(a.ad_delivery_stop_time) : null,
        media: await storeMedia(a),
      });
    }

    brands.push({
      slug: slugify(name), name, industry, pages, livePageId: pages.find((p) => inDb.has(p)) ?? null,
      ads: ads.length, bwAds: bw.length, namedAds: named.length,
      namedShare: bw.length ? round(named.length / bw.length) : null,
      promoShareBaseline: promoShare(BASELINE), promoShareBw: promoShare(BW_PERIOD),
      baselineRate: round(baselineRate, 1), bwRate: round(bwRate, 1), lift: baselineRate > 0 ? round(bwRate / baselineRate, 1) : null,
      firstBw: bwStarts.length ? [...bwStarts].sort()[0] : null, medianBwStart: medianDate(bwStarts),
      maxDiscount: withPct.length ? Math.max(...withPct) : null, medianDiscount: median(withPct),
      discountShare: bw.length ? round(withPct.length / bw.length) : null,
      mech: Object.fromEntries(Object.entries(MECH).map(([k, re]) => [k, share(re)])),
      medianBwDays: median(ranFor),
      afterCyberMonday: bw.length ? round(bw.filter((a) => !a.ad_delivery_stop_time || day(a.ad_delivery_stop_time) > CYBER_MONDAY).length / bw.length) : null,
      bwReach: bw.reduce((s, a) => s + (a.eu_total_reach ?? 0), 0),
      series: { all, bw: bwSeries },
      topAds,
    });
    console.log(`${name}: ${ads.length} ads, ${bw.length} Black Week, media ${topAds.filter((t) => t.media).length}/${topAds.length}`);
  }

  const industries = Object.entries(INDUSTRIES).map(([key, label]) => {
    const bs = brands.filter((b) => b.industry === key);
    const summed = DAYS.map((_, i) => bs.reduce((s, b) => s + b.series.bw[i], 0));
    const peak = Math.max(1, ...summed);
    const med = (f: (b: (typeof bs)[number]) => number | null) => median(bs.map(f).filter((x): x is number => x != null));
    return {
      key, label, brands: bs.map((b) => b.slug),
      ads: bs.reduce((s, b) => s + b.ads, 0), bwAds: bs.reduce((s, b) => s + b.bwAds, 0),
      medianLift: round(med((b) => b.lift), 1), medianBwStart: medianDate(bs.map((b) => b.medianBwStart).filter((d): d is string => !!d)),
      medianMaxDiscount: med((b) => b.maxDiscount), freeShipBrands: bs.filter((b) => (b.mech.freeShip ?? 0) >= 0.2).length,
      bwShape: summed.map((n) => round(n / peak)),
    };
  });

  const out = {
    meta: {
      window: WINDOW, markets: MARKETS, baseline: BASELINE, bwPeriod: BW_PERIOD,
      blackFriday: BLACK_FRIDAY, cyberMonday: CYBER_MONDAY, pulledAt: new Date().toISOString().slice(0, 10), days: DAYS,
      totals: { brands: brands.length, ads: brands.reduce((s, b) => s + b.ads, 0), bwAds: brands.reduce((s, b) => s + b.bwAds, 0) },
    },
    industries,
    brands,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT}: ${out.meta.totals.ads} ads, ${out.meta.totals.bwAds} Black Week`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
