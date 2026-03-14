/**
 * Fix video ad detection by querying Meta API v22.0 with media_type=video filter.
 * Updates displayFormat from 'image' to 'video' for matching ads in the database.
 *
 * Usage: npx tsx scripts/fix-video-formats.ts [--brand PAGE_ID]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const token = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (token?.trim()) tokens.push(token.trim());
  }
  if (tokens.length === 0) {
    const single = process.env.FACEBOOK_ACCESS_TOKEN;
    if (single?.trim()) tokens.push(single.trim());
  }
  if (tokens.length === 0) throw new Error('No Facebook access token configured');
  console.log(`Tokens available: ${tokens.length}`);
  return tokens;
}

const tokens = getTokens();
let tokenIndex = 0;

async function fetchVideoAdIds(pageId: string): Promise<string[]> {
  const videoIds: string[] = [];
  let cursor: string | undefined;

  do {
    let lastError = '';
    let success = false;

    // Try each token on failure
    for (let attempt = 0; attempt < tokens.length; attempt++) {
      const token = tokens[(tokenIndex + attempt) % tokens.length];

      const params = new URLSearchParams({
        access_token: token,
        search_page_ids: pageId,
        ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
        ad_type: 'ALL',
        media_type: 'video',
        fields: 'id',
        limit: '100',
      });

      if (cursor) params.set('after', cursor);

      const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
      const data = await response.json();

      if (data.error) {
        lastError = `API Error: ${data.error.message} (code: ${data.error.code})`;
        console.log(`  Token ${(tokenIndex + attempt) % tokens.length + 1} failed, trying next...`);
        await sleep(2000);
        continue;
      }

      // Success - update token index and collect results
      tokenIndex = (tokenIndex + attempt) % tokens.length;
      for (const ad of data.data || []) {
        videoIds.push(ad.id);
      }
      cursor = data.paging?.cursors?.after;
      success = true;
      break;
    }

    if (!success) {
      throw new Error(lastError || 'All tokens failed');
    }

    if (cursor) await sleep(2000);
  } while (cursor);

  return videoIds;
}

async function main() {
  const brandArg = process.argv.find(a => a.startsWith('--brand='));
  const specificPageId = brandArg?.split('=')[1];

  const where = specificPageId
    ? { pageId: specificPageId }
    : { ingestionStatus: { in: ['active', 'completed'] } };

  const brands = await prisma.adLibraryBrand.findMany({ where });

  console.log(`=== Fix Video Formats (API ${API_VERSION}) ===`);
  console.log(`Brands to check: ${brands.length}\n`);

  let totalUpdated = 0;

  for (const brand of brands) {
    console.log(`Checking: ${brand.pageName} (${brand.pageId})`);

    try {
      const videoIds = await fetchVideoAdIds(brand.pageId);
      console.log(`  Found ${videoIds.length} video ads from API`);

      if (videoIds.length === 0) continue;

      const result = await prisma.adLibraryAd.updateMany({
        where: {
          brandId: brand.id,
          adId: { in: videoIds },
          displayFormat: { not: 'video' },
        },
        data: { displayFormat: 'video' },
      });

      console.log(`  ✓ Updated ${result.count} ads to video format`);
      totalUpdated += result.count;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed: ${msg}`);
    }

    await sleep(3000);
  }

  console.log(`\n=== Done: ${totalUpdated} ads updated to video ===`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
