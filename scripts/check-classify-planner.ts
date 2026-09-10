// Self-check for the nightly classification planner's spend guards.
// Run: npx tsx scripts/check-classify-planner.ts
// No DB and no API key needed — planClassificationRun is pure.

import assert from "node:assert/strict";
import { planClassificationRun } from "../src/lib/classification/plan-run";
import {
  estimateBatchCostUsd,
  EST_USD_PER_AD,
} from "../src/lib/classification/classify-batch";

const base = {
  committedUsdToday: 0,
  budgetUsd: 25,
  maxAdsPerRun: 5_000,
  maxBrandsPerRun: 5,
};
const brands = (...counts: number[]) =>
  counts.map((n, i) => ({ brandId: `b${i}`, unclassified: n }));

// The exact per-ad rate drives the budget maths; the rounded helper is display
// only. Dividing a budget by estimateBatchCostUsd(1) would lose ~4%.
assert.ok(EST_USD_PER_AD > 0);
assert.ok(Math.abs(estimateBatchCostUsd(1000) - EST_USD_PER_AD * 1000) < 1e-6);
assert.notEqual(estimateBatchCostUsd(1), EST_USD_PER_AD);

// The per-run ad cap is never exceeded, however much backlog exists.
{
  const p = planClassificationRun({ ...base, candidates: brands(999_999, 999_999) });
  assert.equal(p.totalAds, 5_000, "per-run ad cap must bind");
  assert.ok(p.brands.length <= 5);
}

// The brand cap is never exceeded.
{
  const p = planClassificationRun({
    ...base,
    maxAdsPerRun: 1_000_000,
    candidates: brands(10, 10, 10, 10, 10, 10, 10),
  });
  assert.equal(p.brands.length, 5, "brand cap must bind");
}

// Budget binds tighter than the ad cap when it is the smaller limit.
{
  const p = planClassificationRun({
    ...base,
    budgetUsd: estimateBatchCostUsd(100),
    candidates: brands(999_999),
  });
  assert.equal(p.totalAds, 100, "budget must convert to an ad ceiling");
  assert.ok(p.estimatedUsd <= base.budgetUsd);
}

// Money already committed today is subtracted from tonight's headroom.
{
  const budgetUsd = estimateBatchCostUsd(1_000);
  const p = planClassificationRun({
    ...base,
    budgetUsd,
    committedUsdToday: estimateBatchCostUsd(600),
    candidates: brands(999_999),
  });
  assert.equal(p.totalAds, 400, "committed spend must reduce headroom");
}

// An exhausted budget submits nothing at all.
for (const committedUsdToday of [25, 40]) {
  const p = planClassificationRun({ ...base, committedUsdToday, candidates: brands(500) });
  assert.equal(p.brands.length, 0);
  assert.equal(p.totalAds, 0);
  assert.equal(p.skipReason, "budget-exhausted");
}

// Nothing to do is reported, not treated as an error.
{
  const p = planClassificationRun({ ...base, candidates: [] });
  assert.equal(p.skipReason, "no-candidates");
  const q = planClassificationRun({ ...base, candidates: brands(0, 0) });
  assert.equal(q.skipReason, "no-candidates");
}

// Every planned brand gets real work; a zero-ad submission would waste a job row.
{
  const p = planClassificationRun({ ...base, candidates: brands(3_000, 3_000, 3_000) });
  assert.ok(p.brands.every((b) => b.take > 0));
  assert.equal(p.totalAds, 5_000);
  assert.equal(
    p.totalAds,
    p.brands.reduce((n, b) => n + b.take, 0),
    "totalAds must equal the sum of per-brand takes"
  );
}

console.log("check-classify-planner: all assertions passed");
