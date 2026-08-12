/**
 * Brand Discovery Script
 *
 * Searches Meta's Ad Library (ads_archive) by keyword/category and auto-adds
 * the advertisers it finds as new AdLibraryBrand rows with ingestionStatus
 * 'pending'. The daily ingest cron then backfills their ads (and, with the
 * weekly-refresh fix, keeps them current).
 *
 * Run (Node 22.6+ strips TS types natively):
 *   node --env-file=.env.local scripts/discover-brands.ts "activewear" "gym leggings" --category=activewear --pages=5
 *   node --env-file=.env.local scripts/discover-brands.ts "coffee subscription" --dry
 *
 * Flags:
 *   --category=<slug>   category label stored on new brands (default: first term)
 *   --pages=<n>         max API pages per term (default 5, ~100 ads/page)
 *   --countries=DE,GB   override reached-countries (default EU+GB set)
 *   --dry               discover + print, but do not insert
 *
 * Requires: DATABASE_URL and FACEBOOK_ACCESS_TOKEN(S) in the environment.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SEARCH_TERMS } from '../src/lib/discovery-terms';

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';
const DEFAULT_COUNTRIES = ['SE', 'DE', 'FR', 'GB', 'NL', 'IT', 'ES', 'PL', 'DK', 'NO', 'FI', 'BE', 'AT', 'IE', 'PT'];

function loadTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  if (tokens.length === 0 && process.env.FACEBOOK_ACCESS_TOKENS) {
    tokens.push(...process.env.FACEBOOK_ACCESS_TOKENS.split(',').map((t) => t.trim()).filter(Boolean));
  }
  if (tokens.length === 0 && process.env.FACEBOOK_ACCESS_TOKEN?.trim()) {
    tokens.push(process.env.FACEBOOK_ACCESS_TOKEN.trim());
  }
  return tokens;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MetaAd { page_id?: string; page_name?: string; eu_total_reach?: number }
interface Advertiser { pageId: string; pageName: string; maxReach: number; ads: number }

async function searchTerm(
  term: string, tokens: string[], countries: string[], maxPages: number
): Promise<Map<string, Advertiser>> {
  const found = new Map<string, Advertiser>();
  let cursor: string | undefined;
  let tokenIdx = 0;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      access_token: tokens[tokenIdx % tokens.length],
      search_terms: term,
      ad_reached_countries: JSON.stringify(countries),
      ad_type: 'ALL',
      ad_active_status: 'ACTIVE',
      fields: 'page_id,page_name,eu_total_reach',
      limit: '100',
    });
    if (cursor) params.set('after', cursor);

    const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    const data = await res.json();
    if (data.error) {
      // Rotate token on rate-limit / auth errors, else stop this term.
      console.warn(`  ! "${term}" p${page + 1}: ${data.error.message} (code ${data.error.code})`);
      if ([4, 17, 613, 190].includes(data.error.code) && tokenIdx < tokens.length - 1) {
        tokenIdx++; await sleep(2000); continue;
      }
      break;
    }
    for (const ad of (data.data ?? []) as MetaAd[]) {
      if (!ad.page_id || !ad.page_name) continue;
      const prev = found.get(ad.page_id);
      const reach = ad.eu_total_reach ?? 0;
      if (prev) { prev.ads++; prev.maxReach = Math.max(prev.maxReach, reach); }
      else found.set(ad.page_id, { pageId: ad.page_id, pageName: ad.page_name, maxReach: reach, ads: 1 });
    }
    cursor = data.paging?.cursors?.after;
    if (!cursor) break;
    await sleep(1200); // gentle on rate limits
  }
  return found;
}

// reach → priority bucket (higher = processed sooner by the cron)
const priorityFor = (reach: number) => (reach > 5e6 ? 50 : reach > 1e6 ? 40 : reach > 1e5 ? 30 : reach > 1e4 ? 20 : 10);

async function main() {
  const argv = process.argv.slice(2);
  const flags = Object.fromEntries(
    argv.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; })
  );
  // --all sweeps the full shared term list (the daily cron drips a few/day; this drains it now).
  const terms = flags.all === 'true' ? SEARCH_TERMS : argv.filter((a) => !a.startsWith('--'));
  if (terms.length === 0) {
    console.error('Usage: node --env-file=.env.local scripts/discover-brands.ts "<term>" ["<term2>"] [--category=slug] [--pages=5] [--dry]');
    console.error('   or: node --env-file=.env.local scripts/discover-brands.ts --all [--pages=5]   (sweep full shared list)');
    process.exit(1);
  }
  const tokens = loadTokens();
  if (tokens.length === 0) { console.error('No FACEBOOK_ACCESS_TOKEN(S) configured.'); process.exit(1); }

  const category = flags.category ?? (flags.all === 'true' ? 'auto-sweep' : terms[0].toLowerCase().replace(/\s+/g, '-'));
  const maxPages = Number(flags.pages ?? 5);
  const countries = flags.countries ? String(flags.countries).split(',') : DEFAULT_COUNTRIES;
  const dry = flags.dry === 'true';

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  console.log(`Discovering advertisers for: ${terms.map((t) => `"${t}"`).join(', ')}`);
  console.log(`  category=${category} pages=${maxPages} countries=${countries.length} tokens=${tokens.length}${dry ? ' [DRY RUN]' : ''}\n`);

  // 1) Search every term, merge advertisers.
  const advertisers = new Map<string, Advertiser>();
  for (const term of terms) {
    const found = await searchTerm(term, tokens, countries, maxPages);
    for (const [id, a] of found) {
      const prev = advertisers.get(id);
      if (prev) { prev.ads += a.ads; prev.maxReach = Math.max(prev.maxReach, a.maxReach); }
      else advertisers.set(id, a);
    }
    console.log(`  "${term}" → ${found.size} advertisers`);
  }
  console.log(`\nTotal distinct advertisers discovered: ${advertisers.size}`);

  // 2) Skip ones we already track.
  const ids = [...advertisers.keys()];
  const existing = new Set(
    (await prisma.adLibraryBrand.findMany({ where: { pageId: { in: ids } }, select: { pageId: true } })).map((b) => b.pageId)
  );
  const fresh = [...advertisers.values()].filter((a) => !existing.has(a.pageId)).sort((a, b) => b.maxReach - a.maxReach);
  console.log(`Already tracked: ${existing.size} · New to add: ${fresh.length}\n`);

  fresh.slice(0, 20).forEach((a) => console.log(`  + ${a.pageName}  (reach≈${(a.maxReach / 1e6).toFixed(2)}M, ${a.ads} ads seen)`));
  if (fresh.length > 20) console.log(`  … and ${fresh.length - 20} more`);

  // 3) Insert as pending — the ingest cron takes it from here.
  if (!dry && fresh.length > 0) {
    const result = await prisma.adLibraryBrand.createMany({
      data: fresh.map((a) => ({
        pageId: a.pageId,
        pageName: a.pageName,
        category,
        ingestionStatus: 'pending',
        priority: priorityFor(a.maxReach),
        totalReach: BigInt(Math.round(a.maxReach)),
        requestedAt: new Date(),
        requestNote: flags.all === 'true' ? 'Discovered via full-list sweep' : `Discovered via search: ${terms.join(', ')}`,
      })),
      skipDuplicates: true,
    });
    console.log(`\n✓ Inserted ${result.count} new brands (ingestionStatus='pending'). The daily cron will backfill them.`);
  } else if (dry) {
    console.log(`\n[DRY RUN] Would insert ${fresh.length} brands. Re-run without --dry to apply.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Discovery failed:', e); process.exit(1); });
