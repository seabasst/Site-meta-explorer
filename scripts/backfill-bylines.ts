/**
 * Backfill bylines (partnership ads) for all active brands.
 * Lightweight pass — only fetches id + bylines from Meta API,
 * then updates the bylines column for matching ads.
 *
 * Usage:
 *   npx tsx scripts/backfill-bylines.ts
 *   npx tsx scripts/backfill-bylines.ts --limit 10
 *   npx tsx scripts/backfill-bylines.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

// Token management
function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim() && !tokens.includes(single.trim())) tokens.push(single.trim());
  if (tokens.length === 0) throw new Error('No Facebook access token found');
  return tokens;
}

const TOKENS = getTokens();
let tokenIdx = 0;
function getToken(): string { return TOKENS[tokenIdx % TOKENS.length]; }
function rotateToken(): void { tokenIdx++; }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const TARGET_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
  'US', 'CA', 'MX',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'TW', 'IN', 'PH', 'MY', 'ID', 'TH', 'VN',
  'AE', 'SA', 'IL',
  'BR', 'AR', 'CO', 'CL',
  'ZA', 'NG', 'EG',
];

const MAX_PAGES_PER_BRAND = 20; // Cap at ~2000 ads per brand to avoid hanging
const FETCH_TIMEOUT = 15000; // 15s timeout per request

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBylinesForBrand(
  pageId: string,
  retryCount = 0,
): Promise<Map<string, string>> {
  const bylinesMap = new Map<string, string>();
  let cursor: string | undefined;
  let pages = 0;

  do {
    const token = getToken();
    const params = new URLSearchParams({
      access_token: token,
      search_page_ids: pageId,
      ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
      ad_type: 'ALL',
      ad_active_status: 'ACTIVE',
      fields: 'id,bylines',
      limit: '100',
    });
    if (cursor) params.set('after', cursor);

    const res = await fetchWithTimeout(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, FETCH_TIMEOUT);
    const data = await res.json();

    if (data.error) {
      const rateLimitCodes = [2, 4, 17, 613, 80004];
      if (rateLimitCodes.includes(data.error.code) && retryCount < 3) {
        rotateToken();
        const wait = 15000 * (retryCount + 1);
        console.log(`    Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        return fetchBylinesForBrand(pageId, retryCount + 1);
      }
      throw new Error(`API error: ${data.error.message} (code: ${data.error.code})`);
    }

    for (const ad of data.data || []) {
      if (ad.bylines) {
        bylinesMap.set(ad.id, ad.bylines);
      }
    }

    pages++;
    cursor = data.paging?.cursors?.after;
    if (cursor && pages < MAX_PAGES_PER_BRAND) await sleep(500);
  } while (cursor && pages < MAX_PAGES_PER_BRAND);

  return bylinesMap;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg) : undefined;

  console.log('═'.repeat(60));
  console.log('Bylines Backfill');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Tokens: ${TOKENS.length}`);

  const brands = await prisma.adLibraryBrand.findMany({
    where: { ingestionStatus: 'active' },
    orderBy: { activeAdCount: 'desc' },
    take: limit,
  });

  console.log(`Brands to process: ${brands.length}\n`);

  let totalUpdated = 0;
  let totalPartnership = 0;

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const label = `[${i + 1}/${brands.length}]`;

    try {
      const bylinesMap = await fetchBylinesForBrand(brand.pageId);

      if (bylinesMap.size === 0) {
        console.log(`${label} ${brand.pageName} — no partnership ads`);
      } else {
        totalPartnership += bylinesMap.size;
        let updated = 0;

        if (!dryRun) {
          // Batch update in chunks of 50
          const entries = Array.from(bylinesMap.entries());
          for (let j = 0; j < entries.length; j += 50) {
            const chunk = entries.slice(j, j + 50);
            const results = await Promise.all(
              chunk.map(([adId, bylines]) =>
                prisma.adLibraryAd.updateMany({
                  where: { adId },
                  data: { bylines },
                }).then(r => r.count)
              )
            );
            updated += results.reduce((a, b) => a + b, 0);
          }
        }

        totalUpdated += updated;
        console.log(`${label} ${brand.pageName} — ${bylinesMap.size} partnership ads found, ${updated} updated`);
      }
    } catch (e) {
      console.log(`${label} ${brand.pageName} — ERROR: ${e instanceof Error ? e.message : e}`);
    }

    // Brief pause between brands
    if (i < brands.length - 1) await sleep(2000);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Partnership ads found: ${totalPartnership}`);
  console.log(`Database rows updated: ${totalUpdated}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
