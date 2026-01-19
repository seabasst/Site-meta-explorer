# Phase 4: Display - Research

**Researched:** 2026-01-19
**Domain:** React UI Components, Data Visualization, Charting Libraries
**Confidence:** HIGH

## Summary

Phase 4 displays aggregated demographic data from the scraper API. The existing codebase uses Next.js 15 with React 19, Tailwind CSS v4, and a custom design system with CSS variables. There is no existing charting library installed.

Research identified **Recharts** as the standard choice for React charting due to its React-native component model, ease of use, and current React 19 compatibility. The app already has established patterns for loading states, form inputs, and glass-effect card layouts that should be extended for the demographics display.

**Primary recommendation:** Use Recharts for charts (BarChart for age/gender, PieChart for countries), extend existing loading spinner pattern for progress, and add a simple number input for ad count configuration.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^2.12+ | Chart rendering (bar, pie) | React-native approach, SVG-based, simple API, React 19 compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (built-in) | N/A | ResponsiveContainer | Always - makes charts responsive |
| (built-in) | N/A | Tooltip, Legend | When interactivity needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js (react-chartjs-2) | Canvas-based, harder to customize individual elements |
| Recharts | Nivo | More beautiful out of box, but larger bundle, steeper learning curve |
| Recharts | Visx | More control, but much more complex setup |

**Installation:**
```bash
npm install recharts
```

**Note on React 19 compatibility:** Recharts v2.12+ works with React 19. If peer dependency warnings appear, use npm overrides in package.json:
```json
{
  "overrides": {
    "react-is": "^19.0.0"
  }
}
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── demographics/           # NEW - Demographics display components
│   │   ├── demographics-panel.tsx    # Container for all demographics UI
│   │   ├── demographics-summary.tsx  # Text summary (e.g., "55% female")
│   │   ├── age-gender-chart.tsx      # BarChart for age/gender breakdown
│   │   ├── country-chart.tsx         # PieChart for country distribution
│   │   └── scrape-config.tsx         # Configuration inputs (ad count)
│   └── results-table.tsx       # EXISTING - Sitemap results
├── app/
│   └── page.tsx               # EXISTING - Main page, will add demographics
└── lib/
    └── demographic-types.ts   # EXISTING - Type definitions
```

### Pattern 1: Chart Data Transformation
**What:** Transform Map-based aggregated data to Recharts array format
**When to use:** Before passing data to any Recharts component
**Example:**
```typescript
// Source: Recharts API documentation
// AggregatedDemographics uses { age: string; percentage: number }[] format
// This already matches Recharts expectations!

// For BarChart (age breakdown):
const ageData = aggregatedDemographics.ageBreakdown;
// Result: [{ age: "18-24", percentage: 15.5 }, { age: "25-34", percentage: 32.1 }, ...]

// For PieChart (country breakdown):
const countryData = aggregatedDemographics.regionBreakdown.map(item => ({
  name: item.region,  // Recharts expects 'name' for labels
  value: item.percentage
}));
```

### Pattern 2: Responsive Chart Container
**What:** Wrap charts in container with explicit height for responsive sizing
**When to use:** Always - Recharts requires parent with defined dimensions
**Example:**
```typescript
// Source: https://recharts.github.io/en-US/api/ResponsiveContainer/
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

function AgeChart({ data }: { data: { age: string; percentage: number }[] }) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="age" />
          <YAxis domain={[0, 100]} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Bar dataKey="percentage" fill="var(--accent-green)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Pattern 3: Existing Loading State Extension
**What:** Reuse existing LoadingSpinner with progress text
**When to use:** During demographic scraping which takes time
**Example:**
```typescript
// Existing pattern from page.tsx - extend with progress info
function DemographicsLoading({ progress }: { progress: { current: number; total: number } }) {
  return (
    <div className="text-center py-8">
      <LoadingSpinner size="lg" />
      <p className="text-[var(--text-primary)] font-medium mt-4">
        Analyzing demographics...
      </p>
      <p className="text-sm text-[var(--text-muted)] mt-1">
        {progress.current} of {progress.total} ads processed
      </p>
    </div>
  );
}
```

### Pattern 4: Glass Card Wrapper (Existing Design System)
**What:** Use existing glass effect styling for chart containers
**When to use:** All demographics UI sections
**Example:**
```typescript
// Existing pattern from globals.css and page.tsx
<div className="glass rounded-2xl p-6">
  <h2 className="font-serif text-xl text-[var(--text-primary)] mb-4">
    Audience <span className="italic text-[var(--accent-green-light)]">Demographics</span>
  </h2>
  {/* Chart content */}
</div>
```

### Anti-Patterns to Avoid
- **Fixed pixel dimensions on charts:** Use ResponsiveContainer - charts must resize with viewport
- **Forgetting parent height:** ResponsiveContainer needs parent with explicit height
- **Transforming data in render:** Move data transformation outside component or useMemo
- **Custom tooltip/legend from scratch:** Use Recharts built-in components, customize via props

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar charts | Custom SVG bars | Recharts BarChart | Handles axes, tooltips, responsiveness, animations |
| Pie charts | Custom SVG arcs | Recharts PieChart | Arc calculations, labels, hover states |
| Chart responsiveness | resize listeners | ResponsiveContainer | Handles debouncing, container queries |
| Tooltip positioning | Manual position calc | Recharts Tooltip | Handles viewport edges, follow cursor |
| Percentage formatting | `${n}%` everywhere | Tooltip formatter prop | Consistent formatting, localization ready |

**Key insight:** Recharts handles all the edge cases in chart rendering (axis tick formatting, responsive resizing, touch interactions, accessibility) that take weeks to build correctly.

## Common Pitfalls

### Pitfall 1: ResponsiveContainer Height Issues
**What goes wrong:** Chart doesn't render or has zero height
**Why it happens:** ResponsiveContainer with percentage height needs parent with explicit height
**How to avoid:** Always wrap ResponsiveContainer in div with explicit height (px or vh)
**Warning signs:** Chart area appears but is empty/collapsed

### Pitfall 2: Data Format Mismatch
**What goes wrong:** Charts render but show no data or wrong data
**Why it happens:** Recharts expects specific data structure with dataKey matching object properties
**How to avoid:** Verify data structure matches dataKey props exactly
**Warning signs:** Console warnings about undefined values

### Pitfall 3: CSS Variable Colors in Charts
**What goes wrong:** Colors not applied or fall back to black
**Why it happens:** Recharts SVG fills may not resolve CSS variables in all contexts
**How to avoid:** Use direct hex values or getComputedStyle() for dynamic theming
**Warning signs:** Charts render with unexpected colors

### Pitfall 4: Progress State During Long Operations
**What goes wrong:** UI appears frozen during demographic scraping
**Why it happens:** Server action completes in single response, no streaming updates
**How to avoid:** For Phase 4, use determinate progress (X of Y) based on maxDemographicAds config
**Warning signs:** User abandons before operation completes

### Pitfall 5: Peer Dependency Warnings
**What goes wrong:** npm install warns about react-is peer dependency
**Why it happens:** Recharts internal dependencies may request older React versions
**How to avoid:** Add npm overrides in package.json if warnings appear
**Warning signs:** Peer dependency warnings during install

## Code Examples

### Text Summary Component
```typescript
// Source: Existing codebase patterns + AggregatedDemographics type
interface DemographicsSummaryProps {
  demographics: AggregatedDemographics;
}

export function DemographicsSummary({ demographics }: DemographicsSummaryProps) {
  // Find dominant gender
  const dominantGender = demographics.genderBreakdown
    .reduce((max, curr) => curr.percentage > max.percentage ? curr : max);

  // Find dominant age range (combine 25-34 and 35-44 as "25-44" if both significant)
  const youngAdults = demographics.ageBreakdown
    .filter(a => a.age === '25-34' || a.age === '35-44')
    .reduce((sum, a) => sum + a.percentage, 0);

  return (
    <div className="space-y-2">
      <p className="text-lg text-[var(--text-primary)]">
        <span className="font-bold">{Math.round(dominantGender.percentage)}%</span>
        {' '}{dominantGender.gender}
      </p>
      <p className="text-lg text-[var(--text-primary)]">
        <span className="font-bold">{Math.round(youngAdults)}%</span>
        {' '}ages 25-44
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        Based on {demographics.adsWithDemographics} ads analyzed
      </p>
    </div>
  );
}
```

### Bar Chart for Age/Gender Breakdown
```typescript
// Source: Recharts documentation + existing design system
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface AgeGenderChartProps {
  data: { age: string; gender: string; percentage: number }[];
}

export function AgeGenderChart({ data }: AgeGenderChartProps) {
  // Transform to grouped format for stacked bar chart
  const groupedData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.age === item.age);
    if (existing) {
      existing[item.gender] = item.percentage;
    } else {
      acc.push({ age: item.age, [item.gender]: item.percentage });
    }
    return acc;
  }, [] as Record<string, number | string>[]);

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={groupedData}>
          <XAxis dataKey="age" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 'auto']} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Legend />
          <Bar dataKey="female" fill="#ec4899" name="Female" stackId="stack" />
          <Bar dataKey="male" fill="#3b82f6" name="Male" stackId="stack" />
          <Bar dataKey="unknown" fill="#6b7280" name="Unknown" stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Pie Chart for Country Distribution
```typescript
// Source: Recharts documentation
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#1a3933', '#2d5a4f', '#3d7a6f', '#4d9a8f', '#5dbaa0', '#6ddab0'];

interface CountryChartProps {
  data: { region: string; percentage: number }[];
}

export function CountryChart({ data }: CountryChartProps) {
  // Take top 5 countries, group rest as "Other"
  const topCountries = data.slice(0, 5);
  const otherPercentage = data.slice(5).reduce((sum, c) => sum + c.percentage, 0);

  const chartData = [
    ...topCountries.map(c => ({ name: c.region, value: c.percentage })),
    ...(otherPercentage > 0 ? [{ name: 'Other', value: otherPercentage }] : [])
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Configuration Input (Number of Ads)
```typescript
// Source: Existing codebase input patterns
interface ScrapeConfigProps {
  maxAds: number;
  onMaxAdsChange: (value: number) => void;
  disabled?: boolean;
}

export function ScrapeConfig({ maxAds, onMaxAdsChange, disabled }: ScrapeConfigProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-[var(--text-secondary)]">
        Ads to analyze:
      </label>
      <input
        type="number"
        min={1}
        max={50}
        value={maxAds}
        onChange={(e) => onMaxAdsChange(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
        disabled={disabled}
        className="input-field w-20 text-center"
      />
      <span className="text-xs text-[var(--text-muted)]">
        (1-50, more = slower but more accurate)
      </span>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js with wrapper | Recharts native | 2020+ | Better React integration, SVG accessibility |
| Manual responsive logic | ResponsiveContainer | Recharts v2.x | No resize listeners needed |
| Server returns all data | Stream progress updates | Next.js 15 | Better UX for long operations |

**Deprecated/outdated:**
- Victory (React charting): Still works but less active development
- react-vis (Uber): Deprecated, use Recharts or Visx instead
- Direct D3 manipulation: Prefer React-wrapped libraries for component lifecycle

## Open Questions

1. **Progress Streaming**
   - What we know: Next.js 15 supports streaming but server actions return complete response
   - What's unclear: Best pattern for showing incremental progress during demographic scraping
   - Recommendation: For Phase 4, use estimated progress (X of maxAds) shown before scrape completes, then actual results. True streaming would require API route refactor.

2. **Chart Theming**
   - What we know: App uses CSS variables for colors
   - What's unclear: Whether Recharts SVG fills properly resolve CSS variables
   - Recommendation: Test with CSS variables first, fall back to direct hex values if needed

## Sources

### Primary (HIGH confidence)
- Recharts official documentation (recharts.github.io) - API reference for PieChart, BarChart, ResponsiveContainer
- Existing codebase analysis - page.tsx, globals.css, demographic-types.ts patterns

### Secondary (MEDIUM confidence)
- [LogRocket Blog - Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) - Library comparison
- [GeeksforGeeks Recharts tutorials](https://www.geeksforgeeks.org/reactjs/create-a-bar-chart-using-recharts-in-reactjs/) - Code examples
- [GitHub Recharts Issues #4558](https://github.com/recharts/recharts/issues/4558) - React 19 compatibility discussion

### Tertiary (LOW confidence)
- WebSearch results for streaming progress patterns - needs validation with actual implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Recharts is well-established, React 19 support verified via GitHub issues
- Architecture: HIGH - Based on existing codebase patterns, direct observation
- Pitfalls: MEDIUM - Based on documentation and community discussions, not personal experience

**Research date:** 2026-01-19
**Valid until:** 2026-03-19 (60 days - Recharts is stable library)
