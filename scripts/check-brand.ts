import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.argv[2];
  if (!name) { console.log('Usage: npx tsx scripts/check-brand.ts <name>'); return; }

  const brand = await prisma.adLibraryBrand.findFirst({ where: { pageName: { contains: name, mode: 'insensitive' } } });
  if (!brand) { console.log('Brand not found'); return; }
  console.log('Brand:', brand.pageName, '(' + brand.pageId + ')');

  const totalAds = await prisma.adLibraryAd.count({ where: { brandId: brand.id } });
  const adsNoAssets = await prisma.adLibraryAd.count({ where: { brandId: brand.id, snapshotUrl: { not: null }, assets: { none: {} } } });

  const completed = await prisma.adAsset.count({ where: { ad: { brandId: brand.id }, downloadStatus: 'completed' } });
  const pending = await prisma.adAsset.count({ where: { ad: { brandId: brand.id }, downloadStatus: 'pending' } });
  const failed = await prisma.adAsset.count({ where: { ad: { brandId: brand.id }, downloadStatus: 'failed' } });
  const downloading = await prisma.adAsset.count({ where: { ad: { brandId: brand.id }, downloadStatus: 'downloading' } });

  console.log('Total ads:', totalAds);
  console.log('Ads without assets (need backfill):', adsNoAssets);
  console.log('Assets - completed:', completed, '| pending:', pending, '| failed:', failed, '| downloading:', downloading);
  console.log('Coverage:', totalAds > 0 ? ((completed / totalAds) * 100).toFixed(1) + '%' : 'N/A');

  await prisma.$disconnect();
}
main();
