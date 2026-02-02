# Phase 30: Brand Comparison - Research

**Researched:** 2026-02-02
**Domain:** Side-by-side brand demographic comparison with butterfly/paired charts
**Confidence:** HIGH

## Summary

This phase adds a dedicated comparison page where users select exactly 2 saved brands and view their demographic data side-by-side using butterfly charts (age-gender), paired horizontal bars (country), and a summary metrics table.

The codebase already has all required data infrastructure: `TrackedBrand` with `BrandSnapshot` containing `demographicsJson` (which stores full `AggregatedDemographics` including `ageGenderBreakdown`, `regionBreakdown`, `genderBreakdown`, and `ageBreakdown`). The existing `useTrackedBrands` hook fetches all brands with their latest snapshots from `/api/dashboard/overview`. Recharts v3.6.0 is already installed and used in `TrendChart` with `LineChart`, `ResponsiveContainer`, etc. The existing `AgeGenderChart` and `CountryChart` components are custom HTML/CSS (not Recharts), but the comparison charts need a different visual approach (butterfly/paired), so new Recharts-based components are appropriate.

**Primary recommendation:** Build the comparison page at `/dashboard/compare` using the existing `useTrackedBrands` hook for data, Recharts `BarChart` with `layout="vertical"` for butterfly charts (negative values for Brand A, positive for Brand B), and paired horizontal `BarChart` for country comparison. No new API endpoints needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^3.6.0 | Butterfly + paired bar charts | Already installed, used in TrendChart |
| Next.js App Router | existing | Page routing at `/dashboard/compare` | Project standard |
| useTrackedBrands hook | existing | Fetch all brand data with snapshots | Already provides all needed data |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons for UI elements | Already used across dashboard |
| sonner | existing | Toast notifications | Already used in dashboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts butterfly chart | Custom CSS bars (like existing AgeGenderChart) | Recharts handles axes, tooltips, responsive sizing automatically; custom CSS gives more design control but more code. Use Recharts for consistency with TrendChart and better axis labeling. |
| URL-based brand selection | React state only | URL params (`?a=id1&b=id2`) enable shareable links and back-button support. Use URL params. |

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    dashboard/
      compare/
        page.tsx              # Comparison page (client component)
  components/
    comparison/
      brand-selector.tsx      # Dual brand picker (2 dropdowns)
      butterfly-chart.tsx     # Age-gender butterfly (Recharts)
      country-comparison.tsx  # Paired horizontal bars (Recharts)
      metrics-table.tsx       # Summary metrics side-by-side
      comparison-empty.tsx    # Empty state (< 2 brands)
```

### Pattern 1: Butterfly Chart via Negative Values
**What:** Use Recharts `BarChart` with `layout="vertical"`, negate Brand A values so bars extend left from center axis, Brand B values extend right.
**When to use:** Age-gender comparison (COMP-02)
**Example:**
```typescript
// Transform data: Brand A gets negative values, Brand B positive
const chartData = AGE_RANGES.map(age => ({
  age,
  brandA_male: -(brandAData.find(d => d.age === age)?.male ?? 0),
  brandA_female: -(brandAData.find(d => d.age === age)?.female ?? 0),
  brandB_male: brandBData.find(d => d.age === age)?.male ?? 0,
  brandB_female: brandBData.find(d => d.age === age)?.female ?? 0,
}));

// Recharts BarChart with layout="vertical"
<BarChart layout="vertical" data={chartData} stackOffset="sign">
  <XAxis type="number" tickFormatter={(v) => `${Math.abs(v)}%`} />
  <YAxis type="category" dataKey="age" />
  <Bar dataKey="brandA_male" fill="#3b82f6" stackId="a" />
  <Bar dataKey="brandA_female" fill="#f43f5e" stackId="a" />
  <Bar dataKey="brandB_male" fill="#60a5fa" stackId="b" />
  <Bar dataKey="brandB_female" fill="#fb7185" stackId="b" />
</BarChart>
```

### Pattern 2: Paired Horizontal Bars for Country Comparison
**What:** Two side-by-side `Bar` components per country, grouped (not stacked).
**When to use:** Country distribution comparison (COMP-03)
**Example:**
```typescript
// Merge countries from both brands into unified list
const countries = mergeCountries(brandACountries, brandBCountries);
// Each entry: { country: "DE", brandA: 25.3, brandB: 18.7 }

<BarChart layout="vertical" data={countries}>
  <XAxis type="number" tickFormatter={(v) => `${v}%`} />
  <YAxis type="category" dataKey="country" width={60} />
  <Bar dataKey="brandA" fill="var(--accent-green)" name={brandAName} />
  <Bar dataKey="brandB" fill="#f59e0b" name={brandBName} />
</BarChart>
```

### Pattern 3: URL-Based Brand Selection
**What:** Store selected brand IDs in URL search params for shareability.
**When to use:** Brand selection state management
**Example:**
```typescript
// In compare/page.tsx
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

// Read from URL: /dashboard/compare?a=cuid1&b=cuid2
const searchParams = useSearchParams();
const brandAId = searchParams.get('a');
const brandBId = searchParams.get('b');

// Update URL when user selects brands
const updateSelection = (key: 'a' | 'b', id: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set(key, id);
  router.replace(`/dashboard/compare?${params.toString()}`);
};
```

### Pattern 4: Data Extraction from demographicsJson
**What:** Parse the `demographicsJson` field from snapshots to get full demographic breakdowns.
**When to use:** Extracting age-gender and region data for charts
**Example:**
```typescript
interface AggregatedDemographics {
  ageBreakdown: { age: string; percentage: number }[];
  genderBreakdown: { gender: string; percentage: number }[];
  ageGenderBreakdown: { age: string; gender: string; percentage: number }[];
  regionBreakdown: { region: string; percentage: number }[];
  totalReachAnalyzed: number;
  adsWithDemographics: number;
  adsWithoutReach: number;
}

// Extract from snapshot
const demo = typeof snapshot.demographicsJson === 'string'
  ? JSON.parse(snapshot.demographicsJson)
  : snapshot.demographicsJson as AggregatedDemographics;

// ageGenderBreakdown has entries like:
// { age: "25-34", gender: "male", percentage: 18.5 }
// { age: "25-34", gender: "female", percentage: 12.3 }
```

### Anti-Patterns to Avoid
- **Creating a new API endpoint for comparison data:** The existing `/api/dashboard/overview` already returns all brands with snapshots including demographicsJson. No new endpoint needed.
- **Fetching individual brand data:** Don't make separate API calls per brand. Use the already-fetched data from `useTrackedBrands`.
- **Hardcoding brand colors:** Use a consistent color scheme with CSS variables, matching the existing dashboard patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Butterfly chart axes/ticks | Custom axis rendering | Recharts XAxis/YAxis with tickFormatter | Handles edge cases, responsive sizing |
| Tooltip formatting | Custom hover tooltips | Recharts Tooltip with custom contentStyle | Consistent with TrendChart, handles positioning |
| Responsive chart sizing | Manual resize listeners | Recharts ResponsiveContainer | Already used in TrendChart, handles all edge cases |
| Brand data fetching | New API endpoint | useTrackedBrands hook | Already fetches all brands + snapshots in one call |
| Country code to name mapping | New mapping file | Existing COUNTRY_NAMES from country-chart.tsx | Already comprehensive mapping exists |

## Common Pitfalls

### Pitfall 1: Recharts Negative Values All-Negative Bug
**What goes wrong:** If ALL bars in a BarChart have negative values, they render incorrectly (known issue #1427).
**Why it happens:** Recharts domain calculation breaks when there are no positive values.
**How to avoid:** The butterfly chart always has both negative (Brand A) and positive (Brand B) values, so this bug won't trigger. But if one brand has no data, ensure the chart still has at least some positive values or show an appropriate empty state.
**Warning signs:** Bars appearing as thin lines instead of full bars.

### Pitfall 2: demographicsJson May Be Null
**What goes wrong:** Brands without snapshots or snapshots without demographic data will have null demographicsJson.
**Why it happens:** Not all brands have been analyzed, or the Facebook API didn't return demographics.
**How to avoid:** Check for null demographicsJson before rendering charts. Show informative message like "No demographic data available for [Brand Name]. Run an analysis first."
**Warning signs:** Runtime errors when accessing properties on null.

### Pitfall 3: BigInt Serialization in totalReach
**What goes wrong:** `totalReach` is stored as BigInt in Prisma but the overview API already handles serialization via the `serialize()` function.
**Why it happens:** BigInt cannot be JSON.stringify'd natively.
**How to avoid:** The existing API already converts BigInt to Number. No special handling needed on the client.
**Warning signs:** Not applicable (already handled).

### Pitfall 4: Missing Age Ranges in One Brand
**What goes wrong:** If Brand A has data for "18-24" but Brand B doesn't, the butterfly chart looks asymmetric with missing rows.
**Why it happens:** Different brands target different demographics.
**How to avoid:** Build a union of all age ranges from both brands, defaulting to 0 for missing entries. Use the AGE_ORDER constant already defined in age-gender-chart.tsx: `['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']`.
**Warning signs:** Uneven chart rows or missing bars.

### Pitfall 5: Country Data Varies Between Brands
**What goes wrong:** Brand A targets EU countries, Brand B targets US. Paired bars look sparse.
**Why it happens:** Different brands have completely different geographic targeting.
**How to avoid:** Merge the union of countries from both brands, take the top 8-10 by combined percentage, and show "Other" for the rest.
**Warning signs:** Too many bars with tiny values.

## Code Examples

### Extracting Butterfly Chart Data from Two Brands
```typescript
const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

function buildButterflyData(
  brandADemo: AggregatedDemographics | null,
  brandBDemo: AggregatedDemographics | null
) {
  const brandAByAge = new Map<string, { male: number; female: number }>();
  const brandBByAge = new Map<string, { male: number; female: number }>();

  // Group Brand A age-gender data
  (brandADemo?.ageGenderBreakdown ?? []).forEach(item => {
    const entry = brandAByAge.get(item.age) || { male: 0, female: 0 };
    if (item.gender === 'male') entry.male = item.percentage;
    if (item.gender === 'female') entry.female = item.percentage;
    brandAByAge.set(item.age, entry);
  });

  // Group Brand B age-gender data
  (brandBDemo?.ageGenderBreakdown ?? []).forEach(item => {
    const entry = brandBByAge.get(item.age) || { male: 0, female: 0 };
    if (item.gender === 'male') entry.male = item.percentage;
    if (item.gender === 'female') entry.female = item.percentage;
    brandBByAge.set(item.age, entry);
  });

  return AGE_ORDER.map(age => ({
    age,
    // Brand A: negative values (extends left)
    brandA_male: -(brandAByAge.get(age)?.male ?? 0),
    brandA_female: -(brandAByAge.get(age)?.female ?? 0),
    // Brand B: positive values (extends right)
    brandB_male: brandBByAge.get(age)?.male ?? 0,
    brandB_female: brandBByAge.get(age)?.female ?? 0,
  }));
}
```

### Brand Selector Component Pattern
```typescript
interface BrandSelectorProps {
  brands: TrackedBrand[];
  selectedAId: string | null;
  selectedBId: string | null;
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
}

// Two dropdowns, each filtering out the other's selection
// Brands must have at least one snapshot to be selectable
function BrandSelector({ brands, selectedAId, selectedBId, onSelectA, onSelectB }: BrandSelectorProps) {
  const eligibleBrands = brands.filter(b => b.snapshots.length > 0);
  const brandsForA = eligibleBrands.filter(b => b.id !== selectedBId);
  const brandsForB = eligibleBrands.filter(b => b.id !== selectedAId);
  // Render two <select> elements...
}
```

### Summary Metrics Table Data
```typescript
// Reuse the metric definitions from comparison-table.tsx
const comparisonMetrics = [
  { label: 'Active Ads', getValue: (s: TrackedBrandSnapshot) => s.activeAdsCount.toLocaleString() },
  { label: 'Total Reach', getValue: (s: TrackedBrandSnapshot) => formatReach(s.totalReach) },
  { label: 'Est. Spend', getValue: (s: TrackedBrandSnapshot) => `$${Math.round(s.estimatedSpendUsd).toLocaleString()}` },
  { label: 'Dominant Gender', getValue: (s: TrackedBrandSnapshot) => s.dominantGender ? `${s.dominantGender} (${Math.round(s.dominantGenderPct ?? 0)}%)` : 'N/A' },
  { label: 'Top Age Range', getValue: (s: TrackedBrandSnapshot) => s.dominantAgeRange ? `${s.dominantAgeRange} (${Math.round(s.dominantAgePct ?? 0)}%)` : 'N/A' },
  { label: 'Top Country', getValue: (s: TrackedBrandSnapshot) => s.topCountry1Code ? `${s.topCountry1Code} (${Math.round(s.topCountry1Pct ?? 0)}%)` : 'N/A' },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CSS bar charts | Recharts for complex charts | v3.0 dashboard | TrendChart uses Recharts; comparison charts should too |
| Stacked bars for demographics | Butterfly/mirrored bars | This phase | Better visual comparison of two brands |
| N-brand comparison table | 2-brand focused deep comparison | This phase | More detailed insight for head-to-head comparison |

## Open Questions

1. **Should the comparison page be accessible from the dashboard nav?**
   - What we know: The dashboard nav has links to Analyse, Dashboard, About, Contact, Feedback
   - What's unclear: Whether to add a "Compare" nav item or just link from dashboard cards
   - Recommendation: Add a "Compare" button on the dashboard page that links to `/dashboard/compare`. Can also add it as a nav sub-item. Keep it simple.

2. **How to handle brands with no demographicsJson but with snapshot scalar data?**
   - What we know: Brands may have `dominantGender`, `topCountry1Code` etc. without full `demographicsJson`
   - What's unclear: Whether this situation actually occurs in practice
   - Recommendation: Fall back to scalar fields for the metrics table, show "No detailed demographics" for charts

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `prisma/schema.prisma` - Data model for TrackedBrand, BrandSnapshot
- Codebase inspection: `src/lib/demographic-types.ts` - AggregatedDemographics interface
- Codebase inspection: `src/lib/snapshot-builder.ts` - How demographicsJson is populated
- Codebase inspection: `src/hooks/use-tracked-brands.ts` - Data fetching hook and types
- Codebase inspection: `src/components/dashboard/trend-chart.tsx` - Existing Recharts usage pattern
- Codebase inspection: `src/components/demographics/age-gender-chart.tsx` - Age-gender data shape
- Codebase inspection: `src/components/demographics/country-chart.tsx` - Country data + mappings
- Codebase inspection: `src/components/dashboard/demographics-comparison.tsx` - Existing comparison pattern
- Codebase inspection: `src/components/dashboard/comparison-table.tsx` - Existing metrics table
- Codebase inspection: `src/app/api/dashboard/overview/route.ts` - API data including demographics
- `package.json` - Recharts ^3.6.0 installed

### Secondary (MEDIUM confidence)
- [Recharts Bar API](https://recharts.github.io/en-US/api/Bar/) - Bar component props including layout="vertical"
- [Recharts Issue #1427](https://github.com/recharts/recharts/issues/1427) - Negative values rendering bug
- [Recharts Stacked Bar Example](https://recharts.github.io/en-US/examples/StackedBarChart/) - Stacking pattern
- [Shadcn Positive/Negative Bar Chart](https://www.shadcn.io/charts/bar-chart/bar-chart-10) - Positive/negative value pattern

### Tertiary (LOW confidence)
- Community pattern of using negative values for butterfly charts in Recharts (multiple sources agree but no official example)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in codebase
- Architecture: HIGH - Follows established patterns from existing dashboard components
- Data model: HIGH - Full codebase inspection of schema, types, and API
- Butterfly chart technique: MEDIUM - Common Recharts pattern (negative values) but no official example; known bug with all-negative values (won't affect us since we have both positive and negative)
- Pitfalls: HIGH - Based on codebase inspection and known Recharts issues

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (stable - all dependencies are existing)
