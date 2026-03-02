import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const pageId = process.argv[2];
  const pageName = process.argv[3];
  const category = process.argv[4] || 'fashion';
  const country = process.argv[5] || 'SE';

  if (!pageId || !pageName) {
    console.error('Usage: npx tsx scripts/add-brand.ts <pageId> <pageName> [category] [country]');
    process.exit(1);
  }

  const brand = await prisma.adLibraryBrand.upsert({
    where: { pageId },
    update: {
      ingestionStatus: 'pending',
      priority: 200,
      failCount: 0,
    },
    create: {
      pageId,
      pageName,
      category,
      country,
      ingestionStatus: 'pending',
      priority: 200,
    }
  });

  console.log(`✓ Added brand: ${brand.pageName} (${brand.pageId})`);
  console.log(`  Status: ${brand.ingestionStatus}, Priority: ${brand.priority}`);
}

main();
