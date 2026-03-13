import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const brands = await prisma.adLibraryBrand.findMany({
    where: { pageName: { in: ['Goldcar', 'Drivalia', 'Holmgrens Bil'] } },
    select: { pageName: true, pageId: true, ingestionStatus: true, category: true, _count: { select: { ads: true } } }
  });
  console.log('New rental car brands:');
  for (const b of brands) {
    console.log(`  ${b.pageName} (${b.pageId}) — status: ${b.ingestionStatus}, ads: ${b._count.ads}`);
  }

  // Also check overall pending download status
  const pendingAssets = await prisma.adAsset.count({ where: { downloadStatus: 'pending' } });
  const completedAssets = await prisma.adAsset.count({ where: { downloadStatus: 'completed' } });
  const failedAssets = await prisma.adAsset.count({ where: { downloadStatus: 'failed' } });
  console.log(`\nAsset download status: ${completedAssets} completed, ${pendingAssets} pending, ${failedAssets} failed`);

  await prisma.$disconnect();
}
main();
