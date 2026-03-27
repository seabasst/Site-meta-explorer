// =============================================================================
// Benchmark Utility Functions
// =============================================================================
// Distribution-level benchmarking: compare brand taxonomy distributions
// against category averages with index scores per taxonomy value.
// Used by: /api/analyze/benchmark

import {
  TAXONOMY,
  CATEGORY_KEYS,
  type CategoryKey,
} from '@/lib/classification/taxonomy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValueIndex {
  value: string;
  label: string;
  brandPct: number; // 0-100, 1 decimal
  categoryPct: number; // 0-100, 1 decimal
  indexScore: number; // e.g. 2.1 means 2.1x over category avg
  status: 'over-indexed' | 'under-indexed' | 'in-line' | 'unique';
}

type CategoryDistribution = Record<CategoryKey, Record<string, number>>;

// ---------------------------------------------------------------------------
// computeCategoryAvgDistribution
// ---------------------------------------------------------------------------
// Aggregates distributionJson across multiple BrandAnalysisCache rows to
// produce an average count per taxonomy value per category.

export function computeCategoryAvgDistribution(
  analyses: { distributionJson: unknown }[]
): CategoryDistribution {
  const result = {} as CategoryDistribution;

  for (const key of CATEGORY_KEYS) {
    const allValues = TAXONOMY[key].values;
    const avgDist: Record<string, number> = {};

    for (const value of allValues) {
      const counts = analyses.map((a) => {
        const dist = a.distributionJson as CategoryDistribution | null;
        return dist?.[key]?.[value] ?? 0;
      });

      avgDist[value] =
        counts.length > 0
          ? counts.reduce((s, c) => s + c, 0) / counts.length
          : 0;
    }

    result[key] = avgDist;
  }

  return result;
}

// ---------------------------------------------------------------------------
// computeValueIndices
// ---------------------------------------------------------------------------
// Compares a brand's distribution against category average for a single
// taxonomy category. Returns per-value index scores with status labels.

export function computeValueIndices(
  brandDist: Record<string, number>,
  categoryAvgDist: Record<string, number>,
  categoryKey: CategoryKey
): ValueIndex[] {
  const allValues = TAXONOMY[categoryKey].values;
  const labels = TAXONOMY[categoryKey].labels as Record<string, string>;

  const brandTotal = Object.values(brandDist).reduce((s, v) => s + v, 0);
  const catTotal = Object.values(categoryAvgDist).reduce((s, v) => s + v, 0);

  return allValues
    .map((value) => {
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
        // Both zero — will be filtered out below
        indexScore = 0;
        status = 'in-line';
      } else {
        indexScore = Math.round((brandPct / categoryPct) * 10) / 10;
        status =
          indexScore >= 1.5
            ? 'over-indexed'
            : indexScore <= 0.5
              ? 'under-indexed'
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
    })
    .filter((v) => v.brandPct > 0 || v.categoryPct > 0);
}
