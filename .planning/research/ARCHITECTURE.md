# Architecture Research: Demographic Extraction

**Domain:** Facebook Ad Library demographic scraping extension
**Researched:** 2026-01-18
**Confidence:** HIGH (existing codebase patterns well-established)

## Executive Summary

The demographic extraction feature requires extending the existing ad scraping flow to drill into individual ad detail pages and aggregate demographic data. The current architecture already handles the first step (ad discovery); this research addresses how to architect the second step (detail page scraping) and the third step (data aggregation).

**Key architectural decision:** Use a two-phase scraping approach within the existing API route, reusing the browser session for efficiency. Demographics are only available for EU-targeted ads via the "European Union Transparency" modal.

---

## Existing Architecture Analysis

### Current Flow

```
User Input (Ad Library URL)
        |
        v
POST /api/scrape-ads
        |
        v
scrapeAdLibrary() in ad-library-scraper.ts
        |
        v
1. Launch Puppeteer browser
2. Navigate to Ad Library page
3. Intercept network responses for destination URLs
4. Scroll to load all ads
5. Extract ad IDs and destination URLs
6. Return aggregated results
        |
        v
UI displays destination URLs with ad counts
```

### Current Component Boundaries

| Component | Location | Responsibility |
|-----------|----------|----------------|
| UI Layer | `page.tsx` | Form handling, state management, display |
| API Route | `/api/scrape-ads/route.ts` | Request validation, timeout config, error handling |
| Scraper Core | `lib/ad-library-scraper.ts` | Puppeteer orchestration, URL extraction |
| Data Types | `lib/ad-library-scraper.ts` | `AdData`, `AdLibraryResult` interfaces |

### Constraints Inherited

- **60s Vercel timeout** (requires Vercel Pro)
- **Puppeteer in serverless** uses `@sparticuz/chromium-min` with remote binary
- **Single browser session** per request (no persistent browsers)
- **Memory limits** in serverless environment

---

## Proposed Architecture

### New Components

#### 1. DemographicScraper (`lib/demographic-scraper.ts`)

**Responsibility:** Scrape individual ad detail pages for demographic data.

```typescript
interface DemographicData {
  adId: string;
  hasEUTransparency: boolean;

  // Audience targeting (what advertiser set)
  targetAgeRange?: { min: number; max: number };
  targetGender?: 'all' | 'male' | 'female';
  targetLocations?: string[];  // Countries/regions
  excludedLocations?: string[];

  // Reach breakdown (actual delivery)
  reachByCountry?: Record<string, number>;
  reachByAge?: Record<string, number>;     // "18-24": 1500
  reachByGender?: Record<string, number>;  // "male": 2000

  // Metadata
  totalReach?: number;
  platforms?: ('facebook' | 'instagram' | 'messenger' | 'audience_network')[];
}

interface DemographicScraperResult {
  success: boolean;
  demographics: DemographicData[];
  errors: { adId: string; error: string }[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    noEUData: number;
  };
}
```

**Why separate module:**
- Single responsibility (demographic extraction vs. ad discovery)
- Testable in isolation
- Can be enhanced independently (e.g., add retry logic)

#### 2. DemographicAggregator (`lib/demographic-aggregator.ts`)

**Responsibility:** Aggregate individual ad demographics into summary statistics.

```typescript
interface AggregatedDemographics {
  // Sample size
  totalAdsAnalyzed: number;
  adsWithDemographicData: number;

  // Aggregated targeting patterns
  targetingPatterns: {
    ageRanges: { range: string; percentage: number }[];
    genderSplit: { gender: string; percentage: number }[];
    topCountries: { country: string; adCount: number }[];
  };

  // Aggregated reach data
  reachAnalysis: {
    totalReach: number;
    reachByAge: Record<string, number>;
    reachByGender: Record<string, number>;
    reachByCountry: Record<string, number>;
  };

  // Insights
  insights: string[];  // e.g., "75% of ads target ages 25-44"
}
```

**Why aggregation layer:**
- Raw per-ad data is too granular for UI consumption
- Aggregation logic is complex and deserves isolation
- Enables caching of aggregated results

#### 3. Extended API Response

Extend existing `/api/scrape-ads` or create `/api/scrape-demographics`:

**Option A: Extend existing route (Recommended)**
- Add optional `includeDemographics: boolean` parameter
- Keeps single request flow
- Risk: May exceed 60s timeout for many ads

**Option B: Separate route**
- `/api/scrape-demographics` accepts ad IDs from previous scrape
- Two-request flow from UI
- Benefit: Can process in background, show progress

**Recommendation:** Start with Option A for simplicity, prepare for Option B if timeouts become an issue.

---

## Data Flow

### Phase 1: Ad Discovery (Existing)

```
Ad Library URL
      |
      v
[Browser Session]
      |
      v
Scroll + Intercept Network
      |
      v
Extract: { adId, destinationUrl, adLibraryLinks }[]
```

### Phase 2: Demographic Extraction (New)

```
adIds from Phase 1
      |
      v
[Reuse Browser Session]
      |
      v
For each adId (batched, 3-5 concurrent):
  |
  +-> Navigate to https://www.facebook.com/ads/library/?id={adId}
  |
  +-> Click "See Ad Details" button
  |
  +-> Wait for EU Transparency modal
  |
  +-> Extract demographic data from modal
  |
  +-> Handle: no EU data, modal not found, timeout
      |
      v
DemographicData[]
```

### Phase 3: Aggregation (New)

```
DemographicData[]
      |
      v
[DemographicAggregator]
      |
      +-> Group by age range
      +-> Sum reach by country
      +-> Calculate percentages
      +-> Generate insights
      |
      v
AggregatedDemographics
```

### Complete Flow Diagram

```
                    User Input
                        |
                        v
                  [API Route]
                        |
        +---------------+---------------+
        |                               |
        v                               v
   [Ad Discovery]              (if demographics requested)
        |                               |
        v                               v
   AdLibraryResult              [Demographic Scraper]
        |                               |
        |                               v
        |                       DemographicData[]
        |                               |
        |                               v
        |                       [Aggregator]
        |                               |
        +---------------+---------------+
                        |
                        v
                Combined Response
                        |
                        v
                   [UI State]
                        |
        +-------+-------+-------+
        |       |       |       |
        v       v       v       v
    Results  Demographics  Charts  Insights
    Table      Summary
```

---

## Integration Points

### 1. Scraper to Scraper (Browser Session Sharing)

The demographic scraper should receive the existing browser instance:

```typescript
// In ad-library-scraper.ts
export async function scrapeAdLibrary(
  adLibraryUrl: string,
  options: {
    debug?: boolean;
    includeDemographics?: boolean;  // NEW
    maxDemographicAds?: number;     // NEW: limit for timeout safety
  }
): Promise<AdLibraryResponse>

// Internal flow
const browser = await puppeteer.launch(/* ... */);
// ... existing ad discovery ...

if (options.includeDemographics) {
  const demographicResult = await scrapeDemographics(
    browser,  // Reuse session
    ads.slice(0, options.maxDemographicAds || 50),
    debug
  );
  // Merge results
}
```

### 2. API Route to UI (Extended Response)

```typescript
// Extended AdLibraryResult
interface AdLibraryResult {
  // Existing fields
  success: true;
  pageId: string;
  pageName: string | null;
  ads: AdData[];
  totalAdsFound: number;
  totalActiveAdsOnPage: number | null;

  // NEW: Optional demographics
  demographics?: {
    aggregated: AggregatedDemographics;
    perAd: DemographicData[];  // Could be omitted if too large
    scrapeStats: {
      total: number;
      successful: number;
      failed: number;
      skipped: number;
    };
  };
}
```

### 3. UI State Management (page.tsx)

Extend existing state to handle demographics:

```typescript
// NEW state
const [demographicResult, setDemographicResult] = useState<AggregatedDemographics | null>(null);
const [isLoadingDemographics, setIsLoadingDemographics] = useState(false);

// Display in new component
{demographicResult && (
  <DemographicsPanel data={demographicResult} />
)}
```

---

## Build Order

### Phase 1: Foundation (Do First)

1. **Define interfaces** in new file `lib/types/demographics.ts`
   - `DemographicData`
   - `AggregatedDemographics`
   - Export from index

2. **Create demographic scraper skeleton** `lib/demographic-scraper.ts`
   - Function signature accepting browser + ad IDs
   - Single-ad scraping logic
   - Error handling per ad

**Rationale:** Interfaces first allows parallel work on scraper and aggregator.

### Phase 2: Core Scraping

3. **Implement detail page navigation**
   - Navigate to `facebook.com/ads/library/?id={adId}`
   - Detect "See Ad Details" button
   - Click and wait for modal

4. **Implement EU Transparency extraction**
   - Parse modal HTML structure
   - Extract reach-by-country table
   - Extract age/gender breakdown
   - Handle missing data gracefully

5. **Add batch processing**
   - Process 3-5 ads concurrently
   - Implement timeout per ad (10s suggested)
   - Collect errors without failing entire batch

**Rationale:** Core value is here. Get single-ad working before scaling.

### Phase 3: Aggregation

6. **Create aggregator module** `lib/demographic-aggregator.ts`
   - Sum/average numeric fields
   - Calculate percentages
   - Generate top-N lists
   - Create insight strings

7. **Integrate with main scraper**
   - Add `includeDemographics` option
   - Call demographic scraper after ad discovery
   - Merge results into response

**Rationale:** Aggregation depends on stable per-ad data shape.

### Phase 4: UI Integration

8. **Extend API response type**
   - Add demographics to `AdLibraryResult`
   - Update API route handler

9. **Create `DemographicsPanel` component**
   - Display aggregated stats
   - Charts for age/gender/country
   - Handle loading/empty states

10. **Wire up in page.tsx**
    - Add checkbox for "Include demographics"
    - Display panel when data available

**Rationale:** UI is last because it depends on finalized data shape.

### Dependency Graph

```
[1. Interfaces]
      |
      +-----> [2. Scraper Skeleton]
      |              |
      |              v
      |       [3. Navigation]
      |              |
      |              v
      |       [4. Extraction]
      |              |
      |              v
      |       [5. Batching]
      |              |
      +-----> [6. Aggregator] <----+
                     |             |
                     v             |
              [7. Integration] ----+
                     |
                     v
              [8. API Types]
                     |
                     v
              [9. UI Component]
                     |
                     v
              [10. Page Wiring]
```

---

## Technical Considerations

### Timeout Management

**Problem:** 60s Vercel limit must accommodate:
- Ad discovery (current: ~20-40s for large pages)
- Demographic scraping (NEW: ~5-10s per ad)

**Solutions:**
1. **Limit demographic scraping** to first N ads (e.g., 10-20)
2. **Parallelize** demographic fetches (3-5 concurrent)
3. **Progressive loading** (future): Stream results as they complete

**Recommendation:** Start with limit of 10 ads, expand based on timing data.

### Selector Stability

Facebook's DOM changes frequently. Mitigation strategies:

1. **Multiple selector fallbacks**
   ```typescript
   const selectors = [
     '[data-testid="ad-details-button"]',
     'div[role="button"]:has-text("See Ad Details")',
     'button:contains("See Ad Details")'
   ];
   ```

2. **Text-based matching** as fallback
   ```typescript
   await page.evaluate(() => {
     const buttons = document.querySelectorAll('div[role="button"]');
     for (const btn of buttons) {
       if (btn.textContent?.includes('See Ad Details')) {
         btn.click();
         return true;
       }
     }
     return false;
   });
   ```

3. **Network interception** for EU data (if exposed in API responses)

### Error Resilience

**Per-ad errors should not fail the batch:**

```typescript
const results: DemographicData[] = [];
const errors: { adId: string; error: string }[] = [];

for (const adId of adIds) {
  try {
    const data = await scrapeAdDemographics(page, adId);
    results.push(data);
  } catch (error) {
    errors.push({ adId, error: error.message });
    // Continue to next ad
  }
}
```

### Memory Management

Reuse browser session but create fresh pages:

```typescript
async function scrapeDemographics(browser: Browser, adIds: string[]) {
  const page = await browser.newPage();
  try {
    for (const adId of adIds) {
      await page.goto(`.../${adId}`);
      // Extract data
      // Don't create new page per ad - reuse
    }
  } finally {
    await page.close();  // Always cleanup
  }
}
```

---

## Anti-Patterns to Avoid

### 1. Creating Separate Browser Per Ad

**Wrong:**
```typescript
for (const adId of adIds) {
  const browser = await puppeteer.launch();  // NO!
  // ...
  await browser.close();
}
```

**Right:** Reuse browser, optionally create new pages.

### 2. Sequential One-by-One Processing

**Wrong:**
```typescript
for (const adId of adIds) {
  await scrapeAd(adId);  // Slow!
}
```

**Right:** Batch with controlled concurrency.
```typescript
await pLimit(3)(adIds.map(id => () => scrapeAd(id)));
```

### 3. Failing Entire Request on Single Ad Error

**Wrong:**
```typescript
const results = await Promise.all(adIds.map(scrapeAd));
// One failure = all fail
```

**Right:**
```typescript
const results = await Promise.allSettled(adIds.map(scrapeAd));
// Process fulfilled and rejected separately
```

### 4. Tight Coupling Between Scraper and Aggregator

**Wrong:** Aggregation logic inside scraper function.

**Right:** Separate modules with clear interfaces.

---

## Scalability Considerations

| Scale | Approach | Notes |
|-------|----------|-------|
| 1-10 ads | In-request processing | Current architecture works |
| 10-50 ads | Timeout-aware batching | Limit concurrent, monitor timing |
| 50+ ads | Background job | Requires architecture change |

### Future: Background Processing

If demand exceeds request timeout, consider:

1. **Trigger.dev** for managed background jobs
2. **Polling pattern:** Start job, return job ID, poll for completion
3. **WebSocket/SSE:** Stream results as they complete

**Not needed for MVP** but worth designing interfaces to allow migration.

---

## File Structure

```
src/
  lib/
    ad-library-scraper.ts      # Existing (modified)
    demographic-scraper.ts     # NEW: Core scraping logic
    demographic-aggregator.ts  # NEW: Aggregation logic
    types/
      demographics.ts          # NEW: Type definitions
  components/
    demographics-panel.tsx     # NEW: UI component
    demographics-chart.tsx     # NEW: Chart visualizations (optional)
  app/
    api/
      scrape-ads/
        route.ts               # Existing (extended)
    page.tsx                   # Existing (extended)
```

---

## Sources

### Facebook Ad Library & Demographics
- [Facebook Ads Library API: Complete Guide (2025)](https://admanage.ai/blog/facebook-ads-library-api) - API capabilities and limitations
- [Meta & Facebook Ads Library API](https://data365.co/blog/meta-facebook-ads-library-api) - EU transparency data access
- [Foreplay Facebook Ads Library Guide](https://www.foreplay.co/post/facebook-ads-library) - EU transparency modal details

### Puppeteer Architecture
- [Ultimate Puppeteer Web Scraping Guide 2025](https://www.browserless.io/blog/ultimate-guide-to-puppeteer-web-scraping-in-2025) - Multi-step workflow patterns
- [Puppeteer Cluster for Scaling](https://www.zenrows.com/blog/puppeteer-cluster) - Concurrency management
- [Apify Puppeteer Tutorial](https://blog.apify.com/puppeteer-web-scraping-tutorial/) - Best practices

### Next.js Architecture
- [Next.js Server Actions vs API Routes](https://medium.com/@shavaizali159/next-js-api-routes-vs-server-actions-which-one-to-use-and-why-809f09d5069b) - When to use each
- [Long-Running Tasks with Next.js](https://dev.to/bardaq/long-running-tasks-with-nextjs-a-journey-of-reinventing-the-wheel-1cjg) - Background processing patterns
- [Puppeteer with Vercel Serverless](https://medium.com/@mahesh.paul.j/use-puppeteer-with-vercel-serverless-functions-in-a-next-js-application-5d6bbe627f84) - Serverless constraints

### Batch Processing Patterns
- [AWS Web Crawling Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/web-crawling-system-esg-data/architecture.html) - Scalable crawling patterns
- [Distributed Web Crawling Guide](https://brightdata.com/blog/web-data/distributed-web-crawling) - Parallelization strategies
