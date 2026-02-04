/**
 * Snapshot Builder
 *
 * Extracts aggregated metrics from a FacebookApiResult for storage as a BrandSnapshot.
 */

import type { FacebookApiResult } from './facebook-api';

export interface SnapshotData {
  totalAdsFound: number;
  activeAdsCount: number;
  totalReach: bigint;
  avgReachPerAd: number;
  estimatedSpendUsd: number;
  videoCount: number;
  imageCount: number;
  carouselCount: number;
  videoPercentage: number;
  imagePercentage: number;
  carouselPercentage: number;
  avgAdAgeDays: number;
  dominantGender: string | null;
  dominantGenderPct: number | null;
  dominantAgeRange: string | null;
  dominantAgePct: number | null;
  topCountry1Code: string | null;
  topCountry1Pct: number | null;
  topCountry2Code: string | null;
  topCountry2Pct: number | null;
  topCountry3Code: string | null;
  topCountry3Pct: number | null;
  demographicsJson: object | null;
  spendByCountryJson: object[] | null;
}

export function buildSnapshotFromApiResult(result: FacebookApiResult): SnapshotData {
  const now = Date.now();

  // Count active ads
  const activeAdsCount = result.ads.filter(ad => ad.isActive).length;

  // Total reach
  const totalReach = result.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
  const avgReachPerAd = result.ads.length > 0 ? totalReach / result.ads.length : 0;

  // Estimated spend
  const estimatedSpendUsd = result.spendAnalysis?.totalEstimatedSpend ?? 0;

  // Media type
  const videoCount = result.mediaTypeBreakdown?.video ?? 0;
  const imageCount = result.mediaTypeBreakdown?.image ?? 0;
  const carouselCount = result.mediaTypeBreakdown?.carousel ?? 0;
  const videoPercentage = result.mediaTypeBreakdown?.videoPercentage ?? 0;
  const imagePercentage = result.mediaTypeBreakdown?.imagePercentage ?? 0;
  const carouselPercentage = result.mediaTypeBreakdown?.carouselPercentage ?? 0;

  // Average ad age in days
  const adAges = result.ads
    .filter(ad => ad.startedRunning)
    .map(ad => {
      const start = new Date(ad.startedRunning!).getTime();
      return (now - start) / (1000 * 60 * 60 * 24);
    });
  const avgAdAgeDays = adAges.length > 0
    ? adAges.reduce((s, d) => s + d, 0) / adAges.length
    : 0;

  // Demographics
  const demo = result.aggregatedDemographics;
  const dominantGender = demo?.genderBreakdown?.[0]?.gender ?? null;
  const dominantGenderPct = demo?.genderBreakdown?.[0]?.percentage ?? null;
  const dominantAgeRange = demo?.ageBreakdown?.[0]?.age ?? null;
  const dominantAgePct = demo?.ageBreakdown?.[0]?.percentage ?? null;

  // Top 3 countries
  const regions = demo?.regionBreakdown ?? [];
  const topCountry1Code = regions[0]?.region ?? null;
  const topCountry1Pct = regions[0]?.percentage ?? null;
  const topCountry2Code = regions[1]?.region ?? null;
  const topCountry2Pct = regions[1]?.percentage ?? null;
  const topCountry3Code = regions[2]?.region ?? null;
  const topCountry3Pct = regions[2]?.percentage ?? null;

  return {
    totalAdsFound: result.totalAdsFound,
    activeAdsCount,
    totalReach: BigInt(totalReach),
    avgReachPerAd,
    estimatedSpendUsd,
    videoCount,
    imageCount,
    carouselCount,
    videoPercentage,
    imagePercentage,
    carouselPercentage,
    avgAdAgeDays,
    dominantGender,
    dominantGenderPct,
    dominantAgeRange,
    dominantAgePct,
    topCountry1Code,
    topCountry1Pct,
    topCountry2Code,
    topCountry2Pct,
    topCountry3Code,
    topCountry3Pct,
    demographicsJson: demo ? JSON.parse(JSON.stringify(demo)) : null,
    spendByCountryJson: result.spendAnalysis?.spendByCountry
      ? JSON.parse(JSON.stringify(result.spendAnalysis.spendByCountry))
      : null,
  };
}
