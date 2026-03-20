# Phase 51: Demographic Peek - Research

**Researched:** 2026-03-20
**Domain:** Mini demographic charts for ad library browsing
**Confidence:** HIGH

## Summary

This phase adds mini demographic charts (age, gender, country) visible while browsing the ad library grid. The codebase already has extensive demographic infrastructure: aggregated demographics are stored per-brand (`AdLibraryBrand.demographicsJson`), per-ad targeting data exists (`AdLibraryAd.targetingJson`), and multiple chart components use Recharts throughout the dashboard.

The primary data source for "demographic peek" is `AdLibraryBrand.demographicsJson`, which contains aggregated `AggregatedDemographics` (age breakdown, gender breakdown, region breakdown) populated during ingestion. Per-ad `targetingJson` stores `deliveryByRegion`, `targetAges`, and `targetGender` but is less useful for aggregated views and would require expensive queries.

**Primary recommendation:** Build a collapsible `DemographicPeek` panel that renders above or beside the ad grid when a brand filter is active, fetching the brand's `demographicsJson` from the existing `/api/ad-library/brands/[pageId]` endpoint (which already returns the full brand record). Use lightweight Recharts `BarChart` and `PieChart` components consistent with the existing chart infrastructure. For category-level views, create a new API endpoint that aggregates `demographicsJson` across brands in the selected category.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.6.0 | Chart rendering | Already installed and used extensively (17+ files) |
| Tailwind CSS v4 | (installed) | Chart container styling | Project standard |
| lucide-react | (installed) | Icons for chart labels | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/demographics-normalizer.ts` | (existing) | Normalize old/new demographicsJson formats | Always - handles schema drift between old object and new array formats |
| `src/lib/demographic-types.ts` | (existing) | TypeScript types for demographics | Always - `AggregatedDemographics`, `NormalizedDemographics` |
| `src/components/ui/chart.tsx` | (existing) | ChartContainer, ChartTooltip wrappers | For consistent tooltip styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Pure CSS/SVG bars | Lighter weight for mini charts, but inconsistent with rest of app |
| Recharts | Tremor | Would add new dependency for no benefit when Recharts already works |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Data Flow

```
Brand filter active?
  YES -> Fetch brand.demographicsJson from /api/ad-library/brands/[pageId]
  NO  -> Category filter active?
           YES -> New API: /api/ad-library/demographics?category=X (aggregates across brands)
           NO  -> Hide demographic panel (no meaningful aggregation across all brands)
```

### Recommended Component Structure
```
src/app/dashboard/v2/ad-library/
  components/
    demographic-peek.tsx          # Main panel component (collapsible)
    demographic-peek-charts.tsx   # Mini bar/pie chart sub-components
```

### Pattern 1: Collapsible Panel Above Grid
**What:** A horizontal bar/card above the ad grid that shows 3 mini charts side by side (age, gender, country). Collapsible to not block browsing.
**When to use:** When a brand or category filter is active.
**Example:**
```typescript
// Placement in page.tsx (between FilterBar and grid section)
{brandDemographics && (
  <DemographicPeek
    demographics={brandDemographics}
    darkMode={darkMode}
    onCollapse={() => setDemoCollapsed(!demoCollapsed)}
    collapsed={demoCollapsed}
  />
)}
```

### Pattern 2: Fetch Demographics Alongside Brand Data
**What:** When the brand filter changes, fetch demographics from the brand detail endpoint which already returns the full brand record including `demographicsJson`.
**When to use:** Brand-filtered views.
**Example:**
```typescript
// In page.tsx, add effect that fires when brandFilter changes
useEffect(() => {
  if (!brandFilter) {
    setBrandDemographics(null);
    return;
  }
  fetch(`/api/ad-library/brands/${brandFilter}`)
    .then(res => res.json())
    .then(data => {
      if (data.brand?.demographicsJson) {
        const normalized = normalizeDemographicsJson(data.brand.demographicsJson);
        setBrandDemographics(normalized);
      }
    })
    .catch(() => setBrandDemographics(null));
}, [brandFilter]);
```

### Pattern 3: Mini Chart Sizing
**What:** Use small, fixed-height Recharts components (120-150px tall) inside the peek panel. No legends -- use inline labels instead.
**When to use:** Always for the demographic peek charts.
**Example:**
```typescript
// Mini bar chart for age breakdown
<ResponsiveContainer width="100%" height={120}>
  <BarChart data={demographics.ageBreakdown} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
    <XAxis dataKey="age" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
    <Bar dataKey="percentage" fill="#1235e2" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid
- **Fetching all ads' targetingJson to aggregate on the client:** This would be extremely slow and wasteful. Use pre-aggregated `demographicsJson` from brands.
- **Blocking the grid while demographics load:** Demographics are supplementary -- render grid first, demographics can lazy-load.
- **Full-size charts:** This is a "peek" -- charts should be compact (120-150px height). Reserve full charts for dedicated analytics pages.
- **Showing empty demographic panel with "no data" message for all brands:** Many brands may lack demographics. Only show the panel when data exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Demographics JSON normalization | Custom JSON parsing | `normalizeDemographicsJson()` from `src/lib/demographics-normalizer.ts` | Already handles old/new format drift between object and array schemas |
| Chart tooltips | Custom tooltip divs | `ChartTooltipContent` from `src/components/ui/chart.tsx` or Recharts built-in | Already styled for dark/light modes |
| Percentage formatting | Manual rounding | `normalizeBreakdown()` from `src/lib/demographic-aggregator.ts` | Handles edge cases (sums to ~100%, divide-by-zero) |
| Number formatting | Custom formatters | `formatNumber()` from `v2-shell.tsx` | Already used throughout the ad library |
| Country code display | Lookup tables | Map country codes to flag emojis or use raw codes | Existing pattern in the codebase |

## Common Pitfalls

### Pitfall 1: demographicsJson May Be Null
**What goes wrong:** Rendering crashes when brand has no demographics data.
**Why it happens:** Not all brands have demographic data -- it's populated during ingestion and may fail or not be available for some regions.
**How to avoid:** Always check `brand.demographicsJson !== null` before rendering. Don't show the DemographicPeek panel at all when data is missing.
**Warning signs:** Crash on brand filter selection.

### Pitfall 2: Schema Drift in demographicsJson
**What goes wrong:** Old brands have object-format (`{ gender: { male: 45 } }`) while new brands have array-format (`{ genderBreakdown: [{ gender: 'male', percentage: 45 }] }`).
**Why it happens:** The schema evolved over time. Both formats exist in the database.
**How to avoid:** Always run `normalizeDemographicsJson()` on raw JSON before rendering. Never access fields directly.
**Warning signs:** Charts show empty or NaN values for some brands.

### Pitfall 3: Performance Impact on Ad Browsing
**What goes wrong:** Additional API call for demographics slows down the page or blocks ad rendering.
**Why it happens:** Fetching demographics synchronously with ads.
**How to avoid:** Fetch demographics independently from the ads fetch. Use a separate `useEffect` triggered by `brandFilter` changes. The demographic panel can appear with a brief skeleton state.
**Warning signs:** Ads grid loading spinner takes longer than before.

### Pitfall 4: Category-Level Aggregation Expense
**What goes wrong:** Aggregating demographics across all brands in a category requires fetching many brand records.
**Why it happens:** No pre-computed category-level demographics exist.
**How to avoid:** For category-level view, create a simple API endpoint that fetches `demographicsJson` from the top N brands (e.g., top 10 by reach) in the category and does a weighted average. Don't try to aggregate ALL brands in a category. Alternatively, defer category-level demographics to a later phase and only show per-brand for now.
**Warning signs:** API response times > 500ms for category demographics.

### Pitfall 5: Dark/Light Mode Inconsistency
**What goes wrong:** Charts look correct in one mode but illegible in the other.
**Why it happens:** Hardcoded colors that don't adapt.
**How to avoid:** Use the project's design system colors: `#1235e2` primary, dark `#101322` / light `#f6f6f8` backgrounds. Pass `darkMode` prop to chart components and adjust fills/strokes accordingly.
**Warning signs:** White text on white background or invisible grid lines.

## Code Examples

### Existing Brand Demographics Access Pattern
```typescript
// Source: src/app/api/ad-library/brands/[pageId]/route.ts
// The brand detail endpoint already returns full brand record including demographicsJson
const brand = await prisma.adLibraryBrand.findUnique({
  where: { pageId },
});
// brand.demographicsJson is the AggregatedDemographics object
```

### Demographics Normalization
```typescript
// Source: src/lib/demographics-normalizer.ts
import { normalizeDemographicsJson, NormalizedDemographics } from '@/lib/demographics-normalizer';

const normalized: NormalizedDemographics | null = normalizeDemographicsJson(brand.demographicsJson);
// normalized = {
//   ageBreakdown: [{ age: '18-24', percentage: 20 }, { age: '25-34', percentage: 35 }, ...],
//   genderBreakdown: [{ gender: 'male', percentage: 48 }, { gender: 'female', percentage: 52 }],
//   regionBreakdown: [{ region: 'DE', percentage: 30 }, { region: 'FR', percentage: 25 }, ...],
// }
```

### Mini Bar Chart Pattern (from existing Recharts usage)
```typescript
// Source: Adapted from src/components/dashboard/demographic-trend-chart.tsx
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

function AgeBreakdownMini({ data, darkMode }: { data: { age: string; percentage: number }[]; darkMode: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis
          dataKey="age"
          tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`${Math.round(value)}%`, 'Audience']}
          contentStyle={{
            backgroundColor: darkMode ? '#161b2e' : '#fff',
            border: `1px solid ${darkMode ? 'rgba(18,53,226,0.2)' : '#e2e8f0'}`,
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="percentage" fill="#1235e2" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Existing Color Patterns for Demographics
```typescript
// Source: src/components/dashboard/demographic-trend-chart.tsx
const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',    // blue-500
  female: '#ec4899',  // pink-500
  unknown: '#6b7280', // gray-500
};

const AGE_COLORS: Record<string, string> = {
  '13-17': '#94a3b8', '18-24': '#a3e635', '25-34': '#22c55e',
  '35-44': '#14b8a6', '45-54': '#06b6d4', '55-64': '#8b5cf6', '65+': '#f59e0b',
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Object-format demographics `{ gender: { male: 45 } }` | Array-format `{ genderBreakdown: [{ gender, percentage }] }` | During v5.0 pipeline rewrite | Must always normalize with `normalizeDemographicsJson()` |
| No brand-level demographics | `AdLibraryBrand.demographicsJson` populated during ingestion | v5.0 pipeline | Brand-level demographic data readily available |
| Per-ad demographics only | Pre-aggregated brand-level demographics | v5.0 pipeline | No need to query individual ads for aggregated views |

## Open Questions

1. **How many brands actually have demographicsJson populated?**
   - What we know: The ingestion pipeline attempts to populate it, but may fail for some brands.
   - What's unclear: The exact percentage of brands with data.
   - Recommendation: Build the UI to gracefully hide when no data exists. Could also add a count check query to inform the UI.

2. **Should category-level demographics be in scope for Phase 51?**
   - What we know: Per-brand demographics are straightforward (data exists on AdLibraryBrand). Category aggregation requires a new API endpoint and on-the-fly aggregation.
   - What's unclear: Whether the user prioritizes category-level views.
   - Recommendation: Start with per-brand demographics only (when brandFilter is active). Category aggregation can be a follow-up if needed. This satisfies the success criteria ("when browsing by brand, a mini demographic chart is visible").

3. **Expand/collapse state persistence?**
   - What we know: The panel should be collapsible to not obstruct ad browsing.
   - What's unclear: Whether state should persist across sessions (localStorage) or reset per page load.
   - Recommendation: Use localStorage to remember collapsed/expanded state. Simple and low-risk.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- Confirmed `AdLibraryBrand.demographicsJson` (Json?) and `demographicsUpdatedAt` fields
- `src/lib/demographic-types.ts` -- `AggregatedDemographics` interface with ageBreakdown, genderBreakdown, regionBreakdown
- `src/lib/demographics-normalizer.ts` -- `normalizeDemographicsJson()` handles old/new format drift
- `src/lib/demographic-aggregator.ts` -- Weighted aggregation utilities (for potential category-level use)
- `src/app/api/ad-library/brands/[pageId]/route.ts` -- Existing endpoint returns full brand record
- `src/app/api/ad-library/cron/ingest/route.ts` (line 912-919) -- Confirms demographics stored on brand during ingestion
- `src/components/dashboard/demographic-trend-chart.tsx` -- Existing Recharts chart patterns with age/gender/country
- `src/components/demographics/demographics-summary.tsx` -- Existing demographics display component (older dashboard)
- `package.json` -- Confirms recharts ^3.6.0 installed

### Secondary (MEDIUM confidence)
- `src/app/api/ad-library/analytics/route.ts` -- Shows pattern for aggregating targeting data from ads (deliveryByRegion)

### Tertiary (LOW confidence)
- Category-level aggregation performance -- Estimated but not benchmarked

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Recharts already installed and used in 17+ files, all demographic types/utils exist
- Architecture: HIGH -- Data model is clear, existing patterns for demographics display exist throughout the app
- Pitfalls: HIGH -- Based on direct code analysis of existing demographic handling patterns

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
