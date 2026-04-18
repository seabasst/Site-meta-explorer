/**
 * Discover new European brands via Meta Ad Library API.
 * Searches for popular advertisers in underrepresented European countries.
 * Outputs a JSON file of brands to review before importing.
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
  if (tokens.length === 0) throw new Error('No Facebook access token found');
  return tokens;
}

const TOKENS = getTokens();
let tokenIdx = 0;
function getToken(): string { return TOKENS[tokenIdx % TOKENS.length]; }
function rotateToken(): void { tokenIdx++; }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface DiscoveredBrand {
  pageId: string;
  pageName: string;
  country: string;
  searchTerm: string;
  adCount: number;
}

// Search terms by category — European D2C, lifestyle, fashion, beauty, food brands
const SEARCH_TERMS: Record<string, string[]> = {
  fashion: [
    'mode', 'fashion', 'kleidung', 'vêtements', 'moda', 'kleding',
    'sustainable fashion', 'streetwear', 'sneakers', 'denim',
  ],
  beauty: [
    'skincare', 'hautpflege', 'soins', 'cosmetici', 'huidverzorging',
    'parfum', 'makeup', 'naturkosmetik', 'clean beauty',
  ],
  food: [
    'bio', 'organic food', 'vegan', 'meal kit', 'kochbox',
    'livraison repas', 'supermarché', 'snacks', 'protein',
  ],
  fitness: [
    'fitness', 'gym', 'sportswear', 'yoga', 'running',
    'activewear', 'home workout', 'supplements',
  ],
  home: [
    'möbel', 'furniture', 'interior design', 'home decor',
    'meubles', 'wohnen', 'candles', 'bedding', 'matelas',
  ],
  tech: [
    'app', 'fintech', 'saas', 'startup',
    'smart home', 'gadgets',
  ],
  travel: [
    'reisen', 'voyage', 'hotel', 'booking',
    'camping', 'outdoor adventure',
  ],
  wellness: [
    'wellness', 'mental health', 'meditation', 'sleep',
    'vitamins', 'cbd', 'self care',
  ],
  pets: [
    'hundefutter', 'dog food', 'cat food', 'pet',
    'nourriture animaux', 'tierbedarf',
  ],
  kids: [
    'baby', 'kids clothing', 'kindermode', 'jouets',
    'speelgoed', 'nursery',
  ],
};

// Target countries with few brands currently
const TARGET_COUNTRIES = [
  'DE', 'FR', 'NL', 'IT', 'ES', 'DK', 'NO', 'FI',
  'BE', 'AT', 'PL', 'PT', 'IE', 'CH',
];

async function searchBrands(searchTerm: string, country: string): Promise<DiscoveredBrand[]> {
  const token = getToken();
  const params = new URLSearchParams({
    access_token: token,
    search_terms: searchTerm,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: 'ACTIVE',
    fields: 'id,page_id,page_name,eu_total_reach',
    limit: '100',
  });

  try {
    const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    if (data.error) {
      if ([2, 4, 17, 613, 80004].includes(data.error.code)) {
        rotateToken();
        return [];
      }
      return [];
    }

    // Group by page_id and count ads
    const pages = new Map<string, { pageId: string; pageName: string; adCount: number }>();
    for (const ad of data.data || []) {
      if (!ad.page_id || !ad.page_name) continue;
      const existing = pages.get(ad.page_id);
      if (existing) {
        existing.adCount++;
      } else {
        pages.set(ad.page_id, { pageId: ad.page_id, pageName: ad.page_name, adCount: 1 });
      }
    }

    return [...pages.values()]
      .filter(p => p.adCount >= 2) // At least 2 ads in results = likely active advertiser
      .map(p => ({
        pageId: p.pageId,
        pageName: p.pageName,
        country,
        searchTerm,
        adCount: p.adCount,
      }));
  } catch {
    return [];
  }
}

async function main() {
  console.log('Discovering European brands via Meta Ad Library API...\n');

  // Get existing page IDs to skip
  const existing = await prisma.adLibraryBrand.findMany({
    select: { pageId: true },
  });
  const existingIds = new Set(existing.map(b => b.pageId));
  console.log(`Existing brands: ${existingIds.size}\n`);

  const allDiscovered = new Map<string, DiscoveredBrand>();
  const categories = Object.entries(SEARCH_TERMS);
  let queries = 0;

  for (const country of TARGET_COUNTRIES) {
    console.log(`\n🔍 ${country}`);

    for (const [category, terms] of categories) {
      for (const term of terms) {
        const brands = await searchBrands(term, country);
        queries++;

        for (const brand of brands) {
          if (existingIds.has(brand.pageId)) continue;
          const key = brand.pageId;
          const existing = allDiscovered.get(key);
          if (existing) {
            existing.adCount = Math.max(existing.adCount, brand.adCount);
          } else {
            allDiscovered.set(key, brand);
          }
        }

        if (queries % 10 === 0) {
          process.stdout.write(`  ${category}/${term} — ${allDiscovered.size} new brands found\r`);
        }

        await sleep(2000); // Rate limit
      }
    }

    console.log(`  ${country}: ${allDiscovered.size} total new brands so far`);
  }

  // Sort by ad count (most active first)
  const sorted = [...allDiscovered.values()].sort((a, b) => b.adCount - a.adCount);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Discovered ${sorted.length} new brands across ${TARGET_COUNTRIES.length} countries`);
  console.log(`${'='.repeat(60)}\n`);

  // Show top brands per country
  for (const country of TARGET_COUNTRIES) {
    const countryBrands = sorted.filter(b => b.country === country);
    if (countryBrands.length === 0) continue;
    console.log(`${country}: ${countryBrands.length} brands`);
    for (const b of countryBrands.slice(0, 5)) {
      console.log(`  ${b.pageName} (${b.adCount} ads)`);
    }
    if (countryBrands.length > 5) console.log(`  +${countryBrands.length - 5} more`);
  }

  // Save to file
  const output = {
    discoveredAt: new Date().toISOString(),
    totalBrands: sorted.length,
    brands: sorted,
  };

  writeFileSync('data/discovered-european-brands.json', JSON.stringify(output, null, 2));
  console.log(`\nSaved to data/discovered-european-brands.json`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
