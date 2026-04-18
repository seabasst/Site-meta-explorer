/**
 * Import Swedish brands expansion list.
 * Usage: npx tsx scripts/import-swedish-brands.ts [--dry-run] [--limit N]
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

interface BrandEntry {
  name: string;
  website: string;
  country: string;
  category: string;
  page_id?: string;
}

const hasLatin = (s: string) => /[a-zA-Z]/.test(s);

async function resolvePageId(brandName: string): Promise<{ pageId: string; pageName: string } | null> {
  const url = new URL(`${BASE_URL}/${API_VERSION}/ads_archive`);
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('search_terms', brandName);
  url.searchParams.set('ad_reached_countries', '["SE","NL","GB","DE","FR","US"]');
  url.searchParams.set('ad_type', 'ALL');
  url.searchParams.set('limit', '25');
  url.searchParams.set('fields', 'page_id,page_name');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const code = err.error?.code;
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

    const seen = new Map<string, { page_id: string; page_name: string }>();
    for (const d of data.data) {
      if (!seen.has(d.page_id)) seen.set(d.page_id, d);
    }

    // Strict match
    for (const [, d] of seen) {
      if (!hasLatin(d.page_name || '')) continue;
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === nameNorm || n === nameNorm + 'official' || n === nameNorm + 'com' ||
          n === nameNorm + 'se' || n === nameNorm + 'sweden' ||
          (nameNorm.length >= 4 && n.startsWith(nameNorm)) ||
          (nameNorm.length >= 4 && nameNorm.startsWith(n) && n.length >= nameNorm.length - 2)) {
        return { pageId: d.page_id, pageName: d.page_name };
      }
    }

    // Looser: substring match
    for (const [, d] of seen) {
      if (!hasLatin(d.page_name || '')) continue;
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nameNorm.length >= 5 && (n.includes(nameNorm) || nameNorm.includes(n))) {
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
      lower.includes('denim') || lower.includes('rainwear') || lower.includes('underwear') ||
      lower.includes('second-hand')) return 'fashion';
  if (lower.includes('beauty') || lower.includes('skincare') || lower.includes('cosmetic') ||
      lower.includes('hair care') || lower.includes('fragrance') || lower.includes('body care')) return 'beauty';
  if (lower.includes('food') || lower.includes('grocery') || lower.includes('pharmacy')) return 'food_and_beverage';
  if (lower.includes('fitness') || lower.includes('sport') || lower.includes('activewear') ||
      lower.includes('outdoor') || lower.includes('golf') || lower.includes('protection')) return 'fitness';
  if (lower.includes('tech') || lower.includes('phone')) return 'tech';
  if (lower.includes('health')) return 'health';
  if (lower.includes('home') || lower.includes('textile') || lower.includes('care')) return 'home';
  if (lower.includes('marketplace')) return 'other';
  if (lower.includes('jewel') || lower.includes('watch') || lower.includes('accessor')) return 'accessories';
  return 'other';
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  const filePath = join(process.cwd(), 'swedish-brands-expansion.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const brands: BrandEntry[] = raw.brands;

  console.log(`Loaded ${brands.length} Swedish brands`);
  console.log(`Tokens: ${TOKENS.length}`);
  if (dryRun) console.log('DRY RUN\n');

  const toProcess = brands.slice(0, limit);
  let created = 0, failed = 0, alreadyExists = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const brand = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] ${brand.name}`);

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

    const existing = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
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
        country: 'SE',
        website: brand.website,
        ingestionStatus: 'pending',
        priority: 4, // High priority for Swedish focus
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

  await prisma.$disconnect();
}

main().catch(console.error);
