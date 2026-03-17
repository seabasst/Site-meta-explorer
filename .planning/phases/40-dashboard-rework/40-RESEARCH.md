# Phase 40: Dashboard Rework - Research

**Researched:** 2026-03-17
**Domain:** Analytics dashboard UI, charting, configurable views
**Confidence:** HIGH

## Summary

The dashboard rework transforms the current `/dashboard/v2/page.tsx` from a "top ads + brand table" view into a configurable analytics overview of the full ad database. The existing codebase already has all the building blocks: Recharts 3.6.0 for charting, a comprehensive stats API (`/api/ad-library/stats`) with aggregation endpoints, and established UI patterns (V2Shell, V2Card, dark mode support via `useV2()`).

The current dashboard page fetches top ads and displays them as cards -- essentially duplicating the Ad Library browse experience. The rework replaces this with metric cards (KPIs), charts (time series, format distribution, platform breakdown), and a filterable analytics view. The stats API already provides most of the data needed (totalAds, activeAds, adsByFormat, adsByPlatform, totalReach, avgReachPerAd, adsByDate, topBrandsByAdCount).

For saving/loading dashboard configurations (DASH-03), localStorage is the right approach since v2 has no auth requirement for browsing. The existing `useFavorites` hook in `src/hooks/use-favorites.ts` provides a proven localStorage pattern to follow.

**Primary recommendation:** Replace the current dashboard page content with analytics widgets (KPI cards, Recharts charts, filterable tables), reuse the existing stats API (with some extensions), and use localStorage for configuration persistence.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.6.0 | Charts (line, bar, pie, area) | Already installed, used in 11+ components |
| lucide-react | 0.563.0 | Icons for metric cards | Already used throughout the app |
| Prisma | 7.4.2 | Database queries for aggregations | Already the ORM in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All dependencies are already present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Tremor | Tremor has nice prebuilt dashboard components, but Recharts is already installed and used in 11+ files -- switching adds risk |
| localStorage configs | DB-backed configs | DB requires auth; v2 dashboard is open-access. localStorage is simpler and sufficient |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/dashboard/v2/
  page.tsx                        # Reworked dashboard (analytics overview)
src/app/api/ad-library/stats/
  route.ts                        # Existing stats API (extend as needed)
src/app/api/dashboard/analytics/
  route.ts                        # NEW: dedicated analytics endpoint for dashboard-specific aggregations
src/components/dashboard/
  kpi-card.tsx                    # Reusable KPI metric card
  format-distribution-chart.tsx   # Pie/donut chart for ad formats
  ads-timeline-chart.tsx          # Area/line chart for ads over time
  top-brands-table.tsx            # Sortable brands table
  platform-breakdown-chart.tsx    # Bar chart for platform distribution
src/hooks/
  use-dashboard-config.ts         # localStorage hook for saved configurations
```

### Pattern 1: KPI Metric Cards
**What:** Top-level summary cards showing key database metrics
**When to use:** Dashboard header, always visible
**Example:**
```typescript
// Reuse V2Card pattern from v2-shell.tsx
interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string }; // e.g., +12% vs last week
}

function KpiCard({ label, value, icon: Icon, trend }: KpiCardProps) {
  const { darkMode } = useV2();
  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs uppercase font-bold tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        <Icon className="w-5 h-5 text-[#1235e2]" />
      </div>
      <p className="text-3xl font-black">{formatNumber(value)}</p>
      {trend && (
        <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </p>
      )}
    </V2Card>
  );
}
```

### Pattern 2: Recharts with Dark Mode
**What:** Charts that respect the app's dark/light mode
**When to use:** All chart components
**Example:**
```typescript
// Existing pattern from share-of-voice/page.tsx
const BRAND_COLORS = ['#1235e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Dark mode aware chart
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={timelineData}>
    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
    <XAxis dataKey="date" stroke={darkMode ? '#64748b' : '#94a3b8'} fontSize={12} />
    <YAxis stroke={darkMode ? '#64748b' : '#94a3b8'} fontSize={12} />
    <Tooltip
      contentStyle={{
        backgroundColor: darkMode ? '#1e293b' : '#fff',
        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
        borderRadius: '8px',
        color: darkMode ? '#e2e8f0' : '#1e293b',
      }}
    />
    <Area type="monotone" dataKey="count" stroke="#1235e2" fill="#1235e2" fillOpacity={0.1} />
  </AreaChart>
</ResponsiveContainer>
```

### Pattern 3: Dashboard Configuration via localStorage
**What:** Save/load which widgets are visible, filter presets, layout preferences
**When to use:** DASH-03 requirement
**Example:**
```typescript
// Follow the useFavorites pattern from src/hooks/use-favorites.ts
interface DashboardConfig {
  id: string;
  name: string;
  filters: {
    category?: string;
    displayFormats?: string[];
    isActive?: boolean;
    dateRange?: { from: string; to: string };
  };
  widgets: string[]; // which widget IDs are visible
  createdAt: string;
}

const STORAGE_KEY = 'dashboard-v2-configs';

function useDashboardConfig() {
  const [configs, setConfigs] = useState<DashboardConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  // ... same localStorage pattern as useFavorites
}
```

### Pattern 4: Filter Bar with URL Sync
**What:** Dashboard filters that sync with URL search params for shareability
**When to use:** The filter bar at the top of the dashboard
**Example:**
```typescript
// Use Next.js useSearchParams + useRouter for filter state
import { useSearchParams, useRouter } from 'next/navigation';

function DashboardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`);
  };
  // ...
}
```

### Anti-Patterns to Avoid
- **Don't show individual ad cards on Dashboard:** That is what the Ad Library page is for. Dashboard should show aggregated analytics.
- **Don't make heavy API calls without caching:** The stats API already has a 60-second in-memory cache; maintain this pattern.
- **Don't fetch all data in one giant call:** The current page fetches stats and ads in parallel with `Promise.all`; keep this pattern. Use the `fast=true` mode for initial load, then lazy-load heavy data.
- **Don't build a drag-and-drop layout system:** DASH-03 says "save and load configurations" -- this means filter presets and widget visibility toggles, not a full grid layout builder.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/canvas charts | Recharts 3.6.0 (already installed) | Responsive, accessible, dark-mode friendly |
| Number formatting | Custom formatters | `formatNumber()` from v2-shell.tsx | Already handles K/M/B formatting |
| UI cards/containers | Custom containers | `V2Card`, `V2SectionTitle` from v2-shell.tsx | Consistent with existing dark/light mode |
| Date formatting | Manual date strings | `Intl.DateTimeFormat` or date-fns (not installed, use Intl) | Edge cases with timezones |
| Skeleton loading | Custom shimmer | `V2Skeleton` from v2-shell.tsx | Already exists |

**Key insight:** The existing codebase has rich reusable components (V2Card, V2Shell, V2Skeleton, formatNumber). The dashboard rework is primarily a content replacement, not an infrastructure build.

## Common Pitfalls

### Pitfall 1: BigInt Serialization in JSON
**What goes wrong:** Prisma returns BigInt for `totalReach` fields; `JSON.stringify()` throws on BigInt.
**Why it happens:** PostgreSQL `BigInt` columns map to JavaScript `BigInt` which is not JSON-serializable.
**How to avoid:** The stats API already has `serializeBigInt()` helper. Any new API endpoint must use the same pattern.
**Warning signs:** Runtime error "Do not know how to serialize a BigInt" in console.

### Pitfall 2: Stats API Performance in Full Mode
**What goes wrong:** The stats API without `?fast=true` runs heavy queries (platform breakdown iterates 10K rows, reach aggregation, job stats).
**Why it happens:** Multiple `groupBy` and `aggregate` queries to Neon PostgreSQL.
**How to avoid:** Use `fast=true` for initial dashboard render, then progressively load detailed stats. Consider adding a new dedicated analytics endpoint that returns only what the dashboard needs.
**Warning signs:** Dashboard takes >2s to load.

### Pitfall 3: Hydration Mismatch with localStorage
**What goes wrong:** Server renders default config, client reads different config from localStorage -- React hydration mismatch.
**Why it happens:** localStorage is client-only; SSR has no access.
**How to avoid:** Use `'use client'` directive (already the pattern). Initialize state with defaults, then load from localStorage in `useEffect`. Show skeleton during initial load.
**Warning signs:** Console warning about hydration mismatch.

### Pitfall 4: Chart Responsiveness
**What goes wrong:** Charts overflow or don't resize on window change.
**Why it happens:** Not wrapping charts in `<ResponsiveContainer>`.
**How to avoid:** Always use `<ResponsiveContainer width="100%" height={N}>` as the outermost Recharts wrapper. This is already the pattern in all 11+ existing chart components.
**Warning signs:** Charts render at 0 width or overflow container.

### Pitfall 5: Stale Filters After Navigation
**What goes wrong:** User applies filters, navigates away, comes back -- filters reset.
**Why it happens:** Component state lost on unmount.
**How to avoid:** Sync filters to URL search params (Pattern 4 above). URL persists across navigation.
**Warning signs:** Filters reset when user clicks sidebar and comes back.

## Code Examples

### Existing Stats API Response Shape (already available)
```typescript
// GET /api/ad-library/stats (or ?fast=true for quick load)
{
  totalBrands: number,
  brandsByStatus: { status: string, count: number }[],
  totalAds: number,
  activeAds: number,
  inactiveAds: number,
  adsByFormat: { format: string, count: number }[],      // pie chart data
  adsByPlatform: { platform: string, count: number }[],   // bar chart data (slow)
  totalReach: string,           // BigInt serialized as string
  avgReachPerAd: number,
  topBrandsByAdCount: TopBrand[],  // table data
  adsByDate: { date: string, count: number, activeCount: number }[], // timeline data
  // ... job stats (not needed for analytics dashboard)
}
```

### Existing Recharts Import Pattern (from share-of-voice page)
```typescript
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts';
```

### Existing Dark Mode Pattern (used everywhere)
```typescript
const { darkMode } = useV2();
// All conditional styling uses this pattern:
className={`... ${darkMode ? 'bg-[#101322] text-slate-100' : 'bg-white text-slate-900'}`}
// Primary color: #1235e2
// Dark background: #101322
// Light background: #f6f6f8
```

## State of the Art

| Old Approach (Current) | New Approach (Target) | Impact |
|------------------------|----------------------|--------|
| Dashboard shows top ads as cards | Dashboard shows KPI cards + charts + tables | Eliminates Ad Library duplication |
| No filters on dashboard | Filter bar (format, category, date range, active status) | Addresses DASH-02 |
| No saved configurations | localStorage-based config save/load | Addresses DASH-03 |
| Single sort tab (reach/newest/active) | Multi-dimensional analytics filters | More powerful analysis |
| Benchmarking section (own brand vs competitors) | Database-wide analytics (all brands) | Matches "analytics over full ad database" requirement |

**Deprecated/outdated:**
- The current ad card grid on dashboard: Remove entirely, replaced by analytics widgets
- The benchmarking section: Already hidden from sidebar per prior decisions; remove from dashboard page
- `dashboardData` state (own brand / competitors): Not needed for the new analytics-focused dashboard

## Data Available for Analytics

Inventory of what can be visualized from existing data, no schema changes needed:

| Metric | Source | Chart Type |
|--------|--------|------------|
| Total ads / active ads / inactive ads | stats API | KPI cards |
| Total brands | stats API | KPI card |
| Total reach / avg reach per ad | stats API (full mode) | KPI cards |
| Ads by format (image/video/carousel/dpa) | stats API `adsByFormat` | Pie/donut chart |
| Ads by platform (facebook/instagram/etc) | stats API `adsByPlatform` | Horizontal bar chart |
| Ads over time (last 30 days) | stats API `adsByDate` | Area/line chart |
| Top brands by ad volume | stats API `topBrandsByAdCount` | Table |
| Ads by category | New query on `AdLibraryBrand.category` | Bar chart |
| Ad duration distribution | New query on `adDurationDays` | Histogram |
| Active vs inactive ratio | `activeAds / totalAds` | Gauge or KPI |

## Open Questions

1. **How many saved configurations should be supported?**
   - What we know: localStorage can hold ~5MB, configs are small (~1KB each)
   - What's unclear: Should there be a limit? UX for managing many configs?
   - Recommendation: Cap at 10 saved configs with a simple list UI. Sufficient for the feature.

2. **Should dashboard filters propagate to the stats API or compute client-side?**
   - What we know: Stats API already supports `brandId`, `startDate`, `endDate` filters. Does NOT support `category`, `displayFormat` filters at the stats level.
   - What's unclear: Whether to extend the stats API or create a new dedicated endpoint.
   - Recommendation: Extend the stats API with `category` and `displayFormat` params, OR create a new `/api/dashboard/analytics` endpoint that accepts all filter params and returns pre-shaped widget data.

3. **Should we keep any of the current dashboard content?**
   - What we know: Decision says "not a duplicate of Ad Library"
   - What's unclear: Whether the Top Brands table should stay (it's analytics, not ad browsing)
   - Recommendation: Keep the Top Brands table -- it IS analytics. Remove the ad cards grid entirely.

## Sources

### Primary (HIGH confidence)
- `/Users/sebastian/Codingprojects/Sitemap-experiment/package.json` -- Recharts 3.6.0 confirmed installed
- `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/api/ad-library/stats/route.ts` -- Full stats API with caching, aggregation
- `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/dashboard/v2/page.tsx` -- Current dashboard implementation
- `/Users/sebastian/Codingprojects/Sitemap-experiment/prisma/schema.prisma` -- Full data model
- `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/dashboard/v2/v2-shell.tsx` -- Reusable UI components
- `/Users/sebastian/Codingprojects/Sitemap-experiment/src/hooks/use-favorites.ts` -- localStorage pattern
- 11+ existing Recharts chart components across the codebase

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- everything is already installed and verified in package.json
- Architecture: HIGH -- patterns are established in the existing codebase (11+ chart components, V2Shell, V2Card)
- Pitfalls: HIGH -- all identified from actual code inspection (BigInt serialization, hydration, stats performance)
- Data model: HIGH -- full schema inspected, all aggregatable fields catalogued

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- no fast-moving dependencies)
