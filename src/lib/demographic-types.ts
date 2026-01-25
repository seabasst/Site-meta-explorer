// Age/gender breakdown from API response
export interface DemographicBreakdown {
  age: string;       // e.g., "18-24", "25-34", "35-44", "45-54", "55-64", "65+"
  gender: string;    // "male" | "female" | "unknown"
  percentage: number; // 0-100
}

// Country/region breakdown
export interface RegionBreakdown {
  region: string;    // Country code or region name (e.g., "DE", "FR", "GB")
  percentage: number; // 0-100
}

// Complete demographics for a single ad
export interface AdDemographics {
  adArchiveId: string;
  ageGenderBreakdown: DemographicBreakdown[];
  regionBreakdown: RegionBreakdown[];
  euTotalReach?: number;
  impressionsLower?: number;
  impressionsUpper?: number;
}

// Extended result that includes demographic data
export interface AdLibraryResultWithDemographics {
  success: true;
  pageId: string;
  pageName: string | null;
  ads: AdDataWithDemographics[];
  totalAdsFound: number;
  totalActiveAdsOnPage: number | null;
  demographicsScraped: number;      // How many ads had demographics extracted
  demographicsFailed: number;        // How many ads failed/had no data
  topPerformersAnalyzed: number;     // How many top performers were analyzed
  aggregatedDemographics?: AggregatedDemographics;  // Weighted aggregation across all ads with demographics
}

// Extended ad data with demographics
export interface AdDataWithDemographics {
  adId: string;
  adArchiveId: string | null;
  destinationUrl: string | null;
  linkText: string | null;
  startedRunning: string | null;
  adCount: number;
  adLibraryLinks: string[];
  demographics: AdDemographics | null;  // null if extraction failed or not attempted
}

// Type guard for result with demographics
export function hasAdDemographics(ad: AdDataWithDemographics): ad is AdDataWithDemographics & { demographics: AdDemographics } {
  return ad.demographics !== null;
}

// Aggregated demographics across multiple ads
export interface AggregatedDemographics {
  // Age breakdown (aggregated across genders)
  ageBreakdown: { age: string; percentage: number }[];

  // Gender breakdown (aggregated across ages)
  genderBreakdown: { gender: string; percentage: number }[];

  // Combined age-gender breakdown (preserves correlation)
  ageGenderBreakdown: { age: string; gender: string; percentage: number }[];

  // Region breakdown
  regionBreakdown: { region: string; percentage: number }[];

  // Metadata
  totalReachAnalyzed: number;      // Sum of weights used
  adsWithDemographics: number;     // Count of ads that contributed
  adsWithoutReach: number;         // Count of ads that used default weight
}
