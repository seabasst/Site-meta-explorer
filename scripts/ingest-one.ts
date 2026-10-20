/**
 * Re-ingest a single brand now, bypassing the due-brand queue.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/ingest-one.ts <pageId>
 */
import { prisma } from '../src/lib/prisma';
import { processBrand } from '../src/lib/ingestion/ingest-core';

async function main() {
  const pageId = process.argv[2];
  if (!pageId) { console.error('Usage: ingest-one.ts <pageId>'); process.exit(1); }

  const brand = await prisma.adLibraryBrand.findUnique({ where: { pageId } });
  if (!brand) { console.error(`No brand with pageId ${pageId}`); process.exit(1); }

  console.log(`Re-ingesting ${brand.pageName} (${pageId})`);
  await processBrand(brand.id, brand.pageId, brand.pageName);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
