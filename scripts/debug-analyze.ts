import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check each category
  const categories = ['airline', 'car_rental', 'fast_food'];

  for (const cat of categories) {
    console.log(`\n=== ${cat} ===`);

    // Total active ads
    const totalActive = await prisma.adLibraryAd.count({
      where: { isActive: true, brand: { category: cat } },
    });
    console.log(`Active ads: ${totalActive}`);

    // Ads with completed assets
    const withAssets = await prisma.adLibraryAd.count({
      where: {
        isActive: true,
        brand: { category: cat },
        assets: { some: { downloadStatus: 'completed' } },
      },
    });
    console.log(`With completed assets: ${withAssets}`);

    // Check storedUrl vs storedKey
    const sampleAssets = await prisma.adAsset.findMany({
      where: {
        downloadStatus: 'completed',
        ad: { isActive: true, brand: { category: cat } },
      },
      select: { storedUrl: true, storedKey: true, assetType: true },
      take: 5,
    });
    console.log(`Sample assets:`);
    for (const a of sampleAssets) {
      console.log(`  type=${a.assetType} url=${a.storedUrl?.slice(0, 80)} key=${a.storedKey?.slice(0, 60)}`);
    }

    // Count image vs video assets
    const imageAssets = await prisma.adAsset.count({
      where: {
        downloadStatus: 'completed',
        assetType: 'image',
        ad: { isActive: true, brand: { category: cat } },
      },
    });
    const videoAssets = await prisma.adAsset.count({
      where: {
        downloadStatus: 'completed',
        assetType: 'video',
        ad: { isActive: true, brand: { category: cat } },
      },
    });
    console.log(`Image assets: ${imageAssets}, Video assets: ${videoAssets}`);
  }

  await prisma.$disconnect();
}
main();
