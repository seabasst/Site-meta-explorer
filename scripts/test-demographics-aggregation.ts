/**
 * Self-check for demographics aggregation.
 *   npx tsx scripts/test-demographics-aggregation.ts
 * No DB, no network — it only exercises aggregateDemographicsFromAds().
 */
import assert from 'node:assert/strict';
import { aggregateDemographicsFromAds } from '../src/lib/ingestion/ingest-core';

const sum = (xs: { percentage: number }[]) => xs.reduce((a, b) => a + b.percentage, 0);
const near = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.01, `${label}: got ${actual}, want ~${expected}`);

const country = (code: string, rows: [string, number, number, number][]) => ({
  country: code,
  age_gender_breakdowns: rows.map(([age_range, male, female, unknown]) => ({
    age_range, male, female, unknown,
  })),
});

// One ad, three delivery countries — the Temu Sweden shape that summed to 193%.
// SE carries 80% of the reach and skews female; DK/FI are small and skew male.
const multiCountry = {
  id: 'ad_multi',
  eu_total_reach: 10_000,
  age_country_gender_reach_breakdown: [
    country('SE', [['25-34', 100, 700, 0], ['35-44', 100, 900, 0]]),
    country('DK', [['25-34', 180, 20, 0]]),
    country('FI', [['25-34', 180, 20, 0]]),
  ],
};

const one = aggregateDemographicsFromAds([multiCountry])!;
near(sum(one.ageBreakdown), 100, 'age sums to 100');
near(sum(one.genderBreakdown), 100, 'gender sums to 100');
near(sum(one.ageGenderBreakdown), 100, 'age-gender sums to 100');
near(sum(one.regionBreakdown), 100, 'region sums to 100');

// Composition follows reach, not country count: 1640/2200 female overall.
near(one.genderBreakdown.find(g => g.gender === 'female')!.percentage, 74.55, 'female share');
near(one.genderBreakdown.find(g => g.gender === 'male')!.percentage, 25.45, 'male share');
// 1800 of 2200 delivered in SE — not 1/3 each, which is what equal-weighting gave.
near(one.regionBreakdown.find(r => r.region === 'SE')!.percentage, 81.82, 'SE share');

// A second, single-country ad with 9x the reach must dominate the blend.
const singleCountry = {
  id: 'ad_single',
  eu_total_reach: 90_000,
  age_country_gender_reach_breakdown: [country('DE', [['45-54', 1000, 0, 0]])],
};

const both = aggregateDemographicsFromAds([multiCountry, singleCountry])!;
near(sum(both.ageBreakdown), 100, 'age sums to 100 across ads');
near(sum(both.genderBreakdown), 100, 'gender sums to 100 across ads');
near(sum(both.regionBreakdown), 100, 'region sums to 100 across ads');
near(both.ageBreakdown.find(a => a.age === '45-54')!.percentage, 90, '45-54 tracks reach weight');
assert.equal(both.totalReachAnalyzed, 100_000);
assert.equal(both.adsWithDemographics, 2);

// An ad whose breakdown is all zeros must not add weight it contributes no mass to.
const empty = {
  id: 'ad_empty',
  eu_total_reach: 5_000,
  age_country_gender_reach_breakdown: [country('NO', [['25-34', 0, 0, 0]])],
};
const withEmpty = aggregateDemographicsFromAds([singleCountry, empty])!;
assert.equal(withEmpty.totalReachAnalyzed, 90_000);
near(sum(withEmpty.genderBreakdown), 100, 'gender sums to 100 with a zero-reach ad');

assert.equal(aggregateDemographicsFromAds([]), null);

console.log('aggregateDemographicsFromAds: 16 assertions passed');
