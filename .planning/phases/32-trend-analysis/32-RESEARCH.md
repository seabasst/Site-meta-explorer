# Phase 32: Trend Analysis - Research

**Researched:** 2026-02-06
**Domain:** Time-series visualization, Recharts, demographic data
**Confidence:** HIGH

## Summary

Phase 32 implements demographic trend charts for saved brands, allowing users to visualize how age, gender, and country distributions change over time across historical snapshots. This builds on the existing snapshot infrastructure where `BrandSnapshot.demographicsJson` stores full demographic breakdowns.

The research confirms that **zero new npm dependencies are needed**. Recharts 3.6.0 (already installed) handles time-series visualization with `type="number"` + `scale="time"` on XAxis. The primary technical challenges are (1) normalizing the `demographicsJson` schema across snapshots of different ages and (2) handling sparse/irregular snapshot timelines.

The recommended approach is to create a dedicated `DemographicTrendChart` component with three chart types (age, gender, country) switchable via tabs, reusing the existing chart styling patterns from `TrendChart` and `TrendAnalysis` components. Data flows through a new `GET /api/dashboard/trends?trackedBrandId=X` endpoint that returns normalized demographic series data.

**Primary recommendation:** Build a JSON normalizer utility first, then implement the trend API endpoint, then the chart component. Require minimum 3 snapshots before showing trend charts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.6.0 | Time-series charts | Already installed, used throughout codebase |
| React | 19.2.3 | Component framework | Project standard |
| TypeScript | ^5 | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | - | Date formatting | NOT NEEDED - use native Intl.DateTimeFormat |
| d3-scale | - | Custom tick generation | NOT NEEDED - Recharts 3.x handles time ticks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts LineChart | AreaChart with stackOffset="expand" | AreaChart better for composition visualization, LineChart better for absolute values |
| Custom CSS bars | Recharts | Recharts provides tooltips, legends, responsive behavior out of box |
| Manual tick generation | Recharts auto-ticks | Recharts 3.x improved time-scale ticks; manual only if issues arise |

**Installation:**
```bash
# No new installations needed - all libraries already present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── demographics-normalizer.ts  # NEW: Normalize demographicsJson across versions
├── app/api/dashboard/
│   └── trends/
│       └── route.ts                # NEW: Trend data endpoint
└── components/dashboard/
    └── demographic-trend-chart.tsx # NEW: Multi-tab trend visualization
```

### Pattern 1: JSON Schema Normalizer
**What:** A utility function that takes any `demographicsJson` blob and returns a consistent shape
**When to use:** Before processing any snapshot's demographic data for trends
**Example:**
```typescript
// Source: Existing pattern from demographic-aggregator.ts
interface NormalizedDemographics {
  schemaVersion: 1;
  ageBreakdown: { age: string; percentage: number }[];
  genderBreakdown: { gender: string; percentage: number }[];
  regionBreakdown: { region: string; percentage: number }[];
}

export function normalizeDemographicsJson(raw: unknown): NormalizedDemographics | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  // Handle both array and object formats
  const ageBreakdown = Array.isArray(obj.ageBreakdown)
    ? obj.ageBreakdown
    : convertObjectToArray(obj.age, 'age');

  const genderBreakdown = Array.isArray(obj.genderBreakdown)
    ? obj.genderBreakdown
    : convertObjectToArray(obj.gender, 'gender');

  const regionBreakdown = Array.isArray(obj.regionBreakdown)
    ? obj.regionBreakdown
    : convertObjectToArray(obj.country || obj.region, 'region');

  return {
    schemaVersion: 1,
    ageBreakdown: ageBreakdown ?? [],
    genderBreakdown: genderBreakdown ?? [],
    regionBreakdown: regionBreakdown ?? [],
  };
}
```

### Pattern 2: Time-Series XAxis Configuration
**What:** Proper Recharts configuration for sparse, irregular timestamps
**When to use:** All trend charts with snapshot dates
**Example:**
```typescript
// Source: Recharts official docs + v3.1 research PITFALLS.md
<XAxis
  dataKey="timestamp"
  type="number"
  scale="time"
  domain={['dataMin', 'dataMax']}
  tickFormatter={(ts: number) =>
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short'
    }).format(new Date(ts))
  }
  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
/>
```

### Pattern 3: Multi-Series Line Chart for Age Distribution
**What:** Multiple Line components sharing the same chart, one per age bracket
**When to use:** Age distribution trend
**Example:**
```typescript
// Source: Existing TrendAnalysis.tsx pattern
const AGE_COLORS = {
  '13-17': '#94a3b8',
  '18-24': '#a3e635',
  '25-34': '#22c55e',
  '35-44': '#14b8a6',
  '45-54': '#06b6d4',
  '55-64': '#8b5cf6',
  '65+': '#f59e0b',
};

{Object.entries(AGE_COLORS).map(([age, color]) => (
  <Line
    key={age}
    dataKey={age}
    name={age}
    type="monotone"
    stroke={color}
    strokeWidth={2}
    dot={{ r: 3 }}
    activeDot={{ r: 5 }}
  />
))}
```

### Anti-Patterns to Avoid
- **Categorical XAxis for time data:** Evenly spaces snapshots regardless of actual time gaps. Use `type="number"` + `scale="time"` instead.
- **Passing Date objects to Recharts:** Causes `[object Object]` rendering. Use Unix epoch milliseconds.
- **Reading demographicsJson without normalization:** Different snapshots may have different shapes. Always normalize first.
- **Showing trend chart with <3 snapshots:** Single dot or two-point line is meaningless. Show "Re-analyze to see trends" message.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time axis formatting | Custom tick calculation | `Intl.DateTimeFormat` + Recharts `tickFormatter` | Browser-native, locale-aware |
| Chart tooltips | Custom hover state | Recharts `<Tooltip>` component | Handles positioning, visibility, mobile |
| Responsive charts | CSS width hacks | `<ResponsiveContainer>` | Already used throughout codebase |
| Date parsing | Manual string splitting | `new Date().getTime()` | `snapshotDate` is already ISO format |

**Key insight:** The existing codebase already has two trend chart implementations (`TrendChart` in dashboard, `TrendAnalysis` in analytics). Reuse their patterns for tooltips, colors, and responsive containers.

## Common Pitfalls

### Pitfall 1: demographicsJson Schema Drift
**What goes wrong:** Old snapshots have `{ age: {...}, gender: {...}, country: {...} }` object format while new ones have `{ ageBreakdown: [...], genderBreakdown: [...], regionBreakdown: [...] }` array format.
**Why it happens:** The `demographicsJson` field stores the raw output of `aggregateDemographics()` which evolved over time.
**How to avoid:** Always pass through `normalizeDemographicsJson()` before trend processing.
**Warning signs:** Trend chart shows `null` or `0` for older data points; type errors when comparing snapshots.

### Pitfall 2: Sparse Snapshot Timeline
**What goes wrong:** Snapshots at Day 1, Day 3, Day 45, Day 46 render as evenly-spaced points (categorical) or as a flat line with compressed clusters (time scale without proper handling).
**Why it happens:** Users re-analyze brands at irregular intervals.
**How to avoid:**
1. Use `type="number"` + `scale="time"` + Unix epoch timestamps
2. Show visible dots at each data point (not just lines)
3. Require minimum 3 snapshots before showing chart
4. Format tick labels with `Intl.DateTimeFormat`
**Warning signs:** Chart axis shows no ticks; points cluster at edges with long flat line.

### Pitfall 3: Empty State Not Handled
**What goes wrong:** Component renders with 0-2 snapshots showing a useless single dot or two-point line.
**Why it happens:** Developer tests only happy path with 5+ snapshots.
**How to avoid:** Check snapshot count before rendering chart; show informative empty state with CTA to re-analyze.
**Warning signs:** User sees blank chart or single dot; no guidance on how to get more data.

### Pitfall 4: Y-Axis Not Starting at Zero
**What goes wrong:** A shift from 24% to 26% looks dramatic when Y-axis ranges from 24-26, but is actually noise.
**Why it happens:** Recharts auto-scales Y-axis to fit data by default.
**How to avoid:** Set `domain={[0, 100]}` on YAxis for percentage data; use `tickFormatter` to show `%` suffix.
**Warning signs:** Small percentage changes appear as massive visual shifts.

## Code Examples

Verified patterns from the existing codebase:

### Trend Data Point Interface
```typescript
// Source: Derived from TrendSnapshot in use-tracked-brands.ts
interface DemographicTrendPoint {
  timestamp: number;           // Unix epoch ms for XAxis
  date: string;                // Formatted date for display
  snapshotId: string;          // For linking back to full snapshot
  // Age breakdown
  '13-17': number;
  '18-24': number;
  '25-34': number;
  '35-44': number;
  '45-54': number;
  '55-64': number;
  '65+': number;
}

interface GenderTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  male: number;
  female: number;
  unknown: number;
}

interface CountryTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  [countryCode: string]: number | string;  // Dynamic country keys
}
```

### API Endpoint Pattern
```typescript
// Source: Pattern from /api/dashboard/snapshots/route.ts
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trackedBrandId = searchParams.get('trackedBrandId');
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  // Fetch snapshots with demographics
  const snapshots = await prisma.brandSnapshot.findMany({
    where: {
      trackedBrandId,
      trackedBrand: {
        OR: [
          { ownerId: session.user.id },
          { trackerId: session.user.id },
        ],
      },
    },
    orderBy: { snapshotDate: 'asc' },  // Oldest first for chart
    take: limit,
    select: {
      id: true,
      snapshotDate: true,
      demographicsJson: true,
    },
  });

  // Transform to trend data
  const ageTrend = snapshots.map(s => {
    const demo = normalizeDemographicsJson(s.demographicsJson);
    return {
      timestamp: new Date(s.snapshotDate).getTime(),
      date: formatDate(s.snapshotDate),
      snapshotId: s.id,
      ...buildAgeDataFromBreakdown(demo?.ageBreakdown ?? []),
    };
  });

  return NextResponse.json({ ageTrend, genderTrend, countryTrend });
}
```

### Chart Component Pattern
```typescript
// Source: Adapted from TrendChart.tsx and TrendAnalysis.tsx
export function DemographicTrendChart({
  snapshots
}: {
  snapshots: TrackedBrandSnapshot[]
}) {
  const [activeTab, setActiveTab] = useState<'age' | 'gender' | 'country'>('age');

  if (snapshots.length < 3) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-[var(--text-muted)] text-sm mb-2">
          Need at least 3 snapshots to show trends
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Re-analyze this brand over time to track demographic changes
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      {/* Tab selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Demographic Trends
        </h3>
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
          {(['age', 'gender', 'country'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                activeTab === tab
                  ? 'bg-[var(--accent-green)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'age' && <AgeTrendLineChart data={ageTrendData} />}
          {activeTab === 'gender' && <GenderTrendLineChart data={genderTrendData} />}
          {activeTab === 'country' && <CountryTrendLineChart data={countryTrendData} />}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Categorical XAxis | `type="number"` + `scale="time"` | Recharts 2.x | Proper time-proportional spacing |
| Manual tick generation with d3-scale | Recharts auto-ticks | Recharts 3.0 | Less boilerplate needed |
| Date objects to Recharts | Unix epoch milliseconds | Always | Prevents `[object Object]` rendering |
| Y-axis auto domain | `domain={[0, 100]}` for percentages | Best practice | Prevents misleading visualizations |

**Deprecated/outdated:**
- Using `scale="time"` with Date objects (use numbers)
- Using `Customized` component for arbitrary elements (Recharts 3.x allows this natively)
- Relying on Recharts `range` prop (ignored since 3.0)

## Open Questions

Things that couldn't be fully resolved:

1. **Country trend top-N selection**
   - What we know: Each snapshot may have different countries in top positions
   - What's unclear: Should we show union of all top-5 across all snapshots, or track a fixed set?
   - Recommendation: Use union approach - collect all countries that appear in top-5 of any snapshot, show all with 0% for snapshots where they don't appear

2. **Snapshot date granularity**
   - What we know: Snapshots have `snapshotDate` with full timestamp
   - What's unclear: If user re-analyzes twice on same day, should they appear as separate points?
   - Recommendation: Yes, show both - timestamps are precise enough; user intent is to track each analysis

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/snapshot-builder.ts`, `src/lib/demographic-aggregator.ts`
- Codebase analysis: `src/components/dashboard/trend-chart.tsx`, `src/components/analytics/trend-analysis.tsx`
- Codebase analysis: `src/app/api/dashboard/snapshots/route.ts`
- [Recharts XAxis API](https://recharts.github.io/en-US/api/XAxis/) - type, scale, domain configuration
- [Recharts API Overview](https://recharts.github.io/en-US/api/) - AreaChart stackOffset options
- `.planning/research/PITFALLS.md` - Pitfalls #2 (sparse time-series) and #3 (schema drift)

### Secondary (MEDIUM confidence)
- [shadcn/ui Stacked Area Chart Example](https://www.shadcn.io/patterns/chart-area-stacked-expand) - stackOffset="expand" pattern

### Tertiary (LOW confidence)
- General Recharts GitHub issues for edge case handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all patterns verified in existing codebase
- Architecture: HIGH - Follows established patterns from existing trend components
- Pitfalls: HIGH - Documented in v3.1 research and verified against codebase

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain)
