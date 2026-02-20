/**
 * Fetch fresh ads for a brand and create pending asset records.
 * Run this before process-assets.ts to get fresh snapshot URLs.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';
const TARGET_COUNTRIES = ['DE', 'GB', 'US', 'FR'];

async function fetchAds(pageId: string, limit = 10) {
  const params = new URLSearchParams({
    access_token: FACEBOOK_ACCESS_TOKEN!,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_active_status: 'ACTIVE',
    fields: 'id,ad_snapshot_url',
    limit: String(limit),
  });

  const res = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
  return res.json();
}

async function main() {
  const limitArg = process.argv.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || '10') : 10;

  console.log('Fetching fresh ads...\n');

  // Find a pending brand or use the first active one
  let brand = await prisma.adLibraryBrand.findFirst({
    where: { ingestionStatus: 'pending' },
    select: { id: true, pageId: true, pageName: true },
  });

  if (!brand) {
    brand = await prisma.adLibraryBrand.findFirst({
      where: { ingestionStatus: 'active' },
      select: { id: true, pageId: true, pageName: true },
    });
  }

  if (!brand) {
    console.log('No brands found');
    process.exit(1);
  }

  console.log(`Brand: ${brand.pageName} (${brand.pageId})`);
  console.log(`Fetching ${limit} active ads...\n`);

  const data = await fetchAds(brand.pageId, limit);

  if (data.error) {
    console.error('API Error:', data.error.message);
    process.exit(1);
  }

  const ads = data.data || [];
  console.log(`Got ${ads.length} ads\n`);

  let created = 0;
  let updated = 0;

  for (const ad of ads) {
    console.log(`Ad: ${ad.id}`);

    // Find or create the ad record
    let adRecord = await prisma.adLibraryAd.findUnique({ where: { adId: ad.id } });

    if (!adRecord) {
      adRecord = await prisma.adLibraryAd.create({
        data: {
          adId: ad.id,
          brandId: brand.id,
          snapshotUrl: ad.ad_snapshot_url,
          isActive: true,
        },
      });
      console.log('  Created ad record');
    } else {
      await prisma.adLibraryAd.update({
        where: { id: adRecord.id },
        data: { snapshotUrl: ad.ad_snapshot_url },
      });
      console.log('  Updated snapshot URL');
    }

    // Create/update asset with fresh URL
    const assetId = `${adRecord.id}-0`;
    const existing = await prisma.adAsset.findUnique({ where: { id: assetId } });

    if (!existing) {
      await prisma.adAsset.create({
        data: {
          id: assetId,
          adId: adRecord.id,
          assetType: 'image',
          position: 0,
          originalUrl: ad.ad_snapshot_url,
          downloadStatus: 'pending',
        },
      });
      console.log('  Created asset (pending)');
      created++;
    } else if (existing.downloadStatus !== 'completed') {
      await prisma.adAsset.update({
        where: { id: assetId },
        data: {
          originalUrl: ad.ad_snapshot_url,
          downloadStatus: 'pending',
          downloadError: null,
        },
      });
      console.log('  Reset asset with fresh URL');
      updated++;
    } else {
      console.log('  Asset already in R2, skipping');
    }
  }

  console.log(`\n✓ Created ${created} new assets, updated ${updated}`);
  console.log('\nNow run:');
  console.log('  npx tsx scripts/process-assets.ts --limit=' + ads.length);

  process.exit(0);
}

main().catch(console.error);
