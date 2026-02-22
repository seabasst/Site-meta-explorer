import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

// Meta API config
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// Token rotation manager
class TokenManager {
  private tokens: string[];
  private currentIndex: number = 0;
  private rateLimitedTokens: Set<number> = new Set();
  private rateLimitResetTimes: Map<number, number> = new Map();

  constructor() {
    this.tokens = [];

    // Support multiple formats:
    // 1. FACEBOOK_ACCESS_TOKEN1, FACEBOOK_ACCESS_TOKEN2, etc.
    // 2. Comma-separated FACEBOOK_ACCESS_TOKENS
    // 3. Single FACEBOOK_ACCESS_TOKEN

    // Check for numbered tokens (TOKEN1, TOKEN2, etc.)
    for (let i = 1; i <= 10; i++) {
      const token = process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
      if (token && token.trim()) {
        this.tokens.push(token.trim());
      }
    }

    // If no numbered tokens, try comma-separated
    if (this.tokens.length === 0) {
      const tokensEnv = process.env.FACEBOOK_ACCESS_TOKENS;
      if (tokensEnv) {
        this.tokens = tokensEnv.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
    }

    // If still no tokens, try single token
    if (this.tokens.length === 0) {
      const singleToken = process.env.FACEBOOK_ACCESS_TOKEN;
      if (singleToken && singleToken.trim()) {
        this.tokens.push(singleToken.trim());
      }
    }

    console.log(`TokenManager initialized with ${this.tokens.length} token(s)`);
  }

  hasTokens(): boolean {
    return this.tokens.length > 0;
  }

  getToken(): string {
    if (this.tokens.length === 0) {
      throw new Error('No Facebook access tokens configured');
    }

    // Clear expired rate limits
    const now = Date.now();
    for (const [index, resetTime] of this.rateLimitedTokens.entries()) {
      const time = this.rateLimitResetTimes.get(index);
      if (time && now > time) {
        this.rateLimitedTokens.delete(index);
        this.rateLimitResetTimes.delete(index);
      }
    }

    // Find an available token
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      if (!this.rateLimitedTokens.has(index)) {
        this.currentIndex = index;
        return this.tokens[index];
      }
    }

    // All tokens rate limited, return current anyway
    return this.tokens[this.currentIndex];
  }

  markRateLimited(waitTimeMs: number = 60000): void {
    console.log(`Token ${this.currentIndex + 1}/${this.tokens.length} rate limited, rotating...`);
    this.rateLimitedTokens.add(this.currentIndex);
    this.rateLimitResetTimes.set(this.currentIndex, Date.now() + waitTimeMs);

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  getCurrentTokenIndex(): number {
    return this.currentIndex + 1; // 1-indexed for logging
  }

  getTotalTokens(): number {
    return this.tokens.length;
  }

  allTokensRateLimited(): boolean {
    return this.rateLimitedTokens.size >= this.tokens.length;
  }
}

// Global token manager instance
const tokenManager = new TokenManager();

// Conservative rate limiting
const DELAY_BETWEEN_REQUESTS = 2000;
const BRANDS_PER_RUN = 2; // Process only 2 brands per cron run
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 30000;

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
  retryCount = 0,
  limit = 100
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const token = tokenManager.getToken();
  const params = new URLSearchParams({
    access_token: token,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: AD_FIELDS,
    limit: String(limit),
  });

  if (cursor) {
    params.set('after', cursor);
  }

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
  const data = await response.json();

  if (data.error) {
    const rateLimitCodes = [2, 4, 17, 613, 80004]; // 2 = temporary error

    // Handle "reduce data" error (code 1) by reducing limit
    if (data.error.code === 1 && limit > 10) {
      const reducedLimit = Math.floor(limit / 2);
      console.log(`Data too large, reducing limit from ${limit} to ${reducedLimit}...`);
      return fetchAdsPage(pageId, cursor, retryCount, reducedLimit);
    }

    if (rateLimitCodes.includes(data.error.code) && retryCount < MAX_RETRIES) {
      // Mark current token as rate limited and rotate
      tokenManager.markRateLimited(INITIAL_RETRY_DELAY * Math.pow(2, retryCount));

      // If we have multiple tokens and not all are rate limited, retry immediately with new token
      if (tokenManager.getTotalTokens() > 1 && !tokenManager.allTokensRateLimited()) {
        console.log(`Switching to token ${tokenManager.getCurrentTokenIndex()}/${tokenManager.getTotalTokens()}, retrying immediately...`);
        return fetchAdsPage(pageId, cursor, retryCount + 1, limit);
      }

      // All tokens exhausted, wait before retrying
      const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`All tokens rate limited, waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
      return fetchAdsPage(pageId, cursor, retryCount + 1, limit);
    }
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return {
    ads: data.data || [],
    nextCursor: data.paging?.cursors?.after,
  };
}

async function fetchAdsBySearchTerms(
  searchTerm: string,
  cursor?: string,
  limit = 100
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const token = tokenManager.getToken();
  const params = new URLSearchParams({
    access_token: token,
    search_terms: searchTerm,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: AD_FIELDS,
    limit: String(limit),
  });

  if (cursor) {
    params.set('after', cursor);
  }

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return {
    ads: data.data || [],
    nextCursor: data.paging?.cursors?.after,
  };
}

async function fetchAllAdsForBrand(pageId: string, pageName?: string): Promise<MetaAd[]> {
  const allAds: MetaAd[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;

  // First try with page ID
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

  // If no ads found and we have a page name, try search by name
  if (allAds.length === 0 && pageName) {
    console.log(`  No ads found by page ID, trying search by name: "${pageName}"`);
    cursor = undefined;

    try {
      do {
        const { ads, nextCursor } = await fetchAdsBySearchTerms(pageName, cursor);

        // Filter to only include ads that seem to be from this brand
        // (search_terms is fuzzy, so we need to verify)
        for (const ad of ads) {
          const adPageName = ad.page_name?.toLowerCase() || '';
          const searchName = pageName.toLowerCase();
          // Accept if page name contains brand name or vice versa
          if (adPageName.includes(searchName) || searchName.includes(adPageName)) {
            if (!seenIds.has(ad.id)) {
              seenIds.add(ad.id);
              allAds.push(ad);
            }
          }
        }

        cursor = nextCursor;
        // Limit search results to avoid getting too many unrelated ads
        if (cursor && allAds.length < 500) {
          await sleep(DELAY_BETWEEN_REQUESTS);
        } else {
          cursor = undefined; // Stop if we have enough ads
        }
      } while (cursor);
    } catch (error) {
      console.log(`  Search by name failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  return allAds;
}

function detectDisplayFormat(ad: MetaAd): string {
  // Check for video indicators in snapshot URL or content
  const snapshotUrl = ad.ad_snapshot_url || '';
  if (snapshotUrl.includes('video') || snapshotUrl.includes('reel')) {
    return 'video';
  }

  // Check for carousel indicators:
  // - Multiple distinct link titles with different URLs typically indicate carousel
  // - Multiple link descriptions with different content
  const titles = ad.ad_creative_link_titles || [];
  const descriptions = ad.ad_creative_link_descriptions || [];
  const captions = ad.ad_creative_link_captions || [];

  // Only mark as carousel if we have multiple DIFFERENT titles or descriptions
  // (not just variations of the same ad)
  const uniqueTitles = new Set(titles.filter(t => t && t.length > 0));
  const uniqueDescriptions = new Set(descriptions.filter(d => d && d.length > 0));

  if (uniqueTitles.size > 2 || uniqueDescriptions.size > 2 || captions.length > 2) {
    return 'carousel';
  }

  // Default to image for single-image ads
  return 'image';
}

async function upsertAd(ad: MetaAd, brandId: string): Promise<{ action: 'created' | 'updated'; adDbId: string }> {
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

  let adDbId: string;
  let action: 'created' | 'updated';

  if (existing) {
    await prisma.adLibraryAd.update({ where: { id: existing.id }, data });
    adDbId = existing.id;
    action = 'updated';
  } else {
    const created = await prisma.adLibraryAd.create({ data });
    adDbId = created.id;
    action = 'created';
  }

  // Create/update AdAsset with fresh snapshot URL for later processing
  if (ad.ad_snapshot_url) {
    // Check if asset already exists and is completed
    const existingAsset = await prisma.adAsset.findUnique({
      where: { id: `${adDbId}-0` },
      select: { downloadStatus: true },
    });

    if (!existingAsset) {
      // Create new asset record
      await prisma.adAsset.create({
        data: {
          id: `${adDbId}-0`,
          adId: adDbId,
          assetType: detectDisplayFormat(ad) === 'video' ? 'video' : 'image',
          position: 0,
          originalUrl: ad.ad_snapshot_url,
          downloadStatus: 'pending',
        },
      });
    } else if (existingAsset.downloadStatus !== 'completed') {
      // Update with fresh URL if not already completed
      await prisma.adAsset.update({
        where: { id: `${adDbId}-0` },
        data: {
          originalUrl: ad.ad_snapshot_url,
          downloadStatus: 'pending',
          downloadError: null,
        },
      });
    }
  }

  return { action, adDbId };
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
    // Fetch ads - try by page ID first, then by name if no results
    const ads = await fetchAllAdsForBrand(pageId, pageName);
    console.log(`Fetched ${ads.length} ads for ${pageName}`);

    // Update job progress
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { adsFetched: ads.length },
    });

    // Upsert ads and create asset records
    let created = 0;
    let updated = 0;
    let assetsQueued = 0;
    for (const ad of ads) {
      const result = await upsertAd(ad, brandId);
      if (result.action === 'created') created++;
      else updated++;
      if (ad.ad_snapshot_url) assetsQueued++;
    }
    console.log(`Queued ${assetsQueued} assets for processing`);

    // Update brand status
    const activeCount = ads.filter(a => !a.ad_delivery_stop_time).length;
    const totalReach = ads.reduce((sum, a) => sum + (a.eu_total_reach || 0), 0);

    await prisma.adLibraryBrand.update({
      where: { id: brandId },
      data: {
        ingestionStatus: 'active',
        activeAdCount: activeCount,
        totalReach: BigInt(totalReach),
        lastCheckedAt: new Date(),
        failCount: 0, // Reset on success
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

    // Mark brand as failed and increment fail count
    await prisma.adLibraryBrand.update({
      where: { id: brandId },
      data: {
        ingestionStatus: 'failed',
        failCount: { increment: 1 },
      },
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

  if (!tokenManager.hasTokens()) {
    return NextResponse.json({ error: 'No Facebook access tokens configured (set FACEBOOK_ACCESS_TOKENS or FACEBOOK_ACCESS_TOKEN)' }, { status: 500 });
  }

  try {
    // Get pending/failed brands to process (skip brands that failed 3+ times)
    const brands = await prisma.adLibraryBrand.findMany({
      where: {
        ingestionStatus: { in: ['pending', 'failed'] },
        failCount: { lt: 3 }, // Skip brands that failed too many times
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

    console.log(`Cron: Processing ${brands.length} brands (using ${tokenManager.getTotalTokens()} token(s))`);

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
      tokensConfigured: tokenManager.getTotalTokens(),
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
