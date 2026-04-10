import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

// Meta API config
const API_VERSION = 'v22.0';
const BASE_URL = 'https://graph.facebook.com';

// Token status types
type TokenStatus = 'active' | 'rate_limited' | 'expired' | 'invalid';

// Rate limit usage tracking from Facebook headers
interface RateLimitUsage {
  callCount: number;        // Percentage of calls used (0-100)
  totalCpuTime: number;     // Percentage of CPU time used (0-100)
  totalTime: number;        // Percentage of total time used (0-100)
  estimatedTimeToReset: number; // Minutes until reset
}

interface TokenState {
  status: TokenStatus;
  lastError?: string;
  rateLimitResetTime?: number;
  lastUsed?: Date;
  requestCount: number;
  usage?: RateLimitUsage;   // Current rate limit usage
}

// Threshold for proactive rotation (percentage)
const USAGE_ROTATION_THRESHOLD = 80;

// Token rotation manager with health tracking
class TokenManager {
  private tokens: string[];
  private currentIndex: number = 0;
  private tokenStates: Map<number, TokenState> = new Map();

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

    // Initialize token states
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenStates.set(i, { status: 'active', requestCount: 0 });
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
    for (const [index, state] of this.tokenStates.entries()) {
      if (state.status === 'rate_limited' && state.rateLimitResetTime && now > state.rateLimitResetTime) {
        state.status = 'active';
        state.rateLimitResetTime = undefined;
        console.log(`Token ${index + 1} rate limit cleared, now active`);
      }
    }

    // Find an available token (prefer active, avoid expired/invalid)
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      const state = this.tokenStates.get(index);
      if (state && state.status === 'active') {
        this.currentIndex = index;
        state.lastUsed = new Date();
        state.requestCount++;
        return this.tokens[index];
      }
    }

    // Try rate-limited tokens (they might work with reduced load)
    for (let i = 0; i < this.tokens.length; i++) {
      const index = (this.currentIndex + i) % this.tokens.length;
      const state = this.tokenStates.get(index);
      if (state && state.status === 'rate_limited') {
        this.currentIndex = index;
        state.lastUsed = new Date();
        state.requestCount++;
        return this.tokens[index];
      }
    }

    // All tokens are expired/invalid - throw error
    throw new Error('All tokens are expired or invalid. Please update your Facebook access tokens.');
  }

  // Mark token as rate limited (temporary, will recover)
  markRateLimited(waitTimeMs: number = 60000): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'rate_limited';
      state.rateLimitResetTime = Date.now() + waitTimeMs;
      state.lastError = 'Rate limited';
      console.log(`Token ${this.currentIndex + 1}/${this.tokens.length} rate limited for ${waitTimeMs / 1000}s, rotating...`);
    }

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  // Mark token as expired (permanent until refreshed)
  markExpired(errorMessage?: string): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'expired';
      state.lastError = errorMessage || 'Token expired';
      console.log(`⚠️ Token ${this.currentIndex + 1}/${this.tokens.length} EXPIRED: ${errorMessage}`);
    }

    // Rotate to next token
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
  }

  // Mark token as invalid (wrong permissions, etc.)
  markInvalid(errorMessage?: string): void {
    const state = this.tokenStates.get(this.currentIndex);
    if (state) {
      state.status = 'invalid';
      state.lastError = errorMessage || 'Token invalid';
      console.log(`⚠️ Token ${this.currentIndex + 1}/${this.tokens.length} INVALID: ${errorMessage}`);
    }

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
    for (const state of this.tokenStates.values()) {
      if (state.status === 'active') return false;
    }
    return true;
  }

  // Check if any tokens are still usable
  hasUsableTokens(): boolean {
    for (const state of this.tokenStates.values()) {
      if (state.status === 'active' || state.status === 'rate_limited') return true;
    }
    return false;
  }

  // Get status summary for API response
  getStatusSummary(): {
    total: number;
    active: number;
    rateLimited: number;
    expired: number;
    invalid: number;
    details: Array<{
      token: number;
      status: TokenStatus;
      error?: string;
      requestCount: number;
      usage?: { call: number; cpu: number; time: number };
    }>;
  } {
    let active = 0, rateLimited = 0, expired = 0, invalid = 0;
    const details: Array<{
      token: number;
      status: TokenStatus;
      error?: string;
      requestCount: number;
      usage?: { call: number; cpu: number; time: number };
    }> = [];

    for (const [index, state] of this.tokenStates.entries()) {
      switch (state.status) {
        case 'active': active++; break;
        case 'rate_limited': rateLimited++; break;
        case 'expired': expired++; break;
        case 'invalid': invalid++; break;
      }
      details.push({
        token: index + 1,
        status: state.status,
        error: state.lastError,
        requestCount: state.requestCount,
        usage: state.usage ? {
          call: state.usage.callCount,
          cpu: state.usage.totalCpuTime,
          time: state.usage.totalTime,
        } : undefined,
      });
    }

    return { total: this.tokens.length, active, rateLimited, expired, invalid, details };
  }

  // Reset all token states (useful after updating tokens)
  resetStates(): void {
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenStates.set(i, { status: 'active', requestCount: 0 });
    }
    this.currentIndex = 0;
    console.log('TokenManager states reset');
  }

  // Update usage from Facebook response headers
  // Returns true if we should rotate to a different token
  updateUsageFromHeaders(headers: Headers): boolean {
    const state = this.tokenStates.get(this.currentIndex);
    if (!state) return false;

    // Facebook sends rate limit info in these headers (JSON format)
    // x-business-use-case-usage: {"app_id":{"call_count":X,"total_cputime":Y,"total_time":Z}}
    // x-app-usage: {"call_count":X,"total_cputime":Y,"total_time":Z}
    // x-ad-account-usage: {"acc_id_util_pct":X}

    let usage: RateLimitUsage | undefined;

    // Try x-app-usage first (simpler format)
    const appUsage = headers.get('x-app-usage');
    if (appUsage) {
      try {
        const parsed = JSON.parse(appUsage);
        usage = {
          callCount: parsed.call_count || 0,
          totalCpuTime: parsed.total_cputime || 0,
          totalTime: parsed.total_time || 0,
          estimatedTimeToReset: parsed.estimated_time_to_regain_access || 0,
        };
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Try x-business-use-case-usage (nested format)
    if (!usage) {
      const businessUsage = headers.get('x-business-use-case-usage');
      if (businessUsage) {
        try {
          const parsed = JSON.parse(businessUsage);
          // This is nested by app_id or ad_account_id, get first entry
          const firstKey = Object.keys(parsed)[0];
          if (firstKey && Array.isArray(parsed[firstKey]) && parsed[firstKey][0]) {
            const data = parsed[firstKey][0];
            usage = {
              callCount: data.call_count || 0,
              totalCpuTime: data.total_cputime || 0,
              totalTime: data.total_time || 0,
              estimatedTimeToReset: data.estimated_time_to_regain_access || 0,
            };
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    if (usage) {
      state.usage = usage;
      const maxUsage = Math.max(usage.callCount, usage.totalCpuTime, usage.totalTime);

      // Log when usage is getting high
      if (maxUsage >= 50) {
        console.log(`Token ${this.currentIndex + 1} usage: ${maxUsage}% (call: ${usage.callCount}%, cpu: ${usage.totalCpuTime}%, time: ${usage.totalTime}%)`);
      }

      // Proactively rotate if usage is above threshold
      if (maxUsage >= USAGE_ROTATION_THRESHOLD) {
        console.log(`⚡ Token ${this.currentIndex + 1} at ${maxUsage}% usage, proactively rotating...`);

        // Find a token with lower usage
        const currentMaxUsage = maxUsage;
        for (let i = 1; i < this.tokens.length; i++) {
          const nextIndex = (this.currentIndex + i) % this.tokens.length;
          const nextState = this.tokenStates.get(nextIndex);
          if (nextState && nextState.status === 'active') {
            const nextMaxUsage = nextState.usage
              ? Math.max(nextState.usage.callCount, nextState.usage.totalCpuTime, nextState.usage.totalTime)
              : 0;

            // Only rotate if next token has significantly lower usage
            if (nextMaxUsage < currentMaxUsage - 20) {
              this.currentIndex = nextIndex;
              console.log(`Switched to token ${nextIndex + 1} (${nextMaxUsage}% usage)`);
              return true;
            }
          }
        }

        // No better token found, continue with current
        console.log(`No better token available, continuing with token ${this.currentIndex + 1}`);
      }
    }

    return false;
  }

  // Get the best available token (lowest usage)
  getBestToken(): string {
    if (this.tokens.length === 0) {
      throw new Error('No Facebook access tokens configured');
    }

    // Clear expired rate limits first
    const now = Date.now();
    for (const [index, state] of this.tokenStates.entries()) {
      if (state.status === 'rate_limited' && state.rateLimitResetTime && now > state.rateLimitResetTime) {
        state.status = 'active';
        state.rateLimitResetTime = undefined;
        state.usage = undefined; // Clear usage on reset
        console.log(`Token ${index + 1} rate limit cleared, now active`);
      }
    }

    // Find active token with lowest usage
    let bestIndex = -1;
    let lowestUsage = Infinity;

    for (let i = 0; i < this.tokens.length; i++) {
      const state = this.tokenStates.get(i);
      if (state && state.status === 'active') {
        const maxUsage = state.usage
          ? Math.max(state.usage.callCount, state.usage.totalCpuTime, state.usage.totalTime)
          : 0;

        if (maxUsage < lowestUsage) {
          lowestUsage = maxUsage;
          bestIndex = i;
        }
      }
    }

    if (bestIndex >= 0) {
      this.currentIndex = bestIndex;
      const state = this.tokenStates.get(bestIndex)!;
      state.lastUsed = new Date();
      state.requestCount++;
      return this.tokens[bestIndex];
    }

    // Fallback to regular getToken() logic
    return this.getToken();
  }
}

// Global token manager instance
const tokenManager = new TokenManager();

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 2000;
const BRANDS_PER_RUN = 10; // Process 10 brands per cron run
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 30000;

// Target countries - Nordic + major EU markets
// Balance between coverage and avoiding "data too large" errors
const TARGET_COUNTRIES = [
  'SE', 'NO', 'DK', 'FI',  // Nordic
  'DE', 'GB', 'FR', 'NL',  // Major EU markets
];

// Core fields only - reduced to prevent "data too large" errors
// Full fields can be fetched later for individual ads if needed
const AD_FIELDS = [
  'id', 'ad_creation_time', 'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_snapshot_url', 'page_id', 'page_name', 'publisher_platforms',
  'ad_creative_bodies', 'ad_creative_link_titles', 'eu_total_reach',
].join(',');

// Fields for demographics fetch (separate smaller request)
const DEMOGRAPHICS_FIELDS = [
  'id', 'eu_total_reach', 'age_country_gender_reach_breakdown',
].join(',');

// EU countries for demographics (required for demographic data)
const EU_DEMOGRAPHICS_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

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

// Calculate date 1 year ago for filtering
function getOneYearAgoDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Check if a string is a numeric page ID
function isNumericPageId(pageId: string): boolean {
  return /^\d+$/.test(pageId);
}

// Reduced country list for search_terms queries (much smaller response)
const SEARCH_TERMS_COUNTRIES = ['SE', 'NO', 'DK', 'FI'];

// Minimal fields for initial fetch (reduces response size dramatically)
const MINIMAL_AD_FIELDS = [
  'id', 'ad_creation_time', 'ad_delivery_start_time', 'ad_delivery_stop_time',
  'ad_snapshot_url', 'page_id', 'page_name', 'publisher_platforms',
].join(',');

async function fetchAdsPage(
  pageId: string,
  pageName: string,
  cursor?: string,
  retryCount = 0,
  limit = 100
): Promise<{ ads: MetaAd[]; nextCursor?: string; effectiveLimit: number }> {
  const token = tokenManager.getBestToken();
  const usingSearchTerms = !isNumericPageId(pageId);

  // Use smaller query for search_terms to avoid "data too large" errors
  const countries = usingSearchTerms ? SEARCH_TERMS_COUNTRIES : TARGET_COUNTRIES;
  const fields = usingSearchTerms ? MINIMAL_AD_FIELDS : AD_FIELDS;
  const effectiveLimit = usingSearchTerms ? Math.min(limit, 10) : limit;

  const params = new URLSearchParams({
    access_token: token,
    ad_reached_countries: JSON.stringify(countries),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    ad_delivery_date_min: getOneYearAgoDate(), // Only ads from last year
    fields: fields,
    limit: String(effectiveLimit),
  });

  // Use search_page_ids for numeric IDs, search_terms for usernames/names
  if (!usingSearchTerms) {
    params.set('search_page_ids', pageId);
  } else {
    // Use brand name for search when we don't have a numeric ID
    params.set('search_terms', pageName);
    console.log(`Using search_terms for ${pageName} (non-numeric pageId: ${pageId}, limit: ${effectiveLimit}, countries: ${countries.length})`);
  }

  if (cursor) {
    params.set('after', cursor);
  }

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);

  // Check rate limit headers and proactively rotate if needed
  tokenManager.updateUsageFromHeaders(response.headers);

  const data = await response.json();

  if (data.error) {
    const errorCode = data.error.code;
    const errorMessage = data.error.message || 'Unknown error';

    // Error code categories:
    // - 190: Token expired/invalid (OAuth error)
    // - 102, 463, 467: Token/session issues
    // - 200, 10: Permissions error
    // - 2, 4, 17, 613, 80004: Rate limiting / temporary
    // - 1: Data too large (can retry with smaller limit)

    // Token expired (code 190)
    if (errorCode === 190) {
      tokenManager.markExpired(errorMessage);

      // If we have usable tokens, retry with next one
      if (tokenManager.hasUsableTokens()) {
        console.log(`Token expired, switching to token ${tokenManager.getCurrentTokenIndex()}/${tokenManager.getTotalTokens()}...`);
        return fetchAdsPage(pageId, pageName, cursor, retryCount, limit);
      }
      throw new Error(`All tokens expired. Please update your Facebook access tokens. Last error: ${errorMessage}`);
    }

    // Session/token issues (permanent until refreshed)
    if ([102, 463, 467].includes(errorCode)) {
      tokenManager.markExpired(errorMessage);
      if (tokenManager.hasUsableTokens()) {
        console.log(`Token invalid (code ${errorCode}), switching tokens...`);
        return fetchAdsPage(pageId, pageName, cursor, retryCount, limit);
      }
      throw new Error(`Token error (${errorCode}): ${errorMessage}`);
    }

    // Permission errors
    if ([200, 10].includes(errorCode)) {
      tokenManager.markInvalid(`Missing permissions: ${errorMessage}`);
      if (tokenManager.hasUsableTokens()) {
        console.log(`Token missing permissions (code ${errorCode}), trying next token...`);
        return fetchAdsPage(pageId, pageName, cursor, retryCount, limit);
      }
      throw new Error(`Permission error (${errorCode}): ${errorMessage}`);
    }

    // Handle "reduce data" error (code 1) by reducing limit
    // Allow smaller limits for search_terms (min 1) vs page_ids (min 5)
    const minLimit = usingSearchTerms ? 1 : 5;
    if (errorCode === 1 && limit > minLimit) {
      const reducedLimit = Math.max(minLimit, Math.floor(limit / 2));
      console.log(`Data too large, reducing limit from ${limit} to ${reducedLimit}...`);
      return fetchAdsPage(pageId, pageName, cursor, retryCount, reducedLimit);
    }

    // Rate limiting errors (temporary, will recover)
    const rateLimitCodes = [2, 4, 17, 613, 80004];
    if (rateLimitCodes.includes(errorCode) && retryCount < MAX_RETRIES) {
      // Mark current token as rate limited and rotate
      tokenManager.markRateLimited(INITIAL_RETRY_DELAY * Math.pow(2, retryCount));

      // If we have multiple tokens and not all are rate limited, retry immediately with new token
      if (tokenManager.getTotalTokens() > 1 && !tokenManager.allTokensRateLimited()) {
        console.log(`Switching to token ${tokenManager.getCurrentTokenIndex()}/${tokenManager.getTotalTokens()}, retrying immediately...`);
        return fetchAdsPage(pageId, pageName, cursor, retryCount + 1, limit);
      }

      // All tokens exhausted, wait before retrying
      const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`All tokens rate limited, waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
      return fetchAdsPage(pageId, pageName, cursor, retryCount + 1, limit);
    }

    throw new Error(`API Error: ${errorMessage} (code: ${errorCode})`);
  }

  return {
    ads: data.data || [],
    nextCursor: data.paging?.cursors?.after,
    effectiveLimit: limit,
  };
}

async function fetchAdsBySearchTerms(
  searchTerm: string,
  cursor?: string,
  limit = 100
): Promise<{ ads: MetaAd[]; nextCursor?: string }> {
  const token = tokenManager.getBestToken();
  const params = new URLSearchParams({
    access_token: token,
    search_terms: searchTerm,
    ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    ad_delivery_date_min: getOneYearAgoDate(), // Only ads from last year
    fields: AD_FIELDS,
    limit: String(limit),
  });

  if (cursor) {
    params.set('after', cursor);
  }

  const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);

  // Check rate limit headers and proactively rotate if needed
  tokenManager.updateUsageFromHeaders(response.headers);

  const data = await response.json();

  if (data.error) {
    throw new Error(`API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return {
    ads: data.data || [],
    nextCursor: data.paging?.cursors?.after,
  };
}

const MAX_ADS_PER_BRAND = 2000; // Limit to prevent runaway queries
const MAX_PAGES_FOR_SEARCH = 10; // Max API pages when using search_terms

async function fetchAllAdsForBrand(pageId: string, pageName: string): Promise<MetaAd[]> {
  const allAds: MetaAd[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  const usingSearchTerms = !isNumericPageId(pageId);
  let pageCount = 0;
  let currentLimit = 100; // Track effective limit across pages

  // First try with page ID (or search_terms for non-numeric IDs)
  do {
    const { ads, nextCursor, effectiveLimit } = await fetchAdsPage(pageId, pageName, cursor, 0, currentLimit);
    currentLimit = effectiveLimit; // Remember reduced limit for next page
    pageCount++;

    for (const ad of ads) {
      if (!seenIds.has(ad.id)) {
        // When using search_terms, filter to only include ads from this brand
        if (usingSearchTerms) {
          const adPageName = ad.page_name?.toLowerCase() || '';
          const searchName = pageName.toLowerCase();
          // Accept if page name closely matches brand name
          if (!adPageName.includes(searchName) && !searchName.includes(adPageName)) {
            continue; // Skip ads from other pages
          }
        }
        seenIds.add(ad.id);
        allAds.push(ad);
      }
    }

    cursor = nextCursor;

    // Stop conditions: no more pages, reached max ads, or too many pages for search_terms
    const shouldContinue = cursor &&
      allAds.length < MAX_ADS_PER_BRAND &&
      (!usingSearchTerms || pageCount < MAX_PAGES_FOR_SEARCH);

    if (shouldContinue) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    } else {
      cursor = undefined;
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

// =============================================================================
// Demographics Fetching
// =============================================================================

interface DemographicsAd {
  id: string;
  eu_total_reach?: number;
  age_country_gender_reach_breakdown?: Array<{
    country: string;
    age_gender_breakdowns: Array<{
      age_range: string;
      male: number;
      female: number;
      unknown: number;
    }>;
  }>;
}

interface AggregatedDemographics {
  ageBreakdown: { age: string; percentage: number }[];
  genderBreakdown: { gender: string; percentage: number }[];
  ageGenderBreakdown: { age: string; gender: string; percentage: number }[];
  regionBreakdown: { region: string; percentage: number }[];
  totalReachAnalyzed: number;
  adsWithDemographics: number;
  adsWithoutReach: number;
}

async function fetchDemographicsForBrand(
  pageId: string,
  limit = 50
): Promise<DemographicsAd[]> {
  const token = tokenManager.getBestToken();

  const params = new URLSearchParams({
    access_token: token,
    search_page_ids: pageId,
    ad_reached_countries: JSON.stringify(EU_DEMOGRAPHICS_COUNTRIES),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE', // Only active ads for current demographics
    fields: DEMOGRAPHICS_FIELDS,
    limit: String(limit),
  });

  try {
    const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    tokenManager.updateUsageFromHeaders(response.headers);

    const data = await response.json();

    if (data.error) {
      console.log(`Demographics fetch error: ${data.error.message}`);
      return [];
    }

    return data.data || [];
  } catch (error) {
    console.log(`Demographics fetch failed: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

function aggregateDemographicsFromAds(ads: DemographicsAd[]): AggregatedDemographics | null {
  const adsWithData = ads.filter(ad =>
    ad.age_country_gender_reach_breakdown &&
    ad.age_country_gender_reach_breakdown.length > 0
  );

  if (adsWithData.length === 0) return null;

  const ageMap = new Map<string, number>();
  const genderMap = new Map<string, number>();
  const ageGenderMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  let totalWeight = 0;
  let adsWithoutReach = 0;

  for (const ad of adsWithData) {
    const breakdown = ad.age_country_gender_reach_breakdown!;
    const weight = ad.eu_total_reach && ad.eu_total_reach > 0 ? ad.eu_total_reach : 1;
    if (!ad.eu_total_reach || ad.eu_total_reach === 0) adsWithoutReach++;
    totalWeight += weight;

    // Process each country's breakdown
    for (const countryData of breakdown) {
      const countryCode = countryData.country.toUpperCase();

      // Calculate total for this country to get percentages
      let countryTotal = 0;
      for (const ageData of countryData.age_gender_breakdowns) {
        countryTotal += (ageData.male || 0) + (ageData.female || 0) + (ageData.unknown || 0);
      }

      if (countryTotal === 0) continue;

      // Add to region map
      const countryWeight = weight * (countryTotal > 0 ? 1 : 0);
      regionMap.set(countryCode, (regionMap.get(countryCode) || 0) + countryWeight);

      // Process age-gender breakdown
      for (const ageData of countryData.age_gender_breakdowns) {
        const age = ageData.age_range;
        const maleCount = ageData.male || 0;
        const femaleCount = ageData.female || 0;
        const unknownCount = ageData.unknown || 0;
        const ageTotal = maleCount + femaleCount + unknownCount;

        if (ageTotal === 0) continue;

        // Weight by reach and country proportion
        const maleWeighted = (maleCount / countryTotal) * weight;
        const femaleWeighted = (femaleCount / countryTotal) * weight;
        const unknownWeighted = (unknownCount / countryTotal) * weight;

        // Age totals
        ageMap.set(age, (ageMap.get(age) || 0) + maleWeighted + femaleWeighted + unknownWeighted);

        // Gender totals
        genderMap.set('male', (genderMap.get('male') || 0) + maleWeighted);
        genderMap.set('female', (genderMap.get('female') || 0) + femaleWeighted);
        if (unknownWeighted > 0) {
          genderMap.set('unknown', (genderMap.get('unknown') || 0) + unknownWeighted);
        }

        // Age-gender combinations
        if (maleWeighted > 0) {
          const keyMale = `${age}|male`;
          ageGenderMap.set(keyMale, (ageGenderMap.get(keyMale) || 0) + maleWeighted);
        }
        if (femaleWeighted > 0) {
          const keyFemale = `${age}|female`;
          ageGenderMap.set(keyFemale, (ageGenderMap.get(keyFemale) || 0) + femaleWeighted);
        }
      }
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

  const regionTotal = Array.from(regionMap.values()).reduce((a, b) => a + b, 0);
  const regionBreakdown = Array.from(regionMap.entries())
    .map(([region, value]) => ({ region, percentage: regionTotal > 0 ? (value / regionTotal) * 100 : 0 }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    ageBreakdown,
    genderBreakdown,
    ageGenderBreakdown,
    regionBreakdown,
    totalReachAnalyzed: totalWeight,
    adsWithDemographics: adsWithData.length,
    adsWithoutReach,
  };
}

async function fetchAndStoreDemographics(brandId: string, pageId: string, pageName: string): Promise<boolean> {
  console.log(`  Fetching demographics for ${pageName}...`);

  try {
    const demographicsAds = await fetchDemographicsForBrand(pageId, 50);

    if (demographicsAds.length === 0) {
      console.log(`  No demographics data available for ${pageName}`);
      return false;
    }

    const aggregated = aggregateDemographicsFromAds(demographicsAds);

    if (!aggregated) {
      console.log(`  Could not aggregate demographics for ${pageName}`);
      return false;
    }

    // Store demographics in brand record
    await prisma.adLibraryBrand.update({
      where: { id: brandId },
      data: {
        demographicsJson: aggregated as object,
        demographicsUpdatedAt: new Date(),
      },
    });

    console.log(`  Stored demographics: ${aggregated.adsWithDemographics} ads analyzed, ${aggregated.ageBreakdown.length} age groups, ${aggregated.regionBreakdown.length} regions`);
    return true;
  } catch (error) {
    console.log(`  Demographics fetch/store failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

// =============================================================================
// Ad Processing
// =============================================================================

function detectDisplayFormat(ad: MetaAd): string {
  // Video detection via API media_type=video filter (set by processBrand)
  if ((ad as any)._isVideo) return 'video';

  const titles = ad.ad_creative_link_titles || [];
  const descriptions = ad.ad_creative_link_descriptions || [];
  const captions = ad.ad_creative_link_captions || [];

  const uniqueTitles = new Set(titles.filter(t => t && t.length > 0));
  const uniqueDescriptions = new Set(descriptions.filter(d => d && d.length > 0));

  if (uniqueTitles.size > 2 || uniqueDescriptions.size > 2 || captions.length > 2) {
    return 'carousel';
  }

  return 'image';
}

async function fetchVideoAdIds(pageId: string): Promise<Set<string>> {
  const videoIds = new Set<string>();
  if (!isNumericPageId(pageId)) return videoIds;

  let cursor: string | undefined;
  try {
    do {
      const token = tokenManager.getToken();
      const params = new URLSearchParams({
        access_token: token,
        search_page_ids: pageId,
        ad_reached_countries: JSON.stringify(TARGET_COUNTRIES),
        ad_type: 'ALL',
        media_type: 'video',
        fields: 'id',
        limit: '100',
      });
      if (cursor) params.set('after', cursor);

      const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
      const data = await response.json();

      if (data.error) break;

      for (const ad of data.data || []) {
        videoIds.add(ad.id);
      }
      cursor = data.paging?.cursors?.after;
      if (cursor) await sleep(2000);
    } while (cursor);
  } catch { /* skip on error */ }

  return videoIds;
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
    bylines: ad.bylines || null,
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
    // Fetch ads and video IDs in parallel
    const [ads, videoIds] = await Promise.all([
      fetchAllAdsForBrand(pageId, pageName),
      fetchVideoAdIds(pageId),
    ]);
    console.log(`Fetched ${ads.length} ads for ${pageName}, ${videoIds.size} detected as video`);

    // Tag video ads
    for (const ad of ads) {
      if (videoIds.has(ad.id)) (ad as any)._isVideo = true;
    }

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

    // Fetch and store demographics (only for numeric page IDs)
    let demographicsStored = false;
    if (isNumericPageId(pageId)) {
      demographicsStored = await fetchAndStoreDemographics(brandId, pageId, pageName);
    } else {
      console.log(`  Skipping demographics for ${pageName} (non-numeric pageId)`);
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

    return { success: true, brand: pageName, ads: ads.length, created, updated, demographicsStored };
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
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    console.log(`Cron: Processing ${brands.length} brands (using ${tokenManager.getTotalTokens()} token(s))`);

    const results = [];
    for (const brand of brands) {
      const result = await processBrand(brand.id, brand.pageId, brand.pageName);
      results.push(result);

      // Wait between brands to avoid rate limits
      if (brands.indexOf(brand) < brands.length - 1) {
        await sleep(15000); // 15 second pause between brands
      }
    }

    return NextResponse.json({
      message: `Processed ${brands.length} brands`,
      tokenStatus: tokenManager.getStatusSummary(),
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

/**
 * POST /api/ad-library/cron/ingest
 * Manual trigger for ingestion
 *
 * Body options:
 * - { brandIds: string[] } - Process specific brands by ID
 * - { dcongressOnly: true } - Process only D-Congress brands (priority=100)
 * - { limit: number } - Override the number of brands to process (max 20)
 * - { checkStatus: true } - Just check token status without processing
 * - { resetTokens: true } - Reset all token states (use after updating tokens)
 * - {} - Process next pending brands (same as cron)
 */
export async function POST(req: NextRequest) {
  if (!tokenManager.hasTokens()) {
    return NextResponse.json(
      { error: 'No Facebook access tokens configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { brandIds, dcongressOnly, limit: requestedLimit, checkStatus, resetTokens, numericIdsOnly } = body as {
      brandIds?: string[];
      dcongressOnly?: boolean;
      limit?: number;
      checkStatus?: boolean;
      resetTokens?: boolean;
      numericIdsOnly?: boolean;
    };

    // Just check token status
    if (checkStatus) {
      return NextResponse.json({
        message: 'Token status check',
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    // Reset token states (useful after updating tokens in .env)
    if (resetTokens) {
      tokenManager.resetStates();
      return NextResponse.json({
        message: 'Token states reset successfully',
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    const limit = Math.min(requestedLimit || BRANDS_PER_RUN, 20); // Cap at 20

    let brands;

    if (brandIds && brandIds.length > 0) {
      // Process specific brands
      brands = await prisma.adLibraryBrand.findMany({
        where: { id: { in: brandIds } },
        take: limit,
      });
    } else if (dcongressOnly) {
      // Process D-Congress brands only (priority=100)
      brands = await prisma.adLibraryBrand.findMany({
        where: {
          priority: 100,
          OR: [
            { ingestionStatus: { in: ['pending', 'failed'] } },
            { activeAdCount: 0 }, // Also re-process brands with no ads
          ],
          failCount: { lt: 3 },
        },
        orderBy: { priority: 'desc' },
        take: limit,
      });
    } else {
      // Default: process next pending brands
      brands = await prisma.adLibraryBrand.findMany({
        where: {
          ingestionStatus: { in: ['pending', 'failed'] },
          failCount: { lt: 3 },
        },
        orderBy: { priority: 'desc' },
        take: limit,
      });
    }

    // Filter to only numeric pageIds if requested (skip brands that would use search_terms)
    if (numericIdsOnly) {
      const beforeCount = brands.length;
      brands = brands.filter(b => isNumericPageId(b.pageId));
      if (beforeCount !== brands.length) {
        console.log(`Filtered to ${brands.length} brands with numeric pageIds (skipped ${beforeCount - brands.length} non-numeric)`);
      }
    }

    if (brands.length === 0) {
      return NextResponse.json({
        message: 'No brands to process',
        processed: 0,
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    console.log(`Manual trigger: Processing ${brands.length} brands (using ${tokenManager.getTotalTokens()} token(s))`);

    const results = [];
    for (const brand of brands) {
      // Reset status to pending if we're re-processing
      if (brand.ingestionStatus === 'active' && brand.activeAdCount === 0) {
        await prisma.adLibraryBrand.update({
          where: { id: brand.id },
          data: { ingestionStatus: 'pending' },
        });
      }

      const result = await processBrand(brand.id, brand.pageId, brand.pageName);
      results.push(result);

      // Wait between brands to avoid rate limits
      if (brands.indexOf(brand) < brands.length - 1) {
        await sleep(15000); // 15 second pause for manual triggers (faster than cron)
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Processed ${brands.length} brands (${successful} successful, ${failed} failed)`,
      tokenStatus: tokenManager.getStatusSummary(),
      results,
    });
  } catch (error) {
    console.error('Manual ingestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}
