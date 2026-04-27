import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.adCreator.count();
  const tiers = await prisma.adCreator.groupBy({ by: ['tier'], _count: true });
  const partnerships = await prisma.creatorPartnership.count();
  console.log('Creators:', count);
  console.log('Tiers:', JSON.stringify(tiers, null, 2));
  console.log('Partnerships:', partnerships);

  if (count > 0) {
    const sample = await prisma.adCreator.findFirst({
      where: { tier: 'confirmed' },
      include: { partnerships: { take: 3 } },
    });
    console.log('\nSample confirmed creator:', JSON.stringify(sample, null, 2));
  }

  // Also check bylines/partnership ads
  const adsWithBylines = await prisma.adLibraryAd.count({ where: { bylines: { not: null } } });
  const adsWithBylinesAndAssets = await prisma.adLibraryAd.count({
    where: { bylines: { not: null }, assets: { some: { downloadStatus: 'completed' } } },
  });
  console.log('\nAds with bylines:', adsWithBylines);
  console.log('Ads with bylines + completed assets:', adsWithBylinesAndAssets);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
