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

// Ad with metrics for top performer selection
export interface AdWithMetrics {
  adArchiveId: string;
  destinationUrl: string | null;
  startedRunning: string | null;
  reachLower?: number;
  reachUpper?: number;
  adCount: number;
}
