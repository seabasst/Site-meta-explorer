# Phase 3: Aggregation - Research

**Researched:** 2026-01-19
**Domain:** Weighted demographic data aggregation in TypeScript
**Confidence:** HIGH

## Summary

Phase 3 aggregates per-ad demographic data into weighted summaries where high-reach ads contribute more than low-reach ads. This is a pure data transformation problem - no external dependencies needed, no network calls, no UI. The input data structures are well-defined from Phase 2, and the aggregation algorithm is straightforward weighted averaging.

The core challenge is handling the dimensional complexity: demographics have multiple dimensions (age x gender for age/gender breakdown, region for geographic breakdown), and each dimension needs separate weighted aggregation. Additionally, some ads may lack reach data and still need to contribute (with equal weight or a default weight).

**Primary recommendation:** Implement a dedicated aggregation module with pure functions that take `AdDataWithDemographics[]` and return an `AggregatedDemographics` summary. Use the weighted mean formula: `sum(percentage_i * weight_i) / sum(weight_i)`, then normalize to ensure percentages sum to 100%.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new required) | - | Aggregation is pure TypeScript | No external dependencies needed for in-memory data transformation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new required) | - | - | Existing TypeScript/Node.js sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual aggregation | simple-statistics npm | Overkill; weighted mean is 5 lines of code |
| Manual aggregation | d3-array | Adds 100KB+ dependency for one function |
| Pure functions | Class-based aggregator | Pure functions are simpler, easier to test |

**No new dependencies needed.** Weighted averaging is elementary mathematics implementable in pure TypeScript.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── demographic-types.ts       # Existing - extend with AggregatedDemographics
│   ├── demographic-extractor.ts   # Existing - unchanged
│   ├── top-performer-selector.ts  # Existing - unchanged
│   ├── demographic-aggregator.ts  # NEW - aggregation logic
│   └── ad-library-scraper.ts      # Existing - call aggregator after scraping
```

### Pattern 1: Weighted Mean Aggregation

**What:** Calculate weighted average of percentages using reach as weight

**When to use:** For combining age/gender/region percentages from multiple ads

**Example:**
```typescript
// Source: https://gist.github.com/stekhn/a12ed417e91f90ecec14bcfa4c2ae16a
// Weighted mean formula: sum(value_i * weight_i) / sum(weight_i)

function weightedMean(values: number[], weights: number[]): number {
  const [valueSum, weightSum] = values
    .map((v, i) => [v * weights[i], weights[i]])
    .reduce(([vSum, wSum], [v, w]) => [vSum + v, wSum + w], [0, 0]);

  // Handle edge case: no weights (avoid division by zero)
  if (weightSum === 0) return 0;

  return valueSum / weightSum;
}

// Example: Two ads with age 25-34 percentages
// Ad 1: 40% of 25-34, reach = 10,000
// Ad 2: 60% of 25-34, reach = 30,000
// Weighted avg: (40 * 10000 + 60 * 30000) / (10000 + 30000) = 55%
```

### Pattern 2: Group-by-Key Aggregation

**What:** Group breakdown entries by their key (age, gender, region) before aggregating

**When to use:** To combine multiple ads' breakdowns into single summaries

**Example:**
```typescript
// Source: Standard TypeScript Map-based grouping pattern

interface GroupedBreakdown {
  key: string;        // e.g., "25-34" or "female" or "DE"
  percentages: number[];
  weights: number[];
}

function groupBreakdowns<T extends { [key: string]: unknown }>(
  items: T[],
  keyField: keyof T,
  percentageField: keyof T,
  weight: number
): Map<string, { percentages: number[]; weights: number[] }> {
  const groups = new Map<string, { percentages: number[]; weights: number[] }>();

  for (const item of items) {
    const key = String(item[keyField]);
    const percentage = Number(item[percentageField]);

    if (!groups.has(key)) {
      groups.set(key, { percentages: [], weights: [] });
    }

    const group = groups.get(key)!;
    group.percentages.push(percentage);
    group.weights.push(weight);
  }

  return groups;
}
```

### Pattern 3: Normalization to 100%

**What:** Ensure aggregated percentages sum to exactly 100%

**When to use:** After weighted aggregation, before returning results

**Example:**
```typescript
// Source: Standard normalization formula

interface BreakdownEntry {
  key: string;
  percentage: number;
}

function normalizeToHundred(entries: BreakdownEntry[]): BreakdownEntry[] {
  const total = entries.reduce((sum, e) => sum + e.percentage, 0);

  // If already sums to ~100 (within 0.1%), don't normalize
  if (Math.abs(total - 100) < 0.1) return entries;

  // If total is 0, return as-is (all zeros)
  if (total === 0) return entries;

  // Normalize each entry
  return entries.map(e => ({
    ...e,
    percentage: (e.percentage / total) * 100
  }));
}
```

### Pattern 4: Default Weight for Missing Reach

**What:** Assign a fallback weight to ads without reach data so they still contribute

**When to use:** When an ad has demographics but no reach/impressions data

**Example:**
```typescript
// Decision: Ads without reach contribute equally (weight = 1)
// This avoids excluding potentially valuable demographic data

function getWeight(ad: AdDataWithDemographics): number {
  const demographics = ad.demographics;
  if (!demographics) return 0; // No demographics = no contribution

  // Prefer euTotalReach, then impressions midpoint, then default
  if (demographics.euTotalReach && demographics.euTotalReach > 0) {
    return demographics.euTotalReach;
  }

  if (demographics.impressionsLower && demographics.impressionsUpper) {
    return (demographics.impressionsLower + demographics.impressionsUpper) / 2;
  }

  // Default weight: 1 (contributes equally with other no-reach ads)
  return 1;
}
```

### Anti-Patterns to Avoid
- **Excluding ads without reach:** They have demographic data that's still valuable; use default weight
- **Not normalizing:** Raw weighted averages may not sum to 100% due to rounding
- **Modifying input data:** Keep aggregation pure; don't mutate AdDataWithDemographics
- **Over-engineering:** This is simple arithmetic; don't create complex class hierarchies
- **Ignoring zero-weight edge cases:** Division by zero crashes; check weightSum > 0

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted mean | Complex recursive formula | Simple map/reduce pattern | Well-established 5-line implementation |
| Grouping | Manual loops with object mutation | Map-based grouping | Cleaner, type-safe, no mutation |
| Rounding | String formatting | `Math.round(x * 100) / 100` | Standard JavaScript pattern for 2 decimal places |
| Type definitions | Inline types | Centralized in demographic-types.ts | Consistency with Phase 2 |

**Key insight:** This phase is pure data transformation with well-known algorithms. The complexity is in handling edge cases (missing data, normalization) rather than novel computation.

## Common Pitfalls

### Pitfall 1: Division by Zero
**What goes wrong:** `NaN` returned when total weight is zero
**Why it happens:** All ads lack reach data and default weight handling is missing
**How to avoid:**
- Check `if (weightSum === 0)` before dividing
- Return 0 or empty result, not NaN
- Log warning when no weighted data available
**Warning signs:** `NaN` values in output; crashes in downstream code

### Pitfall 2: Percentages Not Summing to 100%
**What goes wrong:** Age groups sum to 98.7% or 101.3%
**Why it happens:** Floating-point arithmetic errors accumulate; Facebook's data may not sum perfectly
**How to avoid:**
- Always normalize final results to exactly 100%
- Round to reasonable precision (1-2 decimal places)
- Document that normalization is applied
**Warning signs:** UI showing percentage totals that don't add up

### Pitfall 3: Losing Dimensional Information
**What goes wrong:** Age/gender combinations lost when aggregating separately
**Why it happens:** Aggregating age and gender as separate dimensions ignores their correlation
**How to avoid:**
- Preserve age-gender pairs as combined keys (e.g., "25-34_male")
- Also provide simplified breakdowns (age-only, gender-only)
- Document what information is preserved vs. summarized
**Warning signs:** Cannot recreate original distribution from summary

### Pitfall 4: Unequal Contribution When Expected
**What goes wrong:** High-reach ad has same influence as low-reach ad
**Why it happens:** Using ad count instead of reach as weight; forgetting to use weight
**How to avoid:**
- Always use reach/impressions as weight (EXTR-04 requirement)
- Write tests that verify high-reach ads dominate result
- Log weights for debugging
**Warning signs:** Aggregated results don't reflect top performer demographics

### Pitfall 5: Mutation of Input Data
**What goes wrong:** Original ad array modified during aggregation
**Why it happens:** Using array.sort() without slice(), modifying objects in place
**How to avoid:**
- Use pure functions that return new objects
- Never modify input arrays or objects
- Use spread operator for object copies
**Warning signs:** Caller's data changed unexpectedly; non-deterministic tests

## Code Examples

Verified patterns for Phase 3 implementation:

### Complete Aggregation Function
```typescript
// Core aggregation logic combining all patterns

import {
  AdDataWithDemographics,
  DemographicBreakdown,
  RegionBreakdown
} from './demographic-types';

// Output type for aggregated results
export interface AggregatedDemographics {
  // Age breakdown (aggregated across genders)
  ageBreakdown: { age: string; percentage: number }[];

  // Gender breakdown (aggregated across ages)
  genderBreakdown: { gender: string; percentage: number }[];

  // Combined age-gender breakdown (preserves correlation)
  ageGenderBreakdown: { age: string; gender: string; percentage: number }[];

  // Region breakdown
  regionBreakdown: { region: string; percentage: number }[];

  // Metadata
  totalReachAnalyzed: number;
  adsWithDemographics: number;
  adsWithoutReach: number;
}

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

function getWeight(ad: AdDataWithDemographics): number {
  const demo = ad.demographics!;

  if (demo.euTotalReach && demo.euTotalReach > 0) {
    return demo.euTotalReach;
  }

  if (demo.impressionsLower && demo.impressionsUpper) {
    return (demo.impressionsLower + demo.impressionsUpper) / 2;
  }

  return 1; // Default weight for ads without reach
}

function emptyResult(): AggregatedDemographics {
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
```

### Weight Calculation Logic
```typescript
// Implements EXTR-04: Weight by reach/impressions

function getWeight(ad: AdDataWithDemographics): number {
  const demo = ad.demographics;
  if (!demo) return 0;

  // Priority 1: EU total reach (most accurate)
  if (demo.euTotalReach && demo.euTotalReach > 0) {
    return demo.euTotalReach;
  }

  // Priority 2: Impressions midpoint
  if (demo.impressionsLower !== undefined && demo.impressionsUpper !== undefined) {
    return (demo.impressionsLower + demo.impressionsUpper) / 2;
  }

  // Priority 3: Default weight (still contributes)
  // This handles "missing data gracefully" per success criteria
  return 1;
}
```

### Age-Gender Aggregation
```typescript
// Aggregate age-gender combinations with proper weighting

function aggregateAgeGender(
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

  for (const [key, { percentages, weights: w }] of groups) {
    const [age, gender] = key.split('_');
    const weightedAvg = weightedMean(percentages, w);

    result.push({ age, gender, percentage: weightedAvg });
  }

  return result;
}

function weightedMean(values: number[], weights: number[]): number {
  let valueSum = 0;
  let weightSum = 0;

  for (let i = 0; i < values.length; i++) {
    valueSum += values[i] * weights[i];
    weightSum += weights[i];
  }

  return weightSum > 0 ? valueSum / weightSum : 0;
}
```

### Normalization
```typescript
// Ensure percentages sum to exactly 100%

function normalizeBreakdown<T extends { percentage: number }>(
  entries: T[]
): T[] {
  if (entries.length === 0) return entries;

  const total = entries.reduce((sum, e) => sum + e.percentage, 0);

  // Already ~100%, no change needed
  if (Math.abs(total - 100) < 0.1) {
    return entries.map(e => ({
      ...e,
      percentage: roundTo2Decimals(e.percentage)
    }));
  }

  // Total is 0, return as-is
  if (total === 0) return entries;

  // Normalize to 100%
  return entries.map(e => ({
    ...e,
    percentage: roundTo2Decimals((e.percentage / total) * 100)
  }));
}

function roundTo2Decimals(n: number): number {
  return Math.round(n * 100) / 100;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple average (unweighted) | Weighted by reach | Industry standard | High-reach ads properly influence summary |
| Exclude missing data | Include with default weight | Best practice | More complete picture; no data loss |
| Separate age/gender arrays | Combined breakdown preserving correlation | Standard | Richer analysis possible |

**Deprecated/outdated:**
- **Unweighted averaging:** Treats 100-reach ad same as 100,000-reach ad; misleading results
- **Ad count as weight:** Does not reflect actual audience size; explicitly rejected by EXTR-04

## Open Questions

Things that couldn't be fully resolved:

1. **Default Weight Value**
   - What we know: Ads without reach should still contribute
   - What's unclear: Should default be 1, or median reach of ads with data?
   - Recommendation: Use 1 as simple default; document in output how many ads used default

2. **Precision for Percentages**
   - What we know: Raw data has varying precision
   - What's unclear: How many decimal places to keep in output
   - Recommendation: 2 decimal places (e.g., 34.56%) - standard for percentage display

3. **Age Bracket Ordering**
   - What we know: Facebook uses brackets like "18-24", "25-34", etc.
   - What's unclear: Exact set of brackets; whether "65+" exists
   - Recommendation: Preserve original labels; sort by first number in bracket

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/demographic-types.ts` - Input data structures
- Existing codebase: `src/lib/demographic-extractor.ts` - Data format context
- [Weighted Arithmetic Mean - GitHub Gist](https://gist.github.com/stekhn/a12ed417e91f90ecec14bcfa4c2ae16a) - TypeScript implementation pattern
- [Weighted Average Formula - DataCamp](https://www.datacamp.com/tutorial/weighted-average-formula) - Formula verification
- [Weighted Arithmetic Mean - Wikipedia](https://en.wikipedia.org/wiki/Weighted_arithmetic_mean) - Mathematical foundation

### Secondary (MEDIUM confidence)
- [Data Aggregation Techniques in TypeScript - CodeSignal](https://codesignal.com/learn/courses/projection-filtering-and-aggregation-of-data-streams-in-ts/lessons/data-aggregation-techniques-in-typescript) - TypeScript patterns
- [Handling Missing Data - Medium](https://medium.com/@tarangds/the-impact-of-missing-data-on-statistical-analysis-and-how-to-fix-it-3498ad084bfe) - Missing data best practices

### Tertiary (LOW confidence)
- General TypeScript best practices articles - Patterns confirmed but not domain-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No dependencies; pure TypeScript
- Architecture: HIGH - Well-defined input/output, standard algorithms
- Pitfalls: HIGH - Common mathematical edge cases documented
- Code examples: HIGH - Based on verified formulas and existing codebase types

**Research date:** 2026-01-19
**Valid until:** 2026-03-19 (60 days - this is stable algorithmic work, not framework-dependent)

---

## Implementation Guidance for Planner

### Critical Path
1. **Define output types** - `AggregatedDemographics` interface
2. **Implement weight calculation** - `getWeight()` with reach priority
3. **Implement grouped aggregation** - Map-based grouping, weighted mean
4. **Implement normalization** - Ensure 100% sums
5. **Derive simplified breakdowns** - Age-only, gender-only from combined
6. **Integrate with scraper** - Call aggregator after demographic scraping
7. **Add unit tests** - Verify weighting, normalization, edge cases

### Estimated Effort
- Type definitions: 15 minutes
- Weight calculation: 30 minutes
- Grouped aggregation: 1 hour
- Normalization: 30 minutes
- Derived breakdowns: 30 minutes
- Integration: 30 minutes
- Unit tests: 1 hour
- **Total: 4-5 hours**

### Risk Assessment
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rounding errors | Medium | Normalize to 100%; round to 2 decimals |
| Missing reach data | High | Default weight of 1; track in metadata |
| Division by zero | Low | Check before dividing; return empty result |
| Type mismatches | Low | Strict TypeScript; test with real data |
