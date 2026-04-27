/**
 * Restore creator partnerships from backup JSON.
 */
import { config } from 'dotenv'; config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const backup = JSON.parse(readFileSync('data/creator-partnerships-backup.json', 'utf-8'));
  console.log(`Restoring ${backup.creatorCount} creators, ${backup.partnershipCount} partnerships...\n`);

  let creators = 0, partnerships = 0;

  for (const c of backup.creators) {
    const creator = await prisma.adCreator.upsert({
      where: { pageId: c.pageId },
      create: {
        pageId: c.pageId, pageName: c.pageName,
        totalAds: c.totalAds, totalReach: c.totalReach,
        brandCount: c.brandCount, tier: c.tier,
        score: c.score, creatorType: c.creatorType,
        categories: [], signals: ['partnership-ad-scraped'],
      },
      update: {
        totalAds: c.totalAds, totalReach: c.totalReach,
        brandCount: c.brandCount,
      },
    });
    creators++;

    for (const p of c.partnerships) {
      const brand = await prisma.adLibraryBrand.findFirst({
        where: { pageId: p.brandPageId },
        select: { id: true },
      });
      if (!brand) continue;

      await prisma.creatorPartnership.upsert({
        where: { creatorId_brandId: { creatorId: creator.id, brandId: brand.id } },
        create: {
          creatorId: creator.id, brandId: brand.id,
          adCount: p.adCount, totalReach: p.totalReach,
          metaAdIds: p.metaAdIds || [], snapshotUrls: p.snapshotUrls || [],
          mediaUrls: p.mediaUrls || [], mediaTypes: p.mediaTypes || [],
          adBodies: p.adBodies || [], adTitles: p.adTitles || [],
        },
        update: {
          adCount: p.adCount, totalReach: p.totalReach,
          metaAdIds: p.metaAdIds || [], snapshotUrls: p.snapshotUrls || [],
          mediaUrls: p.mediaUrls || [], mediaTypes: p.mediaTypes || [],
        },
      });
      partnerships++;
    }

    if (creators % 20 === 0) process.stdout.write(`\r  ${creators}/${backup.creatorCount} creators`);
  }

  console.log(`\n\nDone! Restored ${creators} creators, ${partnerships} partnerships.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
