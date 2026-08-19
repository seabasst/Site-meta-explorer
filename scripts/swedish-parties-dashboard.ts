/**
 * Builds a self-contained HTML dashboard (in Swedish) from the ingested Swedish
 * party ad data.
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
 *
 * The "Budskap och målgrupper" section pairs curated theme notes (read from
 * the actual ad text — see PARTY_MESSAGING) with targeting stats computed
 * live from targetingJson, so the messaging themes are the only hand-authored
 * content on the page; every number stays accurate on re-runs.
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
  national: 'Nationellt parti', youth: 'Ungdomsförbund', branch: 'Regional/lokal avdelning',
  affiliate: 'Partifinansierad sida', unverified: 'Obekräftad betalare',
};

// Meta returns county names in English ("Stockholm County"); Swedish genitive
// forms don't follow a clean rule (Skåne län, but Stockholms län), so this is
// a full lookup rather than a suffix heuristic.
const COUNTY_SV: Record<string, string> = {
  'Stockholm County': 'Stockholms län', 'Uppsala County': 'Uppsala län',
  'Södermanland County': 'Södermanlands län', 'Östergötland County': 'Östergötlands län',
  'Jönköping County': 'Jönköpings län', 'Kronoberg County': 'Kronobergs län',
  'Kalmar County': 'Kalmar län', 'Gotland County': 'Gotlands län',
  'Blekinge County': 'Blekinge län', 'Skåne County': 'Skåne län',
  'Halland County': 'Hallands län', 'Västra Götaland County': 'Västra Götalands län',
  'Värmland County': 'Värmlands län', 'Örebro County': 'Örebro län',
  'Västmanland County': 'Västmanlands län', 'Dalarna County': 'Dalarnas län',
  'Gävleborg County': 'Gävleborgs län', 'Västernorrland County': 'Västernorrlands län',
  'Jämtland County': 'Jämtlands län', 'Västerbotten County': 'Västerbottens län',
  'Norrbotten County': 'Norrbottens län',
};
const countySv = (s: string) => COUNTY_SV[s] ?? s;

// Curated from reading the actual ad text (see chat) — the only hand-authored
// content on the page. Every stat next to it is computed live from the DB.
const PARTY_MESSAGING: Record<string, string[]> = {
  SD: [
    'Invandring och bidrag: utvisningar, stopp för bidrag till nyanlända, kritik av S:s migrationspolitik',
    'Ledarprofil: Jimmie Åkesson i centrum (sommartal, "Jimmie-priserna" på drivmedel)',
    'Kyrkovalet: positionerar sig som försvarare av en "svensk" kristen folkkyrka',
    'Vardagsekonomi och EU-kritik: sänkt matmoms, kärnkraft, motstånd mot EU-regler för bilreparationer',
  ],
  S: [
    'Lokal välfärd: gratis fritidsklubbar, kamp mot vinster i förskolan',
    'Kyrkovalet: stort annonsfokus trots att kyrkopolitik formellt är partioberoende',
    'Opposition mot "Tidöpartierna" (M/SD/KD/L-regeringsunderlaget) och privatiseringar',
    'Gemenskap och rörelsekänsla: rosen, "tillsammans", lokala Facebook/Instagram/TikTok-kanaler',
  ],
  C: [
    'Ny partiledare introduceras med ett personligt, privat anslag ("jag är människa och mamma")',
    'Klimat och landsbygd sida vid sida: skogsägares rättigheter, budget 2026 (nära vård, kollektivtrafik)',
    'Kyrkovalet: "medmänsklighet, hållbarhet och frihet"',
    'Lokal rekrytering och nomineringar inför valet 2026',
  ],
  M: [
    'Hushållsekonomi: halverad matmoms, sänkt skatt ("1 800 kr mer i månaden" för barnfamiljer)',
    'Bostäder och lokal trygghet: fler villor och radhus, "tryggare" kommuner',
    'Kärnkraft som stolthetsprojekt ("för första gången på 50 år")',
    'Flera annonser noterar själva att politisk annonsering upphör i oktober',
  ],
  MP: [
    'Utrikespolitik dominerar: upprop om Gaza/Palestina, krav på stopp för UNRWA-nedskärningar',
    'Miljöskydd lokalt: stoppa uranbrytning, nya naturreservat',
    'Anti-etablissemangston riktad mot S- och M-styren i kommuner och regioner',
    'Tydligt kvinnodominerad målgrupp där annonser riktas snävt (se nedan)',
  ],
  L: [
    '"Skolan är viktigast" som återkommande slogan över hela landet',
    'Vårdskandaler och kvinnohälsa (t.ex. livmoderskandalen på Akademiska sjukhuset)',
    'Personlig kandidatkontakt: öppna nomineringar, direkta vädjanden om synpunkter',
    'Skydd av äldre mot bedrägerier, fler närakuter lokalt',
  ],
  KD: [
    'Vård och äldreomsorg som kärnfråga, med konkreta lokala initiativ (naloxon, suicidprevention)',
    'Familjen som samhällets grund, tydligt värderingsbaserad profil',
    'Hushållsekonomi: sänkt matmoms, "billigare att vara svensk"',
    'Kärnkraft och bilvänlig lokalpolitik (mot förtätning/parkeringsminskning)',
  ],
  V: [
    'Avprivatisering och stärkt välfärd som huvudspår ("Moderaterna ut, välfärden in")',
    'Gaza/Palestina-solidaritet och fri abort som tydliga rättighetsfrågor',
    'Kyrkovalet via den partipolitiskt oberoende nomineringsgruppen ViSK',
    'Kraftigt kvinnodominerad målgrupp och stark Stockholmstyngdpunkt (se nedan)',
  ],
  AFS: [
    'Hårdare linje än SD: uttalat anti-muslimsk retorik ("inte för muslimskt folkutbyte")',
    'Offerberättelse: polistrakasserier, annonsförbud i tidningar',
    'Kyrkovalet som huvudslagfält: "ta tillbaka kyrkan"',
    'Tydligt mansdominerad målgrupp (se nedan), mycket litet annonsbudget',
  ],
  MED: [
    'Granskande lokaljournalistik-ton ("Slöseriombudsmannen", kommunala avslöjanden)',
    'Otrygghet och nedskräpning: klotter, tiggeri, tältläger',
    'Kritik av "extremvänstern" och uppmärksamhet på hedersrelaterat våld',
    'Öppenhet kring partifinansiering använd som vapen mot etablerade partier',
  ],
  SJUKV: [
    'Enfrågeparti: bevara lokala akutmottagningar, BB och förlossningsvård',
    'Visselblåsarton mot regionstyren, hänvisar ofta till lokal press',
    'Medlemsfinansierat och utan partistöd — återkommande vädjan om stöd inför 2026',
  ],
};
const MIN_ADS_FOR_MESSAGING = 15;

interface Party { abbr: string; name: string; riksdag: boolean }
interface PageMeta { pageId: string; pageName: string; level: Level; payerParty: string | null; bylinesSeen: string[] }

interface Targeting {
  ages?: string[] | string | null;
  gender?: string | null;
  deliveryByRegion?: Array<{ region: string; percentage: string | number }>;
}

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
  targeting: Targeting | null;
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

/** Targeting signal, restricted to declared ads (targetingJson on undeclared ads
 *  is present but meaningless — Meta doesn't apply real audience targeting to a
 *  boosted organic post the same way). "All"/18–65 is the default reach; only
 *  the minority of ads with a narrower setting says anything about strategy. */
function targetingStats(ads: AdRow[]) {
  let women = 0, men = 0, broadAge = 0, narrowAge = 0;
  const region = new Map<string, number>();
  for (const a of ads) {
    if (a.spendUpper === null) continue;
    const t = a.targeting;
    if (!t) continue;
    if (t.gender === 'Women') women++;
    else if (t.gender === 'Men') men++;
    const ages = t.ages;
    if (Array.isArray(ages) && ages.length === 2) {
      const lo = Number(ages[0]), hi = Number(ages[1]);
      if (Number.isFinite(lo) && Number.isFinite(hi)) { if (lo <= 20 && hi >= 60) broadAge++; else narrowAge++; }
    }
    for (const r of t.deliveryByRegion ?? []) {
      region.set(r.region, (region.get(r.region) ?? 0) + Number(r.percentage || 0));
    }
  }
  const topRegions = [...region.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => countySv(r));
  return { women, men, broadAge, narrowAge, topRegions };
}

function targetingSentence(t: ReturnType<typeof targetingStats>): string {
  const parts: string[] = [];
  const genderTargeted = t.women + t.men;
  if (genderTargeted >= 5) {
    if (t.women > t.men * 2) parts.push(`riktar tydligt mer mot kvinnor (${fmt(t.women)} mot ${fmt(t.men)} annonser med könsriktning)`);
    else if (t.men > t.women * 2) parts.push(`riktar tydligt mer mot män (${fmt(t.men)} mot ${fmt(t.women)} annonser med könsriktning)`);
    else parts.push(`riktar ${fmt(t.women)}/${fmt(t.men)} annonser mot kvinnor/män`);
  }
  if (t.narrowAge >= 5) parts.push(`${fmt(t.narrowAge)} annonser med snävare åldersspann än standardbrett 18–65`);
  if (t.topRegions.length) parts.push(`tyngdpunkt i ${t.topRegions.join(' och ')}`);
  if (!parts.length) return 'Nästan alla annonser riktas brett (alla kön, 18–65 år) utan tydlig regional tyngdpunkt.';
  return `${parts.join('; ')}.`;
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

/** Monthly declared-ad starts and upper-bound spend, columns + line. A vertical
 *  marker flags October 2025, when Meta stopped accepting paid political ads
 *  in the EU under the bloc's new transparency regulation. */
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
    `<rect class="tl-bar" x="${(x(i) + bw * 0.18).toFixed(1)}" y="${yA(p.ads).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - padB - yA(p.ads)).toFixed(1)}" rx="1.5"><title>${p.m}: ${fmt(p.ads)} deklarerade annonser</title></rect>`).join('');
  const line = perMonth.map((p, i) => `${(x(i) + bw / 2).toFixed(1)},${yS(p.spend).toFixed(1)}`).join(' ');
  const dots = perMonth.map((p, i) =>
    `<circle class="tl-dot" cx="${(x(i) + bw / 2).toFixed(1)}" cy="${yS(p.spend).toFixed(1)}" r="2.6"><title>${p.m}: övre gräns ${kr(p.spend)} kr</title></circle>`).join('');
  const labels = perMonth.map((p, i) => {
    const short = p.m.slice(5) === '01' ? p.m.slice(0, 4) : ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(p.m.slice(5)) - 1];
    return `<text class="tl-x" x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 8}">${short}</text>`;
  }).join('');
  const cutoffIdx = months.indexOf('2025-10');
  const cutoff = cutoffIdx >= 0
    ? `<line class="tl-cutoff" x1="${x(cutoffIdx).toFixed(1)}" y1="${padT}" x2="${x(cutoffIdx).toFixed(1)}" y2="${H - padB}"/>
       <text class="tl-cutoff-label" x="${(x(cutoffIdx) + 4).toFixed(1)}" y="${padT + 9}">EU stänger av politiska annonser</text>`
    : '';

  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deklarerade politiska annonser per månad, med kostnadens övre gräns">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      ${bars}
      ${cutoff}
      <polyline class="tl-line" points="${line}"/>
      ${dots}
      ${labels}
      <text class="tl-y" x="0" y="${padT + 8}">${fmt(maxAds)} annonser</text>
      <text class="tl-y tl-y-r" x="${W}" y="${padT + 8}">${compact(maxSpend)} kr</text>
    </svg>
    <figcaption>Staplar: deklarerade politiska annonser som startade den månaden. Linjen: summan av kostnadens övre gräns för dessa annonser. Vänster och höger skala är oberoende av varandra.</figcaption>
  </figure>`;
}

/** Where the money sits: stacked share of upper-bound spend by page level. */
function levelSplit(rows: PartyAgg[], levels: Level[]): string {
  return rows.filter((r) => r.spendUpper > 0).slice(0, 10).map((r) => {
    const segs = levels.filter((l) => r.byLevel[l]?.spendUpper).map((l) => {
      const pct = (r.byLevel[l]!.spendUpper / r.spendUpper) * 100;
      return `<span class="seg seg-${l}" style="--w:${pct.toFixed(2)}%" title="${LEVEL_LABEL[l]}: ${pct.toFixed(0)}% av kostnadens övre gräns (${fmt(r.byLevel[l]!.declared)} annonser, ${fmt(r.byLevel[l]!.pages)} sidor)"></span>`;
    }).join('');
    return `<div class="split-row">
      <span class="split-label"><span class="chip" style="--hue:${r.hue}">${esc(r.abbr)}</span></span>
      <span class="split-bar">${segs}</span>
      <span class="split-total num">${kr(r.spendUpper)}</span>
    </div>`;
  }).join('');
}

/** Messaging + targeting cards, strict set only, above the sample-size floor. */
function messagingCards(strict: PartyAgg[], strictAds: AdRow[]): { cards: string; tooSmall: string[] } {
  const tooSmall: string[] = [];
  const cards = strict.map((r) => {
    if (r.declared < MIN_ADS_FOR_MESSAGING) { tooSmall.push(`${r.abbr} ${r.name}`); return ''; }
    const themes = PARTY_MESSAGING[r.abbr];
    if (!themes) { tooSmall.push(`${r.abbr} ${r.name}`); return ''; }
    const partyAds = strictAds.filter((a) => a.party === r.abbr);
    const t = targetingStats(partyAds);
    return `<article class="msg-card">
      <h3><span class="chip" style="--hue:${r.hue}">${esc(r.abbr)}</span>${esc(r.name)}</h3>
      <ul>${themes.map((th) => `<li>${esc(th)}</li>`).join('')}</ul>
      <p class="targeting">🎯 ${esc(targetingSentence(t))}</p>
    </article>`;
  }).join('');
  return { cards, tooSmall };
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
      targetingJson: true,
    },
  });

  const ads: AdRow[] = raw.map((a) => {
    const b = brandById.get(a.brandId)!;
    const t = a.targetingJson as { targetAges?: unknown; targetGender?: string | null; deliveryByRegion?: Targeting['deliveryByRegion'] } | null;
    return {
      pageId: b.pageId,
      party: partyByPage.get(b.pageId) ?? (b.category ?? '').replace('party-', ''),
      level: levelByPage.get(b.pageId) ?? 'unverified',
      startDate: a.startDate, spendLower: a.spendLower, spendUpper: a.spendUpper,
      impressionsLower: a.impressionsLower, impressionsUpper: a.impressionsUpper,
      currency: a.currency, isActive: a.isActive,
      targeting: t ? { ages: t.targetAges as string[] | string | null, gender: t.targetGender ?? null, deliveryByRegion: t.deliveryByRegion } : null,
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

  // Church-election spike / EU political-ad cutoff, computed from the strict set.
  const churchWindow = strictAds.filter((a) => a.currency === 'SEK' && a.spendUpper !== null && a.startDate && a.startDate >= new Date('2025-08-01') && a.startDate < new Date('2025-10-01')).length;
  const afterCutoff = strictAds.filter((a) => a.currency === 'SEK' && a.spendUpper !== null && a.startDate && a.startDate >= new Date('2025-10-01')).length;
  const totalDeclaredSek = strictAds.filter((a) => a.currency === 'SEK' && a.spendUpper !== null).length;
  const churchPct = totalDeclaredSek ? Math.round((churchWindow / totalDeclaredSek) * 100) : 0;

  // Whether verified party pages actually stopped advertising, or just stopped
  // disclosing — checked on ALL ads (any currency, any disclosure state), not
  // just declared/SEK ones, so a reader can't mistake "no disclosure" for
  // "kept running ads quietly". Compared against the unverified bucket (pages
  // keyword-matched to a party with no confirmed payer), since that bucket is
  // where the apparent continued activity actually sits — see [[project-swedish-party-ads]].
  const OCT_CUTOFF = new Date('2025-10-01');
  const spikeAllAds = strictAds.filter((a) => a.startDate && a.startDate >= new Date('2025-08-01') && a.startDate < OCT_CUTOFF).length;
  const afterCutoffAllAds = strictAds.filter((a) => a.startDate && a.startDate >= OCT_CUTOFF).length;
  const monthsAfterCutoff = Math.max(1, months.filter((m) => m >= '2025-11').length);
  const strictPerMonthAfter = Math.round(afterCutoffAllAds / monthsAfterCutoff);
  const spikePerMonth = Math.round(spikeAllAds / 2);
  const unverifiedAds = ads.filter((a) => a.level === 'unverified' && a.startDate && a.startDate >= OCT_CUTOFF);
  const unverifiedPerMonthAfter = Math.round(unverifiedAds.length / monthsAfterCutoff);

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

  const { cards: messagingHtml, tooSmall } = messagingCards(strict, strictAds);

  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const windowEnd = new Date().toISOString().slice(0, 10);

  const html = `<title>Svenska partiers annonsering på Meta · ${windowStart} till ${windowEnd}</title>
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
  .tl-cutoff { stroke: #c2410c; stroke-width: 1.3; stroke-dasharray: 3 3; }
  .tl-cutoff-label { font-family: var(--ui); font-size: 8.5px; fill: #c2410c; font-weight: 600; }
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

  .callout {
    display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px;
    background: color-mix(in srgb, #c2410c 8%, var(--surface)); border: 1px solid color-mix(in srgb, #c2410c 30%, var(--rule));
    border-radius: 8px; box-shadow: var(--shadow);
  }
  .callout .mark { font-family: var(--display); font-size: 26px; color: #c2410c; line-height: 1; }
  .callout p { margin: 0; color: var(--ink-2); font-size: 13.5px; max-width: 74ch; }
  .callout strong { color: var(--ink); }

  .msg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .msg-card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px;
    box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
  }
  .msg-card h3 { margin: 0; font-family: var(--display); font-size: 16px; font-weight: 600; display: flex; align-items: center; }
  .msg-card ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--ink-2); }
  .msg-card .targeting { margin: 0; font-size: 12.5px; color: var(--muted); border-top: 1px solid var(--rule); padding-top: 9px; }
  .too-small { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; }

  .toggle {
    display: inline-flex; align-items: center; gap: 9px; margin-left: auto; font-size: 12.5px;
    color: var(--ink-2); background: var(--surface); border: 1px solid var(--rule);
    border-radius: 999px; padding: 5px 13px 5px 10px; cursor: pointer; box-shadow: var(--shadow);
  }
  .toggle input { accent-color: var(--accent); margin: 0; }
  .toggle:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  [hidden] { display: none !important; }

  footer { border-top: 1px solid var(--rule); padding-top: 20px; color: var(--muted); font-size: 12.5px; }
  footer h2 { font-family: var(--ui); font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); margin: 24px 0 8px; }
  footer h2:first-child { margin-top: 0; }
  footer li { margin-bottom: 7px; max-width: 88ch; }
  footer a { color: var(--accent); }
  .footnotes { padding-left: 18px; }
  .footnotes li { max-width: 92ch; }
  .callout sup a, .callout sup { color: #c2410c; }
  sup a { text-decoration: none; font-weight: 700; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <h1>Svenska partiers annonsering på Meta</h1>
    <p class="standfirst">Varje Facebook- och Instagramannons som når Sverige från ett svenskt partis riksorganisation, ungdomsförbund, regionala och lokala avdelningar, samt sidor partiet betalar för, under de tolv månaderna fram till ${windowEnd}. Kostnad och visningar är de intervall Meta redovisar enligt EU:s DSA-förordning, aldrig exakta tal.</p>
    <dl class="attribution">
      <div><dt>Datakälla</dt><dd>Meta Ad Library API, ads_archive v22.0</dd></div>
      <div><dt>Annonstyp / status</dt><dd>ALL / ALL (det politiska filtret är blockerat i EU)</dd></div>
      <div><dt>Tidsfönster</dt><dd>${windowStart} till ${windowEnd}, annonsens startdatum</dd></div>
      <div><dt>Nått land</dt><dd>Endast Sverige</dd></div>
      <div><dt>Partitillhörighet</dt><dd>Sidnamn, därefter "betalad av"-avsändare</dd></div>
      <div><dt>Genererad</dt><dd>${generated} UTC</dd></div>
    </dl>
  </header>

  <div class="kpis">
    <div class="kpi">
      <div class="lab">Deklarerade politiska annonser</div>
      <div class="v" data-strict="${fmt(tS.declared)}" data-loose="${fmt(tL.declared)}">${fmt(tS.declared)}</div>
      <div class="sub"><span data-strict="${fmt(tS.noDisclosure)}" data-loose="${fmt(tL.noDisclosure)}">${fmt(tS.noDisclosure)}</span> ytterligare annonser på dessa sidor saknar redovisning</div>
    </div>
    <div class="kpi">
      <div class="lab">Redovisad kostnad, kr</div>
      <div class="v" data-strict="${compact(tS.spendLower)}<span class='dim'> – </span>${compact(tS.spendUpper)}" data-loose="${compact(tL.spendLower)}<span class='dim'> – </span>${compact(tL.spendUpper)}">${compact(tS.spendLower)}<span class="dim"> – </span>${compact(tS.spendUpper)}</div>
      <div class="sub">Summan av varje annons undre och övre gräns</div>
    </div>
    <div class="kpi">
      <div class="lab">Redovisade visningar</div>
      <div class="v" data-strict="${compact(tS.imprLower)}<span class='dim'> – </span>${compact(tS.imprUpper)}" data-loose="${compact(tL.imprLower)}<span class='dim'> – </span>${compact(tL.imprUpper)}">${compact(tS.imprLower)}<span class="dim"> – </span>${compact(tS.imprUpper)}</div>
      <div class="sub">I Sverige, samma intervallogik</div>
    </div>
    <div class="kpi">
      <div class="lab">Sidor / annonser som fortfarande går</div>
      <div class="v" data-strict="${fmt(tS.pages)}<span class='dim'> / </span>${fmt(tS.active)}" data-loose="${fmt(tL.pages)}<span class='dim'> / </span>${fmt(tL.active)}">${fmt(tS.pages)}<span class="dim"> / </span>${fmt(tS.active)}</div>
      <div class="sub">Sidor med minst en annons; annonser som inte stoppats</div>
    </div>
  </div>

  <section>
    <h2>Vem spenderade mest
      <label class="toggle"><input type="checkbox" id="loose"> Inkludera sidor utan partiavsändare</label>
    </h2>
    <p class="note">Varje stapel är ett redovisningsintervall: den mättade delen är summan av undre gränser, den ljusa förlängningen summan av övre gränser. Det verkliga beloppet ligger någonstans däremellan. Rankat på övre gränsen.</p>
    <div class="panel scroll">
      <table>
        <thead><tr><th>Parti</th><th>Redovisat kostnadsintervall</th><th class="num">kr</th><th class="num">Annonser</th><th class="num">Visningar</th><th class="num">Sidor</th></tr></thead>
        <tbody id="tb-strict">${spendBands(strict, maxStrict)}</tbody>
        <tbody id="tb-loose" hidden>${spendBands(loose, maxLoose)}</tbody>
      </table>
    </div>
    ${absent.length ? `<p class="note absent"><span class="lab">Inga annonser hittades</span> ${absent.map((a) => esc(a)).join(' · ')}</p>` : ''}
  </section>

  <section>
    <h2>Var pengarna finns</h2>
    <p class="note">Andel av kostnadens övre gräns per sidtyp, de tio mest spenderande partierna. Riksorganisation, lokala avdelningar och partifinansierade sidor beter sig mycket olika under ett valår, och fördelningen är historien en enda summa döljer.</p>
    <div class="panel">
      <div class="split">${levelSplit(strict, STRICT_LEVELS)}</div>
      <div class="legend">
        <span><i style="background:var(--ink)"></i> Nationellt parti</span>
        <span><i style="background:color-mix(in srgb, var(--accent) 62%, transparent)"></i> Regional/lokal avdelning</span>
        <span><i style="background:color-mix(in srgb, var(--ink) 42%, transparent)"></i> Ungdomsförbund</span>
        <span><i style="background:color-mix(in srgb, var(--accent) 30%, transparent)"></i> Partifinansierad sida</span>
      </div>
    </div>
  </section>

  <section>
    <h2>Tolv månaders aktivitet</h2>
    <p class="note">Deklarerade politiska annonser efter den månad de började visas, för den strikta partiuppsättningen.</p>
    <div class="panel">${timeline(strictAds, months)}</div>
    <div class="callout" style="margin-top:14px">
      <span class="mark">!</span>
      <div>
        <p><strong>Kyrkovalet 2025 dominerar datat, sedan tystnar det nästan helt.</strong> Cirka ${churchPct}% av alla deklarerade politiska annonser i det strikta partiurvalet (${fmt(churchWindow)} av ${fmt(totalDeclaredSek)}) startade i augusti–september 2025, under Svenska kyrkans kyrkoval. Den 6 oktober 2025 slutade Meta sälja politiska, val- och samhällsfrågerelaterade annonser i hela EU<sup><a href="#fn1">1</a></sup> — bara ${fmt(afterCutoff)} deklarerade annonser startade därefter.</p>
        <p><strong>Det är inte bara redovisningen som försvann.</strong> Den totala annonsvolymen på dessa bekräftade partisidor — oavsett redovisning — rasade från ett snitt på ${fmt(spikePerMonth)} annonser/månad under kyrkovalsspiken till bara ${fmt(strictPerMonthAfter)} annonser/månad från oktober 2025 och framåt. Sidorna slutade i praktiken annonsera, de slutade inte bara redovisa. Den aktivitet som ändå syns i den bredare datamängden (reglaget ovan) sitter nästan helt i sidor utan bekräftad partiavsändare — ${fmt(unverifiedPerMonthAfter)} annonser/månad i samma period, som mest troligt inte är partiannonsering alls.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>Budskap och målgrupper</h2>
    <p class="note">Teman är lästa direkt ur annonstexterna (topp-spenderande annonser per parti). Målgruppsraden under varje kort är beräknad live ur Metas riktningsdata — de allra flesta annonser riktas brett (alla kön, 18–65 år), så det som visas här är just avvikelserna från den bredden.</p>
    <div class="msg-grid">${messagingHtml}</div>
    ${tooSmall.length ? `<p class="too-small"><span class="lab">För litet urval för mönster</span>: ${tooSmall.map((a) => esc(a)).join(' · ')}</p>` : ''}
  </section>

  <section>
    <h2>Topp 20 sidor efter kostnad</h2>
    <p class="note">Enskilda sidor rankade på kostnadens övre gräns, med den avsändare Meta registrerar för dem. En lokalavdelning eller en enskild politiker spenderar ofta mer än partiets egen riksorganisation.</p>
    <div class="panel scroll">
      <table>
        <thead><tr><th>Sida</th><th>Parti</th><th>Typ</th><th class="num">kr-intervall</th><th class="num">Annonser</th><th>Betald av</th></tr></thead>
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
    <h2>Så här läser du detta</h2>
    <ul>
      <li><strong>Intervall, inte exakta tal.</strong> Meta redovisar kostnad och visningar per annons som ett intervall, så summorna är summan av undre gränser respektive summan av övre gränser. Inget mitt-värde är underförstått någonstans på sidan.</li>
      <li><strong>Endast kr.</strong> Ett fåtal annonser på svenska partisidor prissätts i annan valuta; de exkluderas från summorna istället för att växlas om.</li>
      <li><strong>Partitillhörighet.</strong> Sidor vars namn är en partiorganisation knyts till partiet via namnet. Övriga sidor knyts via sin "betalad av"-avsändare. Reglaget ovan lägger till sidor som kör deklarerade politiska annonser som nämner ett parti men saknar avsändare som knyter dem till ett — en grupp som blandar självfinansierade politiker med icke-partianknutna annonsörer.</li>
      <li><strong>Odeklarerade annonser.</strong> Partisidor kör även annonser helt utan politisk redovisning, som saknar kostnadsdata. De räknas men kan inte prissättas.</li>
      <li><strong>Täckning.</strong> Sidor hittas genom att söka efter partinamn i annonstext, så en sida vars annonser aldrig nämner sitt parti är osynlig för det här datat. Partier utan hittade sidor, och partier med avdelningar men utan riksorganisation, listas i rapport-JSON:en.</li>
    </ul>
    <h2>Fotnoter</h2>
    <ol class="footnotes">
      <li id="fn1">EU:s förordning om transparens och riktning av politisk annonsering (TTPA) förbjuder inte politiska annonser i sig — den kräver tydlig märkning, redovisning av avsändare och separat, uttryckligt samtycke för politisk riktning av annonser. Meta meddelade den 25 juli 2025 att man, istället för att bygga om sina system för det samtyckeskravet i sin skala, helt skulle sluta sälja politiska, val- och samhällsfrågerelaterade annonser i EU. Det är alltså Metas eget affärsbeslut som svar på lagen, inte EU som förbjuder annonserna direkt. Källor: <a href="https://about.fb.com/news/2025/07/ending-political-electoral-and-social-issue-advertising-in-the-eu/" target="_blank" rel="noopener">Meta Newsroom, juli 2025</a>, <a href="https://techcrunch.com/2025/07/25/meta-to-stop-selling-political-ads-in-the-eu-from-october" target="_blank" rel="noopener">TechCrunch, juli 2025</a>.</li>
    </ol>
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
  console.log(`  church-election window: ${churchPct}% of declared ads (${fmt(churchWindow)}/${fmt(totalDeclaredSek)}), ${fmt(afterCutoff)} after the Oct 2025 cutoff`);
  console.log(`  verified pages: ${fmt(spikePerMonth)} ads/mo during spike -> ${fmt(strictPerMonthAfter)} ads/mo after; unverified bucket: ${fmt(unverifiedPerMonthAfter)} ads/mo after`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
