# Phase 15: Chart Improvements - Research

**Researched:** 2026-02-01
**Domain:** Recharts tooltips, responsive charts, click-to-filter interactivity
**Confidence:** HIGH

## Summary

Phase 15 enhances the existing chart components with three capabilities: rich tooltips, responsive sizing, and click-to-filter. The codebase currently has **two types of charts**:

1. **Custom HTML charts** (AgeGenderChart, CountryChart, SpendByCountryChart) -- hand-built with divs, CSS bars, and inline hover tooltips using `useState`. These already have basic hover tooltips from Phase 13.
2. **Recharts-based charts** (MediaTypeChart, TrendChart, TimeTrends) -- using Recharts v3.6.0 with `ResponsiveContainer`, default `Tooltip`, and standard Recharts components.

The custom HTML charts need proper tooltip components and responsive behavior. The Recharts charts need richer custom tooltips. All charts need click-to-filter capability, which requires a new filtering state mechanism in the parent page that charts can call into.

**Primary recommendation:** Use the existing `ChartTooltipContent` component from `src/components/ui/chart.tsx` as the base for Recharts tooltips, enhance custom charts with Radix-style positioned tooltips, and implement click-to-filter via callback props + URL search params or lifted state in page.tsx.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.6.0 | Chart visualization | Already used, v3 is current |
| react | 19.2.3 | UI framework | Already used |
| tailwind | 4.x | Styling | Already used |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui chart.tsx | n/a | ChartContainer, ChartTooltip, ChartTooltipContent | Wrap Recharts charts for consistent tooltip styling |

### No New Dependencies Required

All three requirements (CHRT-01, CHRT-02, CHRT-03) can be implemented with existing libraries. No new packages needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tooltip divs | @radix-ui/react-tooltip | Would add dependency; custom divs are simpler for chart-specific positioning |
| State-based click-to-filter | URL search params (nuqs) | URL params enable shareable filtered views but add complexity; state is sufficient for MVP |

## Architecture Patterns

### Current Chart Architecture
```
src/
  components/
    demographics/
      age-gender-chart.tsx      # Custom HTML bars, useState hover
      country-chart.tsx          # Custom HTML bars, useState hover
      demographics-summary.tsx   # Insight cards (circular progress)
      media-type-chart.tsx       # Recharts BarChart + ResponsiveContainer
    dashboard/
      trend-chart.tsx            # Recharts LineChart + ResponsiveContainer
    analytics/
      time-trends.tsx            # Recharts LineChart + ResponsiveContainer
    spend/
      spend-analysis.tsx         # Custom HTML bars (no hover yet)
    ui/
      chart.tsx                  # shadcn ChartContainer, ChartTooltip, ChartTooltipContent
    loading/
      chart-skeleton.tsx         # Loading skeleton for charts
```

### Pattern 1: Rich Custom Tooltip for Recharts Charts
**What:** Create a custom tooltip component passed to Recharts `<Tooltip content={...} />`
**When to use:** For MediaTypeChart, TrendChart, TimeTrends

```typescript
// Recharts v3 pattern: use render function for custom props
import { type TooltipProps } from 'recharts';
import { type NameType, type ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  // Additional custom props
}

function RichTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 text-sm shadow-md">
      <div className="font-medium text-[var(--text-primary)] mb-1">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--text-muted)]">{entry.name}:</span>
          <span className="font-medium text-[var(--text-primary)]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// In Recharts v3, pass custom props via render function
<Tooltip content={(props) => <RichTooltip {...props} extraData={myData} />} />
```

### Pattern 2: Click-to-Filter via Callback Props
**What:** Charts accept an `onSegmentClick` callback that triggers filtering in the parent
**When to use:** All charts that should support click-to-filter

```typescript
// Chart component accepts filter callback
interface AgeGenderChartProps {
  data: { age: string; gender: string; percentage: number }[];
  onSegmentClick?: (filter: { type: 'age' | 'gender'; value: string }) => void;
  activeFilter?: { type: string; value: string } | null;
}

// Parent page manages filter state
const [chartFilter, setChartFilter] = useState<{
  type: 'age' | 'gender' | 'country' | 'mediaType';
  value: string;
} | null>(null);

// Filter ads based on chart selection
const filteredAds = useMemo(() => {
  if (!chartFilter || !apiResult) return apiResult?.ads ?? [];
  switch (chartFilter.type) {
    case 'country':
      return apiResult.ads.filter(ad =>
        ad.demographicDistribution?.some(d => d.region === chartFilter.value)
      );
    case 'mediaType':
      return apiResult.ads.filter(ad => ad.mediaType === chartFilter.value);
    default:
      return apiResult.ads;
  }
}, [chartFilter, apiResult]);
```

### Pattern 3: Recharts Bar onClick Handler
**What:** Attach onClick to Bar/Cell components; payload includes original data
**When to use:** MediaTypeChart click-to-filter

```typescript
// Bar onClick receives data payload and index
<Bar
  dataKey="percentage"
  onClick={(data, index, event) => {
    // data.payload contains the original data item
    onSegmentClick?.({ type: 'mediaType', value: data.payload.name });
  }}
  cursor="pointer"
>
  {chartData.map((entry, index) => (
    <Cell
      key={`cell-${index}`}
      fill={entry.color}
      className={activeFilter?.value === entry.name ? 'opacity-100' : activeFilter ? 'opacity-40' : ''}
    />
  ))}
</Bar>
```

### Pattern 4: ResponsiveContainer with Parent Height
**What:** Always wrap Recharts charts in a parent div with explicit height
**When to use:** All Recharts charts

```typescript
// CORRECT: Parent has explicit height, ResponsiveContainer fills it
<div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData}>
      {/* ... */}
    </BarChart>
  </ResponsiveContainer>
</div>

// WRONG: No parent height -- causes "width(-1) and height(-1)" warning
<ResponsiveContainer>
  <BarChart data={chartData}>...</BarChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid
- **Making tooltips clickable:** Recharts tooltips disappear on mouseout, making links inside them unclickable (known issue #1640). Use onClick on chart elements instead.
- **Using `width="100%"` on ResponsiveContainer without height:** Causes infinite expansion bug. Always set explicit height on parent.
- **Animating during resize:** ResponsiveContainer + animations cause slow/janky resize. Use `isAnimationActive={false}` or debounce.
- **Using `trigger="click"` for tooltips when also using onClick on bars:** These conflict. Use hover tooltips + bar onClick separately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recharts tooltip styling | Raw HTML positioned tooltips | `ChartTooltipContent` from `ui/chart.tsx` | Already exists, handles dark theme, color dots |
| Responsive chart sizing | Manual ResizeObserver | Recharts `ResponsiveContainer` | Already handles debouncing, SSR |
| Chart color management | Inline hex colors everywhere | `ChartConfig` from `ui/chart.tsx` with CSS vars | Consistent theming, already set up |

## Common Pitfalls

### Pitfall 1: ResponsiveContainer React 19 Production Bug
**What goes wrong:** ComposedChart doesn't resize in production with React 19 because displayName evaluates to "Component" instead of "CategoricalChart", breaking the `isChart` check.
**Why it happens:** Minification strips component names in production builds.
**How to avoid:** Test in production builds. Use standard chart types (BarChart, LineChart) which are less affected. If hit, pin explicit width/height instead of relying on ResponsiveContainer.
**Warning signs:** Charts render fine in dev but have wrong size in production.

### Pitfall 2: ResponsiveContainer Width Warning in Recharts 3
**What goes wrong:** Console warning "The width(-1) and height(-1) of chart should be greater than 0" even though chart renders fine.
**Why it happens:** Parent container has no explicit dimensions when ResponsiveContainer initializes.
**How to avoid:** Always wrap in a parent div with explicit height (e.g., `h-[200px]`, `h-[300px]`).
**Warning signs:** Console warnings on page load.

### Pitfall 3: Click-to-Filter State Complexity
**What goes wrong:** Filter state becomes tangled with multiple chart types, hard to clear, hard to know what's active.
**Why it happens:** Each chart produces different filter shapes.
**How to avoid:** Use a single normalized filter type: `{ type: string; value: string; label: string }`. Display active filter as a badge/chip that can be cleared. Only allow one chart filter at a time.
**Warning signs:** Multiple filter states, unclear what's active.

### Pitfall 4: Custom HTML Charts Not Responsive
**What goes wrong:** AgeGenderChart and CountryChart overflow their containers on mobile.
**Why it happens:** Fixed widths (w-36 on country labels), no container queries.
**How to avoid:** Use relative widths, flex-shrink, and truncation. Test at 320px width.
**Warning signs:** Horizontal scroll on mobile.

### Pitfall 5: Tooltip Flicker on Chart Elements
**What goes wrong:** Tooltip appears/disappears rapidly when moving mouse between adjacent bars.
**Why it happens:** mouseLeave fires before mouseEnter on next element.
**How to avoid:** Use a small delay (50-100ms) before hiding tooltip, or use Recharts built-in Tooltip which handles this.
**Warning signs:** Tooltip flickering on hover between bars.

## Code Examples

### Rich Tooltip for MediaTypeChart
```typescript
function MediaTypeTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="font-medium text-[var(--text-primary)]">{data.name}</span>
      </div>
      <div className="text-sm text-[var(--text-secondary)]">
        {data.count} ads ({data.percentage.toFixed(1)}%)
      </div>
    </div>
  );
}
```

### Click-to-Filter Active State Indicator
```typescript
// Filter chip component
function ActiveChartFilter({
  filter,
  onClear,
}: {
  filter: { type: string; value: string; label: string };
  onClear: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 text-sm">
      <span className="text-[var(--text-secondary)]">Filtered by:</span>
      <span className="font-medium text-[var(--accent-green-light)]">{filter.label}</span>
      <button onClick={onClear} className="ml-1 hover:text-[var(--text-primary)]">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
```

### Clickable Country Bar
```typescript
// In CountryChart, add click handler and visual feedback
<div
  key={country.name}
  className={`group relative cursor-pointer transition-opacity duration-200 ${
    activeFilter && activeFilter.value !== country.originalName ? 'opacity-40' : ''
  }`}
  onClick={() => onSegmentClick?.({
    type: 'country',
    value: country.originalName,
    label: `${country.flag} ${country.name}`,
  })}
  onMouseEnter={() => setHoveredCountry(country.name)}
  onMouseLeave={() => setHoveredCountry(null)}
>
  {/* existing bar content */}
</div>
```

### ResponsiveContainer Fix Pattern
```typescript
// Before (warnings, potential sizing issues)
<div style={{ width: '100%', height: 150 }}>
  <ResponsiveContainer>
    <BarChart data={chartData} layout="vertical">

// After (explicit dimensions, no warnings)
<div className="w-full h-[150px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData} layout="vertical">
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts v2 `<Tooltip content={<Custom />}` with props | Recharts v3 render function `content={(props) => <Custom {...props} extra={x} />}` | Recharts 3.0 | Custom props must use render function pattern |
| `@types/recharts` separate package | Types bundled in recharts v3 | Recharts 3.0 | No separate types package needed |
| Default tooltip styling | `ChartTooltipContent` from shadcn/ui | shadcn/ui chart component | Consistent styling with design system |

## Open Questions

1. **What data fields are available on ads for click-to-filter?**
   - What we know: Ads have `demographicDistribution` with region data, `mediaType` field, and start dates
   - What's unclear: Whether filtering by age/gender is meaningful (demographics are aggregated, not per-ad)
   - Recommendation: Implement click-to-filter for country (filter ads by region) and media type (filter ads by video/image). Age/gender filtering may not map cleanly to individual ads -- could instead highlight the chart segment without filtering the ad list.

2. **Should custom HTML charts (AgeGenderChart, CountryChart) be migrated to Recharts?**
   - What we know: They already have rich hover behavior with Phase 13 enhancements
   - What's unclear: Whether maintaining two chart paradigms is sustainable
   - Recommendation: Keep as custom HTML charts for this phase. They're already polished and the custom hover behavior would be harder to replicate in Recharts. Migration can be deferred.

3. **Where should filter state live?**
   - What we know: page.tsx already manages `activeStatus`, `regionFilter`, `dateStart/dateEnd` filter states
   - What's unclear: Whether a new filter context is needed or page-level state is sufficient
   - Recommendation: Add chart filter state to page.tsx alongside existing filters. A single `chartFilter` state is simplest. Context only needed if charts are deeply nested.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/demographics/*.tsx`, `src/components/ui/chart.tsx`, `src/app/page.tsx`
- [Recharts Tooltip API](https://recharts.github.io/en-US/api/Tooltip/) - trigger prop, content prop, custom tooltip
- [Recharts Bar API](https://recharts.github.io/en-US/api/Bar/) - onClick handler, BarMouseEvent type
- package.json: recharts@3.6.0, react@19.2.3, next@16.1.2

### Secondary (MEDIUM confidence)
- [Recharts v3 custom props discussion](https://github.com/recharts/recharts/discussions/6055) - render function pattern for v3
- [Recharts ResponsiveContainer React 19 issue](https://github.com/recharts/recharts/issues/5173) - production minification bug
- [Recharts 3 width warning issue](https://github.com/recharts/recharts/issues/6716) - incorrect console warning

### Tertiary (LOW confidence)
- [Recharts clickable tooltip issue](https://github.com/recharts/recharts/issues/1640) - confirms tooltips not clickable (workaround: use bar onClick)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - already installed, versions confirmed from package.json
- Architecture: HIGH - patterns derived from existing codebase + official Recharts docs
- Pitfalls: MEDIUM - sourced from GitHub issues, not all verified in this specific project
- Click-to-filter: MEDIUM - pattern is standard React, but data shape for filtering needs validation during implementation

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable -- Recharts 3.x is mature, React 19 is stable)
