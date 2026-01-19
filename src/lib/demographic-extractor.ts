import { AdDemographics, DemographicBreakdown, RegionBreakdown } from './demographic-types';

// Debug flag - set to true to log first successful extraction
let hasLoggedSample = false;

/**
 * Log a sample API response structure (for debugging/development).
 * Only logs once per session to avoid spam.
 */
export function logSampleResponse(data: unknown, context: string): void {
  if (hasLoggedSample) return;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[demographic-extractor] Sample ${context} response:`,
      JSON.stringify(data, null, 2).slice(0, 2000) + '...');
    hasLoggedSample = true;
  }
}

/**
 * Reset debug logging (for testing)
 */
export function resetDebugLogging(): void {
  hasLoggedSample = false;
}

// Internal types for API response parsing
interface ApiDemographicDistribution {
  age: string;
  gender: string;
  percentage: string | number;
}

interface ApiRegionDistribution {
  region: string;
  percentage: string | number;
}

/**
 * Extract demographic data from Facebook API response.
 * Uses recursive traversal to find demographic fields regardless of nesting depth.
 * Returns null if no demographic data found (graceful handling for non-EU ads).
 *
 * @param data - Raw API response (parsed JSON)
 * @param adArchiveId - The ad's archive ID
 * @param debug - If true, logs first successful response structure
 * @returns AdDemographics or null if no data found
 */
export function extractDemographicsFromApiResponse(
  data: unknown,
  adArchiveId: string,
  debug: boolean = false
): AdDemographics | null {
  const result: AdDemographics = {
    adArchiveId,
    ageGenderBreakdown: [],
    regionBreakdown: [],
  };

  function parsePercentage(value: string | number): number {
    if (typeof value === 'number') {
      // If already decimal (0-1), convert to percentage
      return value <= 1 ? value * 100 : value;
    }
    const parsed = parseFloat(value);
    // If parsed value is decimal, convert to percentage
    return parsed <= 1 ? parsed * 100 : parsed;
  }

  function traverse(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
      return;
    }

    const record = obj as Record<string, unknown>;

    // Look for demographic_distribution field (age/gender breakdown)
    if (record.demographic_distribution && Array.isArray(record.demographic_distribution)) {
      for (const demo of record.demographic_distribution as ApiDemographicDistribution[]) {
        if (demo.age && demo.gender && demo.percentage !== undefined) {
          result.ageGenderBreakdown.push({
            age: demo.age,
            gender: demo.gender.toLowerCase(),
            percentage: parsePercentage(demo.percentage),
          });
        }
      }
    }

    // Alternative field names for age/gender data
    if (record.age_country_gender_reach_breakdown && Array.isArray(record.age_country_gender_reach_breakdown)) {
      for (const item of record.age_country_gender_reach_breakdown as ApiDemographicDistribution[]) {
        if (item.age && item.gender && item.percentage !== undefined) {
          result.ageGenderBreakdown.push({
            age: item.age,
            gender: item.gender.toLowerCase(),
            percentage: parsePercentage(item.percentage),
          });
        }
      }
    }

    // Look for delivery_by_region or region_distribution (country/region breakdown)
    const regionField = record.delivery_by_region || record.region_distribution;
    if (regionField && Array.isArray(regionField)) {
      for (const region of regionField as ApiRegionDistribution[]) {
        if (region.region && region.percentage !== undefined) {
          result.regionBreakdown.push({
            region: region.region,
            percentage: parsePercentage(region.percentage),
          });
        }
      }
    }

    // Look for EU-specific reach field
    if (typeof record.eu_total_reach === 'number') {
      result.euTotalReach = record.eu_total_reach;
    }
    // Also handle string version
    if (typeof record.eu_total_reach === 'string') {
      const parsed = parseInt(record.eu_total_reach, 10);
      if (!isNaN(parsed)) {
        result.euTotalReach = parsed;
      }
    }

    // Look for impressions range
    if (record.impressions && typeof record.impressions === 'object') {
      const imp = record.impressions as { lower_bound?: string | number; upper_bound?: string | number };
      if (imp.lower_bound !== undefined) {
        result.impressionsLower = typeof imp.lower_bound === 'string'
          ? parseInt(imp.lower_bound, 10)
          : imp.lower_bound;
      }
      if (imp.upper_bound !== undefined) {
        result.impressionsUpper = typeof imp.upper_bound === 'string'
          ? parseInt(imp.upper_bound, 10)
          : imp.upper_bound;
      }
    }

    // Recurse into nested objects
    Object.values(record).forEach(val => traverse(val));
  }

  traverse(data);

  // Return null if no demographic data found (RELY-02: graceful handling)
  if (result.ageGenderBreakdown.length === 0 && result.regionBreakdown.length === 0) {
    return null;
  }

  // Log sample response structure when debug enabled (helps validate API structure)
  if (debug) {
    logSampleResponse(data, `demographics-${adArchiveId}`);
  }

  return result;
}
