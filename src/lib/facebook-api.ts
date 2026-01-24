/**
 * Facebook Ad Library API Client
 *
 * Uses the official Graph API to fetch ad data with demographics.
 * EU DSA regulations require detailed demographic data for all ads shown in EU.
 */

import type {
  AdDemographics,
  DemographicBreakdown,
  RegionBreakdown,
  AggregatedDemographics,
} from './demographic-types';
import { analyzeSpend, COUNTRY_NAMES, type SpendAnalysis } from './spend-estimator';

// Facebook API response types
interface FacebookAgeGenderBreakdown {
  age_range: string;
  male?: number;
  female?: number;
  unknown?: number;
}

interface FacebookCountryBreakdown {
  country: string;
  age_gender_breakdowns: FacebookAgeGenderBreakdown[];
}

interface FacebookBeneficiaryPayer {
  payer: string;
  beneficiary: string;
  current: boolean;
}

interface FacebookTargetLocation {
  name: string;
  type: string;
  excluded: boolean;
  num_obfuscated?: number;
}

interface FacebookAdCreativeLinkDescription {
  text?: string;
}

interface FacebookAdData {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: FacebookAdCreativeLinkDescription[];
  ad_creative_link_captions?: string[];
  eu_total_reach?: number;
  age_country_gender_reach_breakdown?: FacebookCountryBreakdown[];
  beneficiary_payers?: FacebookBeneficiaryPayer[];
  target_ages?: string[];
  target_gender?: string;
  target_locations?: FacebookTargetLocation[];
  languages?: string[];
  publisher_platforms?: string[];
  estimated_audience_size_lower?: number;
  estimated_audience_size_upper?: number;
}

interface FacebookApiResponse {
  data: FacebookAdData[];
  paging?: {
    cursors?: {
      after?: string;
      before?: string;
    };
    next?: string;
  };
}

export interface FacebookAdResult {
  adId: string;
  adArchiveId: string;
  pageId: string;
  pageName: string;
  startedRunning: string | null;
  stoppedRunning: string | null;
  isActive: boolean;
  creativeBody: string | null;
  linkTitle: string | null;
  linkCaption: string | null;
  euTotalReach: number;
  mediaType: 'video' | 'image' | 'unknown';
  demographics: AdDemographics | null;
  targeting: {
    ageMin: string | null;
    ageMax: string | null;
    gender: string;
    locations: string[];
  };
  beneficiary: string | null;
  payer: string | null;
}

export interface MediaTypeBreakdown {
  video: number;
  image: number;
  unknown: number;
  videoPercentage: number;
  imagePercentage: number;
}

export interface ProductMarketReach {
  countryCode: string;
  countryName: string;
  reach: number;
  percentage: number;
}

export interface ProductAnalysis {
  productId: string;
  productName: string;
  description: string | null;
  adCount: number;
  totalReach: number;
  isActive: boolean;
  startedRunning: string | null;
  markets: ProductMarketReach[];
  adIds: string[];
}

export interface ProductMarketMatrix {
  products: ProductAnalysis[];
  allMarkets: string[];
  totalReach: number;
}

export interface FacebookApiResult {
  success: true;
  pageId: string;
  pageName: string | null;
  ads: FacebookAdResult[];
  totalAdsFound: number;
  aggregatedDemographics: AggregatedDemographics | null;
  mediaTypeBreakdown: MediaTypeBreakdown | null;
  productAnalysis: ProductMarketMatrix | null;
  spendAnalysis: SpendAnalysis | null;
  metadata: {
    apiVersion: string;
    countries: string[];
    fetchedAt: string;
  };
}

export interface FacebookApiError {
  success: false;
  error: string;
  code?: number;
  subcode?: number;
}

export type FacebookApiResponse2 = FacebookApiResult | FacebookApiError;

// EU countries for DSA compliance
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Key EU markets to query separately for accurate country distribution
// These are the largest EU ad markets by spend
const KEY_EU_MARKETS = ['DE', 'FR', 'NL', 'SE', 'FI', 'DK', 'ES', 'IT', 'PL', 'BE'];

const API_VERSION = 'v19.0';
const API_BASE = 'https://graph.facebook.com';

/**
 * Extract page ID from Facebook Ad Library URL
 */
export function extractPageIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Try view_all_page_id parameter first
    const viewAllPageId = urlObj.searchParams.get('view_all_page_id');
    if (viewAllPageId) return viewAllPageId;

    // Try active_status with page ID in path
    const pageIdMatch = url.match(/[?&]view_all_page_id=(\d+)/);
    if (pageIdMatch) return pageIdMatch[1];

    // Try to extract from other URL patterns
    const searchParams = urlObj.searchParams;
    const id = searchParams.get('id');
    if (id && /^\d+$/.test(id)) return id;

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert Facebook API age/gender breakdown to our format
 */
function convertDemographics(
  breakdowns: FacebookCountryBreakdown[] | undefined,
  euTotalReach: number
): { ageGender: DemographicBreakdown[]; regions: RegionBreakdown[] } | null {
  if (!breakdowns || breakdowns.length === 0) {
    return null;
  }

  const ageGenderMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  let totalReach = 0;

  for (const country of breakdowns) {
    let countryReach = 0;

    for (const breakdown of country.age_gender_breakdowns) {
      const maleReach = breakdown.male || 0;
      const femaleReach = breakdown.female || 0;
      const unknownReach = breakdown.unknown || 0;
      const ageReach = maleReach + femaleReach + unknownReach;
      countryReach += ageReach;

      // Aggregate age-gender
      if (maleReach > 0) {
        const key = `${breakdown.age_range}|male`;
        ageGenderMap.set(key, (ageGenderMap.get(key) || 0) + maleReach);
      }
      if (femaleReach > 0) {
        const key = `${breakdown.age_range}|female`;
        ageGenderMap.set(key, (ageGenderMap.get(key) || 0) + femaleReach);
      }
      if (unknownReach > 0) {
        const key = `${breakdown.age_range}|unknown`;
        ageGenderMap.set(key, (ageGenderMap.get(key) || 0) + unknownReach);
      }
    }

    regionMap.set(country.country, (regionMap.get(country.country) || 0) + countryReach);
    totalReach += countryReach;
  }

  if (totalReach === 0) return null;

  // Convert to percentages
  const ageGender: DemographicBreakdown[] = [];
  for (const [key, reach] of ageGenderMap) {
    const [age, gender] = key.split('|');
    ageGender.push({
      age,
      gender,
      percentage: (reach / totalReach) * 100,
    });
  }

  const regions: RegionBreakdown[] = [];
  for (const [region, reach] of regionMap) {
    regions.push({
      region,
      percentage: (reach / totalReach) * 100,
    });
  }

  // Sort by percentage descending
  ageGender.sort((a, b) => b.percentage - a.percentage);
  regions.sort((a, b) => b.percentage - a.percentage);

  return { ageGender, regions };
}

/**
 * Aggregate demographics across multiple ads
 */
function aggregateDemographics(ads: FacebookAdResult[]): AggregatedDemographics | null {
  const adsWithDemographics = ads.filter(ad => ad.demographics !== null);

  if (adsWithDemographics.length === 0) return null;

  const ageMap = new Map<string, number>();
  const genderMap = new Map<string, number>();
  const ageGenderMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  let totalWeight = 0;
  let adsWithoutReach = 0;

  for (const ad of adsWithDemographics) {
    if (!ad.demographics) continue;

    // Use reach as weight, default to 1 if no reach
    const weight = ad.euTotalReach > 0 ? ad.euTotalReach : 1;
    if (ad.euTotalReach === 0) adsWithoutReach++;
    totalWeight += weight;

    // Aggregate age-gender breakdown
    for (const item of ad.demographics.ageGenderBreakdown) {
      const weightedValue = (item.percentage / 100) * weight;

      // Age only
      ageMap.set(item.age, (ageMap.get(item.age) || 0) + weightedValue);

      // Gender only
      genderMap.set(item.gender, (genderMap.get(item.gender) || 0) + weightedValue);

      // Combined
      const key = `${item.age}|${item.gender}`;
      ageGenderMap.set(key, (ageGenderMap.get(key) || 0) + weightedValue);
    }

    // Aggregate region breakdown
    for (const item of ad.demographics.regionBreakdown) {
      const weightedValue = (item.percentage / 100) * weight;
      regionMap.set(item.region, (regionMap.get(item.region) || 0) + weightedValue);
    }
  }

  if (totalWeight === 0) return null;

  // Convert to percentages
  const ageBreakdown = Array.from(ageMap.entries())
    .map(([age, value]) => ({ age, percentage: (value / totalWeight) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  const genderBreakdown = Array.from(genderMap.entries())
    .map(([gender, value]) => ({ gender, percentage: (value / totalWeight) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  const ageGenderBreakdown = Array.from(ageGenderMap.entries())
    .map(([key, value]) => {
      const [age, gender] = key.split('|');
      return { age, gender, percentage: (value / totalWeight) * 100 };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const regionBreakdown = Array.from(regionMap.entries())
    .map(([region, value]) => ({ region, percentage: (value / totalWeight) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    ageBreakdown,
    genderBreakdown,
    ageGenderBreakdown,
    regionBreakdown,
    totalReachAnalyzed: totalWeight,
    adsWithDemographics: adsWithDemographics.length,
    adsWithoutReach,
  };
}

/**
 * Analyze products by market - groups ads by product and shows reach per country
 */
function analyzeProductsByMarket(ads: FacebookAdResult[]): ProductMarketMatrix | null {
  if (ads.length === 0) return null;

  // Group ads by product name (linkTitle or first part of creativeBody)
  const productMap = new Map<string, {
    ads: FacebookAdResult[];
    totalReach: number;
    marketReach: Map<string, number>;
  }>();

  const allMarketsSet = new Set<string>();

  for (const ad of ads) {
    if (!ad.demographics || ad.euTotalReach === 0) continue;

    // Determine product name
    const productName = ad.linkTitle ||
      (ad.creativeBody ? ad.creativeBody.slice(0, 50).trim() + (ad.creativeBody.length > 50 ? '...' : '') : null) ||
      `Ad ${ad.adId}`;

    // Get or create product entry
    let product = productMap.get(productName);
    if (!product) {
      product = {
        ads: [],
        totalReach: 0,
        marketReach: new Map(),
      };
      productMap.set(productName, product);
    }

    product.ads.push(ad);
    product.totalReach += ad.euTotalReach;

    // Calculate reach per country
    for (const region of ad.demographics.regionBreakdown) {
      const countryCode = region.region.toUpperCase();
      const reach = Math.round((region.percentage / 100) * ad.euTotalReach);

      allMarketsSet.add(countryCode);
      product.marketReach.set(
        countryCode,
        (product.marketReach.get(countryCode) || 0) + reach
      );
    }
  }

  if (productMap.size === 0) return null;

  // Convert to ProductAnalysis array
  const products: ProductAnalysis[] = Array.from(productMap.entries())
    .map(([productName, data]) => {
      // Convert market reach to sorted array
      const markets: ProductMarketReach[] = Array.from(data.marketReach.entries())
        .map(([countryCode, reach]) => ({
          countryCode,
          countryName: COUNTRY_NAMES[countryCode] || countryCode,
          reach,
          percentage: data.totalReach > 0 ? (reach / data.totalReach) * 100 : 0,
        }))
        .sort((a, b) => b.reach - a.reach);

      // Get earliest start date and check if any ad is active
      const startDates = data.ads
        .map(ad => ad.startedRunning)
        .filter((d): d is string => d !== null)
        .sort();

      const isActive = data.ads.some(ad => ad.isActive);

      return {
        productId: data.ads[0].adId,
        productName,
        description: data.ads[0].creativeBody,
        adCount: data.ads.length,
        totalReach: data.totalReach,
        isActive,
        startedRunning: startDates[0] || null,
        markets,
        adIds: data.ads.map(ad => ad.adArchiveId),
      };
    })
    .sort((a, b) => b.totalReach - a.totalReach);

  // Get all unique markets sorted by total reach
  const allMarkets = Array.from(allMarketsSet);

  return {
    products: products.slice(0, 20), // Top 20 products
    allMarkets,
    totalReach: products.reduce((sum, p) => sum + p.totalReach, 0),
  };
}

/**
 * Count ads by media type using the media_type filter
 */
async function countAdsByMediaType(options: {
  accessToken: string;
  pageId: string;
  countries: string[];
  mediaType: 'VIDEO' | 'IMAGE';
}): Promise<number> {
  const { accessToken, pageId, countries, mediaType } = options;

  const params = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: JSON.stringify(countries),
    ad_type: 'ALL',
    search_page_ids: pageId,
    media_type: mediaType,
    fields: 'id',
    limit: '500', // Fetch up to 500 to count
  });

  try {
    const res = await fetch(`${API_BASE}/${API_VERSION}/ads_archive?${params}`);
    const data = await res.json() as FacebookApiResponse | { error: unknown };

    if ('error' in data) {
      return 0;
    }

    return data.data.length;
  } catch {
    return 0;
  }
}

/**
 * Fetch ads for a single country (internal helper)
 */
async function fetchAdsForCountry(options: {
  accessToken: string;
  pageId: string;
  country: string;
  limit: number;
  adType: string;
  activeStatus: 'ACTIVE' | 'INACTIVE' | 'ALL';
}): Promise<FacebookAdData[]> {
  const { accessToken, pageId, country, limit, adType, activeStatus } = options;

  const fields = [
    'id',
    'page_id',
    'page_name',
    'ad_delivery_start_time',
    'ad_delivery_stop_time',
    'ad_creative_bodies',
    'ad_creative_link_titles',
    'ad_creative_link_descriptions',
    'ad_creative_link_captions',
    'eu_total_reach',
    'age_country_gender_reach_breakdown',
    'beneficiary_payers',
    'target_ages',
    'target_gender',
    'target_locations',
    'languages',
    'publisher_platforms',
  ].join(',');

  const params = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: JSON.stringify([country]),
    ad_type: adType,
    ad_active_status: activeStatus,
    fields,
    limit: limit.toString(),
    search_page_ids: pageId,
  });

  try {
    const res = await fetch(`${API_BASE}/${API_VERSION}/ads_archive?${params}`);
    const data = await res.json() as FacebookApiResponse | { error: { message: string } };

    if ('error' in data) {
      console.error(`Error fetching ads for ${country}:`, data.error.message);
      return [];
    }

    return data.data;
  } catch (error) {
    console.error(`Failed to fetch ads for ${country}:`, error);
    return [];
  }
}

/**
 * Fetch ads from Facebook Ad Library API
 */
export async function fetchFacebookAds(options: {
  accessToken: string;
  pageId?: string;
  searchTerms?: string;
  countries?: string[];
  limit?: number;
  adType?: 'ALL' | 'POLITICAL_AND_ISSUE_ADS';
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
}): Promise<FacebookApiResponse2> {
  const {
    accessToken,
    pageId,
    searchTerms,
    countries = ['NL'], // Default to Netherlands for EU DSA data
    limit = 1000,
    adType = 'ALL',
    activeStatus = 'ACTIVE',
  } = options;

  if (!pageId && !searchTerms) {
    return {
      success: false,
      error: 'Either pageId or searchTerms is required',
    };
  }

  const allAds: FacebookAdData[] = [];
  let pageName: string | null = null;
  let fetchedPageId: string | null = pageId || null;

  try {
    // When querying multiple EU countries, fetch each key market separately
    // to get a representative sample from each country
    const useMultiCountryQuery = countries.length > 5 && pageId;

    if (useMultiCountryQuery && pageId) {
      // Query each key market separately (in parallel batches to avoid rate limits)
      const adsPerCountry = Math.ceil(limit / KEY_EU_MARKETS.length);
      const adIdSet = new Set<string>();

      // Fetch in parallel batches of 3 to be gentle on rate limits
      for (let i = 0; i < KEY_EU_MARKETS.length; i += 3) {
        const batch = KEY_EU_MARKETS.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(country =>
            fetchAdsForCountry({
              accessToken,
              pageId,
              country,
              limit: adsPerCountry,
              adType,
              activeStatus,
            })
          )
        );

        // Merge and deduplicate
        for (const countryAds of batchResults) {
          for (const ad of countryAds) {
            if (!adIdSet.has(ad.id)) {
              adIdSet.add(ad.id);
              allAds.push(ad);

              // Extract page info from first ad
              if (!pageName && ad.page_name) {
                pageName = ad.page_name;
                fetchedPageId = ad.page_id || fetchedPageId;
              }
            }
          }
        }
      }
    } else {
      // Single country or small country list - use standard query
      const fields = [
        'id',
        'page_id',
        'page_name',
        'ad_delivery_start_time',
        'ad_delivery_stop_time',
        'ad_creative_bodies',
        'ad_creative_link_titles',
        'ad_creative_link_descriptions',
        'ad_creative_link_captions',
        'eu_total_reach',
        'age_country_gender_reach_breakdown',
        'beneficiary_payers',
        'target_ages',
        'target_gender',
        'target_locations',
        'languages',
        'publisher_platforms',
      ].join(',');

      const params = new URLSearchParams({
        access_token: accessToken,
        ad_reached_countries: JSON.stringify(countries),
        ad_type: adType,
        ad_active_status: activeStatus,
        fields,
        limit: limit.toString(),
      });

      if (pageId) {
        params.set('search_page_ids', pageId);
      }
      if (searchTerms) {
        params.set('search_terms', searchTerms);
      }

      let currentUrl: string | null = `${API_BASE}/${API_VERSION}/ads_archive?${params}`;

      while (currentUrl && allAds.length < limit) {
        const res: Response = await fetch(currentUrl);
        const data = await res.json() as FacebookApiResponse | { error: { message: string; code: number; error_subcode?: number } };

        if ('error' in data) {
          return {
            success: false,
            error: data.error.message,
            code: data.error.code,
            subcode: data.error.error_subcode,
          };
        }

        allAds.push(...data.data);

        // Extract page info from first ad
        if (!pageName && data.data.length > 0) {
          pageName = data.data[0].page_name || null;
          fetchedPageId = data.data[0].page_id || fetchedPageId;
        }

        // Check for more pages
        currentUrl = data.paging?.next ?? null;

        // Respect limit
        if (allAds.length >= limit) {
          allAds.splice(limit);
          break;
        }
      }
    }

    // Convert to our format
    const ads: FacebookAdResult[] = allAds.map(ad => {
      const demographics = convertDemographics(
        ad.age_country_gender_reach_breakdown,
        ad.eu_total_reach || 0
      );

      const currentBeneficiary = ad.beneficiary_payers?.find(bp => bp.current);

      return {
        adId: ad.id,
        adArchiveId: ad.id,
        pageId: ad.page_id || fetchedPageId || '',
        pageName: ad.page_name || pageName || '',
        startedRunning: ad.ad_delivery_start_time || null,
        stoppedRunning: ad.ad_delivery_stop_time || null,
        isActive: !ad.ad_delivery_stop_time,
        creativeBody: ad.ad_creative_bodies?.[0] || null,
        linkTitle: ad.ad_creative_link_titles?.[0] || null,
        linkCaption: ad.ad_creative_link_captions?.[0] || null,
        euTotalReach: ad.eu_total_reach || 0,
        mediaType: 'unknown' as const, // Media type determined via separate API calls
        demographics: demographics ? {
          adArchiveId: ad.id,
          ageGenderBreakdown: demographics.ageGender,
          regionBreakdown: demographics.regions,
          euTotalReach: ad.eu_total_reach,
        } : null,
        targeting: {
          ageMin: ad.target_ages?.[0] || null,
          ageMax: ad.target_ages?.[1] || null,
          gender: ad.target_gender || 'All',
          locations: ad.target_locations?.map(loc => loc.name) || [],
        },
        beneficiary: currentBeneficiary?.beneficiary || null,
        payer: currentBeneficiary?.payer || null,
      };
    });

    // Sort by reach descending
    ads.sort((a, b) => b.euTotalReach - a.euTotalReach);

    // Aggregate demographics
    const aggregatedDemographics = aggregateDemographics(ads);

    // Get media type breakdown via separate filtered API calls (in parallel)
    let mediaTypeBreakdown: MediaTypeBreakdown | null = null;
    if (fetchedPageId) {
      const [videoCount, imageCount] = await Promise.all([
        countAdsByMediaType({ accessToken, pageId: fetchedPageId, countries, mediaType: 'VIDEO' }),
        countAdsByMediaType({ accessToken, pageId: fetchedPageId, countries, mediaType: 'IMAGE' }),
      ]);

      const totalCounted = videoCount + imageCount;
      if (totalCounted > 0) {
        mediaTypeBreakdown = {
          video: videoCount,
          image: imageCount,
          unknown: 0,
          videoPercentage: (videoCount / totalCounted) * 100,
          imagePercentage: (imageCount / totalCounted) * 100,
        };
      }
    }

    // Analyze spend
    const spendAnalysis = analyzeSpend(ads);

    // Analyze products by market
    const productAnalysis = analyzeProductsByMarket(ads);

    return {
      success: true,
      pageId: fetchedPageId || '',
      pageName,
      ads,
      totalAdsFound: ads.length,
      aggregatedDemographics,
      mediaTypeBreakdown,
      productAnalysis,
      spendAnalysis,
      metadata: {
        apiVersion: API_VERSION,
        countries,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch ads for a specific page by URL or page ID
 */
export async function fetchAdsByPageUrl(
  adLibraryUrl: string,
  accessToken: string,
  options?: {
    countries?: string[];
    limit?: number;
    activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  }
): Promise<FacebookApiResponse2> {
  const pageId = extractPageIdFromUrl(adLibraryUrl);

  if (!pageId) {
    return {
      success: false,
      error: 'Could not extract page ID from URL. Make sure the URL contains view_all_page_id parameter.',
    };
  }

  return fetchFacebookAds({
    accessToken,
    pageId,
    countries: options?.countries,
    limit: options?.limit,
    activeStatus: options?.activeStatus,
  });
}
