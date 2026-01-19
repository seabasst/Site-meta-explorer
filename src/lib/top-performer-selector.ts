import { AdWithMetrics } from './demographic-types';

/**
 * Select top-performing ads for demographic analysis.
 * Prioritizes by reach (if available), then by duration (days running).
 *
 * @param ads - Array of ads with metrics
 * @param maxAds - Maximum number of ads to return (default: 10)
 * @returns Top performing ads sorted by reach then duration
 */
export function selectTopPerformers(
  ads: AdWithMetrics[],
  maxAds: number = 10
): AdWithMetrics[] {
  return ads
    .filter(ad => ad.adArchiveId) // Only ads with archive IDs can be scraped
    .map(ad => {
      // Calculate duration score (days running)
      const durationDays = ad.startedRunning
        ? Math.floor((Date.now() - new Date(ad.startedRunning).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Use midpoint of reach range as reach score
      const reachScore = ad.reachLower && ad.reachUpper
        ? (ad.reachLower + ad.reachUpper) / 2
        : 0;

      return { ...ad, durationDays, reachScore };
    })
    // Sort by reach first (descending), then by duration (descending)
    .sort((a, b) => {
      if (b.reachScore !== a.reachScore) {
        return b.reachScore - a.reachScore;
      }
      return b.durationDays - a.durationDays;
    })
    // Remove computed fields before returning
    .map(({ durationDays, reachScore, ...ad }) => ad)
    .slice(0, maxAds);
}
