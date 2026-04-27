/**
 * Import expanded brand list from new-brands-expansion.json.
 * Resolves Facebook page IDs via Graph API search, then upserts into database.
 *
 * Usage: npx tsx scripts/import-expansion-brands.ts [--dry-run] [--limit N]
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

// Collect all available tokens
function getTokens(): string[] {
  const tokens: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
    if (t?.trim()) tokens.push(t.trim());
  }
  const csv = process.env.FACEBOOK_ACCESS_TOKENS;
  if (csv) {
    for (const t of csv.split(',')) {
      if (t.trim()) tokens.push(t.trim());
    }
  }
  const single = process.env.FACEBOOK_ACCESS_TOKEN;
  if (single?.trim() && !tokens.includes(single.trim())) tokens.push(single.trim());
  if (tokens.length === 0) throw new Error('No Facebook access token found');
  return tokens;
}

const TOKENS = getTokens();
let tokenIdx = 0;
function getToken(): string {
  return TOKENS[tokenIdx % TOKENS.length];
}
function rotateToken(): void {
  tokenIdx++;
  console.log(`  ↻ Rotated to token ${(tokenIdx % TOKENS.length) + 1}/${TOKENS.length}`);
}

interface BrandEntry {
  name: string;
  website: string;
  country: string;
  category: string;
  page_id?: string;
}

async function resolvePageId(brandName: string): Promise<{ pageId: string; pageName: string } | null> {
  const url = new URL(`${BASE_URL}/${API_VERSION}/ads_archive`);
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('search_terms', brandName);
  url.searchParams.set('ad_reached_countries', '["NL","GB","DE","FR","US"]');
  url.searchParams.set('ad_type', 'ALL');
  url.searchParams.set('limit', '25');
  url.searchParams.set('fields', 'page_id,page_name');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const code = err.error?.code;
      // Rate limit — rotate token and retry once
      if (code === 4 || code === 17 || code === 613 || code === 80004) {
        rotateToken();
        await sleep(5000);
        return resolvePageId(brandName);
      }
      console.error(`  API error for "${brandName}":`, err.error?.message || res.status);
      return null;
    }
    const data = await res.json();
    if (!data.data?.length) return null;

    const nameNorm = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Deduplicate by page_id and find best match
    const seen = new Map<string, { page_id: string; page_name: string }>();
    for (const d of data.data) {
      if (!seen.has(d.page_id)) seen.set(d.page_id, d);
    }

    // Reject pages whose names contain no Latin characters (wrong language match)
    const hasLatin = (s: string) => /[a-zA-Z]/.test(s);

    for (const [, d] of seen) {
      if (!hasLatin(d.page_name || '')) continue;
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === nameNorm || n === nameNorm + 'official' || n === nameNorm + 'com' ||
          (nameNorm.length >= 4 && n.startsWith(nameNorm)) ||
          (nameNorm.length >= 4 && nameNorm.startsWith(n) && n.length >= nameNorm.length - 2)) {
        return { pageId: d.page_id, pageName: d.page_name };
      }
    }

    // Looser match: check if brand name appears as substring of page name
    for (const [, d] of seen) {
      if (!hasLatin(d.page_name || '')) continue;
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n.includes(nameNorm) || nameNorm.includes(n)) {
        return { pageId: d.page_id, pageName: d.page_name };
      }
    }

    return null;
  } catch (err: any) {
    console.error(`  Network error for "${brandName}":`, err.message);
    return null;
  }
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('fashion') || lower.includes('apparel') || lower.includes('clothing') ||
      lower.includes('streetwear') || lower.includes('lingerie') || lower.includes('underwear')) return 'fashion';
  if (lower.includes('beauty') || lower.includes('skincare') || lower.includes('cosmetic') ||
      lower.includes('makeup') || lower.includes('hair care')) return 'beauty';
  if (lower.includes('food') || lower.includes('nutrition') || lower.includes('coffee') ||
      lower.includes('beverage') || lower.includes('drink') || lower.includes('snack') ||
      lower.includes('meal') || lower.includes('cereal') || lower.includes('superfood')) return 'food_and_beverage';
  if (lower.includes('fitness') || lower.includes('sport') || lower.includes('wellness') ||
      lower.includes('activewear') || lower.includes('running') || lower.includes('cycling')) return 'fitness';
  if (lower.includes('tech') || lower.includes('electronic') || lower.includes('phone')) return 'tech';
  if (lower.includes('health') || lower.includes('supplement') || lower.includes('probiotic') ||
      lower.includes('grooming')) return 'health';
  if (lower.includes('home') || lower.includes('furniture') || lower.includes('decor') ||
      lower.includes('bedding') || lower.includes('mattress') || lower.includes('art') || lower.includes('poster')) return 'home';
  if (lower.includes('travel') || lower.includes('luggage')) return 'travel';
  if (lower.includes('pet')) return 'pets';
  if (lower.includes('baby') || lower.includes('kid') || lower.includes('child')) return 'kids';
  if (lower.includes('flower') || lower.includes('gift')) return 'gifts';
  if (lower.includes('jewel') || lower.includes('watch') || lower.includes('accessor') ||
      lower.includes('eyewear') || lower.includes('footwear') || lower.includes('shoe') ||
      lower.includes('sneaker')) return 'accessories';
  if (lower.includes('marketplace') || lower.includes('resale')) return 'fashion';
  return 'other';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  const filePath = join(process.cwd(), 'new-brands-expansion.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const brands: BrandEntry[] = raw.brands;

  console.log(`Loaded ${brands.length} brands from expansion list`);
  console.log(`Available tokens: ${TOKENS.length}`);
  if (dryRun) console.log('DRY RUN — no database writes\n');

  const toProcess = brands.slice(0, limit);
  let created = 0, skipped = 0, failed = 0, alreadyExists = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const brand = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] ${brand.name} (${brand.country})`);

    let pageId = brand.page_id;
    let pageName = brand.name;

    if (!pageId) {
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
      await sleep(300);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${pageName} (${pageId})`);
      created++;
      await sleep(500);
      continue;
    }

    const category = mapCategory(brand.category);

    await prisma.adLibraryBrand.create({
      data: {
        pageId,
        pageName,
        category,
        country: brand.country,
        website: brand.website,
        ingestionStatus: 'pending',
        priority: 3, // Higher priority for new expansion brands
      },
    });

    console.log(`  ✓ Created: ${pageName} (${pageId}) [${category}]`);
    created++;

    await sleep(1500);
  }

  console.log('\n=== Summary ===');
  console.log(`Created: ${created}`);
  console.log(`Already existed: ${alreadyExists}`);
  console.log(`Failed to resolve: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  await prisma.$disconnect();
}

main().catch(console.error);
