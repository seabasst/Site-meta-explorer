import type { TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';
import type { HookGroupDisplay } from '@/components/dashboard/hook-explorer';

export type ObservationType =
  | 'demographic-skew'
  | 'gender-imbalance'
  | 'geo-concentration'
  | 'hook-pattern';

export interface Observation {
  type: ObservationType;
  title: string;
  description: string;
  magnitude: number; // 0-100, used for ranking
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function detectDemographicSkew(
  snapshot: TrackedBrandSnapshot
): Observation | null {
  const { dominantAgeRange, dominantAgePct, dominantGender, dominantGenderPct } =
    snapshot;

  if (
    !dominantAgeRange ||
    dominantAgePct == null ||
    !dominantGender ||
    dominantGenderPct == null
  ) {
    return null;
  }

  if (dominantAgePct < 25) return null;

  return {
    type: 'demographic-skew',
    title: 'Demographic Skew',
    description: `Skews ${dominantAgeRange} ${dominantGender}, ${Math.round(dominantAgePct)}% of reach`,
    magnitude: dominantAgePct,
  };
}

function detectGenderImbalance(
  snapshot: TrackedBrandSnapshot
): Observation | null {
  const { dominantGender, dominantGenderPct } = snapshot;

  if (!dominantGender || dominantGenderPct == null) return null;
  if (dominantGenderPct <= 60) return null;

  return {
    type: 'gender-imbalance',
    title: 'Gender Imbalance',
    description: `${capitalize(dominantGender)} audience dominates at ${Math.round(dominantGenderPct)}% of reach`,
    magnitude: ((dominantGenderPct - 60) / 40) * 100,
  };
}

function detectGeoConcentration(
  snapshot: TrackedBrandSnapshot
): Observation | null {
  const { topCountry1Code, topCountry1Pct, topCountry2Code, topCountry2Pct } =
    snapshot;

  if (!topCountry1Code || topCountry1Pct == null) return null;

  const combinedPct = topCountry1Pct + (topCountry2Pct ?? 0);
  if (combinedPct <= 50) return null;

  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const country1Name = regionNames.of(topCountry1Code) ?? topCountry1Code;

  let countriesLabel: string;
  if (topCountry2Code && topCountry2Pct != null && topCountry2Pct > 0) {
    const country2Name = regionNames.of(topCountry2Code) ?? topCountry2Code;
    countriesLabel = `${country1Name} and ${country2Name}`;
  } else {
    countriesLabel = country1Name;
  }

  return {
    type: 'geo-concentration',
    title: 'Geographic Concentration',
    description: `Concentrated in ${countriesLabel}, ${Math.round(combinedPct)}% of reach`,
    magnitude: combinedPct,
  };
}

function detectHookPattern(
  hookGroups: HookGroupDisplay[],
  totalAds: number
): Observation | null {
  if (hookGroups.length === 0 || totalAds < 5) return null;

  const topHook = hookGroups[0]; // Already sorted by totalReach desc from API
  if (topHook.frequency < 3) return null;

  const truncatedText =
    topHook.hookText.length > 50
      ? topHook.hookText.slice(0, 47) + '...'
      : topHook.hookText;

  return {
    type: 'hook-pattern',
    title: 'Recurring Hook',
    description: `"${truncatedText}" appears in ${topHook.frequency} ads`,
    magnitude: (topHook.frequency / totalAds) * 100,
  };
}

export function generateObservations(
  snapshot: TrackedBrandSnapshot,
  hookGroups: HookGroupDisplay[]
): Observation[] {
  const observations: Observation[] = [];

  const skew = detectDemographicSkew(snapshot);
  if (skew) observations.push(skew);

  const gender = detectGenderImbalance(snapshot);
  if (gender) observations.push(gender);

  const geo = detectGeoConcentration(snapshot);
  if (geo) observations.push(geo);

  const hook = detectHookPattern(hookGroups, snapshot.totalAdsFound);
  if (hook) observations.push(hook);

  return observations
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 5);
}
