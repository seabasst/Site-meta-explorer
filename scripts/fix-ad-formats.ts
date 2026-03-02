/**
 * Re-detect display format for existing ads using improved logic
 * Run with: npx tsx scripts/fix-ad-formats.ts
 */

import { prisma } from '../src/lib/prisma';

const BATCH_SIZE = 1000;

async function main() {
  console.log('Fixing ad display formats...\n');

  // Get total count
  const totalAds = await prisma.adLibraryAd.count();
  console.log(`Total ads to process: ${totalAds}\n`);

  let processed = 0;
  let updated = 0;
  let cursor: string | undefined;

  while (true) {
    // Fetch batch of ads
    const ads = await prisma.adLibraryAd.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        displayFormat: true,
        snapshotUrl: true,
      },
    });

    if (ads.length === 0) break;

    // Process each ad
    for (const ad of ads) {
      const newFormat = detectDisplayFormat(ad.snapshotUrl);

      if (newFormat !== ad.displayFormat) {
        await prisma.adLibraryAd.update({
          where: { id: ad.id },
          data: { displayFormat: newFormat },
        });
        updated++;
      }
      processed++;
    }

    cursor = ads[ads.length - 1].id;
    console.log(`Processed ${processed}/${totalAds} (${updated} updated)`);
  }

  console.log(`\n✅ Done! Updated ${updated} ads out of ${processed}`);

  // Show new distribution
  const distribution = await prisma.adLibraryAd.groupBy({
    by: ['displayFormat'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\nNew format distribution:');
  for (const row of distribution) {
    console.log(`  ${row.displayFormat}: ${row._count.id}`);
  }

  await prisma.$disconnect();
}

function detectDisplayFormat(snapshotUrl: string | null): string {
  if (!snapshotUrl) return 'image';

  // Check for video indicators
  if (snapshotUrl.includes('video') || snapshotUrl.includes('reel')) {
    return 'video';
  }

  // Default to image - we can't reliably detect carousel without the full ad data
  // The ingest route now has better logic for new ads
  return 'image';
}

main().catch(console.error);
