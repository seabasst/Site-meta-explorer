/**
 * Ad Ingestion Script
 *
 * Fetches full ad data from Meta Ad Library API for brands in the database
 * and stores them in the AdLibraryAd table.
 *
 * Usage:
 *   npx tsx scripts/ingest-ads.ts                    # Process all pending brands
 *   npx tsx scripts/ingest-ads.ts --brand <pageId>   # Process single brand
 *   npx tsx scripts/ingest-ads.ts --limit 5          # Process top 5 by priority
 *   npx tsx scripts/ingest-ads.ts --dry-run          # Preview without saving
 */

import { PrismaClient, AdLibraryBrand, IngestionJob } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// Load .env.local (takes precedence) then .env
config({ path: '.env.local' });
config({ path: '.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// Rate limiting - conservative to avoid 613 errors
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between pagination requests
const DELAY_BETWEEN_BRANDS = 30000;  // 30 seconds between brands
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 60000;   // 1 minute initial retry delay
const RATE_LIMIT_PAUSE = 300000;     // 5 minute pause when rate limited

// Global countries for comprehensive coverage
const TARGET_COUNTRIES = [
  // Europe (EU + GB + others)
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
  // North America
  'US', 'CA', 'MX',
  // Asia-Pacific
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'TW', 'IN', 'PH', 'MY', 'ID', 'TH', 'VN',
  // Middle East
  'AE', 'SA', 'IL',
  // South America
  'BR', 'AR', 'CO', 'CL',
  // Africa
  'ZA', 'NG', 'EG',
];

// Fields to fetch from Meta API
const AD_FIELDS = [
  'id',
  'ad_creation_time',
  'ad_creative_bodies',
  'ad_creative_link_captions',
  'ad_creative_link_descriptions',
  'ad_creative_link_titles',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'bylines',
  'currency',
  'delivery_by_region',
  'estimated_audience_size',
  'eu_total_reach',
  'impressions',
  'languages',
  'page_id',
  'page_name',
  'publisher_platforms',
  'spend',
  'target_ages',
  'target_gender',
  'target_locations',
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

interface IngestionStats {
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  errors: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toString();
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function detectDisplayFormat(ad: MetaAd): string {
  const bodies = ad.ad_creative_bodies || [];
  const titles = ad.ad_creative_link_titles || [];

  // Multiple bodies/titles suggest carousel or DPA
  if (bodies.length > 1 || titles.length > 1) {
    return 'carousel';
  }

  // Check snapshot URL for video indicators (heuristic)
  if (ad.ad_snapshot_url?.includes('video')) {
    return 'video';
  }

  return 'image'; // Default
}

function calculateAdDuration(startDate?: string, endDate?: string): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ============================================================================
// Meta API Functions
// ============================================================================

async function fetchAdsPage(
  pageId: string,
  cursor?: string,
  retryCount = 0
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    access_token: FACEBOOK_ACCESS_TOKEN!,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: AD_FIELDS,
    limit: '100',
  });

  if (cursor) {
    params.set('after', cursor);
  }

  try {
    const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    const data = await response.json();

    if (data.error) {
      // Rate limit hit - wait and retry with exponential backoff
      const rateLimitCodes = [4, 17, 613, 80004];
      if (rateLimitCodes.includes(data.error.code)) {
        if (retryCount < MAX_RETRIES) {
          // Exponential backoff: 1min, 2min, 4min, 8min, 16min
          const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`    ⏳ Rate limited (code ${data.error.code}), waiting ${waitTime / 60000} minutes...`);
          await sleep(waitTime);
          return fetchAdsPage(pageId, cursor, retryCount + 1);
        }
        // If all retries exhausted, throw with a flag to pause processing
        const error = new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
        (error as any).isRateLimit = true;
        throw error;
      }
      throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
    }

    return {
      ads: data.data || [],
      nextCursor: data.paging?.cursors?.after,
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`    ⚠️ Fetch error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY);
      return fetchAdsPage(pageId, cursor, retryCount + 1);
    }
    throw error;
  }
}

async function fetchAllAdsForBrand(
  brand: AdLibraryBrand,
  onProgress?: (fetched: number) => void
): Promise<MetaAd[]> {
  const allAds: MetaAd[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  let pageNum = 0;

  console.log(`  Fetching ads for ${brand.pageName}...`);

  do {
    pageNum++;
    const { ads, nextCursor } = await fetchAdsPage(brand.pageId, cursor);

    // Deduplicate (API sometimes returns duplicates across pages)
    for (const ad of ads) {
      if (!seenIds.has(ad.id)) {
        seenIds.add(ad.id);
        allAds.push(ad);
      }
    }

    cursor = nextCursor;
    onProgress?.(allAds.length);

    if (pageNum % 5 === 0) {
      console.log(`    Page ${pageNum}: ${allAds.length} ads fetched`);
    }

    // Rate limiting between pages
    if (cursor) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  } while (cursor);

  console.log(`  ✓ Total: ${allAds.length} unique ads`);
  return allAds;
}

// ============================================================================
// Database Functions
// ============================================================================

async function upsertAd(
  ad: MetaAd,
  brandId: string,
  jobId: string
): Promise<'created' | 'updated'> {
  const startDate = parseDate(ad.ad_delivery_start_time);
  const endDate = parseDate(ad.ad_delivery_stop_time);
  const isActive = !ad.ad_delivery_stop_time;

  const adData = {
    brandId,
    ingestionJobId: jobId,
    displayFormat: detectDisplayFormat(ad),
    publisherPlatforms: ad.publisher_platforms || [],
    body: ad.ad_creative_bodies?.[0] || null,
    caption: ad.ad_creative_link_captions?.[0] || null,
    title: ad.ad_creative_link_titles?.[0] || null,
    linkDescription: ad.ad_creative_link_descriptions?.[0] || null,
    snapshotUrl: ad.ad_snapshot_url || null,
    startDate,
    endDate,
    adDurationDays: calculateAdDuration(ad.ad_delivery_start_time, ad.ad_delivery_stop_time),
    isActive,
    reachEstimate: ad.eu_total_reach || null,
    impressionsLower: ad.impressions?.lower_bound || null,
    impressionsUpper: ad.impressions?.upper_bound || null,
    spendLower: ad.spend?.lower_bound || null,
    spendUpper: ad.spend?.upper_bound || null,
    currency: ad.currency || null,
    targetingJson: {
      ages: ad.target_ages,
      gender: ad.target_gender,
      locations: ad.target_locations,
      languages: ad.languages,
      estimatedAudienceSize: ad.estimated_audience_size,
      deliveryByRegion: ad.delivery_by_region,
    },
  };

  const existing = await prisma.adLibraryAd.findUnique({
    where: { adId: ad.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.adLibraryAd.update({
      where: { adId: ad.id },
      data: adData,
    });
    return 'updated';
  } else {
    await prisma.adLibraryAd.create({
      data: {
        adId: ad.id,
        ...adData,
      },
    });
    return 'created';
  }
}

async function createIngestionJob(brandId: string): Promise<IngestionJob> {
  return prisma.ingestionJob.create({
    data: {
      brandId,
      jobType: 'full',
      status: 'running',
      startedAt: new Date(),
    },
  });
}

async function completeIngestionJob(
  jobId: string,
  stats: IngestionStats,
  status: 'completed' | 'failed'
): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status,
      adsFetched: stats.adsFetched,
      adsCreated: stats.adsCreated,
      adsUpdated: stats.adsUpdated,
      errorMessage: stats.errors.length > 0 ? stats.errors[0] : null,
      errorsJson: stats.errors.length > 0 ? stats.errors : undefined,
      completedAt: new Date(),
    },
  });
}

async function updateBrandStatus(
  brandId: string,
  status: 'active' | 'failed',
  activeAdCount?: number
): Promise<void> {
  await prisma.adLibraryBrand.update({
    where: { id: brandId },
    data: {
      ingestionStatus: status,
      lastCheckedAt: new Date(),
      ...(activeAdCount !== undefined && { activeAdCount }),
    },
  });
}

// ============================================================================
// Main Ingestion Logic
// ============================================================================

async function ingestBrand(
  brand: AdLibraryBrand,
  dryRun: boolean
): Promise<IngestionStats> {
  const stats: IngestionStats = {
    adsFetched: 0,
    adsCreated: 0,
    adsUpdated: 0,
    errors: [],
  };

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Brand: ${brand.pageName} (${brand.pageId})`);
  console.log(`Category: ${brand.category || 'unknown'} | Priority: ${brand.priority}`);
  console.log(`${'─'.repeat(60)}`);

  let job: IngestionJob | null = null;

  try {
    // Create job record
    if (!dryRun) {
      job = await createIngestionJob(brand.id);
      console.log(`  Job ID: ${job.id}`);
    }

    // Fetch all ads
    const ads = await fetchAllAdsForBrand(brand, (count) => {
      stats.adsFetched = count;
    });
    stats.adsFetched = ads.length;

    if (dryRun) {
      console.log(`  DRY RUN - Would save ${ads.length} ads`);

      // Show sample
      if (ads.length > 0) {
        console.log(`\n  Sample ads:`);
        ads.slice(0, 3).forEach((ad, i) => {
          const body = ad.ad_creative_bodies?.[0]?.slice(0, 60) || '(no body)';
          console.log(`    ${i + 1}. ${body}${body.length >= 60 ? '...' : ''}`);
          console.log(`       Platforms: ${ad.publisher_platforms?.join(', ') || 'unknown'}`);
          console.log(`       Reach: ${formatNumber(ad.eu_total_reach || 0)}`);
        });
      }
      return stats;
    }

    // Upsert ads to database
    console.log(`  Saving ${ads.length} ads to database...`);
    let processed = 0;

    for (const ad of ads) {
      try {
        const result = await upsertAd(ad, brand.id, job!.id);
        if (result === 'created') stats.adsCreated++;
        else stats.adsUpdated++;

        processed++;
        if (processed % 100 === 0) {
          console.log(`    Processed: ${processed}/${ads.length}`);
        }
      } catch (error) {
        const errMsg = `Ad ${ad.id}: ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errMsg);
        if (stats.errors.length <= 5) {
          console.error(`    ❌ ${errMsg}`);
        }
      }
    }

    // Update brand status
    const activeCount = ads.filter(a => !a.ad_delivery_stop_time).length;
    await updateBrandStatus(brand.id, 'active', activeCount);

    // Complete job
    await completeIngestionJob(job!.id, stats, 'completed');

    console.log(`\n  ✅ Complete: ${stats.adsCreated} created, ${stats.adsUpdated} updated`);
    if (stats.errors.length > 0) {
      console.log(`  ⚠️  ${stats.errors.length} errors`);
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit = (error as any).isRateLimit || errMsg.includes('613') || errMsg.includes('rate limit');
    stats.errors.push(errMsg);
    (stats as any).isRateLimit = isRateLimit;
    console.error(`  ❌ Failed: ${errMsg}`);

    if (job) {
      await completeIngestionJob(job.id, stats, 'failed');
    }
    if (!dryRun) {
      await updateBrandStatus(brand.id, 'failed');
    }
  }

  return stats;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  if (!FACEBOOK_ACCESS_TOKEN) {
    console.error('Error: FACEBOOK_ACCESS_TOKEN environment variable not set');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const brandArg = args.find(a => a.startsWith('--brand='))?.split('=')[1];
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg) : undefined;

  console.log('═'.repeat(60));
  console.log('Ad Ingestion Pipeline');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (brandArg) console.log(`Target: Single brand (${brandArg})`);
  if (limit) console.log(`Limit: ${limit} brands`);
  console.log('═'.repeat(60));

  // Get brands to process
  let brands: AdLibraryBrand[];

  if (brandArg) {
    const brand = await prisma.adLibraryBrand.findFirst({
      where: {
        OR: [
          { pageId: brandArg },
          { pageName: { contains: brandArg, mode: 'insensitive' } },
        ],
      },
    });
    if (!brand) {
      console.error(`Brand not found: ${brandArg}`);
      process.exit(1);
    }
    brands = [brand];
  } else {
    brands = await prisma.adLibraryBrand.findMany({
      where: {
        ingestionStatus: { in: ['pending', 'failed'] },
      },
      orderBy: { priority: 'desc' },
      take: limit,
    });
  }

  console.log(`\nBrands to process: ${brands.length}`);

  if (brands.length === 0) {
    console.log('No pending brands found.');
    await prisma.$disconnect();
    return;
  }

  // Show preview
  console.log('\nQueue:');
  brands.slice(0, 10).forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.pageName.padEnd(25)} (priority: ${b.priority})`);
  });
  if (brands.length > 10) {
    console.log(`  ... and ${brands.length - 10} more`);
  }

  // Process brands
  const totalStats: IngestionStats = {
    adsFetched: 0,
    adsCreated: 0,
    adsUpdated: 0,
    errors: [],
  };

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    console.log(`\n[${i + 1}/${brands.length}]`);

    const stats = await ingestBrand(brand, dryRun);
    totalStats.adsFetched += stats.adsFetched;
    totalStats.adsCreated += stats.adsCreated;
    totalStats.adsUpdated += stats.adsUpdated;
    totalStats.errors.push(...stats.errors);

    // Delay between brands - longer if rate limited
    if (i < brands.length - 1) {
      if ((stats as any).isRateLimit) {
        console.log(`\n  ⚠️ Rate limit hit - pausing for ${RATE_LIMIT_PAUSE / 60000} minutes before next brand...`);
        await sleep(RATE_LIMIT_PAUSE);
      } else {
        console.log(`\n  Waiting ${DELAY_BETWEEN_BRANDS / 1000}s before next brand...`);
        await sleep(DELAY_BETWEEN_BRANDS);
      }
    }
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('INGESTION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Brands processed: ${brands.length}`);
  console.log(`Ads fetched: ${totalStats.adsFetched}`);
  console.log(`Ads created: ${totalStats.adsCreated}`);
  console.log(`Ads updated: ${totalStats.adsUpdated}`);
  console.log(`Errors: ${totalStats.errors.length}`);

  if (!dryRun) {
    const totalAds = await prisma.adLibraryAd.count();
    const activeBrands = await prisma.adLibraryBrand.count({
      where: { ingestionStatus: 'active' },
    });
    console.log(`\nDatabase totals:`);
    console.log(`  Total ads: ${totalAds}`);
    console.log(`  Active brands: ${activeBrands}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
