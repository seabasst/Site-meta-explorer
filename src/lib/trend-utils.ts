import type { FacebookAdResult } from '@/lib/facebook-api';

// ── Types ──────────────────────────────────────────────────────────────

export type PeriodMode = 'monthly' | 'weekly';

export interface TimePeriodGroup {
  key: string;       // "2025-03" or "2025-W12"
  label: string;     // "Mar '25" or "Mar 17"
  ads: FacebookAdResult[];
}

export interface CountryReachPoint {
  label: string;
  [country: string]: string | number; // dynamic country keys + label
}

export interface MediaMixPoint {
  label: string;
  video: number;
  image: number;
  carousel: number;
}

export interface CreativeVelocityPoint {
  label: string;
  adsLaunched: number;
  totalReach: number;
}

export interface ReachTrajectoryPoint {
  label: string;
  totalReach: number;
  avgReachPerAd: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** ISO week key: "2025-W12" */
function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekLabel(key: string): string {
  // Parse "2025-W12" back to a Monday date
  const [yearStr, weekStr] = key.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4.getTime() + ((week - 1) * 7 - (dayOfWeek - 1)) * 86400000);
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatReach(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// ── Core grouping ───────────────────────────────────────────────────────

export function groupAdsByPeriod(
  ads: FacebookAdResult[],
  mode: PeriodMode,
): TimePeriodGroup[] {
  const adsWithDates = ads.filter((ad): ad is FacebookAdResult & { startedRunning: string } =>
    ad.startedRunning !== null,
  );

  if (adsWithDates.length === 0) return [];

  const map = new Map<string, FacebookAdResult[]>();

  for (const ad of adsWithDates) {
    const date = new Date(ad.startedRunning);
    const key = mode === 'monthly' ? getMonthKey(date) : getWeekKey(date);
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
    }
    group.push(ad);
  }

  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const sliced = sorted.slice(-(mode === 'monthly' ? 12 : 12));

  return sliced.map(([key, groupAds]) => ({
    key,
    label: mode === 'monthly' ? getMonthLabel(key) : getWeekLabel(key),
    ads: groupAds,
  }));
}

// ── Derived datasets ────────────────────────────────────────────────────

/** Per-period reach by top N countries (absolute reach, not %) */
export function computeCountryReachTrends(
  groups: TimePeriodGroup[],
  topN = 5,
): { data: CountryReachPoint[]; countries: string[] } {
  // First pass: aggregate total reach per country across all periods
  const countryTotals = new Map<string, number>();

  for (const group of groups) {
    for (const ad of group.ads) {
      if (!ad.demographics?.regionBreakdown) continue;
      const reach = ad.euTotalReach;
      for (const rb of ad.demographics.regionBreakdown) {
        const prev = countryTotals.get(rb.region) ?? 0;
        countryTotals.set(rb.region, prev + (reach * rb.percentage) / 100);
      }
    }
  }

  // Pick top N countries
  const topCountries = Array.from(countryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([c]) => c);

  if (topCountries.length === 0) return { data: [], countries: [] };

  // Second pass: per-period reach for those countries
  const data: CountryReachPoint[] = groups.map(group => {
    const point: CountryReachPoint = { label: group.label };
    for (const country of topCountries) point[country] = 0;

    for (const ad of group.ads) {
      if (!ad.demographics?.regionBreakdown) continue;
      const reach = ad.euTotalReach;
      for (const rb of ad.demographics.regionBreakdown) {
        if (topCountries.includes(rb.region)) {
          (point[rb.region] as number) += (reach * rb.percentage) / 100;
        }
      }
    }

    // Round values
    for (const country of topCountries) {
      point[country] = Math.round(point[country] as number);
    }

    return point;
  });

  return { data, countries: topCountries };
}

/** Per-period video/image/carousel percentage */
export function computeMediaMixTrends(groups: TimePeriodGroup[]): MediaMixPoint[] {
  return groups.map(group => {
    const total = group.ads.length;
    if (total === 0) return { label: group.label, video: 0, image: 0, carousel: 0 };

    let video = 0;
    let image = 0;
    let carousel = 0;

    for (const ad of group.ads) {
      if (ad.mediaType === 'video') video++;
      else if (ad.mediaType === 'image') image++;
      else if (ad.mediaType === 'carousel') carousel++;
      // 'unknown' is excluded from percentages
    }

    const counted = video + image + carousel;
    if (counted === 0) return { label: group.label, video: 0, image: 0, carousel: 0 };

    return {
      label: group.label,
      video: Math.round((video / counted) * 100),
      image: Math.round((image / counted) * 100),
      carousel: Math.round((carousel / counted) * 100),
    };
  });
}

/** Ads launched + total reach per period */
export function computeCreativeVelocity(groups: TimePeriodGroup[]): CreativeVelocityPoint[] {
  return groups.map(group => ({
    label: group.label,
    adsLaunched: group.ads.length,
    totalReach: group.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0),
  }));
}

/** Total reach + avg reach/ad per period */
export function computeReachTrajectory(groups: TimePeriodGroup[]): ReachTrajectoryPoint[] {
  return groups.map(group => {
    const totalReach = group.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
    return {
      label: group.label,
      totalReach,
      avgReachPerAd: group.ads.length > 0 ? Math.round(totalReach / group.ads.length) : 0,
    };
  });
}

/** Trend detection: compare recent 3 periods vs previous 3 */
export function detectTrend(
  groups: TimePeriodGroup[],
): { trend: 'scaling' | 'stable' | 'declining'; trendPercent: number; peakLabel: string; peakCount: number } {
  const recent = groups.slice(-3);
  const older = groups.slice(-6, -3);

  const recentAvg = recent.length > 0
    ? recent.reduce((s, g) => s + g.ads.length, 0) / recent.length
    : 0;
  const olderAvg = older.length > 0
    ? older.reduce((s, g) => s + g.ads.length, 0) / older.length
    : 0;

  let trend: 'scaling' | 'stable' | 'declining' = 'stable';
  let trendPercent = 0;

  if (olderAvg > 0) {
    trendPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (trendPercent > 20) trend = 'scaling';
    else if (trendPercent < -20) trend = 'declining';
  }

  let peakLabel = '';
  let peakCount = 0;
  for (const g of groups) {
    if (g.ads.length > peakCount) {
      peakCount = g.ads.length;
      peakLabel = g.label;
    }
  }

  return { trend, trendPercent, peakLabel, peakCount };
}
