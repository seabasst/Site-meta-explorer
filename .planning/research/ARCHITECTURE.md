# Architecture Research

**Domain:** Data dashboard enhancement (v1.1)
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

This research addresses three architectural questions for the v1.1 milestone:
1. How to integrate ad media previews with the existing API flow
2. Client-side vs server-side export tradeoffs
3. Chart enhancement patterns for existing Recharts components

The existing architecture is well-structured for these enhancements. Key recommendation: extend rather than replace. The current patterns (API route -> lib functions -> client components) accommodate all v1.1 features with minimal architectural changes.

---

## Integration with Existing Architecture

### Current System Overview

```
User Input
    |
    v
page.tsx (client state)
    |
    v [POST /api/facebook-ads]
route.ts (validation, orchestration)
    |
    v
facebook-api.ts (Graph API client)
    |
    +-> demographic-aggregator.ts (weighted combination)
    +-> spend-estimator.ts (CPM analysis)
    |
    v
Client receives FacebookApiResult
    |
    v
Component tree renders (charts, tables, analysis)
```

**Key characteristics:**
- Single API endpoint handles all Facebook Ad Library queries
- API response is comprehensive (~15 fields per ad)
- Client-side rendering with Recharts
- Export utilities already exist (client-side CSV generation)
- No caching layer (each request is fresh)

### Data Types Currently Returned

```typescript
// From facebook-api.ts - existing fields per ad
interface FacebookAdResult {
  adId: string;
  adArchiveId: string;           // Used for Ad Library links
  pageId: string;
  pageName: string;
  startedRunning: string | null;
  stoppedRunning: string | null;
  isActive: boolean;
  creativeBody: string | null;   // Ad copy text
  linkTitle: string | null;      // Headline
  linkCaption: string | null;
  euTotalReach: number;
  mediaType: 'video' | 'image' | 'unknown';
  demographics: AdDemographics | null;
  targeting: { ageMin, ageMax, gender, locations };
  beneficiary: string | null;
  payer: string | null;
}
```

**NOT currently fetched but available in Graph API:**
- `ad_snapshot_url` - Link to Facebook's ad preview page
- `ad_creative_link_captions` - Already partially used
- Video/image URLs are NOT directly available via API

---

## Ad Preview Integration

### Challenge: Facebook Does Not Provide Direct Media URLs

The Facebook Ad Library API provides `ad_snapshot_url` but NOT direct image/video URLs. The snapshot URL is:
```
https://www.facebook.com/ads/archive/render_ad/?id=<id>&access_token=<token>
```

This is a Facebook-hosted page that:
1. Requires authentication (access token in URL)
2. Cannot be embedded via iframe (X-Frame-Options)
3. Cannot fetch media directly due to authentication

### Recommended Approach: Link-Based Preview

**Option A: External Link (Recommended for v1.1)**
- Add `ad_snapshot_url` to API response
- Create "Preview" button that opens Facebook's preview in new tab
- Zero CORS/authentication issues
- Users see official Facebook rendering

**Implementation:**

1. Update `facebook-api.ts` to fetch `ad_snapshot_url`:
```typescript
// Add to fields array in fetchFacebookAds()
const fields = [
  // ... existing fields
  'ad_snapshot_url',  // ADD THIS
].join(',');

// Add to FacebookAdResult interface
interface FacebookAdResult {
  // ... existing fields
  adSnapshotUrl: string | null;  // ADD THIS
}

// Map in conversion logic
adSnapshotUrl: ad.ad_snapshot_url || null,
```

2. Create preview component:
```typescript
// src/components/ad-preview-link.tsx
export function AdPreviewLink({ adSnapshotUrl, adArchiveId }: Props) {
  const fallbackUrl = `https://www.facebook.com/ads/library/?id=${adArchiveId}`;

  return (
    <a
      href={adSnapshotUrl || fallbackUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="..."
    >
      Preview Ad
    </a>
  );
}
```

**Option B: Thumbnail Proxy (Future Enhancement)**

For inline thumbnails without leaving the app:
1. Create server-side proxy endpoint: `/api/ad-thumbnail`
2. Use Puppeteer to screenshot the ad preview page
3. Cache thumbnails to avoid repeated rendering
4. Return image blob to client

This is complex and has Vercel serverless constraints (10s timeout on Hobby, 60s on Pro). Recommend deferring to v1.2+.

### API Response Changes

```typescript
// Updated FacebookApiResult structure
interface FacebookApiResult {
  // ... existing fields
  ads: Array<FacebookAdResult & {
    adSnapshotUrl: string | null;  // NEW
  }>;
}
```

**Backward compatible:** Existing code ignores new fields.

---

## Export Architecture

### Current Implementation

Export is already client-side in `src/lib/export-utils.ts`:

```typescript
function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  // ... trigger download
}
```

Three export functions exist:
- `exportAdsToCSV()` - Basic ad list
- `exportDemographicsToCSV()` - Demographics breakdown
- `exportFullReportToCSV()` - Combined report

### Client-Side vs Server-Side Tradeoffs

| Aspect | Client-Side | Server-Side |
|--------|-------------|-------------|
| Latency | Instant (data already in memory) | Network round-trip required |
| Memory | Browser memory limits (~500MB safe) | Serverless memory limits (1GB-3GB) |
| Format flexibility | Limited (CSV, JSON easy; PDF hard) | Full (any format with right libraries) |
| Security | Data exposed to client | Sensitive data never leaves server |
| Vercel constraints | None | 10s timeout (Hobby), 60s (Pro) |
| Dependencies | Minimal | May need heavy libs (pdfkit, xlsx) |

### Recommendation: Keep Client-Side for CSV, Add Server-Side for PDF

**CSV (keep client-side):**
- Current implementation works well
- Data is already on client
- No additional latency
- Supports thousands of rows easily

**PDF export (add server-side):**

For professional reports, add an API route:

```typescript
// src/app/api/export/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Pro plan required for > 10s

export async function POST(request: NextRequest) {
  const data = await request.json();

  // Option 1: Use @react-pdf/renderer (lighter, faster)
  // Option 2: Use jspdf (client-friendly but can run server-side)
  // Option 3: Use puppeteer for HTML->PDF (heavy but flexible)

  const pdfBuffer = await generatePDF(data);

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report.pdf"`,
    },
  });
}
```

**Vercel Serverless Constraints:**
- Hobby plan: 10s max execution time
- Pro plan: 60s max execution time (matches current `maxDuration = 60`)
- PDF generation with @react-pdf/renderer typically takes 2-5s
- Puppeteer-based PDF would risk timeout on Hobby

### Export Enhancement Component Organization

```
src/
  components/
    export/
      export-dropdown.tsx       # Existing, in page.tsx currently
      export-pdf-button.tsx     # NEW - triggers PDF generation
  lib/
    export-utils.ts             # Existing CSV functions
    export-pdf.ts               # NEW - PDF generation logic (if server-side)
  app/
    api/
      export/
        pdf/
          route.ts              # NEW - PDF endpoint
```

---

## Chart Enhancement Pattern

### Current Recharts Usage

The codebase uses Recharts 3.6.0 with a custom wrapper:

```typescript
// src/components/ui/chart.tsx
// Provides: ChartContainer, ChartTooltip, ChartTooltipContent

// Usage in time-trends.tsx:
<ChartContainer config={chartConfig}>
  <LineChart data={data}>
    <CartesianGrid />
    <XAxis dataKey="week" />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line dataKey="count" type="natural" />
  </LineChart>
</ChartContainer>
```

### Enhancement Patterns

**1. Add Brush for Time Range Selection**

```typescript
import { Brush } from 'recharts';

<LineChart data={monthlyData}>
  {/* ... existing elements */}
  <Brush
    dataKey="month"
    height={30}
    stroke="var(--accent-green)"
    fill="var(--bg-tertiary)"
    startIndex={monthlyData.length - 6}  // Show last 6 months by default
    endIndex={monthlyData.length - 1}
  />
</LineChart>
```

**2. Add Click Handlers for Drill-Down**

```typescript
<Bar
  dataKey="adsLaunched"
  onClick={(data, index) => {
    // Drill down to show ads from that month
    setSelectedMonth(data.month);
    setShowMonthDetail(true);
  }}
  style={{ cursor: 'pointer' }}
/>
```

**3. Add Reference Lines for Benchmarks**

```typescript
import { ReferenceLine } from 'recharts';

<LineChart>
  {/* ... */}
  <ReferenceLine
    y={averageReach}
    stroke="var(--accent-yellow)"
    strokeDasharray="3 3"
    label={{ value: 'Avg', position: 'right' }}
  />
</LineChart>
```

**4. Implement Zoom via ReferenceArea (Advanced)**

```typescript
// State for zoom selection
const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
const [zoomedData, setZoomedData] = useState(fullData);

<LineChart
  onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
  onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
  onMouseUp={() => {
    if (refAreaLeft && refAreaRight) {
      // Calculate zoom range and filter data
      const [left, right] = [refAreaLeft, refAreaRight].sort();
      setZoomedData(fullData.filter(d => d.month >= left && d.month <= right));
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }}
>
  {refAreaLeft && refAreaRight && (
    <ReferenceArea
      x1={refAreaLeft}
      x2={refAreaRight}
      strokeOpacity={0.3}
      fill="var(--accent-green)"
      fillOpacity={0.3}
    />
  )}
</LineChart>
```

### New Chart Types to Consider

| Chart Type | Use Case | Recharts Component |
|------------|----------|-------------------|
| Funnel | Conversion analysis | Not built-in, use BarChart creatively |
| Radar | Multi-dimensional comparison | `<RadarChart>` |
| Treemap | Category breakdown | `<Treemap>` |
| Sankey | Flow visualization | Not built-in |
| Scatter | Correlation analysis | `<ScatterChart>` |

**Recommendation for v1.1:** Enhance existing charts (Line, Bar) with interactivity before adding new chart types.

---

## Component Organization

### Proposed Structure for v1.1 Features

```
src/
  components/
    ui/
      chart.tsx                    # EXISTING - ChartContainer wrapper
    demographics/
      age-gender-chart.tsx         # EXISTING
      country-chart.tsx            # EXISTING
      demographics-summary.tsx     # EXISTING
      media-type-chart.tsx         # EXISTING
    analytics/
      time-trends.tsx              # EXISTING - enhance with Brush
      ad-longevity.tsx             # EXISTING
      ad-copy-analysis.tsx         # EXISTING
      brand-comparison.tsx         # EXISTING
      landing-page-analysis.tsx    # EXISTING
      product-market-table.tsx     # EXISTING
    ads/                           # NEW FOLDER
      ad-preview-link.tsx          # NEW - external preview link
      ad-card.tsx                  # NEW - card with preview thumbnail (v1.2)
      ads-grid.tsx                 # NEW - grid layout for ad cards
    export/                        # NEW FOLDER
      export-menu.tsx              # REFACTOR from page.tsx inline code
      export-pdf-button.tsx        # NEW - PDF export trigger
    error/                         # NEW FOLDER
      error-boundary.tsx           # NEW - React error boundary
      error-message.tsx            # NEW - Styled error display
  lib/
    facebook-api.ts                # MODIFY - add ad_snapshot_url
    export-utils.ts                # EXISTING - CSV exports
    export-pdf.ts                  # NEW - PDF generation (if needed)
```

### Component Boundaries

| Component | Responsibility | Data Source |
|-----------|----------------|-------------|
| AdPreviewLink | Render preview button | adSnapshotUrl prop |
| ExportMenu | Show export options dropdown | apiResult prop |
| TimeTrends | Render time charts with Brush | ads array prop |
| ErrorMessage | Display user-friendly errors | error string prop |

---

## Data Flow Changes

### Current Flow (Unchanged)

```
page.tsx state
    |
    +-- POST /api/facebook-ads
    |       |
    |       v
    |   fetchFacebookAds()
    |       |
    |       v
    |   return FacebookApiResult
    |
    v
setApiResult(response)
    |
    v
Render components with apiResult prop
```

### Enhanced Flow for v1.1

```
page.tsx state
    |
    +-- POST /api/facebook-ads
    |       |
    |       v
    |   fetchFacebookAds()
    |       +-- NOW includes ad_snapshot_url  <-- CHANGE
    |       |
    |       v
    |   return FacebookApiResult
    |
    v
setApiResult(response)
    |
    +-- AdPreviewLink receives adSnapshotUrl  <-- NEW
    +-- TimeTrends receives ads (unchanged)
    +-- ExportMenu receives apiResult
            |
            +-- CSV: client-side (unchanged)
            +-- PDF: POST /api/export/pdf  <-- NEW
```

---

## Build Order

Based on dependencies, recommended implementation order:

### Phase 1: Foundation (No Dependencies)
1. **Error handling components** - ErrorBoundary, ErrorMessage
2. **Export refactoring** - Extract inline export to ExportMenu component

### Phase 2: API Enhancement (Depends on Phase 1)
3. **Add ad_snapshot_url to API** - Modify facebook-api.ts
4. **AdPreviewLink component** - Uses new API field

### Phase 3: Chart Interactivity (Depends on Phase 1)
5. **Brush component integration** - Enhance TimeTrends
6. **Click handlers** - Add to existing charts
7. **Reference lines** - Add benchmarks to charts

### Phase 4: Export Enhancement (Depends on Phase 1, 2)
8. **PDF export** - Add server-side route (if pursuing)
9. **Export options UI** - Enhance ExportMenu

### Phase 5: Mobile/UI Polish (Depends on Phases 1-4)
10. **Responsive breakpoints** - Adjust chart sizing
11. **Touch interactions** - Mobile-friendly chart controls

**Rationale:**
- Error handling first ensures robust foundation
- API changes early unlock preview features
- Chart enhancements independent of API changes
- Export depends on having all data fields available
- UI polish last when functionality is stable

---

## Vercel/Serverless Considerations

### Existing Configuration

```typescript
// src/app/api/facebook-ads/route.ts
export const maxDuration = 60;  // Already configured for Pro plan
```

### Constraints to Remember

| Constraint | Hobby Plan | Pro Plan | Impact |
|------------|------------|----------|--------|
| Execution time | 10s | 60s | PDF generation needs Pro |
| Memory | 1GB | 3GB | Large CSV exports fine |
| Payload size | 4.5MB | 4.5MB | Watch large data exports |
| Concurrent executions | 10 | 1000 | Not a concern for this app |

### Recommendations

1. **Keep heavy operations in existing endpoint** - maxDuration already 60s
2. **PDF generation** - Add maxDuration = 60 to any new export endpoint
3. **No file system writes** - Vercel functions are ephemeral; generate and return immediately
4. **Streaming for large exports** - Use Response with ReadableStream if exports grow large

```typescript
// Example streaming response for large exports
export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Generate CSV chunks
      controller.enqueue(new TextEncoder().encode(header));
      for (const row of rows) {
        controller.enqueue(new TextEncoder().encode(row));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/csv' },
  });
}
```

---

## Anti-Patterns to Avoid

### 1. Inline Media Embedding Without Proxy

**Wrong:**
```tsx
<img src={adSnapshotUrl} /> // Will fail - requires auth
```

**Right:**
```tsx
<a href={adSnapshotUrl} target="_blank">Preview</a>
```

### 2. Server-Side CSV for Small Data

**Wrong:** Creating API route for CSV that's already on client

**Right:** Use existing client-side export-utils.ts

### 3. Blocking Chart Interactions

**Wrong:**
```tsx
<Line onClick={async () => {
  await fetchDetailData(); // Blocks interaction
}} />
```

**Right:**
```tsx
<Line onClick={(data) => {
  setSelectedItem(data); // Instant state update
  // Fetch in useEffect or separate handler
}} />
```

### 4. Breaking Existing API Contract

**Wrong:** Changing existing field names/types

**Right:** Adding new optional fields, keeping existing ones

---

## Sources

**Facebook Ad Library API:**
- [Facebook Ad Library API Complete Guide 2025](https://admanage.ai/blog/facebook-ads-library-api)
- [Meta Ad Library API Guide](https://data365.co/blog/meta-facebook-ads-library-api)
- [Facebook Ads Library API 2026 Update](https://deepsolv.ai/blog/facebook-ads-library-api-how-to-use-it-for-advanced-competitive-research-2026-update)

**Next.js/Vercel Export Patterns:**
- [Edge vs Serverless Functions 2025](https://medium.com/@itsamanyadav/edge-functions-vs-serverless-in-next-js-which-one-should-you-use-in-2025-f4ae28c0788d)
- [PDF Generation on Vercel](https://medium.com/@gritchmond/how-to-generate-pdf-for-a-nextjs-project-hosted-on-vercel-a65457603412)
- [Download Files in Next.js App Router](https://www.codeconcisely.com/posts/nextjs-app-router-api-download-file/)
- [Streaming Files from Next.js Route Handlers](https://www.ericburel.tech/blog/nextjs-stream-files)

**CORS and Proxy Patterns:**
- [Avoiding CORS Issues in Next.js](https://www.propelauth.com/post/avoiding-cors-issues-in-react-next-js)
- [Server-Side Proxy for Images](https://dev.to/bilelsalemdev/solving-image-download-with-a-server-side-proxy-in-nextjs-21g4)
- [Next.js Proxy Configuration](https://blog.logrocket.com/how-to-use-proxy-next-js/)

**Recharts Interactivity:**
- [Recharts API Documentation](https://recharts.github.io/en-US/api/)
- [shadcn Chart Brush Component](https://www.shadcn.io/template/rudrodip-shadcn-chart-brush)
- [Recharts Scatter Plot with Zoom](https://medium.com/@rohanbajaj/recharts-scatter-plot-with-zoom-and-selection-112d82b26f43)
- [Recharts Releases](https://github.com/recharts/recharts/releases)

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Ad Preview (link approach) | HIGH | Verified against Facebook API docs, no CORS issues |
| Ad Preview (thumbnail proxy) | MEDIUM | Feasible but complex; Vercel constraints |
| CSV Export (client) | HIGH | Already implemented and working |
| PDF Export (server) | MEDIUM | Requires Pro plan for timeout; libs verified |
| Chart Brush/Zoom | HIGH | Recharts 3.x supports these features |
| Component organization | HIGH | Follows existing patterns |
| Build order | HIGH | Based on actual dependency analysis |

---

## Summary for Roadmap

**Recommended phase structure based on this research:**

1. **Error Handling & Export Refactor** - Foundation, no blockers
2. **API Enhancement** - Add ad_snapshot_url, simple field addition
3. **Ad Preview UI** - Depends on API enhancement
4. **Chart Interactivity** - Independent track, can parallelize
5. **PDF Export** - Optional, requires Pro plan evaluation
6. **Mobile Polish** - After core features stable

**Key decision points:**
- Ad preview: Use link approach (v1.1) vs thumbnail proxy (v1.2+)
- PDF export: Worth Pro plan requirement? Consider keeping CSV-only if not
- Chart zoom: Worth complexity? Brush might be sufficient

**No architectural rewrites needed** - all features integrate with existing patterns.
