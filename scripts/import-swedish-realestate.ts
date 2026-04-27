/**
 * Import Swedish real estate agencies from swedish-realestate-agencies.json
 * Resolves Facebook page IDs via Meta Ad Library API search, then upserts into database.
 *
 * Usage:
 *   npx tsx scripts/import-swedish-realestate.ts                # Full run
 *   npx tsx scripts/import-swedish-realestate.ts --dry-run      # Preview without saving
 *   npx tsx scripts/import-swedish-realestate.ts --limit 10     # Process first N only
 *   npx tsx scripts/import-swedish-realestate.ts --known-only   # Only add the 3 known page IDs
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
const CATEGORY = 'real-estate';

// Token management
function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  const csv = process.env.FACEBOOK_ACCESS_TOKENS;
  if (csv) {
    for (const t of csv.split(',')) {
      if (t.trim() && !tokens.includes(t.trim())) tokens.push(t.trim());
    }
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim() && !tokens.includes(single.trim())) tokens.push(single.trim());
  if (tokens.length === 0) throw new Error('No Facebook access token found');
  return tokens;
}

const TOKENS = getTokens();
let tokenIdx = 0;
function getToken(): string { return TOKENS[tokenIdx % TOKENS.length]; }
function rotateToken(): void {
  tokenIdx++;
  console.log(`  ↻ Rotated to token ${(tokenIdx % TOKENS.length) + 1}/${TOKENS.length}`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface BrandEntry {
  name: string;
  type: string;
  city: string | null;
  region: string | null;
  parent_brand: string | null;
  category: string;
}

// Known page IDs from the user
const KNOWN_PAGES: Record<string, string> = {
  '213631731981508': 'Erik Olsson Fastighetsförmedling',
  '130022160902': 'Fastighetsbyrån',
  '144901165573093': 'Fastighetsbyrån',
};

async function resolvePageId(
  brandName: string,
  retries = 0
): Promise<{ pageId: string; pageName: string } | null> {
  const token = getToken();
  const params = new URLSearchParams({
    access_token: token,
    search_terms: brandName,
    ad_reached_countries: '["SE"]',
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    fields: 'page_id,page_name',
    limit: '5',
  });

  try {
    const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    const data = await res.json();

    if (data.error) {
      const rateLimitCodes = [2, 4, 17, 613, 80004];
      if (rateLimitCodes.includes(data.error.code) && retries < 3) {
        rotateToken();
        if (retries >= 1) {
          console.log(`    Waiting ${30 * (retries + 1)}s...`);
          await sleep(30000 * (retries + 1));
        }
        return resolvePageId(brandName, retries + 1);
      }
      console.log(`    API error for "${brandName}": ${data.error.message}`);
      return null;
    }

    if (!data.data?.length) return null;

    // Try exact match first
    const exactMatch = data.data.find(
      (d: any) => d.page_name?.toLowerCase() === brandName.toLowerCase()
    );
    if (exactMatch) return { pageId: exactMatch.page_id, pageName: exactMatch.page_name };

    // Try starts-with match
    const startsMatch = data.data.find(
      (d: any) => d.page_name?.toLowerCase().startsWith(brandName.toLowerCase().split(' ')[0])
    );
    if (startsMatch) return { pageId: startsMatch.page_id, pageName: startsMatch.page_name };

    // Return first result as fallback but flag it
    const first = data.data[0];
    console.log(`    Fuzzy match: "${brandName}" → "${first.page_name}" (${first.page_id})`);
    return { pageId: first.page_id, pageName: first.page_name };
  } catch (e) {
    console.log(`    Fetch error for "${brandName}": ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const knownOnly = args.includes('--known-only');
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg) : undefined;

  console.log('═'.repeat(60));
  console.log('Swedish Real Estate Agency Import');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Tokens: ${TOKENS.length}`);
  console.log(`Category: ${CATEGORY}`);

  let resolved = 0, added = 0, skipped = 0, failed = 0;

  // Step 1: Add the 3 known page IDs first
  console.log('\n── Known Pages ──');
  for (const [pageId, pageName] of Object.entries(KNOWN_PAGES)) {
    const existing = await prisma.adLibraryBrand.findFirst({ where: { pageId } });
    if (existing) {
      console.log(`  ✓ ${pageName} (${pageId}) — already exists`);
      // Update category if needed
      if (existing.category !== CATEGORY && !dryRun) {
        await prisma.adLibraryBrand.update({
          where: { id: existing.id },
          data: { category: CATEGORY },
        });
        console.log(`    Updated category to ${CATEGORY}`);
      }
      skipped++;
    } else if (!dryRun) {
      await prisma.adLibraryBrand.create({
        data: {
          pageId,
          pageName,
          category: CATEGORY,
          country: 'SE',
          ingestionStatus: 'pending',
          priority: 5,
        },
      });
      console.log(`  + ${pageName} (${pageId}) — added`);
      added++;
    } else {
      console.log(`  [DRY] Would add ${pageName} (${pageId})`);
      added++;
    }
  }

  if (knownOnly) {
    console.log(`\nDone (known-only mode). Added: ${added}, Skipped: ${skipped}`);
    await prisma.$disconnect();
    return;
  }

  // Step 2: Load and resolve brands from JSON
  const jsonPath = join(process.cwd(), 'swedish-realestate-agencies.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  let brands: BrandEntry[] = data.brands;

  if (limit) brands = brands.slice(0, limit);

  console.log(`\n── Resolving ${brands.length} brands via Meta API ──\n`);

  const seenPageIds = new Set(Object.keys(KNOWN_PAGES));

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const label = `[${i + 1}/${brands.length}]`;

    // Check if already in DB by name
    const existingByName = await prisma.adLibraryBrand.findFirst({
      where: { pageName: { equals: brand.name, mode: 'insensitive' } },
    });
    if (existingByName) {
      // Update category
      if (existingByName.category !== CATEGORY && !dryRun) {
        await prisma.adLibraryBrand.update({
          where: { id: existingByName.id },
          data: { category: CATEGORY },
        });
      }
      console.log(`${label} ${brand.name} — already in DB (${existingByName.pageId})`);
      skipped++;
      continue;
    }

    // Resolve via API
    const result = await resolvePageId(brand.name);
    await sleep(1500); // Rate limit between searches

    if (!result) {
      console.log(`${label} ${brand.name} — not found on Meta`);
      failed++;
      continue;
    }

    resolved++;

    // Skip duplicates
    if (seenPageIds.has(result.pageId)) {
      console.log(`${label} ${brand.name} → ${result.pageName} (${result.pageId}) — duplicate, skipping`);
      skipped++;
      continue;
    }
    seenPageIds.add(result.pageId);

    // Check if pageId already in DB
    const existingByPageId = await prisma.adLibraryBrand.findFirst({ where: { pageId: result.pageId } });
    if (existingByPageId) {
      if (existingByPageId.category !== CATEGORY && !dryRun) {
        await prisma.adLibraryBrand.update({
          where: { id: existingByPageId.id },
          data: { category: CATEGORY },
        });
      }
      console.log(`${label} ${brand.name} → ${result.pageName} (${result.pageId}) — already in DB`);
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.adLibraryBrand.create({
        data: {
          pageId: result.pageId,
          pageName: result.pageName,
          category: CATEGORY,
          country: 'SE',
          ingestionStatus: 'pending',
          priority: 5,
        },
      });
    }
    console.log(`${label} + ${result.pageName} (${result.pageId})`);
    added++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Resolved: ${resolved}`);
  console.log(`Added: ${added}`);
  console.log(`Skipped (already in DB): ${skipped}`);
  console.log(`Not found: ${failed}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
