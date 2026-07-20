// Shared ranking helpers for the /analyze feature.
//
// The public Ad Library API only exposes reach *estimates* and how long an ad
// has run — never real conversion/ROI data. "Best performing" here means a
// composite of those two honest signals, not a performance guarantee.

export interface RankableAd {
  id: string;
  adId: string;
  displayFormat: string | null;
  body: string | null;
  title: string | null;
  caption: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  startDate: Date | null;
  isActive: boolean;
  adDurationDays: number | null;
  reachEstimate: number | null;
  brand: {
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
  };
  assets: {
    id: string;
    assetType: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    position: number;
    downloadStatus: string;
  }[];
}

export interface RankedAd extends RankableAd {
  score: number;
  longevityDays: number;
}

function longevityDays(ad: RankableAd, now: number): number {
  if (ad.adDurationDays !== null) return ad.adDurationDays;
  if (ad.isActive && ad.startDate) {
    return Math.max(0, Math.floor((now - ad.startDate.getTime()) / 86_400_000));
  }
  return 0;
}

function minMaxNormalize(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return () => 0.5;
  return (v: number) => (v - min) / (max - min);
}

/**
 * Ranks ads by a 60/40 blend of estimated reach and how long the ad has run.
 * Both signals are min-max normalized within the candidate pool so the blend
 * is stable regardless of the pool's absolute scale.
 */
export function rankAds(ads: RankableAd[]): RankedAd[] {
  if (ads.length === 0) return [];
  const now = Date.now();

  const reachValues = ads.map((a) => a.reachEstimate ?? 0);
  const longevityValues = ads.map((a) => longevityDays(a, now));
  const normReach = minMaxNormalize(reachValues);
  const normLongevity = minMaxNormalize(longevityValues);

  return ads
    .map((ad, i) => ({
      ...ad,
      longevityDays: longevityValues[i],
      score: normReach(reachValues[i]) * 0.6 + normLongevity(longevityValues[i]) * 0.4,
    }))
    .sort((a, b) => b.score - a.score || (b.reachEstimate ?? 0) - (a.reachEstimate ?? 0));
}

export interface BestCopyEntry {
  adId: string;
  displayFormat: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  reachEstimate: number | null;
  longevityDays: number;
  brand: { pageId: string; pageName: string };
}

function copyKey(ad: RankedAd): string {
  const text = (ad.body || ad.title || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return text.slice(0, 80);
}

/**
 * Picks the top-scoring ad per distinct copy variant from an already-ranked
 * list, so the same headline running across multiple creatives only shows up
 * once.
 */
export function pickBestCopy(rankedAds: RankedAd[], limit: number): BestCopyEntry[] {
  const seen = new Set<string>();
  const results: BestCopyEntry[] = [];

  for (const ad of rankedAds) {
    if (!ad.body && !ad.title) continue;
    const key = copyKey(ad);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    results.push({
      adId: ad.adId,
      displayFormat: ad.displayFormat,
      title: ad.title,
      body: ad.body,
      ctaText: ad.ctaText,
      snapshotUrl: ad.snapshotUrl,
      reachEstimate: ad.reachEstimate,
      longevityDays: ad.longevityDays,
      brand: { pageId: ad.brand.pageId, pageName: ad.brand.pageName },
    });

    if (results.length >= limit) break;
  }

  return results;
}
