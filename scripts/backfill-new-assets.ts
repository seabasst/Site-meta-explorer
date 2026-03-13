import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find ads with snapshotUrl but no assets
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      snapshotUrl: { not: null },
      assets: { none: {} },
    },
    select: { id: true, snapshotUrl: true },
  });

  console.log(`Found ${ads.length} ads needing asset backfill`);

  // Batch insert in chunks of 500
  const BATCH_SIZE = 500;
  let created = 0;
  for (let i = 0; i < ads.length; i += BATCH_SIZE) {
    const batch = ads.slice(i, i + BATCH_SIZE);
    const result = await prisma.adAsset.createMany({
      data: batch.map(ad => ({
        adId: ad.id,
        originalUrl: ad.snapshotUrl!,
        assetType: 'image',
        downloadStatus: 'pending',
      })),
      skipDuplicates: true,
    });
    created += result.count;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: created ${result.count} (total: ${created})`);
  }

  console.log(`\nDone: ${created} assets created`);
  await prisma.$disconnect();
}
main();
