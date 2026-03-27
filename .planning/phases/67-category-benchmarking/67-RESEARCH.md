# Phase 67: Category Benchmarking - Research

**Researched:** 2026-03-27
**Domain:** Category-level aggregation and brand vs. category comparison across 8 classification dimensions
**Confidence:** HIGH

## Summary

Phase 67 adds category benchmarking -- comparing a brand's creative strategy against the average of all analyzed brands in the same business category. The infrastructure for this is **almost entirely built already**. The existing `/api/analyze/benchmark` API endpoint already computes category averages from `BrandAnalysisCache`, produces per-pillar index scores, and returns gaps/strengths. The `BenchmarkComparison` UI component already renders this data with comparison bars, score cards, and gap/strength sections.

The core work for this phase is about upgrading from the current diversity-score-level benchmarking to **distribution-level benchmarking** (BNCH-01) and adding **index scores like "2x over-indexed on testimonials"** (BNCH-02). The current benchmark compares diversity scores (single numbers per category), not the underlying distributions (e.g., "35% UGC, 20% studio"). The requirements explicitly call for distribution-level comparison with index multipliers.

**Primary recommendation:** Extend the existing benchmark API to compute category average distributions from `BrandAnalysisCache.distributionJson`, then add index score computation (brand % / category avg %) per taxonomy value. Reuse the existing `BenchmarkComparison` component structure but add a new distribution comparison section.

## Standard Stack

No new libraries needed. This phase uses existing infrastructure exclusively.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.4.2 | DB queries for BrandAnalysisCache aggregation | Already used throughout |
| Next.js Route Handlers | 16 | API endpoint for benchmark data | Existing pattern |
| React | 19 | UI components | Existing |
| Tailwind CSS | v4 | Styling | Existing |
| Lucide React | latest | Icons | Existing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | - | - |

## Architecture Patterns

### Existing Infrastructure to Reuse

The codebase already has a complete benchmark pipeline. Here is what exists:

1. **`/api/analyze/benchmark` (POST)** -- Fetches brand's `BrandAnalysisCache`, fetches all `BrandAnalysisCache` rows for the category, computes averages, produces per-pillar indexing with `computeIndex()`, generates gaps/strengths lists. Currently operates on diversity **scores** (single ints), not distributions.

2. **`BenchmarkComparison` component** -- Renders overall/Andromeda score cards, per-pillar comparison bars (brand vs category avg), and gaps/strengths sections. Already imported and used in `AnalysisView`.

3. **`BrandAnalysisCache.distributionJson`** -- Stores the full `CategoryDistribution` (8 categories, each mapping taxonomy values to counts). This is the key data source for distribution-level benchmarking.

4. **`AnalysisView`** -- After diversity analysis succeeds, automatically calls `fetchBenchmark()` if brand has a category. Non-blocking, silently fails if not available.

5. **`StrategyView`** -- Shows taxonomy breakdown with horizontal bar charts per category. This is the **exact UI pattern** needed for distribution comparison.

### Recommended Approach

```
Upgrade path (not greenfield):

1. Extend /api/analyze/benchmark:
   - Already fetches all BrandAnalysisCache for category
   - ADD: Aggregate distributionJson across all category brands
   - ADD: Compute per-value index scores (brand pct / category avg pct)
   - Return new distributionComparison field alongside existing indexing

2. Extend BenchmarkComparison component:
   - ADD: Distribution comparison section (bar charts per category)
   - ADD: Index score badges on each value (e.g., "2.1x", "0.5x")
   - Reuse StrategyView's bar chart pattern for distribution rendering

3. Integration point: Already wired in AnalysisView
   - No new routing or flow state changes needed
   - BenchmarkComparison already receives full result object
```

### Data Flow

```
BrandAnalysisCache (brand) ─────────────────────────────────┐
                                                              │
BrandAnalysisCache (all category brands) ── aggregate ──────┤
  └─ distributionJson per brand                              │
     └─ merge into category avg distribution                 │
                                                              ▼
                                              /api/analyze/benchmark
                                                              │
                                              ┌───────────────┤
                                              │               │
                                        existing:       new:
                                        diversity      distribution
                                        score          comparison
                                        indexing       + index scores
                                              │               │
                                              ▼               ▼
                                        BenchmarkComparison component
```

### Index Score Computation

```typescript
// For each taxonomy category (e.g., visualFormat):
// brand distribution: { "talking-head": 15, "product-demo": 8, "lifestyle": 3 }
// category avg distribution: { "talking-head": 10, "product-demo": 12, "lifestyle": 8, ... }

// Convert to percentages:
// brand: { "talking-head": 57.7%, "product-demo": 30.8%, "lifestyle": 11.5% }
// category: { "talking-head": 20%, "product-demo": 24%, "lifestyle": 16%, ... }

// Index score = brand % / category avg %
// "talking-head": 57.7 / 20 = 2.9x (over-indexed)
// "lifestyle": 11.5 / 16 = 0.7x (under-indexed)

// Thresholds:
// >= 1.5x = "over-indexed" (strength/saturation)
// <= 0.5x = "under-indexed" (gap/opportunity)
// 0.5x - 1.5x = "in line with category"
```

### Anti-Patterns to Avoid
- **Computing from AdClassification directly for category averages:** Use `BrandAnalysisCache.distributionJson` instead. Querying raw classifications across all brands in a category would be extremely expensive. The cache exists for this exact purpose.
- **Building a separate caching layer for category averages:** Not needed at current scale. In-memory aggregation of `BrandAnalysisCache` rows (likely <50 per category) is fast enough.
- **Creating a new API route:** The existing `/api/analyze/benchmark` already handles this flow. Extend it, don't duplicate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-pillar comparison bars | Custom SVG charts | Existing `PillarComparisonBar` in `BenchmarkComparison` | Already styled, handles dark mode |
| Score cards | New card components | Existing `ScoreCard` in `BenchmarkComparison` | Consistent design |
| Distribution bar charts | Custom chart library | Copy pattern from `StrategyView` taxonomy breakdown section | Horizontal bars with labels and counts already implemented |
| Category avg aggregation | Raw SQL or complex Prisma | `Promise.all` + in-memory avg of `distributionJson` | Small dataset, fast enough |

## Common Pitfalls

### Pitfall 1: Division by Zero in Index Scores
**What goes wrong:** Category average percentage for a taxonomy value is 0% (no brand in category uses it), and you divide brand% by 0.
**Why it happens:** Some taxonomy values are rare (e.g., "ai-generated" asset type, "giveaway" offer type).
**How to avoid:** Guard against zero denominators. If category avg is 0% and brand is >0%, display as "unique to brand" rather than infinity. If both are 0%, skip the value.
**Warning signs:** NaN or Infinity values in index scores.

### Pitfall 2: Small Category Sample Size
**What goes wrong:** A category has only 1-2 analyzed brands, making "category average" meaningless.
**Why it happens:** Not all brands have been analyzed via `/api/analyze/diversity`.
**How to avoid:** Show a warning badge when `analyzedBrands < 3` (already implemented in `BenchmarkComparison`). Consider requiring minimum 3 analyzed brands before showing distribution comparison.
**Warning signs:** The existing benchmark API already shows this via `category.analyzedBrands vs category.totalBrands`.

### Pitfall 3: Stale distributionJson
**What goes wrong:** `BrandAnalysisCache.distributionJson` was saved months ago and doesn't reflect current ad mix.
**Why it happens:** Cache is only updated when `/api/analyze/diversity` is called for that brand.
**How to avoid:** Show `analyzedAt` date. For the current brand, the cache was just updated (since analysis runs before benchmark). For other category brands, accept staleness -- this is a known tradeoff.

### Pitfall 4: Excluding Current Brand from Category Average
**What goes wrong:** Including the current brand in the category average inflates similarity, making index scores closer to 1.0x.
**Why it happens:** Natural tendency to include all data.
**How to avoid:** The existing benchmark API already handles this correctly -- it filters out the current brand (`otherAnalyses`) with fallback to include it only when it's the sole analyzed brand.

### Pitfall 5: Inconsistent Distribution Formats in distributionJson
**What goes wrong:** Different brands' `distributionJson` may have different keys present (some have "ai-generated", some don't).
**Why it happens:** Brands with no ads of a certain type simply don't have that key in their distribution.
**How to avoid:** When aggregating across brands, iterate over ALL taxonomy values from `TAXONOMY[key].values`, treating missing values as 0.

## Code Examples

### Computing Category Average Distribution
```typescript
// Source: Pattern derived from existing /api/analyze/benchmark + taxonomy.ts

import { TAXONOMY, CATEGORY_KEYS, type CategoryKey } from '@/lib/classification/taxonomy';

type CategoryDistribution = Record<CategoryKey, Record<string, number>>;

function computeCategoryAvgDistribution(
  analyses: { distributionJson: unknown }[]
): CategoryDistribution {
  const result: CategoryDistribution = {} as CategoryDistribution;

  for (const key of CATEGORY_KEYS) {
    const allValues = TAXONOMY[key].values;
    const avgDist: Record<string, number> = {};

    for (const value of allValues) {
      const counts = analyses
        .map(a => {
          const dist = a.distributionJson as CategoryDistribution | null;
          return dist?.[key]?.[value] ?? 0;
        });

      // Average count across brands
      avgDist[value] = counts.length > 0
        ? counts.reduce((s, c) => s + c, 0) / counts.length
        : 0;
    }

    result[key] = avgDist;
  }

  return result;
}
```

### Computing Index Scores per Value
```typescript
// Source: Pattern from requirements BNCH-02

interface ValueIndex {
  value: string;
  label: string;
  brandPct: number;      // 0-100
  categoryPct: number;   // 0-100
  indexScore: number;     // e.g., 2.1 means 2.1x
  status: 'over-indexed' | 'under-indexed' | 'in-line' | 'unique';
}

function computeValueIndices(
  brandDist: Record<string, number>,
  categoryAvgDist: Record<string, number>,
  allValues: readonly string[],
  labels: Record<string, string>
): ValueIndex[] {
  const brandTotal = Object.values(brandDist).reduce((s, v) => s + v, 0);
  const catTotal = Object.values(categoryAvgDist).reduce((s, v) => s + v, 0);

  return allValues.map(value => {
    const brandCount = brandDist[value] ?? 0;
    const catCount = categoryAvgDist[value] ?? 0;

    const brandPct = brandTotal > 0 ? (brandCount / brandTotal) * 100 : 0;
    const categoryPct = catTotal > 0 ? (catCount / catTotal) * 100 : 0;

    let indexScore: number;
    let status: ValueIndex['status'];

    if (categoryPct === 0 && brandPct > 0) {
      indexScore = Infinity;
      status = 'unique';
    } else if (categoryPct === 0) {
      indexScore = 0;
      status = 'in-line';
    } else {
      indexScore = Math.round((brandPct / categoryPct) * 10) / 10;
      status = indexScore >= 1.5 ? 'over-indexed'
             : indexScore <= 0.5 ? 'under-indexed'
             : 'in-line';
    }

    return {
      value,
      label: labels[value] || value,
      brandPct: Math.round(brandPct * 10) / 10,
      categoryPct: Math.round(categoryPct * 10) / 10,
      indexScore,
      status,
    };
  }).filter(v => v.brandPct > 0 || v.categoryPct > 0); // Skip unused values
}
```

### Distribution Comparison UI Pattern
```typescript
// Source: Adapted from strategy-view.tsx taxonomy breakdown pattern

// For each taxonomy category, render side-by-side bars:
// [Label] [=== brand bar (blue) ===] 35%  2.1x
//         [==== category bar (gray) ====] 20%
//
// Index badge colors:
// over-indexed (>=1.5x): green
// under-indexed (<=0.5x): red/amber
// in-line: neutral/gray
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No benchmarking | Diversity score comparison via `/api/analyze/benchmark` | Phase 65-66 | Score-level comparison exists |
| JSON blob classifications | Indexed columns on AdClassification | Phase 62 | Fast queries possible |
| No distribution cache | `distributionJson` on BrandAnalysisCache | Phase 64-65 | Distribution data available for aggregation |

**Key insight:** The existing system already has 90% of the infrastructure. The gap is going from score-level comparison (one number per category) to distribution-level comparison (percentage breakdown per taxonomy value with index multipliers).

## Open Questions

1. **Data coverage per category**
   - What we know: `AdLibraryBrand.category` field exists and is indexed. `BrandAnalysisCache` stores analysis results with `distributionJson`.
   - What's unclear: Exact counts of analyzed brands per category. Could not query the production database directly during research.
   - Recommendation: Add a data-check task early in the phase to run a quick query. If most categories have <3 analyzed brands, the feature will show "limited data" warnings everywhere. May need to prioritize running diversity analysis on more brands first.

2. **Where to surface benchmarking in the UI**
   - What we know: Currently embedded in `AnalysisView` (which requires running analysis first). `StrategyView` does NOT include benchmarking.
   - What's unclear: Should distribution benchmarking also appear in Strategy view? Or only in Analysis view?
   - Recommendation: Keep it in Analysis view for now (path of least resistance). The Strategy view is focused on gap matrix + concept generation, which is a different workflow. Can cross-link later.

3. **Category normalization**
   - What we know: The benchmark API already uses case-insensitive matching (`mode: 'insensitive'`). Categories are free-text strings on `AdLibraryBrand.category`.
   - What's unclear: Are there inconsistent category names (e.g., "Fashion" vs "fashion" vs "Fashion & Apparel")?
   - Recommendation: The case-insensitive match handles basic casing. For Phase 67, accept free-text categories as-is. Category normalization is a separate concern.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- Full data model including BrandAnalysisCache with distributionJson, AdClassification with 8 indexed columns, AdLibraryBrand with category field
- `src/app/api/analyze/benchmark/route.ts` -- Existing benchmark API with category avg computation, pillar indexing, gap/strength generation
- `src/app/api/analyze/diversity/route.ts` -- Diversity analysis that populates BrandAnalysisCache including distributionJson
- `src/app/api/strategy/[pageId]/route.ts` -- Strategy API with taxonomy breakdown computation pattern
- `src/app/dashboard/v2/creative-lab/benchmark-comparison.tsx` -- Existing benchmark UI component
- `src/app/dashboard/v2/creative-lab/analysis-view.tsx` -- Integration point showing benchmark after analysis
- `src/app/dashboard/v2/creative-lab/strategy-view.tsx` -- Taxonomy breakdown bar chart UI pattern
- `src/lib/classification/taxonomy.ts` -- 8 categories, 71 values, CATEGORY_KEYS

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- existing API and UI components can be directly extended
- Pitfalls: HIGH -- patterns are well-understood from existing code
- Data coverage: MEDIUM -- could not query production DB for exact category counts

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependencies)
