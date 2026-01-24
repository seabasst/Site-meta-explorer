/**
 * Ad Spend Estimator
 *
 * Estimates ad spend based on reach and CPM (Cost per 1,000 accounts reached) data.
 * CPM values are based on actual Facebook Ads data and vary significantly by country.
 */

// CPM data by country (Cost per 1,000 impressions in USD)
// Source: Enhencer 2024 Facebook Ads benchmark data
// https://enhencer.com/blog/cpm-of-facebook-ads-2024
export const CPM_BY_COUNTRY: Record<string, number> = {
  // Nordic countries
  SE: 9.51,   // Sweden
  NO: 9.67,   // Norway
  FI: 6.87,   // Finland
  DK: 9.29,   // Denmark

  // Western Europe
  DE: 10.05,  // Germany
  NL: 9.49,   // Netherlands
  GB: 10.85,  // United Kingdom
  AT: 9.24,   // Austria
  BE: 9.18,   // Belgium
  FR: 8.05,   // France
  CH: 9.75,   // Switzerland
  IE: 11.66,  // Ireland
  LU: 7.22,   // Luxembourg

  // Southern Europe
  ES: 9.41,   // Spain
  IT: 8.06,   // Italy
  PT: 9.88,   // Portugal
  GR: 4.14,   // Greece

  // Eastern Europe (lower CPM)
  PL: 9.41,   // Poland
  LT: 5.50,   // Lithuania (estimated based on regional avg)
  LV: 5.00,   // Latvia (estimated based on regional avg)
  EE: 5.50,   // Estonia (estimated based on regional avg)
  CZ: 6.50,   // Czech Republic (estimated)
  HU: 5.11,   // Hungary
  RO: 4.50,   // Romania (estimated)
  SK: 5.50,   // Slovakia (estimated)
  BG: 4.00,   // Bulgaria (estimated)
  HR: 5.00,   // Croatia (estimated)
  SI: 6.00,   // Slovenia (estimated)

  // Other major markets
  US: 20.48,  // United States
  CA: 14.03,  // Canada
  AU: 11.04,  // Australia
  IN: 2.70,   // India

  // Default for unknown countries
  DEFAULT: 8.00,
};

// Country names for display
export const COUNTRY_NAMES: Record<string, string> = {
  SE: 'Sweden',
  NO: 'Norway',
  FI: 'Finland',
  DK: 'Denmark',
  DE: 'Germany',
  NL: 'Netherlands',
  GB: 'United Kingdom',
  AT: 'Austria',
  BE: 'Belgium',
  FR: 'France',
  CH: 'Switzerland',
  IE: 'Ireland',
  ES: 'Spain',
  IT: 'Italy',
  PT: 'Portugal',
  GR: 'Greece',
  PL: 'Poland',
  LT: 'Lithuania',
  LV: 'Latvia',
  EE: 'Estonia',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  SK: 'Slovakia',
  BG: 'Bulgaria',
  HR: 'Croatia',
  SI: 'Slovenia',
  MT: 'Malta',
  CY: 'Cyprus',
  LU: 'Luxembourg',
};

/**
 * Get CPM for a country
 */
export function getCPM(countryCode: string): number {
  return CPM_BY_COUNTRY[countryCode.toUpperCase()] || CPM_BY_COUNTRY.DEFAULT;
}

/**
 * Calculate estimated spend from reach and country
 */
export function calculateSpend(reach: number, countryCode: string): number {
  const cpm = getCPM(countryCode);
  return (reach / 1000) * cpm;
}

/**
 * Spend breakdown by country
 */
export interface CountrySpend {
  countryCode: string;
  countryName: string;
  reach: number;
  cpm: number;
  estimatedSpend: number;
}

/**
 * Product/Ad spend analysis
 */
export interface ProductSpend {
  adId: string;
  adArchiveId: string;
  title: string;
  description: string | null;
  totalReach: number;
  totalEstimatedSpend: number;
  spendByCountry: CountrySpend[];
  startedRunning: string | null;
  isActive: boolean;
}

/**
 * Overall spend analysis
 */
export interface SpendAnalysis {
  totalEstimatedSpend: number;
  totalReach: number;
  spendByCountry: CountrySpend[];
  topProducts: ProductSpend[];
  averageCPM: number;
  currency: string;
}

/**
 * Calculate spend analysis from Facebook API ad data
 */
export function analyzeSpend(ads: Array<{
  adId: string;
  adArchiveId: string;
  linkTitle: string | null;
  creativeBody: string | null;
  euTotalReach: number;
  startedRunning: string | null;
  isActive: boolean;
  demographics: {
    regionBreakdown: Array<{ region: string; percentage: number }>;
  } | null;
}>): SpendAnalysis {
  const countrySpendMap = new Map<string, { reach: number; spend: number }>();
  const productSpends: ProductSpend[] = [];

  for (const ad of ads) {
    if (!ad.demographics || ad.euTotalReach === 0) continue;

    const adCountrySpends: CountrySpend[] = [];
    let adTotalSpend = 0;

    // Calculate spend per country for this ad
    for (const region of ad.demographics.regionBreakdown) {
      const countryCode = region.region.toUpperCase();
      const reach = Math.round((region.percentage / 100) * ad.euTotalReach);
      const cpm = getCPM(countryCode);
      const spend = calculateSpend(reach, countryCode);

      adCountrySpends.push({
        countryCode,
        countryName: COUNTRY_NAMES[countryCode] || countryCode,
        reach,
        cpm,
        estimatedSpend: spend,
      });

      adTotalSpend += spend;

      // Aggregate to overall country totals
      const existing = countrySpendMap.get(countryCode) || { reach: 0, spend: 0 };
      countrySpendMap.set(countryCode, {
        reach: existing.reach + reach,
        spend: existing.spend + spend,
      });
    }

    // Sort country spends by spend descending
    adCountrySpends.sort((a, b) => b.estimatedSpend - a.estimatedSpend);

    productSpends.push({
      adId: ad.adId,
      adArchiveId: ad.adArchiveId,
      title: ad.linkTitle || ad.creativeBody?.slice(0, 50) || `Ad ${ad.adId}`,
      description: ad.creativeBody,
      totalReach: ad.euTotalReach,
      totalEstimatedSpend: adTotalSpend,
      spendByCountry: adCountrySpends,
      startedRunning: ad.startedRunning,
      isActive: ad.isActive,
    });
  }

  // Sort products by spend descending
  productSpends.sort((a, b) => b.totalEstimatedSpend - a.totalEstimatedSpend);

  // Convert country map to sorted array
  const spendByCountry: CountrySpend[] = Array.from(countrySpendMap.entries())
    .map(([countryCode, data]) => ({
      countryCode,
      countryName: COUNTRY_NAMES[countryCode] || countryCode,
      reach: data.reach,
      cpm: getCPM(countryCode),
      estimatedSpend: data.spend,
    }))
    .sort((a, b) => b.estimatedSpend - a.estimatedSpend);

  // Calculate totals
  const totalEstimatedSpend = spendByCountry.reduce((sum, c) => sum + c.estimatedSpend, 0);
  const totalReach = spendByCountry.reduce((sum, c) => sum + c.reach, 0);
  const averageCPM = totalReach > 0 ? (totalEstimatedSpend / totalReach) * 1000 : 0;

  return {
    totalEstimatedSpend,
    totalReach,
    spendByCountry,
    topProducts: productSpends.slice(0, 10), // Top 10 products
    averageCPM,
    currency: 'USD',
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
