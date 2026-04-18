/**
 * Create a brand record and trigger ingestion
 * Usage: npx tsx scripts/create-brand.ts <pageId>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error('DATABASE_URL not set'); process.exit(1); }

const adapter = new PrismaPg({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

const pageId = process.argv[2];
if (!pageId) { console.error('Usage: npx tsx scripts/create-brand.ts <pageId>'); process.exit(1); }

async function main() {
  // Check if brand exists
  const existing = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
  if (existing) {
    console.log(`Brand already exists: ${existing.pageName} (status: ${existing.ingestionStatus})`);
    if (existing.ingestionStatus !== 'pending') {
      await prisma.adLibraryBrand.update({
        where: { pageId },
        data: { ingestionStatus: 'pending' },
      });
      console.log('Reset to pending for re-ingestion');
    }
    await prisma.$disconnect();
    return;
  }

  // Look up page name from Ad Library API
  const token = process.env.FACEBOOK_ACCESS_TOKEN1 || process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) { console.error('No Facebook token found'); process.exit(1); }

  const url = new URL('https://graph.facebook.com/v22.0/ads_archive');
  url.searchParams.set('access_token', token);
  url.searchParams.set('search_page_ids', pageId);
  url.searchParams.set('ad_reached_countries', 'ALL');
  url.searchParams.set('ad_active_status', 'ACTIVE');
  url.searchParams.set('fields', 'page_id,page_name');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    console.error('API error:', data.error.message);
    process.exit(1);
  }

  const pageName = data.data?.[0]?.page_name || 'Unknown Brand';
  console.log(`Page name: ${pageName}`);

  const brand = await prisma.adLibraryBrand.create({
    data: {
      pageId,
      pageName,
      ingestionStatus: 'pending',
      priority: 10,
    },
  });
  console.log(`Created brand: ${brand.pageName} (id: ${brand.id})`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
