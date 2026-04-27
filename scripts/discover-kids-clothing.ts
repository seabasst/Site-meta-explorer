/**
 * Discover kids clothing brands in Europe with 50+ active Facebook ads.
 * One-off script. Writes results to data/discovered-kids-clothing.json.
 */
import { config } from 'dotenv'; config({ path: '.env.local' });
import { writeFileSync } from 'fs';
import { prisma } from '../src/lib/prisma';

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim() && !tokens.includes(single.trim())) tokens.push(single.trim());
  if (!tokens.length) throw new Error('No Facebook access token found');
  return tokens;
}
const TOKENS = getTokens();
let tokIdx = 0;
const nextToken = () => TOKENS[tokIdx++ % TOKENS.length];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Kid/baby clothing search terms in EU languages
const SEARCH_TERMS = [
  'kids clothing', 'children clothing', 'baby clothes',
  'kindermode', 'babykleidung', 'kinderkleidung',
  'vêtements enfants', 'vêtements bébé', 'mode enfant',
  'ropa niños', 'ropa infantil', 'ropa bebé',
  'abbigliamento bambini', 'moda bambini',
  'kinderkleding', 'babykleding',
  'barnkläder', 'barnmode', 'børnetøj',
  'odzież dziecięca',
  'roupa infantil', 'roupa bebê',
];

const EU_COUNTRIES = [
  'GB', 'DE', 'FR', 'NL', 'IT', 'ES', 'SE', 'DK', 'NO', 'FI',
  'BE', 'AT', 'PL', 'PT', 'IE', 'CH', 'CZ',
];

interface Candidate {
  pageId: string;
  pageName: string;
  countries: Set<string>;
  searchTerms: Set<string>;
  hits: number;
}

async function search(term: string, country: string): Promise<Array<{ pageId: string; pageName: string }>> {
  const params = new URLSearchParams({
    access_token: nextToken(),
    search_terms: term,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: 'ACTIVE',
    fields: 'page_id,page_name',
    limit: '100',
  });
  try {
    const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.error) return [];
    return (data.data || [])
      .filter((a: any) => a.page_id && a.page_name)
      .map((a: any) => ({ pageId: a.page_id, pageName: a.page_name }));
  } catch {
    return [];
  }
}

// Count active ads for a single page. Early-exits once >=50 confirmed, or probes ~3 pages.
// Tries per-country (best coverage on FB API); returns max across representative countries.
async function countActiveAds(pageId: string, minThreshold: number): Promise<{ count: number; country: string }> {
  const probeCountries = ['GB', 'DE', 'FR', 'NL', 'IT', 'ES', 'SE', 'DK', 'PL', 'PT'];
  let best = { count: 0, country: 'ALL' };
  for (const country of probeCountries) {
    let total = 0;
    let after: string | undefined;
    for (let p = 0; p < 3; p++) {
      const params = new URLSearchParams({
        access_token: nextToken(),
        search_page_ids: JSON.stringify([pageId]),
        ad_reached_countries: JSON.stringify([country]),
        ad_active_status: 'ACTIVE',
        fields: 'id',
        limit: '100',
      });
      if (after) params.set('after', after);
      try {
        const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, {
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        if (data.error) break;
        total += (data.data || []).length;
        after = data.paging?.cursors?.after;
        if (!data.paging?.next || !after) break;
        if (total >= minThreshold) break; // early exit once threshold hit
        await sleep(250);
      } catch { break; }
    }
    if (total > best.count) best = { count: total, country };
    if (best.count >= minThreshold) return best; // good enough
    await sleep(150);
  }
  return best;
}

async function main() {
  console.log(`Searching ${SEARCH_TERMS.length} terms × ${EU_COUNTRIES.length} countries…`);

  const candidates = new Map<string, Candidate>();

  for (const country of EU_COUNTRIES) {
    for (const term of SEARCH_TERMS) {
      const hits = await search(term, country);
      for (const h of hits) {
        const c = candidates.get(h.pageId);
        if (c) {
          c.countries.add(country);
          c.searchTerms.add(term);
          c.hits++;
        } else {
          candidates.set(h.pageId, {
            pageId: h.pageId,
            pageName: h.pageName,
            countries: new Set([country]),
            searchTerms: new Set([term]),
            hits: 1,
          });
        }
      }
      await sleep(350);
    }
    console.log(`  ${country}: ${candidates.size} unique candidates so far`);
  }

  // Skip brands already in DB
  const existing = await prisma.adLibraryBrand.findMany({ select: { pageId: true } });
  const existingIds = new Set(existing.map(b => b.pageId));
  const toCheck = [...candidates.values()]
    .filter(c => !existingIds.has(c.pageId))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 150); // check top 150 by hit frequency

  console.log(`\n${candidates.size} unique candidates; verifying top ${toCheck.length} (excluding ${existing.length} already in DB)…\n`);

  const verified: Array<Candidate & { adCount: number; topCountry: string }> = [];
  for (const c of toCheck) {
    const { count, country } = await countActiveAds(c.pageId, 50);
    console.log(`  ${c.pageName.padEnd(35).slice(0, 35)} ${c.pageId.padEnd(18)} ads=${count}/${country}  [${[...c.countries].join(',')}]`);
    if (count >= 50) verified.push({ ...c, adCount: count, topCountry: country });
    if (verified.length >= 25) break;
    await sleep(200);
  }

  verified.sort((a, b) => b.adCount - a.adCount);
  const top20 = verified.slice(0, 20);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOP ${top20.length} KIDS CLOTHING BRANDS (50+ active ads, EU)`);
  console.log(`${'='.repeat(70)}`);
  for (const b of top20) {
    console.log(`  ${b.adCount.toString().padStart(4)} ads  ${b.pageName.padEnd(35).slice(0, 35)}  pageId=${b.pageId}  [${[...b.countries].join(',')}]`);
  }

  writeFileSync('data/discovered-kids-clothing.json', JSON.stringify({
    discoveredAt: new Date().toISOString(),
    brands: top20.map(b => ({
      pageId: b.pageId,
      pageName: b.pageName,
      adCount: b.adCount,
      countries: [...b.countries],
      matchedTerms: [...b.searchTerms],
    })),
    allVerified: verified.map(b => ({
      pageId: b.pageId,
      pageName: b.pageName,
      adCount: b.adCount,
      countries: [...b.countries],
    })),
  }, null, 2));

  console.log(`\nSaved to data/discovered-kids-clothing.json`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
