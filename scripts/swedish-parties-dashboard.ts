/**
 * Builds a self-contained HTML dashboard from the ingested Swedish party ad data.
 *
 *   npx tsx --env-file=.env.local scripts/swedish-parties-dashboard.ts [--out path.html]
 *
 * Reads AdLibraryAd rows for brands with category `party-<ABBR>` plus the page
 * levels from data/swedish-party-pages.json. Emits one file with inline SVG
 * charts and no external requests, so it can be published or opened directly.
 *
 * Money rules baked in, not decoration: EU DSA gives spend and impressions as
 * ranges per ad, so every figure here is a lower and an upper bound and every
 * bar is drawn as a band between them. Totals cover SEK-priced ads only.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';

const DATA_DIR = path.join(__dirname, '../data');
const PARTIES_FILE = path.join(DATA_DIR, 'swedish-parties.json');
const PAGES_FILE = path.join(DATA_DIR, 'swedish-party-pages.json');

// Party identity hues, contrast-tuned. Four parties are blue, so every mark is
// labelled with the abbreviation too and colour never carries meaning alone.
const PARTY_HUE: Record<string, string> = {
  S: '#d72638', SD: '#1f3a63', M: '#5aa9e6', C: '#1c7c4f', V: '#8c1a2b',
  KD: '#1a5a8a', MP: '#6aa84f', L: '#2b6fd6', AFS: '#7a5c2e', NYANS: '#7d3f8c',
  FI: '#c2417f', PP: '#4a4a8a', MED: '#8a6a3f', KRVP: '#5c6b8a', FOLK: '#8a8a3f',
  DJUR: '#3f8a7a', ENHET: '#6a8a3f', SKP: '#a02020', LPO: '#6b7d3f',
  DD: '#5f6b7d', KLIMAT: '#2e8a6a', SJUKV: '#3f7d8a',
};
const FALLBACK_HUE = '#6b7089';

type Level = 'national' | 'youth' | 'branch' | 'affiliate' | 'unverified' | 'candidate';
const STRICT_LEVELS: Level[] = ['national', 'youth', 'branch', 'affiliate'];
const LEVEL_LABEL: Record<string, string> = {
  national: 'National org', youth: 'Youth league', branch: 'Regional / local branch',
  affiliate: 'Party-funded page', unverified: 'Unverified payer',
};

interface Party { abbr: string; name: string; riksdag: boolean }
interface PageMeta { pageId: string; pageName: string; level: Level; payerParty: string | null; bylinesSeen: string[] }

interface AdRow {
  pageId: string;
  party: string;
  level: Level;
  startDate: Date | null;
  spendLower: number | null;
  spendUpper: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  currency: string | null;
  isActive: boolean;
}

const fmt = (n: number) => n.toLocaleString('sv-SE');
const kr = (n: number) => `${fmt(Math.round(n))}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} mn`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} tn`;
  return fmt(n);
}

// ---------------------------------------------------------------------------

interface PartyAgg {
  abbr: string; name: string; riksdag: boolean; hue: string;
  pages: number; ads: number; declared: number; noDisclosure: number; active: number;
  spendLower: number; spendUpper: number; imprLower: number; imprUpper: number;
  byLevel: Record<string, { spendLower: number; spendUpper: number; declared: number; pages: number }>;
  firstAd: string | null; lastAd: string | null;
}

function aggregate(ads: AdRow[], parties: Party[], pages: PageMeta[], levels: Level[]): PartyAgg[] {
  const keep = new Set(levels);
  const out: PartyAgg[] = [];

  for (const p of parties) {
    const partyPages = pages.filter((pg) => keep.has(pg.level) && partyOf(pg) === p.abbr);
    const pageIds = new Set(partyPages.map((pg) => pg.pageId));
    const rows = ads.filter((a) => pageIds.has(a.pageId));
    if (rows.length === 0) continue;

    const sek = rows.filter((a) => a.currency === 'SEK');
    const dates = rows.map((a) => a.startDate).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
    const byLevel: PartyAgg['byLevel'] = {};
    for (const lvl of levels) {
      const ids = new Set(partyPages.filter((pg) => pg.level === lvl).map((pg) => pg.pageId));
      if (ids.size === 0) continue;
      const r = sek.filter((a) => ids.has(a.pageId));
      byLevel[lvl] = {
        pages: ids.size,
        declared: r.length,
        spendLower: r.reduce((s, a) => s + (a.spendLower ?? 0), 0),
        spendUpper: r.reduce((s, a) => s + (a.spendUpper ?? 0), 0),
      };
    }

    out.push({
      abbr: p.abbr, name: p.name, riksdag: p.riksdag, hue: PARTY_HUE[p.abbr] ?? FALLBACK_HUE,
      pages: pageIds.size,
      ads: rows.length,
      declared: rows.filter((a) => a.spendUpper !== null).length,
      noDisclosure: rows.filter((a) => a.spendUpper === null).length,
      active: rows.filter((a) => a.isActive).length,
      spendLower: sek.reduce((s, a) => s + (a.spendLower ?? 0), 0),
      spendUpper: sek.reduce((s, a) => s + (a.spendUpper ?? 0), 0),
      imprLower: sek.reduce((s, a) => s + (a.impressionsLower ?? 0), 0),
      imprUpper: sek.reduce((s, a) => s + (a.impressionsUpper ?? 0), 0),
      byLevel,
      firstAd: dates[0]?.toISOString().slice(0, 10) ?? null,
      lastAd: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
    });
  }
  return out.sort((a, b) => b.spendUpper - a.spendUpper);
}

/** The pages file already holds the resolved answer: discover() sets `party` from
 *  the page name for org pages and from the byline payer for everything else.
 *  Preferring payerParty here would second-guess that and could move an org page
 *  to another party on a coalition byline. */
function partyOf(pg: PageMeta & { party?: string }): string {
  return (pg as { party?: string }).party ?? pg.payerParty ?? '';
}

// ---------------------------------------------------------------------------
// Charts (inline SVG, no libraries — CSP-safe and theme-driven via currentColor)
// ---------------------------------------------------------------------------

/** Ranked spend bands. The bar spans lower→upper because that is what Meta
 *  discloses; a single-length bar would invent a precision that does not exist. */
function spendBands(rows: PartyAgg[], max: number): string {
  return rows.map((r) => {
    const l = (r.spendLower / max) * 100;
    const u = (r.spendUpper / max) * 100;
    return `<tr>
      <th scope="row"><span class="chip" style="--hue:${r.hue}">${esc(r.abbr)}</span><span class="pname">${esc(r.name)}</span></th>
      <td class="band-cell">
        <span class="band" style="--l:${l.toFixed(2)}%;--u:${u.toFixed(2)}%;--hue:${r.hue}" aria-hidden="true"></span>
      </td>
      <td class="num">${kr(r.spendLower)}<span class="dim"> – </span>${kr(r.spendUpper)}</td>
      <td class="num">${fmt(r.declared)}</td>
      <td class="num">${compact(r.imprLower)}<span class="dim"> – </span>${compact(r.imprUpper)}</td>
      <td class="num">${fmt(r.pages)}</td>
    </tr>`;
  }).join('');
}

/** Monthly declared-ad starts and upper-bound spend, columns + line. */
function timeline(ads: AdRow[], months: string[]): string {
  const W = 760, H = 190, padL = 46, padR = 46, padB = 26, padT = 12;
  const perMonth = months.map((m) => {
    const rows = ads.filter((a) => a.currency === 'SEK' && a.startDate?.toISOString().slice(0, 7) === m);
    return { m, ads: rows.length, spend: rows.reduce((s, a) => s + (a.spendUpper ?? 0), 0) };
  });
  const maxAds = Math.max(1, ...perMonth.map((p) => p.ads));
  const maxSpend = Math.max(1, ...perMonth.map((p) => p.spend));
  const bw = (W - padL - padR) / months.length;
  const x = (i: number) => padL + i * bw;
  const yA = (v: number) => padT + (1 - v / maxAds) * (H - padT - padB);
  const yS = (v: number) => padT + (1 - v / maxSpend) * (H - padT - padB);

  const bars = perMonth.map((p, i) =>
    `<rect class="tl-bar" x="${(x(i) + bw * 0.18).toFixed(1)}" y="${yA(p.ads).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - padB - yA(p.ads)).toFixed(1)}" rx="1.5"><title>${p.m}: ${fmt(p.ads)} declared ads</title></rect>`).join('');
  const line = perMonth.map((p, i) => `${(x(i) + bw / 2).toFixed(1)},${yS(p.spend).toFixed(1)}`).join(' ');
  const dots = perMonth.map((p, i) =>
    `<circle class="tl-dot" cx="${(x(i) + bw / 2).toFixed(1)}" cy="${yS(p.spend).toFixed(1)}" r="2.6"><title>${p.m}: upper bound ${kr(p.spend)} SEK</title></circle>`).join('');
  const labels = perMonth.map((p, i) => {
    const short = p.m.slice(5) === '01' ? p.m.slice(0, 4) : ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(p.m.slice(5)) - 1];
    return `<text class="tl-x" x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 8}">${short}</text>`;
  }).join('');

  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Declared political ads started per month, with upper-bound spend">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      ${bars}
      <polyline class="tl-line" points="${line}"/>
      ${dots}
      ${labels}
      <text class="tl-y" x="0" y="${padT + 8}">${fmt(maxAds)} ads</text>
      <text class="tl-y tl-y-r" x="${W}" y="${padT + 8}">${compact(maxSpend)} kr</text>
    </svg>
    <figcaption>Bars: declared political ads started that month. Line: sum of upper-bound spend for those ads. Left and right scales are independent.</figcaption>
  </figure>`;
}

/** Where the money sits: stacked share of upper-bound spend by page level. */
function levelSplit(rows: PartyAgg[], levels: Level[]): string {
  return rows.filter((r) => r.spendUpper > 0).slice(0, 10).map((r) => {
    const segs = levels.filter((l) => r.byLevel[l]?.spendUpper).map((l) => {
      const pct = (r.byLevel[l]!.spendUpper / r.spendUpper) * 100;
      return `<span class="seg seg-${l}" style="--w:${pct.toFixed(2)}%" title="${LEVEL_LABEL[l]}: ${pct.toFixed(0)}% of upper-bound spend (${fmt(r.byLevel[l]!.declared)} ads, ${fmt(r.byLevel[l]!.pages)} pages)"></span>`;
    }).join('');
    return `<div class="split-row">
      <span class="split-label"><span class="chip" style="--hue:${r.hue}">${esc(r.abbr)}</span></span>
      <span class="split-bar">${segs}</span>
      <span class="split-total num">${kr(r.spendUpper)}</span>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------

async function main() {
  const outArg = process.argv.indexOf('--out');
  const out = outArg >= 0 ? process.argv[outArg + 1] : path.join(DATA_DIR, 'swedish-party-dashboard.html');

  const parties: Party[] = JSON.parse(fs.readFileSync(PARTIES_FILE, 'utf-8')).parties;
  const pagesRaw = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
  const pages: Array<PageMeta & { party: string }> = pagesRaw.pages;
  const windowStart: string = pagesRaw.windowStart;

  const brands = await prisma.adLibraryBrand.findMany({
    where: { category: { startsWith: 'party-' } },
    select: { id: true, pageId: true, pageName: true, category: true },
  });
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const levelByPage = new Map(pages.map((p) => [p.pageId, p.level]));
  const partyByPage = new Map(pages.map((p) => [p.pageId, partyOf(p)]));

  const raw = await prisma.adLibraryAd.findMany({
    where: { brandId: { in: brands.map((b) => b.id) }, startDate: { gte: new Date(windowStart) } },
    select: {
      brandId: true, startDate: true, isActive: true, currency: true, body: true,
      spendLower: true, spendUpper: true, impressionsLower: true, impressionsUpper: true, bylines: true,
    },
  });

  const ads: AdRow[] = raw.map((a) => {
    const b = brandById.get(a.brandId)!;
    return {
      pageId: b.pageId,
      party: partyByPage.get(b.pageId) ?? (b.category ?? '').replace('party-', ''),
      level: levelByPage.get(b.pageId) ?? 'unverified',
      startDate: a.startDate, spendLower: a.spendLower, spendUpper: a.spendUpper,
      impressionsLower: a.impressionsLower, impressionsUpper: a.impressionsUpper,
      currency: a.currency, isActive: a.isActive,
    };
  });

  const allLevels: Level[] = [...STRICT_LEVELS, 'unverified'];
  const strict = aggregate(ads, parties, pages, STRICT_LEVELS);
  const loose = aggregate(ads, parties, pages, allLevels);

  // Months covered by the window, oldest first.
  const months: string[] = [];
  for (const d = new Date(windowStart); d <= new Date(); d.setMonth(d.getMonth() + 1)) {
    months.push(d.toISOString().slice(0, 7));
  }

  const strictIds = new Set(pages.filter((p) => STRICT_LEVELS.includes(p.level)).map((p) => p.pageId));
  const strictAds = ads.filter((a) => strictIds.has(a.pageId));

  const totals = (rows: PartyAgg[]) => ({
    spendLower: rows.reduce((s, r) => s + r.spendLower, 0),
    spendUpper: rows.reduce((s, r) => s + r.spendUpper, 0),
    imprLower: rows.reduce((s, r) => s + r.imprLower, 0),
    imprUpper: rows.reduce((s, r) => s + r.imprUpper, 0),
    declared: rows.reduce((s, r) => s + r.declared, 0),
    noDisclosure: rows.reduce((s, r) => s + r.noDisclosure, 0),
    pages: rows.reduce((s, r) => s + r.pages, 0),
    active: rows.reduce((s, r) => s + r.active, 0),
  });
  const tS = totals(strict);
  const tL = totals(loose);
  // Parties the search found nothing for are a finding, not an empty row to omit.
  const absent = parties.filter((p) => !loose.some((r) => r.abbr === p.abbr)).map((p) => `${p.abbr} ${p.name}`);
  const maxStrict = Math.max(...strict.map((r) => r.spendUpper), 1);
  const maxLoose = Math.max(...loose.map((r) => r.spendUpper), 1);

  // Top spending pages, strict set only.
  const bySpend = new Map<string, { pageId: string; name: string; party: string; level: Level; lower: number; upper: number; ads: number; byline: string | null }>();
  for (const a of raw) {
    const b = brandById.get(a.brandId)!;
    if (!strictIds.has(b.pageId) || a.currency !== 'SEK') continue;
    const e = bySpend.get(b.pageId) ?? {
      pageId: b.pageId, name: b.pageName, party: partyByPage.get(b.pageId) ?? '',
      level: levelByPage.get(b.pageId) ?? 'unverified', lower: 0, upper: 0, ads: 0, byline: null,
    };
    e.lower += a.spendLower ?? 0; e.upper += a.spendUpper ?? 0; e.ads++;
    e.byline = e.byline ?? a.bylines ?? null;
    bySpend.set(b.pageId, e);
  }
  const topPages = [...bySpend.values()].sort((a, b) => b.upper - a.upper).slice(0, 20);
  const maxPage = Math.max(...topPages.map((p) => p.upper), 1);

  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const windowEnd = new Date().toISOString().slice(0, 10);

  const html = `<title>Swedish party advertising on Meta · ${windowStart} to ${windowEnd}</title>
<style>
  :root {
    --ground: #f6f6f8;
    --surface: #ffffff;
    --surface-2: #eef0f4;
    --ink: #101322;
    --ink-2: #3d4257;
    --muted: #6b7089;
    --rule: #dcdfe8;
    --accent: #1235e2;
    --band-fill: color-mix(in srgb, var(--hue, #6b7089) 22%, transparent);
    --shadow: 0 1px 2px rgba(16, 19, 34, .06), 0 8px 24px -18px rgba(16, 19, 34, .35);
    --display: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #0b0e19; --surface: #141827; --surface-2: #1c2133;
      --ink: #f2f3f7; --ink-2: #c3c7d6; --muted: #8990a8; --rule: #262c40;
      --accent: #6d84ff;
      --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 10px 30px -20px rgba(0, 0, 0, .9);
    }
  }
  :root[data-theme="dark"] {
    --ground: #0b0e19; --surface: #141827; --surface-2: #1c2133;
    --ink: #f2f3f7; --ink-2: #c3c7d6; --muted: #8990a8; --rule: #262c40;
    --accent: #6d84ff;
    --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 10px 30px -20px rgba(0, 0, 0, .9);
  }
  :root[data-theme="light"] {
    --ground: #f6f6f8; --surface: #ffffff; --surface-2: #eef0f4;
    --ink: #101322; --ink-2: #3d4257; --muted: #6b7089; --rule: #dcdfe8;
    --accent: #1235e2;
    --shadow: 0 1px 2px rgba(16, 19, 34, .06), 0 8px 24px -18px rgba(16, 19, 34, .35);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font-family: var(--ui); font-size: 15px; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 40px 24px 72px; display: flex; flex-direction: column; gap: 34px; }
  .num, td.num, .tabular { font-variant-numeric: tabular-nums; }

  header h1 {
    font-family: var(--display); font-weight: 600; font-size: clamp(30px, 4.4vw, 46px);
    line-height: 1.08; letter-spacing: -.015em; margin: 0 0 12px; text-wrap: balance; max-width: 26ch;
  }
  .standfirst { margin: 0; color: var(--ink-2); max-width: 62ch; }
  .attribution {
    margin-top: 20px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--rule);
    border-radius: 8px; box-shadow: var(--shadow);
    display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 22px;
  }
  .attribution div { display: flex; flex-direction: column; gap: 2px; }
  .attribution dt, .lab {
    font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); font-weight: 600;
  }
  .attribution dd { margin: 0; font-size: 13px; color: var(--ink-2); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  .kpi { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; box-shadow: var(--shadow); }
  .kpi .v { font-family: var(--display); font-size: 27px; line-height: 1.1; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  .kpi .v .dim { color: var(--muted); font-size: 19px; }
  .kpi .sub { color: var(--muted); font-size: 12px; margin-top: 5px; }

  section > h2 {
    font-family: var(--display); font-size: 21px; font-weight: 600; letter-spacing: -.01em;
    margin: 0 0 4px; display: flex; align-items: baseline; gap: 10px;
  }
  section > .note { margin: 0 0 14px; color: var(--muted); font-size: 13px; max-width: 74ch; }
  .absent { margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
  .absent .lab { margin-right: 4px; }

  .panel { background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; box-shadow: var(--shadow); overflow: hidden; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--rule); white-space: nowrap; }
  thead th { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; background: var(--surface-2); }
  tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--surface-2); }
  td.num, th.num, thead th.num { text-align: right; }
  .dim { color: var(--muted); }
  .pname { color: var(--ink-2); }

  .chip {
    display: inline-block; min-width: 34px; text-align: center; margin-right: 9px;
    padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: .03em;
    background: var(--hue); color: #fff;
  }
  .lvl { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-2); background: var(--surface-2); }

  .band-cell { width: 44%; min-width: 190px; }
  .band { position: relative; display: block; height: 11px; background: var(--surface-2); border-radius: 2px; }
  .band::before {
    content: ""; position: absolute; inset-block: 0; left: 0; width: var(--u);
    background: color-mix(in srgb, var(--hue) 26%, transparent); border-radius: 2px;
  }
  .band::after {
    content: ""; position: absolute; inset-block: 0; left: 0; width: var(--l);
    background: var(--hue); border-radius: 2px;
  }

  .chart { margin: 0; padding: 14px 16px 6px; }
  .chart svg { width: 100%; height: auto; display: block; }
  .chart figcaption { color: var(--muted); font-size: 12px; padding: 8px 2px 10px; max-width: 78ch; }
  .axis { stroke: var(--rule); stroke-width: 1; }
  .tl-bar { fill: color-mix(in srgb, var(--accent) 32%, transparent); }
  .tl-line { fill: none; stroke: var(--ink); stroke-width: 1.6; stroke-linejoin: round; }
  .tl-dot { fill: var(--ink); }
  .tl-x, .tl-y { font-family: var(--ui); font-size: 9.5px; fill: var(--muted); text-anchor: middle; }
  .tl-y { text-anchor: start; letter-spacing: .06em; text-transform: uppercase; }
  .tl-y-r { text-anchor: end; }

  .split { padding: 14px 16px; display: flex; flex-direction: column; gap: 9px; }
  .split-row { display: grid; grid-template-columns: 58px 1fr 108px; align-items: center; gap: 12px; }
  .split-bar { display: flex; height: 13px; border-radius: 2px; overflow: hidden; background: var(--surface-2); }
  .seg { width: var(--w); }
  .seg-national { background: var(--ink); }
  .seg-branch { background: color-mix(in srgb, var(--accent) 62%, transparent); }
  .seg-affiliate { background: color-mix(in srgb, var(--accent) 30%, transparent); }
  .seg-youth { background: color-mix(in srgb, var(--ink) 42%, transparent); }
  .seg-unverified { background: repeating-linear-gradient(45deg, var(--muted) 0 3px, transparent 3px 6px); }
  .split-total { text-align: right; font-size: 13px; color: var(--ink-2); }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 4px 16px 14px; color: var(--muted); font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }

  .toggle {
    display: inline-flex; align-items: center; gap: 9px; margin-left: auto; font-size: 12.5px;
    color: var(--ink-2); background: var(--surface); border: 1px solid var(--rule);
    border-radius: 999px; padding: 5px 13px 5px 10px; cursor: pointer; box-shadow: var(--shadow);
  }
  .toggle input { accent-color: var(--accent); margin: 0; }
  .toggle:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  [hidden] { display: none !important; }

  footer { border-top: 1px solid var(--rule); padding-top: 20px; color: var(--muted); font-size: 12.5px; }
  footer h2 { font-family: var(--ui); font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
  footer li { margin-bottom: 7px; max-width: 88ch; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <h1>Swedish party advertising on Meta</h1>
    <p class="standfirst">Every Facebook and Instagram ad reaching Sweden from a Swedish party organisation, its youth league, its regional and municipal branches, and the pages it pays for, over the twelve months to ${windowEnd}. Spend and impressions are the ranges Meta discloses under the EU DSA, never point values.</p>
    <dl class="attribution">
      <div><dt>Data source</dt><dd>Meta Ad Library API, ads_archive v22.0</dd></div>
      <div><dt>Ad type / status</dt><dd>ALL / ALL (political filter is blocked in the EU)</dd></div>
      <div><dt>Window</dt><dd>${windowStart} to ${windowEnd}, delivery start date</dd></div>
      <div><dt>Reached country</dt><dd>Sweden only</dd></div>
      <div><dt>Attribution</dt><dd>Page name, then "paid for by" byline</dd></div>
      <div><dt>Generated</dt><dd>${generated} UTC</dd></div>
    </dl>
  </header>

  <div class="kpis">
    <div class="kpi">
      <div class="lab">Declared political ads</div>
      <div class="v" data-strict="${fmt(tS.declared)}" data-loose="${fmt(tL.declared)}">${fmt(tS.declared)}</div>
      <div class="sub"><span data-strict="${fmt(tS.noDisclosure)}" data-loose="${fmt(tL.noDisclosure)}">${fmt(tS.noDisclosure)}</span> further ads on these pages carry no disclosure</div>
    </div>
    <div class="kpi">
      <div class="lab">Disclosed spend, SEK</div>
      <div class="v" data-strict="${compact(tS.spendLower)}<span class='dim'> – </span>${compact(tS.spendUpper)}" data-loose="${compact(tL.spendLower)}<span class='dim'> – </span>${compact(tL.spendUpper)}">${compact(tS.spendLower)}<span class="dim"> – </span>${compact(tS.spendUpper)}</div>
      <div class="sub">Sum of per-ad lower and upper bounds</div>
    </div>
    <div class="kpi">
      <div class="lab">Disclosed impressions</div>
      <div class="v" data-strict="${compact(tS.imprLower)}<span class='dim'> – </span>${compact(tS.imprUpper)}" data-loose="${compact(tL.imprLower)}<span class='dim'> – </span>${compact(tL.imprUpper)}">${compact(tS.imprLower)}<span class="dim"> – </span>${compact(tS.imprUpper)}</div>
      <div class="sub">In Sweden, same range logic</div>
    </div>
    <div class="kpi">
      <div class="lab">Pages / ads still running</div>
      <div class="v" data-strict="${fmt(tS.pages)}<span class='dim'> / </span>${fmt(tS.active)}" data-loose="${fmt(tL.pages)}<span class='dim'> / </span>${fmt(tL.active)}">${fmt(tS.pages)}<span class="dim"> / </span>${fmt(tS.active)}</div>
      <div class="sub">Pages with at least one ad; ads not yet stopped</div>
    </div>
  </div>

  <section>
    <h2>Who spent the most
      <label class="toggle"><input type="checkbox" id="loose"> Include pages with no party byline</label>
    </h2>
    <p class="note">Each bar is a disclosure range: the solid part is the sum of lower bounds, the pale extension the sum of upper bounds. The true figure sits somewhere inside. Ranked on the upper bound.</p>
    <div class="panel scroll">
      <table>
        <thead><tr><th>Party</th><th>Disclosed spend range</th><th class="num">SEK</th><th class="num">Ads</th><th class="num">Impressions</th><th class="num">Pages</th></tr></thead>
        <tbody id="tb-strict">${spendBands(strict, maxStrict)}</tbody>
        <tbody id="tb-loose" hidden>${spendBands(loose, maxLoose)}</tbody>
      </table>
    </div>
    ${absent.length ? `<p class="note absent"><span class="lab">No ads found</span> ${absent.map((a) => esc(a)).join(' · ')}</p>` : ''}
  </section>

  <section>
    <h2>Where the money sits</h2>
    <p class="note">Share of upper-bound spend by page type, top ten parties. National organisations, local branches and party-funded pages behave very differently in an election year, and the split is the story a single total hides.</p>
    <div class="panel">
      <div class="split">${levelSplit(strict, STRICT_LEVELS)}</div>
      <div class="legend">
        <span><i style="background:var(--ink)"></i> National org</span>
        <span><i style="background:color-mix(in srgb, var(--accent) 62%, transparent)"></i> Regional / local branch</span>
        <span><i style="background:color-mix(in srgb, var(--ink) 42%, transparent)"></i> Youth league</span>
        <span><i style="background:color-mix(in srgb, var(--accent) 30%, transparent)"></i> Party-funded page</span>
      </div>
    </div>
  </section>

  <section>
    <h2>Twelve months of activity</h2>
    <p class="note">Declared political ads by the month they started running, across the strict party set.</p>
    <div class="panel">${timeline(strictAds, months)}</div>
  </section>

  <section>
    <h2>Top twenty spending pages</h2>
    <p class="note">Individual pages ranked on upper-bound spend, with the payer Meta records for them. A branch or a politician often outspends its own national organisation.</p>
    <div class="panel scroll">
      <table>
        <thead><tr><th>Page</th><th>Party</th><th>Type</th><th class="num">SEK range</th><th class="num">Ads</th><th>Paid for by</th></tr></thead>
        <tbody>
          ${topPages.map((p) => `<tr>
            <th scope="row"><span class="band" style="--l:${((p.lower / maxPage) * 100).toFixed(2)}%;--u:${((p.upper / maxPage) * 100).toFixed(2)}%;--hue:${PARTY_HUE[p.party] ?? FALLBACK_HUE};width:56px;display:inline-block;vertical-align:middle;margin-right:10px"></span>${esc(p.name)}</th>
            <td><span class="chip" style="--hue:${PARTY_HUE[p.party] ?? FALLBACK_HUE}">${esc(p.party)}</span></td>
            <td><span class="lvl">${LEVEL_LABEL[p.level] ?? p.level}</span></td>
            <td class="num">${kr(p.lower)}<span class="dim"> – </span>${kr(p.upper)}</td>
            <td class="num">${fmt(p.ads)}</td>
            <td class="dim">${esc(p.byline ?? '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>

  <footer>
    <h2>How to read this</h2>
    <ul>
      <li><strong>Ranges, not numbers.</strong> Meta discloses spend and impressions per ad as a bucket, so totals are the sum of lower bounds and the sum of upper bounds. No midpoint is implied anywhere on this page.</li>
      <li><strong>SEK only.</strong> A handful of ads on Swedish party pages are priced in other currencies; they are excluded from money totals rather than converted.</li>
      <li><strong>Attribution.</strong> Pages whose name is a party organisation are attributed by name. Other pages are attributed by their "paid for by" byline. The toggle above adds pages that run declared political ads naming a party but have no byline tying them to one, a bucket that mixes self-paying politicians with non-party advertisers.</li>
      <li><strong>Undeclared ads.</strong> Party pages also run ads with no political disclosure at all, which carry no spend data. They are counted but cannot be priced.</li>
      <li><strong>Coverage.</strong> Pages are found by searching ad text for party names, so a page whose ads never name its party is invisible to this dataset. Parties with no pages found, and parties with branches but no national page, are listed in the report JSON.</li>
    </ul>
  </footer>
</div>

<script>
  const box = document.getElementById('loose');
  const strictBody = document.getElementById('tb-strict');
  const looseBody = document.getElementById('tb-loose');
  box.addEventListener('change', () => {
    const on = box.checked;
    strictBody.hidden = on;
    looseBody.hidden = !on;
    for (const el of document.querySelectorAll('[data-strict]')) {
      el.innerHTML = on ? el.dataset.loose : el.dataset.strict;
    }
  });
</script>
`;

  fs.writeFileSync(out, html);
  console.log(`✓ ${out}`);
  console.log(`  strict set: ${strict.length} parties, ${fmt(tS.declared)} declared ads, ${kr(tS.spendLower)}–${kr(tS.spendUpper)} SEK`);
  console.log(`  with unverified: ${loose.length} parties, ${fmt(tL.declared)} declared ads, ${kr(tL.spendLower)}–${kr(tL.spendUpper)} SEK`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
