// Demographic aggregation module
// Combines per-ad demographics into weighted summaries where high-reach ads contribute more

import {
  AdDataWithDemographics,
  AggregatedDemographics,
} from './demographic-types';

/**
 * Calculate weight for an ad based on reach/impressions
 * Priority: euTotalReach > impressions midpoint > default (1)
 * Returns 0 if ad has no demographics (should not contribute)
 */
export function getWeight(ad: AdDataWithDemographics): number {
  const demo = ad.demographics;
  if (!demo) return 0;

  // Priority 1: EU total reach (most accurate)
  if (demo.euTotalReach && demo.euTotalReach > 0) {
    return demo.euTotalReach;
  }

  // Priority 2: Impressions midpoint
  if (demo.impressionsLower !== undefined && demo.impressionsUpper !== undefined) {
    const midpoint = (demo.impressionsLower + demo.impressionsUpper) / 2;
    if (midpoint > 0) {
      return midpoint;
    }
  }

  // Priority 3: Default weight (still contributes)
  return 1;
}

/**
 * Calculate weighted mean of values
 * Formula: sum(value_i * weight_i) / sum(weight_i)
 * Returns 0 if total weight is 0 (avoids division by zero)
 */
export function weightedMean(values: number[], weights: number[]): number {
  let valueSum = 0;
  let weightSum = 0;

  for (let i = 0; i < values.length; i++) {
    valueSum += values[i] * weights[i];
    weightSum += weights[i];
  }

  return weightSum > 0 ? valueSum / weightSum : 0;
}

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Normalize breakdown entries to sum to 100%
 * - If already within 0.1 of 100, just round
 * - If total is 0, return as-is
 * - Otherwise normalize each entry
 */
export function normalizeBreakdown<T extends { percentage: number }>(
  entries: T[]
): T[] {
  if (entries.length === 0) return entries;

  const total = entries.reduce((sum, e) => sum + e.percentage, 0);

  // Already ~100%, just round
  if (Math.abs(total - 100) < 0.1) {
    return entries.map(e => ({
      ...e,
      percentage: roundTo2Decimals(e.percentage),
    }));
  }

  // Total is 0, return as-is
  if (total === 0) return entries;

  // Normalize to 100%
  return entries.map(e => ({
    ...e,
    percentage: roundTo2Decimals((e.percentage / total) * 100),
  }));
}

/**
 * Aggregate age-gender breakdown from multiple ads
 * Groups by age_gender key and calculates weighted mean for each group
 */
export function aggregateAgeGender(
  ads: AdDataWithDemographics[],
  weights: number[]
): { age: string; gender: string; percentage: number }[] {
  // Group by age-gender key
  const groups = new Map<string, { percentages: number[]; weights: number[] }>();

  ads.forEach((ad, i) => {
    const weight = weights[i];
    const breakdown = ad.demographics!.ageGenderBreakdown;

    for (const entry of breakdown) {
      const key = `${entry.age}_${entry.gender}`;

      if (!groups.has(key)) {
        groups.set(key, { percentages: [], weights: [] });
      }

      const group = groups.get(key)!;
      group.percentages.push(entry.percentage);
      group.weights.push(weight);
    }
  });

  // Calculate weighted average for each group
  const result: { age: string; gender: string; percentage: number }[] = [];

  Array.from(groups.entries()).forEach(([key, { percentages, weights: w }]) => {
    const [age, gender] = key.split('_');
    const weightedAvg = weightedMean(percentages, w);

    result.push({ age, gender, percentage: weightedAvg });
  });

  return result;
}

/**
 * Derive age-only breakdown from age-gender breakdown
 * Sums percentages by age across all genders
 */
export function deriveAgeBreakdown(
  ageGender: { age: string; gender: string; percentage: number }[]
): { age: string; percentage: number }[] {
  const ageMap = new Map<string, number>();

  for (const entry of ageGender) {
    const current = ageMap.get(entry.age) || 0;
    ageMap.set(entry.age, current + entry.percentage);
  }

  const result: { age: string; percentage: number }[] = [];
  Array.from(ageMap.entries()).forEach(([age, percentage]) => {
    result.push({ age, percentage });
  });

  // Sort by age bracket (extract first number)
  result.sort((a, b) => {
    const aNum = parseInt(a.age.split('-')[0]) || 0;
    const bNum = parseInt(b.age.split('-')[0]) || 0;
    return aNum - bNum;
  });

  return result;
}

/**
 * Derive gender-only breakdown from age-gender breakdown
 * Sums percentages by gender across all ages
 */
export function deriveGenderBreakdown(
  ageGender: { age: string; gender: string; percentage: number }[]
): { gender: string; percentage: number }[] {
  const genderMap = new Map<string, number>();

  for (const entry of ageGender) {
    const current = genderMap.get(entry.gender) || 0;
    genderMap.set(entry.gender, current + entry.percentage);
  }

  const result: { gender: string; percentage: number }[] = [];
  Array.from(genderMap.entries()).forEach(([gender, percentage]) => {
    result.push({ gender, percentage });
  });

  return result;
}

/**
 * Aggregate region breakdown from multiple ads
 * Groups by region and calculates weighted mean for each region
 */
export function aggregateRegions(
  ads: AdDataWithDemographics[],
  weights: number[]
): { region: string; percentage: number }[] {
  // Group by region
  const groups = new Map<string, { percentages: number[]; weights: number[] }>();

  ads.forEach((ad, i) => {
    const weight = weights[i];
    const breakdown = ad.demographics!.regionBreakdown;

    for (const entry of breakdown) {
      if (!groups.has(entry.region)) {
        groups.set(entry.region, { percentages: [], weights: [] });
      }

      const group = groups.get(entry.region)!;
      group.percentages.push(entry.percentage);
      group.weights.push(weight);
    }
  });

  // Calculate weighted average for each region
  const result: { region: string; percentage: number }[] = [];

  Array.from(groups.entries()).forEach(([region, { percentages, weights: w }]) => {
    const weightedAvg = weightedMean(percentages, w);
    result.push({ region, percentage: weightedAvg });
  });

  // Sort by percentage descending
  result.sort((a, b) => b.percentage - a.percentage);

  return result;
}

/**
 * Return empty aggregated demographics result
 */
export function emptyResult(): AggregatedDemographics {
  return {
    ageBreakdown: [],
    genderBreakdown: [],
    ageGenderBreakdown: [],
    regionBreakdown: [],
    totalReachAnalyzed: 0,
    adsWithDemographics: 0,
    adsWithoutReach: 0,
  };
}

/**
 * Main entry point: Aggregate demographics from multiple ads
 * Uses weighted mean where reach/impressions determines weight
 * Normalizes all breakdowns to sum to 100%
 */
export function aggregateDemographics(
  ads: AdDataWithDemographics[]
): AggregatedDemographics {
  // Filter to ads with demographics
  const adsWithData = ads.filter(ad => ad.demographics !== null);

  if (adsWithData.length === 0) {
    return emptyResult();
  }

  // Calculate weights and track metadata
  const weights = adsWithData.map(getWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const adsWithoutReach = weights.filter(w => w === 1).length;

  // Aggregate age-gender breakdown
  const ageGenderBreakdown = aggregateAgeGender(adsWithData, weights);

  // Derive simplified breakdowns
  const ageBreakdown = deriveAgeBreakdown(ageGenderBreakdown);
  const genderBreakdown = deriveGenderBreakdown(ageGenderBreakdown);

  // Aggregate region breakdown
  const regionBreakdown = aggregateRegions(adsWithData, weights);

  return {
    ageBreakdown: normalizeBreakdown(ageBreakdown),
    genderBreakdown: normalizeBreakdown(genderBreakdown),
    ageGenderBreakdown: normalizeBreakdown(ageGenderBreakdown),
    regionBreakdown: normalizeBreakdown(regionBreakdown),
    totalReachAnalyzed: totalWeight,
    adsWithDemographics: adsWithData.length,
    adsWithoutReach,
  };
}
