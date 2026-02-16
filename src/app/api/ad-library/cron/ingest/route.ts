import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

// Meta API config
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// Conservative rate limiting
const DELAY_BETWEEN_REQUESTS = 2000;
const BRANDS_PER_RUN = 2; // Process only 2 brands per cron run
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 30000;

// EU + GB countries
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'
];

const AD_FIELDS = [
  'id', 'ad_creation_time', 'ad_creative_bodies', 'ad_creative_link_captions',
  'ad_creative_link_descriptions', 'ad_creative_link_titles', 'ad_delivery_start_time',
  'ad_delivery_stop_time', 'ad_snapshot_url', 'bylines', 'currency', 'delivery_by_region',
  'estimated_audience_size', 'eu_total_reach', 'impressions', 'languages', 'page_id',
  'page_name', 'publisher_platforms', 'spend', 'target_ages', 'target_gender', 'target_locations',
].join(',');

interface MetaAd {
  id: string;
  ad_creation_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  bylines?: string;
  currency?: string;
  delivery_by_region?: Array<{ region: string; percentage: number }>;
  estimated_audience_size?: { lower_bound: number; upper_bound: number };
  eu_total_reach?: number;
  impressions?: { lower_bound: number; upper_bound: number };
  languages?: string[];
  page_id?: string;
  page_name?: string;
  publisher_platforms?: string[];
  spend?: { lower_bound: number; upper_bound: number };
  target_ages?: string;
  target_gender?: string;
  target_locations?: Array<{ name: string; type: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAdsPage(
  pageId: string,
  cursor?: string,
  retryCount = 0
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    access_token: FACEBOOK_ACCESS_TOKEN!,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(EU_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: AD_FIELDS,
    limit: '100',
  });

  if (cursor) {
    params.set('after', cursor);
  }

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
  const data = await response.json();

  if (data.error) {
    const rateLimitCodes = [4, 17, 613, 80004];
    if (rateLimitCodes.includes(data.error.code) && retryCount < MAX_RETRIES) {
      const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Rate limited, waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
      return fetchAdsPage(pageId, cursor, retryCount + 1);
    }
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return {
    ads: data.data || [],
    nextCursor: data.paging?.cursors?.after,
  };
}

async function fetchAllAdsForBrand(pageId: string): Promise<MetaAd[]> {
  const allAds: MetaAd[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;

  do {
    const { ads, nextCursor } = await fetchAdsPage(pageId, cursor);

    for (const ad of ads) {
      if (!seenIds.has(ad.id)) {
        seenIds.add(ad.id);
        allAds.push(ad);
      }
    }

    cursor = nextCursor;
    if (cursor) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  } while (cursor);

  return allAds;
}

function detectDisplayFormat(ad: MetaAd): string {
  const bodies = ad.ad_creative_bodies || [];
  const titles = ad.ad_creative_link_titles || [];
  if (bodies.length > 1 || titles.length > 1) return 'carousel';
  if (ad.ad_snapshot_url?.includes('video')) return 'video';
  return 'image';
}

async function upsertAd(ad: MetaAd, brandId: string): Promise<'created' | 'updated'> {
  const existing = await prisma.adLibraryAd.findUnique({
    where: { adArchiveId: ad.id },
    select: { id: true },
  });

  const data = {
    brandId,
    adArchiveId: ad.id,
    pageId: ad.page_id || '',
    pageName: ad.page_name || '',
    snapshotUrl: ad.ad_snapshot_url || '',
    startDate: ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null,
    endDate: ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : null,
    isActive: !ad.ad_delivery_stop_time,
    publisherPlatforms: ad.publisher_platforms || [],
    displayFormat: detectDisplayFormat(ad),
    creativeBody: ad.ad_creative_bodies?.[0] || null,
    creativeBodies: ad.ad_creative_bodies || [],
    linkCaption: ad.ad_creative_link_captions?.[0] || null,
    linkDescription: ad.ad_creative_link_descriptions?.[0] || null,
    linkTitle: ad.ad_creative_link_titles?.[0] || null,
    linkTitles: ad.ad_creative_link_titles || [],
    languages: ad.languages || [],
    currency: ad.currency || null,
    spendLower: ad.spend?.lower_bound || null,
    spendUpper: ad.spend?.upper_bound || null,
    impressionsLower: ad.impressions?.lower_bound || null,
    impressionsUpper: ad.impressions?.upper_bound || null,
    reachEstimate: ad.eu_total_reach || null,
    audienceSizeLower: ad.estimated_audience_size?.lower_bound || null,
    audienceSizeUpper: ad.estimated_audience_size?.upper_bound || null,
    targetAges: ad.target_ages || null,
    targetGender: ad.target_gender || null,
    targetLocations: ad.target_locations || [],
    deliveryByRegion: ad.delivery_by_region || [],
    bylines: ad.bylines || null,
  };

  if (existing) {
    await prisma.adLibraryAd.update({ where: { id: existing.id }, data });
    return 'updated';
  } else {
    await prisma.adLibraryAd.create({ data });
    return 'created';
  }
}

async function processBrand(brandId: string, pageId: string, pageName: string) {
  console.log(`Processing brand: ${pageName} (${pageId})`);

  // Create job
  const job = await prisma.ingestionJob.create({
    data: {
      brandId,
      jobType: 'full',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    // Fetch ads
    const ads = await fetchAllAdsForBrand(pageId);
    console.log(`Fetched ${ads.length} ads for ${pageName}`);

    // Update job progress
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { adsFetched: ads.length },
    });

    // Upsert ads
    let created = 0;
    let updated = 0;
    for (const ad of ads) {
      const result = await upsertAd(ad, brandId);
      if (result === 'created') created++;
      else updated++;
    }

    // Update brand status
    const activeCount = ads.filter(a => !a.ad_delivery_stop_time).length;
    const totalReach = ads.reduce((sum, a) => sum + (a.eu_total_reach || 0), 0);

    await prisma.adLibraryBrand.update({
      where: { id: brandId },
      data: {
        ingestionStatus: 'active',
        activeAdCount: activeCount,
        totalReach: BigInt(totalReach),
        lastIngestionAt: new Date(),
      },
    });

    // Complete job
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        adsCreated: created,
        adsUpdated: updated,
        completedAt: new Date(),
      },
    });

    return { success: true, brand: pageName, ads: ads.length, created, updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process ${pageName}: ${errorMessage}`);

    // Mark job as failed
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      },
    });

    // Mark brand as failed
    await prisma.adLibraryBrand.update({
      where: { id: brandId },
      data: { ingestionStatus: 'failed' },
    });

    return { success: false, brand: pageName, error: errorMessage };
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!FACEBOOK_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'FACEBOOK_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Get pending/failed brands to process
    const brands = await prisma.adLibraryBrand.findMany({
      where: {
        ingestionStatus: { in: ['pending', 'failed'] },
      },
      orderBy: { priority: 'desc' },
      take: BRANDS_PER_RUN,
    });

    if (brands.length === 0) {
      return NextResponse.json({
        message: 'No pending brands to process',
        processed: 0,
      });
    }

    console.log(`Cron: Processing ${brands.length} brands`);

    const results = [];
    for (const brand of brands) {
      const result = await processBrand(brand.id, brand.pageId, brand.pageName);
      results.push(result);

      // Wait between brands to avoid rate limits
      if (brands.indexOf(brand) < brands.length - 1) {
        await sleep(30000); // 30 second pause between brands
      }
    }

    return NextResponse.json({
      message: `Processed ${brands.length} brands`,
      results,
    });
  } catch (error) {
    console.error('Cron ingestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}
