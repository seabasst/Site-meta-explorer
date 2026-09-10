// =============================================================================
// Nightly classification run planner
// =============================================================================
// Decides which brands to submit for classification tonight and how many ads
// each may take, under a per-run ad cap and a daily USD budget.
//
// Pure on purpose: every guard that stops this pipeline spending money lives
// here, so it can be checked without a database or an API key.
// See scripts/check-classify-planner.ts.

import { estimateBatchCostUsd, EST_USD_PER_AD } from "./classify-batch";

export interface BrandCandidate {
  brandId: string;
  /** Unclassified ads this brand currently has. */
  unclassified: number;
}

export interface PlanInput {
  /** Brands with no queued/processing job, most unclassified ads first. */
  candidates: BrandCandidate[];
  /** USD already committed by jobs created today. */
  committedUsdToday: number;
  budgetUsd: number;
  maxAdsPerRun: number;
  maxBrandsPerRun: number;
}

export interface PlannedBrand {
  brandId: string;
  /** How many ads to submit for this brand this run. Always > 0. */
  take: number;
  estimatedUsd: number;
}

export interface Plan {
  brands: PlannedBrand[];
  totalAds: number;
  estimatedUsd: number;
  /** Set when nothing will be submitted, for the cron's JSON response. */
  skipReason?: "budget-exhausted" | "no-candidates" | "no-headroom";
}

const nothing = (skipReason: Plan["skipReason"]): Plan => ({
  brands: [],
  totalAds: 0,
  estimatedUsd: 0,
  skipReason,
});

export function planClassificationRun(input: PlanInput): Plan {
  const { candidates, committedUsdToday, budgetUsd, maxAdsPerRun, maxBrandsPerRun } = input;

  const remainingUsd = budgetUsd - committedUsdToday;
  if (remainingUsd <= 0) return nothing("budget-exhausted");

  const usable = candidates.filter((c) => c.unclassified > 0);
  if (usable.length === 0) return nothing("no-candidates");

  // Convert the USD budget into an ad count, then take the tighter of the two
  // caps. Divide by the exact per-ad rate, never by estimateBatchCostUsd(1) —
  // that rounds to 4dp and would understate the budget by ~4%. The epsilon
  // absorbs float error so an exact budget yields the whole ad count.
  const budgetAds =
    EST_USD_PER_AD > 0
      ? Math.floor(remainingUsd / EST_USD_PER_AD + 1e-9)
      : maxAdsPerRun;
  let adsLeft = Math.min(maxAdsPerRun, budgetAds);
  if (adsLeft <= 0) return nothing("budget-exhausted");

  const brands: PlannedBrand[] = [];
  for (const c of usable) {
    if (brands.length >= maxBrandsPerRun || adsLeft <= 0) break;
    const take = Math.min(c.unclassified, adsLeft);
    if (take <= 0) continue;
    brands.push({ brandId: c.brandId, take, estimatedUsd: estimateBatchCostUsd(take) });
    adsLeft -= take;
  }

  if (brands.length === 0) return nothing("no-headroom");

  const totalAds = brands.reduce((n, b) => n + b.take, 0);
  return { brands, totalAds, estimatedUsd: estimateBatchCostUsd(totalAds) };
}
