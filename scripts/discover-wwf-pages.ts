/**
 * Discover all WWF-related pages from the Meta Ad Library API.
 * Searches for "WWF" and "World Wildlife Fund", collects unique page IDs,
 * and adds new ones to the database.
 *
 * Usage: npx tsx scripts/discover-wwf-pages.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getToken(): string {
  for (let i = 1; i <= 10; i++) {
    const token = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (token?.trim()) return token.trim();
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim()) return single.trim();
  throw new Error('No Facebook access token configured');
}

interface PageInfo {
  pageId: string;
  pageName: string;
}

async function searchPages(searchTerm: string, country: string): Promise<PageInfo[]> {
  const token = getToken();
  const pages = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      access_token: token,
      search_terms: searchTerm,
      ad_reached_countries: JSON.stringify([country]),
      ad_type: 'ALL',
      fields: 'page_id,page_name',
      limit: '100',
    });

    if (cursor) params.set('after', cursor);

    const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    const data = await response.json();

    if (data.error) {
      console.log(`  API error for "${searchTerm}" in ${country}: ${data.error.message}`);
      break;
    }

    for (const ad of data.data || []) {
      if (ad.page_id && ad.page_name) {
        const name = ad.page_name.toLowerCase();
        if (name.includes('wwf') || name.includes('world wildlife') || name.includes('världsnaturfonden')) {
          pages.set(ad.page_id, ad.page_name);
        }
      }
    }

    cursor = data.paging?.cursors?.after;
    if (cursor) await sleep(2000);
  } while (cursor);

  return Array.from(pages.entries()).map(([pageId, pageName]) => ({ pageId, pageName }));
}

async function main() {
  console.log('=== Discover WWF Pages ===\n');

  const allPages = new Map<string, string>();

  const searches = [
    { term: 'WWF', countries: ['US', 'GB', 'SE', 'DE', 'FR', 'AU', 'CA', 'IN', 'NL', 'NO', 'DK'] },
    { term: 'World Wildlife Fund', countries: ['US', 'GB', 'AU', 'CA'] },
    { term: 'Världsnaturfonden', countries: ['SE'] },
  ];

  for (const search of searches) {
    for (const country of search.countries) {
      console.log(`Searching "${search.term}" in ${country}...`);
      const pages = await searchPages(search.term, country);
      for (const p of pages) {
        if (!allPages.has(p.pageId)) {
          allPages.set(p.pageId, p.pageName);
          console.log(`  Found: ${p.pageName} (${p.pageId})`);
        }
      }
      await sleep(2000);
    }
  }

  console.log(`\nTotal unique WWF pages found: ${allPages.size}`);

  // Add to database
  let added = 0;
  for (const [pageId, pageName] of allPages) {
    const existing = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
    if (!existing) {
      await prisma.adLibraryBrand.create({
        data: {
          pageId,
          pageName,
          category: 'Non-Profit',
          ingestionStatus: 'pending',
          priority: 10,
        },
      });
      console.log(`  Added: ${pageName} (${pageId})`);
      added++;
    } else {
      console.log(`  Already exists: ${pageName} (${pageId})`);
    }
  }

  console.log(`\nDone: ${added} new pages added to database`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
