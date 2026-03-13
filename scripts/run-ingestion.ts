/**
 * Run ad ingestion directly (bypassing HTTP endpoint)
 * Usage: npx tsx scripts/run-ingestion.ts [--brands N]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Meta API config
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// Token rotation manager
class TokenManager {
  private tokens: string[] = [];
  private currentIndex = 0;
  private rateLimitedTokens = new Set<number>();
  private rateLimitResetTimes = new Map<number, number>();

  constructor() {
    // Check for numbered tokens
    for (let i = 1; i <= 10; i++) {
      const token = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
      if (token?.trim()) this.tokens.push(token.trim());
    }
    // Comma-separated
    if (this.tokens.length === 0) {
      const tokensEnv = process.env.FACEBOOK_ACCESS_TOKENS;
      if (tokensEnv) {
        this.tokens = tokensEnv.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    }
    // Single token
    if (this.tokens.length === 0) {
      const single = process.env.FACEBOOK_ACCESS_TOKEN;
      if (single?.trim()) this.tokens.push(single.trim());
    }
    console.log(`TokenManager: ${this.tokens.length} token(s) configured`);
  }

  hasTokens() { return this.tokens.length > 0; }
  getTotalTokens() { return this.tokens.length; }
  getCurrentTokenIndex() { return this.currentIndex + 1; }
  allTokensRateLimited() { return this.rateLimitedTokens.size >= this.tokens.length; }

  getToken(): string {
    if (this.tokens.length === 0) throw new Error('No tokens configured');
    const now = Date.now();
    for (const [index] of this.rateLimitedTokens.entries()) {
      const resetTime = this.rateLimitResetTimes.get(index);
      if (resetTime && now > resetTime) {
        this.rateLimitedTokens.delete(index);
        this.rateLimitResetTimes.delete(index);
      }
    }
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      if (!this.rateLimitedTokens.has(index)) {
        this.currentIndex = index;
        return this.tokens[index];
      }
    }
    return this.tokens[this.currentIndex];
  }

  markRateLimited(waitTimeMs = 60000) {
    console.log(`  Token ${this.currentIndex + 1}/${this.tokens.length} rate limited, rotating...`);
    this.rateLimitedTokens.add(this.currentIndex);
    this.rateLimitResetTimes.set(this.currentIndex, Date.now() + waitTimeMs);
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }
}

const tokenManager = new TokenManager();

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 30000;

const TARGET_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
  'US', 'CA', 'MX',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'TW', 'IN', 'PH', 'MY', 'ID', 'TH', 'VN',
  'AE', 'SA', 'IL',
  'BR', 'AR', 'CO', 'CL',
  'ZA', 'NG', 'EG',
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getOneYearAgoDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0];
}

async function fetchAdsPage(
  pageId: string,
  cursor?: string,
  retryCount = 0,
  limit = 100
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const token = tokenManager.getToken();
  const params = new URLSearchParams({
    access_token: token,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    ad_delivery_date_min: getOneYearAgoDate(),
    fields: AD_FIELDS,
    limit: String(limit),
  });

  if (cursor) params.set('after', cursor);

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
  const data = await response.json();

  if (data.error) {
    const rateLimitCodes = [2, 4, 17, 613, 80004];

    if (data.error.code === 1 && limit > 10) {
      const reducedLimit = Math.floor(limit / 2);
      console.log(`  Data too large, reducing limit to ${reducedLimit}...`);
      return fetchAdsPage(pageId, cursor, retryCount, reducedLimit);
    }

    if (rateLimitCodes.includes(data.error.code) && retryCount < MAX_RETRIES) {
      tokenManager.markRateLimited(INITIAL_RETRY_DELAY * Math.pow(2, retryCount));

      if (tokenManager.getTotalTokens() > 1 && !tokenManager.allTokensRateLimited()) {
        console.log(`  Switching to token ${tokenManager.getCurrentTokenIndex()}/${tokenManager.getTotalTokens()}`);
        return fetchAdsPage(pageId, cursor, retryCount + 1, limit);
      }

      const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`  All tokens rate limited, waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
      return fetchAdsPage(pageId, cursor, retryCount + 1, limit);
    }
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return { ads: data.data || [], nextCursor: data.paging?.cursors?.after };
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
    if (cursor) await sleep(DELAY_BETWEEN_REQUESTS);
  } while (cursor);

  return allAds;
}

function detectDisplayFormat(ad: MetaAd): string {
  const snapshotUrl = ad.ad_snapshot_url || '';
  if (snapshotUrl.includes('video') || snapshotUrl.includes('reel')) return 'video';

  const titles = ad.ad_creative_link_titles || [];
  const descriptions = ad.ad_creative_link_descriptions || [];
  const captions = ad.ad_creative_link_captions || [];

  const uniqueTitles = new Set(titles.filter(t => t?.length > 0));
  const uniqueDescriptions = new Set(descriptions.filter(d => d?.length > 0));

  if (uniqueTitles.size > 2 || uniqueDescriptions.size > 2 || captions.length > 2) return 'carousel';
  return 'image';
}

async function upsertAd(ad: MetaAd, brandId: string): Promise<'created' | 'updated'> {
  const existing = await prisma.adLibraryAd.findUnique({
    where: { adId: ad.id },
    select: { id: true },
  });

  const data = {
    brandId,
    adId: ad.id,
    snapshotUrl: ad.ad_snapshot_url || null,
    startDate: ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null,
    endDate: ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : null,
    isActive: !ad.ad_delivery_stop_time,
    publisherPlatforms: ad.publisher_platforms || [],
    displayFormat: detectDisplayFormat(ad),
    body: ad.ad_creative_bodies?.[0] || null,
    caption: ad.ad_creative_link_captions?.[0] || null,
    linkDescription: ad.ad_creative_link_descriptions?.[0] || null,
    title: ad.ad_creative_link_titles?.[0] || null,
    currency: ad.currency || null,
    spendLower: ad.spend?.lower_bound != null ? Number(ad.spend.lower_bound) : null,
    spendUpper: ad.spend?.upper_bound != null ? Number(ad.spend.upper_bound) : null,
    impressionsLower: ad.impressions?.lower_bound != null ? Number(ad.impressions.lower_bound) : null,
    impressionsUpper: ad.impressions?.upper_bound != null ? Number(ad.impressions.upper_bound) : null,
    reachEstimate: ad.eu_total_reach || null,
    targetingJson: {
      deliveryByRegion: ad.delivery_by_region || [],
      targetAges: ad.target_ages || null,
      targetGender: ad.target_gender || null,
      targetLocations: ad.target_locations || [],
      languages: ad.languages || [],
      bylines: ad.bylines || null,
    },
  };

  if (existing) {
    await prisma.adLibraryAd.update({ where: { id: existing.id }, data });
    return 'updated';
  } else {
    await prisma.adLibraryAd.create({ data });
    return 'created';
  }
}

async function processBrand(brand: { id: string; pageId: string; pageName: string }) {
  console.log(`\nProcessing: ${brand.pageName} (${brand.pageId})`);

  const job = await prisma.ingestionJob.create({
    data: { brandId: brand.id, jobType: 'full', status: 'running', startedAt: new Date() },
  });

  try {
    const ads = await fetchAllAdsForBrand(brand.pageId);
    console.log(`  Fetched ${ads.length} ads (last 1 year)`);

    await prisma.ingestionJob.update({ where: { id: job.id }, data: { adsFetched: ads.length } });

    let created = 0, updated = 0;
    for (const ad of ads) {
      const result = await upsertAd(ad, brand.id);
      if (result === 'created') created++; else updated++;
    }

    const activeCount = ads.filter(a => !a.ad_delivery_stop_time).length;
    const totalReach = ads.reduce((sum, a) => sum + (a.eu_total_reach || 0), 0);

    await prisma.adLibraryBrand.update({
      where: { id: brand.id },
      data: {
        ingestionStatus: 'active',
        activeAdCount: activeCount,
        totalReach: BigInt(totalReach),
        lastCheckedAt: new Date(),
        failCount: 0,
      },
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: 'completed', adsCreated: created, adsUpdated: updated, completedAt: new Date() },
    });

    console.log(`  ✓ Done: ${created} created, ${updated} updated, ${activeCount} active`);
    return { success: true, ads: ads.length, created, updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Failed: ${errorMessage}`);

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage, completedAt: new Date() },
    });

    await prisma.adLibraryBrand.update({
      where: { id: brand.id },
      data: { ingestionStatus: 'failed', failCount: { increment: 1 } },
    });

    return { success: false, error: errorMessage };
  }
}

async function main() {
  const brandsArg = process.argv.find(a => a.startsWith('--brands'));
  const brandsToProcess = brandsArg ? parseInt(brandsArg.split('=')[1] || '5') : 5;

  console.log('=== Ad Library Ingestion ===');
  console.log(`Date filter: ads from ${getOneYearAgoDate()} onwards`);
  console.log(`Tokens: ${tokenManager.getTotalTokens()}`);
  console.log(`Brands to process: ${brandsToProcess}\n`);

  if (!tokenManager.hasTokens()) {
    console.error('No Facebook access tokens configured!');
    process.exit(1);
  }

  const brands = await prisma.adLibraryBrand.findMany({
    where: {
      ingestionStatus: { in: ['pending', 'failed'] },
      failCount: { lt: 3 },
    },
    orderBy: { priority: 'desc' },
    take: brandsToProcess,
  });

  console.log(`Found ${brands.length} brands to process`);

  let totalAds = 0, totalCreated = 0, totalUpdated = 0, successes = 0, failures = 0;

  for (const brand of brands) {
    const result = await processBrand(brand);
    if (result.success) {
      successes++;
      totalAds += result.ads || 0;
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
    } else {
      failures++;
    }

    // Pause between brands
    if (brands.indexOf(brand) < brands.length - 1) {
      console.log('  Waiting 10s before next brand...');
      await sleep(10000);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Brands: ${successes} succeeded, ${failures} failed`);
  console.log(`Ads: ${totalAds} total, ${totalCreated} created, ${totalUpdated} updated`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
