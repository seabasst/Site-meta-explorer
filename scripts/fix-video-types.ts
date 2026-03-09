/**
 * Retroactively fix mismarked video assets and ads.
 * Updates assetType and displayFormat for videos incorrectly marked as images.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fixing mismarked video assets...\n');

  // 1. Find assets with .mp4 stored URL but assetType='image'
  const mp4Assets = await prisma.adAsset.findMany({
    where: { storedUrl: { contains: '.mp4' }, assetType: 'image' },
    select: { id: true, adId: true, storedUrl: true },
  });
  console.log('Assets with .mp4 URL but assetType=image:', mp4Assets.length);

  // 2. Find assets with .webm stored URL but assetType='image'
  const webmAssets = await prisma.adAsset.findMany({
    where: { storedUrl: { contains: '.webm' }, assetType: 'image' },
    select: { id: true, adId: true },
  });
  console.log('Assets with .webm URL but assetType=image:', webmAssets.length);

  // 3. Find assets with video file extension but assetType='image'
  const videoExtAssets = await prisma.adAsset.findMany({
    where: {
      fileExtension: { in: ['.mp4', '.webm', '.mov'] },
      assetType: 'image',
    },
    select: { id: true, adId: true, fileExtension: true },
  });
  console.log('Assets with video extension but assetType=image:', videoExtAssets.length);

  // Combine all mismatched
  const allMismatched = [...mp4Assets, ...webmAssets, ...videoExtAssets];
  const uniqueAssetIds = [...new Set(allMismatched.map(a => a.id))];
  const uniqueAdIds = [...new Set(allMismatched.map(a => a.adId))];

  console.log('\nTotal unique mismatched assets:', uniqueAssetIds.length);
  console.log('Total unique ads to fix:', uniqueAdIds.length);

  if (uniqueAssetIds.length > 0) {
    // Fix asset types
    const assetResult = await prisma.adAsset.updateMany({
      where: { id: { in: uniqueAssetIds } },
      data: { assetType: 'video' },
    });
    console.log('\nFixed assetType on assets:', assetResult.count);

    // Fix ad displayFormat
    const adResult = await prisma.adLibraryAd.updateMany({
      where: { id: { in: uniqueAdIds }, displayFormat: { not: 'video' } },
      data: { displayFormat: 'video' },
    });
    console.log('Fixed displayFormat on ads:', adResult.count);
  }

  // Also fix: ads that have assetType=video assets but displayFormat != video
  const videoAssetAdIds = await prisma.adAsset.findMany({
    where: { assetType: 'video' },
    select: { adId: true },
    distinct: ['adId'],
  });
  const adIdsWithVideo = videoAssetAdIds.map(a => a.adId);

  if (adIdsWithVideo.length > 0) {
    const adFixResult = await prisma.adLibraryAd.updateMany({
      where: { id: { in: adIdsWithVideo }, displayFormat: { not: 'video' } },
      data: { displayFormat: 'video' },
    });
    if (adFixResult.count > 0) {
      console.log('Additional ads fixed from video assets:', adFixResult.count);
    }
  }

  // Final stats
  const totalVideoAds = await prisma.adLibraryAd.count({ where: { displayFormat: 'video' } });
  const totalVideoAssets = await prisma.adAsset.count({ where: { assetType: 'video' } });
  const remaining = await prisma.adAsset.count({
    where: { assetType: 'video', ad: { displayFormat: { not: 'video' } } },
  });

  console.log('\n=== Final Stats ===');
  console.log('Video ads:', totalVideoAds);
  console.log('Video assets:', totalVideoAssets);
  console.log('Remaining mismatches:', remaining);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
