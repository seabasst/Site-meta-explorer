import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find ads with snapshotUrl but no assets.
  // ACTIVE-ADS-ONLY: only create pending AdAsset rows for running ads.
  // This script previously created rows for every ad with a snapshot, which
  // fed the daily cron's download queue with thousands of stale (dead) ads —
  // the cron then kept retrying them forever, burning R2 + fbcdn bandwidth.
  // See: .planning/review-2026-04-18/03-ingestion-pipeline.md (P0 queue-filler)
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      isActive: true,
      snapshotUrl: { not: null },
      assets: { none: {} },
    },
    select: { id: true, snapshotUrl: true },
  });

  console.log(`Found ${ads.length} active ads needing asset backfill`);

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
