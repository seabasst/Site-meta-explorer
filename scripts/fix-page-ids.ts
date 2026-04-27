/**
 * Fix brands with non-numeric page IDs by resolving them via the Graph API.
 * Usage: npx tsx scripts/fix-page-ids.ts [--dry-run]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

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

/**
 * Try to resolve a page username to a numeric ID via the Facebook Graph API.
 * Falls back to Ad Library search if direct lookup fails.
 */
async function resolvePageId(pageName: string, username: string): Promise<{ pageId: string; pageName: string } | null> {
  // Method 1: Direct page lookup by username
  try {
    const res = await fetch(`${BASE_URL}/${API_VERSION}/${username}?fields=id,name&access_token=${TOKEN}`);
    if (res.ok) {
      const data = await res.json();
      if (data.id && /^\d+$/.test(data.id)) {
        return { pageId: data.id, pageName: data.name || pageName };
      }
    }
  } catch {}

  // Method 2: Ad Library search with strict name matching
  try {
    const url = new URL(`${BASE_URL}/${API_VERSION}/ads_archive`);
    url.searchParams.set('access_token', TOKEN);
    url.searchParams.set('search_terms', pageName);
    url.searchParams.set('ad_reached_countries', '["NL"]');
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('limit', '10');
    url.searchParams.set('fields', 'page_id,page_name');

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data?.length) return null;

    // Strict matching: only accept if page name closely matches
    const nameNorm = pageName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = data.data.find((d: any) => {
      const n = (d.page_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return n === nameNorm || n.startsWith(nameNorm) || nameNorm.startsWith(n);
    });

    if (match) {
      return { pageId: match.page_id, pageName: match.page_name };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Find brands with non-numeric pageIds
  const allBrands = await prisma.adLibraryBrand.findMany({
    where: { ingestionStatus: { in: ['pending', 'failed'] } },
    select: { id: true, pageId: true, pageName: true },
  });

  const nonNumeric = allBrands.filter(b => !/^\d+$/.test(b.pageId));
  console.log(`Found ${nonNumeric.length} brands with non-numeric page IDs (out of ${allBrands.length} pending/failed)\n`);

  if (dryRun) console.log('DRY RUN\n');

  let fixed = 0, failed = 0, deleted = 0;

  for (let i = 0; i < nonNumeric.length; i++) {
    const brand = nonNumeric[i];
    console.log(`[${i + 1}/${nonNumeric.length}] ${brand.pageName} (current: ${brand.pageId})`);

    const resolved = await resolvePageId(brand.pageName, brand.pageId);
    if (!resolved) {
      console.log(`  ✗ Could not resolve — will delete`);
      if (!dryRun) {
        await prisma.adLibraryBrand.delete({ where: { id: brand.id } });
        deleted++;
      }
      await sleep(1000);
      continue;
    }

    // Check if resolved pageId already exists (different record)
    const existing = await prisma.adLibraryBrand.findUnique({
      where: { pageId: resolved.pageId },
    });

    if (existing && existing.id !== brand.id) {
      console.log(`  ⊘ Resolved to ${resolved.pageId} but already exists as "${existing.pageName}" — deleting duplicate`);
      if (!dryRun) {
        await prisma.adLibraryBrand.delete({ where: { id: brand.id } });
        deleted++;
      }
      await sleep(500);
      continue;
    }

    console.log(`  → ${resolved.pageName} (${resolved.pageId})`);
    if (!dryRun) {
      await prisma.adLibraryBrand.update({
        where: { id: brand.id },
        data: {
          pageId: resolved.pageId,
          pageName: resolved.pageName,
          ingestionStatus: 'pending',
        },
      });
      fixed++;
    } else {
      fixed++;
    }

    await sleep(1500);
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed: ${fixed}`);
  console.log(`Deleted (unresolvable/duplicate): ${deleted}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
