/**
 * Import European D2C brands from JSON file.
 * Resolves Facebook page IDs via Graph API search, then upserts into database.
 *
 * Usage: npx tsx scripts/import-european-d2c.ts [--dry-run] [--limit N]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

// Get token
function getToken(): string {
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) return t.trim();
  }
  const t = process.env.FACEBOOK_ACCESS_TOKEN;
  if (t?.trim()) return t.trim();
  throw new Error('No Facebook access token found');
}

const TOKEN = getToken();

interface BrandEntry {
  name: string;
  website: string;
  country: string;
  category: string;
  facebook_ad_library: string;
  page_id?: string;
}

/**
 * Resolve a brand name to a numeric Facebook page ID.
 * Uses Ad Library search and only accepts results where page_name closely matches.
 */
async function resolvePageId(brandName: string): Promise<{ pageId: string; pageName: string } | null> {
  // Search Ad Library for this brand — use page_name field matching
  const url = new URL(`${BASE_URL}/${API_VERSION}/ads_archive`);
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('search_terms', brandName);
  url.searchParams.set('ad_reached_countries', '["NL","GB","DE","FR","US"]');
  url.searchParams.set('ad_type', 'ALL');
  url.searchParams.set('limit', '25');
  url.searchParams.set('fields', 'page_id,page_name');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`  API error for "${brandName}":`, err.error?.message || res.status);
      return null;
    }
    const data = await res.json();
    if (!data.data?.length) return null;

    // Strict matching: normalize and compare
    const nameNorm = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Deduplicate by page_id and find best match
    const seen = new Map<string, { page_id: string; page_name: string }>();
    for (const d of data.data) {
      if (!seen.has(d.page_id)) seen.set(d.page_id, d);
    }

    for (const [, d] of seen) {
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      // Exact match or very close match only
      if (n === nameNorm || n === nameNorm + 'official' || n === nameNorm + 'com' ||
          (nameNorm.length >= 4 && n.startsWith(nameNorm)) ||
          (nameNorm.length >= 4 && nameNorm.startsWith(n) && n.length >= nameNorm.length - 2)) {
        return { pageId: d.page_id, pageName: d.page_name };
      }
    }

    // No close match found
    return null;
  } catch (err: any) {
    console.error(`  Network error for "${brandName}":`, err.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  // Load brands JSON
  const filePath = join(process.cwd(), 'european-d2c-brands-with-page-ids.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const brands: BrandEntry[] = raw.brands;

  console.log(`Loaded ${brands.length} brands from JSON`);
  if (dryRun) console.log('DRY RUN — no database writes\n');

  const toProcess = brands.slice(0, limit);
  let created = 0, skipped = 0, failed = 0, alreadyExists = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const brand = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${brand.name} (${brand.country})`);

    // Check if brand already has a page_id in the JSON
    let pageId = brand.page_id;
    let pageName = brand.name;

    if (!pageId) {
      // Resolve via API
      const resolved = await resolvePageId(brand.name);
      if (!resolved) {
        console.log(`  ✗ Could not resolve page ID`);
        failed++;
        await sleep(1000);
        continue;
      }
      pageId = resolved.pageId;
      pageName = resolved.pageName;
      console.log(`  → Resolved: ${pageName} (${pageId})`);
    }

    // Check if already in DB
    const existing = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
    });

    if (existing) {
      console.log(`  ⊘ Already exists: ${existing.pageName}`);
      alreadyExists++;
      await sleep(500);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${pageName} (${pageId})`);
      created++;
      await sleep(500);
      continue;
    }

    // Map category
    const category = mapCategory(brand.category);

    // Create brand
    await prisma.adLibraryBrand.create({
      data: {
        pageId,
        pageName,
        category,
        country: brand.country,
        website: brand.website,
        ingestionStatus: 'pending',
        priority: 2,
      },
    });

    console.log(`  ✓ Created: ${pageName} (${pageId}) [${category}]`);
    created++;

    // Rate limit: 1.5s between API calls
    await sleep(1500);
  }

  console.log('\n=== Summary ===');
  console.log(`Created: ${created}`);
  console.log(`Already existed: ${alreadyExists}`);
  console.log(`Failed to resolve: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  await prisma.$disconnect();
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('fashion') || lower.includes('apparel') || lower.includes('clothing')) return 'fashion';
  if (lower.includes('beauty') || lower.includes('skincare') || lower.includes('cosmetic')) return 'beauty';
  if (lower.includes('food') || lower.includes('nutrition') || lower.includes('coffee') || lower.includes('beverage')) return 'food_and_beverage';
  if (lower.includes('fitness') || lower.includes('sport') || lower.includes('wellness')) return 'fitness';
  if (lower.includes('tech') || lower.includes('electronic')) return 'tech';
  if (lower.includes('health')) return 'health';
  if (lower.includes('home') || lower.includes('furniture') || lower.includes('decor')) return 'home';
  if (lower.includes('travel') || lower.includes('luggage')) return 'travel';
  if (lower.includes('pet')) return 'pets';
  if (lower.includes('baby') || lower.includes('kid') || lower.includes('child')) return 'kids';
  if (lower.includes('flower') || lower.includes('gift')) return 'gifts';
  if (lower.includes('jewel') || lower.includes('watch') || lower.includes('accessor')) return 'accessories';
  return 'other';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
