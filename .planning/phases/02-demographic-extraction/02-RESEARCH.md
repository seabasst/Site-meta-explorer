# Phase 2: Demographic Extraction - Research

**Researched:** 2026-01-18
**Domain:** Facebook Ad Library demographic data extraction via Puppeteer web scraping
**Confidence:** MEDIUM

## Summary

This research investigates how to extend the existing Puppeteer-based scraper to extract demographic data (age, gender, country/region) from Facebook Ad Library ad detail pages. The existing scraper already intercepts network responses to capture ad IDs and destination URLs. The same network interception approach can capture demographic data from the GraphQL responses when ad detail modals are opened.

**Key findings:**
1. EU/UK ads contain rich demographic data including `age_country_gender_reach_breakdown`, `demographic_distribution`, and `eu_total_reach` fields
2. Demographic data is loaded via GraphQL/API responses when users click "See ad details" - these can be intercepted just like the existing URL extraction
3. Top performers can be identified by reach data (already captured) or ad duration (calculate from start date)
4. The existing scraper architecture (network interception + scrolling) is the right foundation - we extend it, not replace it

**Primary recommendation:** Extend the existing network interception pattern to capture demographic data from API responses when navigating to individual ad detail pages. Navigate to top-performing ads (by reach or duration) and extract demographic breakdowns from the intercepted responses.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rebrowser-puppeteer-core | ^24.8.1 | Anti-detection browser automation | Already upgraded in Phase 1; drop-in puppeteer replacement |
| @sparticuz/chromium-min | ^143.0.4 | Serverless Chromium binary | Already in use; required for Vercel deployment |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new required) | - | - | Existing stack sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web scraping | Facebook Ad Library API | API requires identity verification (physical ID + snail mail); adds weeks of delay; but would be more stable |
| Network interception | DOM parsing | DOM selectors change frequently; network responses are more stable |
| Sequential ad navigation | Parallel page instances | Parallel faster but higher detection risk; sequential is safer |

**No new dependencies needed.** The existing stack (rebrowser-puppeteer-core + @sparticuz/chromium-min) is sufficient.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ad-library-scraper.ts     # Existing - extend with demographic extraction
│   ├── demographic-extractor.ts   # NEW - functions to parse demographic data from API responses
│   └── top-performer-selector.ts  # NEW - logic to identify top ads by reach/duration
├── app/
│   └── api/
│       └── scrape-ads/
│           └── route.ts          # Existing - may need timeout adjustment
```

### Pattern 1: Network Response Interception for Demographics

**What:** Capture demographic data from GraphQL/API responses when loading ad detail pages

**When to use:** When extracting structured data that Facebook loads dynamically

**Example:**
```typescript
// Source: Existing pattern in src/lib/ad-library-scraper.ts (lines 166-195)
// Extended for demographic data

interface DemographicBreakdown {
  age: string;       // e.g., "18-24", "25-34"
  gender: string;    // "male" | "female" | "unknown"
  percentage: number; // 0-100
}

interface RegionBreakdown {
  region: string;    // Country code or region name
  percentage: number;
}

interface AdDemographics {
  adId: string;
  ageGenderBreakdown: DemographicBreakdown[];
  regionBreakdown: RegionBreakdown[];
  euTotalReach?: number;
  impressionsLower?: number;
  impressionsUpper?: number;
}

// Intercept demographic data from API responses
page.on('response', async (response: HTTPResponse) => {
  const url = response.url();

  if (url.includes('/api/graphql') || url.includes('/ads/library/async')) {
    try {
      const text = await response.text();
      const json = JSON.parse(text);

      // Extract demographic fields from API response
      const demographics = extractDemographicsFromApiResponse(json, currentAdId);
      if (demographics) {
        adDemographicsMap.set(currentAdId, demographics);
      }
    } catch {
      // Response not parseable - continue
    }
  }
});
```

### Pattern 2: Ad Detail Page Navigation

**What:** Navigate to individual ad detail pages to trigger demographic data loading

**When to use:** After identifying top-performing ads from the initial scrape

**Example:**
```typescript
// Navigate to ad detail page and wait for demographic data
async function scrapeAdDemographics(
  page: Page,
  adArchiveId: string,
  adDemographicsMap: Map<string, AdDemographics>
): Promise<AdDemographics | null> {
  const adDetailUrl = `https://www.facebook.com/ads/library/?id=${adArchiveId}`;

  try {
    // Navigate to ad detail page
    await page.goto(adDetailUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for demographic data to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click "See ad details" button if present (for EU transparency modal)
    const seeDetailsButton = await page.$('div[role="button"]:has-text("See ad details")');
    if (seeDetailsButton) {
      await seeDetailsButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Demographics should now be in adDemographicsMap from network interception
    return adDemographicsMap.get(adArchiveId) || null;
  } catch (error) {
    console.error(`Failed to scrape demographics for ad ${adArchiveId}:`, error);
    return null; // Graceful degradation - continue with other ads
  }
}
```

### Pattern 3: Top Performer Selection

**What:** Filter ads to analyze only the highest-performing ones

**When to use:** Before demographic scraping to stay within timeout limits

**Example:**
```typescript
// Source: Based on existing adCount sorting in ad-library-scraper.ts (line 370)

interface AdWithMetrics {
  adId: string;
  adArchiveId: string;
  startedRunning: string | null;
  reachLower?: number;
  reachUpper?: number;
  adCount: number;
}

function selectTopPerformers(
  ads: AdWithMetrics[],
  maxAds: number = 10
): AdWithMetrics[] {
  return ads
    .map(ad => ({
      ...ad,
      // Calculate duration score (days running)
      durationDays: ad.startedRunning
        ? Math.floor((Date.now() - new Date(ad.startedRunning).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      // Use midpoint of reach range as reach score
      reachScore: ad.reachLower && ad.reachUpper
        ? (ad.reachLower + ad.reachUpper) / 2
        : 0,
    }))
    // Sort by reach first, then by duration
    .sort((a, b) => {
      if (b.reachScore !== a.reachScore) {
        return b.reachScore - a.reachScore;
      }
      return b.durationDays - a.durationDays;
    })
    .slice(0, maxAds);
}
```

### Anti-Patterns to Avoid
- **DOM selector reliance:** Facebook changes class names frequently. Prefer network interception over CSS selectors.
- **Parallel ad navigation:** Opening multiple tabs/pages increases detection risk. Process ads sequentially.
- **Scraping all ads:** With 60s timeout, limit to top 5-10 performers. Quality over quantity.
- **Hard failure on missing data:** Some ads lack demographic data. Continue with remaining ads.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Demographic data parsing | Custom JSON traversal | Structured extraction function with known field paths | API response format is consistent; follow the structure |
| Ad duration calculation | Manual date math | Standard Date operations | Simple subtraction from start date to now |
| Network response parsing | Complex regex | JSON.parse with try-catch | Facebook returns JSON; don't regex-parse it |
| Top performer identification | Complex algorithm | Sort by reach then duration | Two-field sort is sufficient |

**Key insight:** The existing scraper already solves the hard problems (network interception, scrolling, anti-detection). Demographic extraction is an extension of existing patterns, not a new architecture.

## Common Pitfalls

### Pitfall 1: Assuming All Ads Have Demographic Data
**What goes wrong:** Scraper crashes or returns empty results when an ad lacks demographics
**Why it happens:** Only EU/UK ads and political/issue ads have full demographic breakdowns; many ads show limited data
**How to avoid:**
- Check for presence of demographic fields before accessing
- Use optional chaining and nullish coalescing
- Track which ads had data vs which didn't for user feedback
**Warning signs:** TypeError on undefined properties; empty demographic arrays

### Pitfall 2: Timeout Exhaustion on Large Pages
**What goes wrong:** Scraper times out (60s limit) before extracting enough demographic data
**Why it happens:** Each ad detail page navigation takes 2-5 seconds; trying to scrape too many ads
**How to avoid:**
- Limit to top 5-10 performers based on reach/duration
- Calculate time budget: (60s - initial_scrape_time) / ads_to_scrape
- Monitor elapsed time and stop early if needed
**Warning signs:** Function timeout errors; incomplete results

### Pitfall 3: Detection and Blocking
**What goes wrong:** Facebook detects automation and blocks requests or shows CAPTCHAs
**Why it happens:** Too-fast navigation, unusual patterns, missing anti-detection measures
**How to avoid:**
- Use rebrowser-puppeteer-core (already upgraded in Phase 1)
- Add random delays between ad navigations (1-3 seconds)
- Use realistic user-agent and viewport (already configured)
- Limit request frequency
**Warning signs:** CAPTCHA pages; empty responses; HTTP 429 errors

### Pitfall 4: Stale Ad Archive IDs
**What goes wrong:** Navigation to ad detail page fails with "ad not found"
**Why it happens:** Ad archive IDs from network interception may be outdated or malformed
**How to avoid:**
- Validate ad archive ID format (should be numeric string)
- Handle 404/not-found gracefully
- Use fresh IDs from current page scrape
**Warning signs:** Navigation errors; "content not available" messages

### Pitfall 5: Modal Interaction Failures
**What goes wrong:** "See ad details" button click doesn't open modal or modal content doesn't load
**Why it happens:** Button selector changed; modal loaded asynchronously; element not clickable
**How to avoid:**
- Use multiple selector strategies (aria-label, text content, role)
- Wait for element to be visible and clickable before clicking
- Add delay after click for content to load
- Have fallback: try extracting from page content if modal fails
**Warning signs:** Click succeeds but no new content; element not found errors

## Code Examples

Verified patterns from existing codebase and research:

### Extracting Demographics from API Response
```typescript
// Based on API response structure from research
interface ApiDemographicDistribution {
  age: string;
  gender: string;
  percentage: string | number;
}

interface ApiRegionDistribution {
  region: string;
  percentage: string | number;
}

function extractDemographicsFromApiResponse(
  data: unknown,
  adId: string
): AdDemographics | null {
  const result: AdDemographics = {
    adId,
    ageGenderBreakdown: [],
    regionBreakdown: [],
  };

  function traverse(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
      return;
    }

    const record = obj as Record<string, unknown>;

    // Look for demographic_distribution field
    if (record.demographic_distribution && Array.isArray(record.demographic_distribution)) {
      for (const demo of record.demographic_distribution as ApiDemographicDistribution[]) {
        result.ageGenderBreakdown.push({
          age: demo.age,
          gender: demo.gender,
          percentage: typeof demo.percentage === 'string'
            ? parseFloat(demo.percentage) * 100
            : demo.percentage,
        });
      }
    }

    // Look for delivery_by_region or region_distribution
    const regionField = record.delivery_by_region || record.region_distribution;
    if (regionField && Array.isArray(regionField)) {
      for (const region of regionField as ApiRegionDistribution[]) {
        result.regionBreakdown.push({
          region: region.region,
          percentage: typeof region.percentage === 'string'
            ? parseFloat(region.percentage) * 100
            : region.percentage,
        });
      }
    }

    // Look for EU-specific fields
    if (typeof record.eu_total_reach === 'number') {
      result.euTotalReach = record.eu_total_reach;
    }

    // Look for impressions range
    if (record.impressions) {
      const imp = record.impressions as { lower_bound?: string; upper_bound?: string };
      result.impressionsLower = imp.lower_bound ? parseInt(imp.lower_bound, 10) : undefined;
      result.impressionsUpper = imp.upper_bound ? parseInt(imp.upper_bound, 10) : undefined;
    }

    // Recurse into nested objects
    Object.values(record).forEach(val => traverse(val));
  }

  traverse(data);

  // Return null if no demographic data found
  if (result.ageGenderBreakdown.length === 0 && result.regionBreakdown.length === 0) {
    return null;
  }

  return result;
}
```

### Graceful Error Handling Pattern
```typescript
// Source: Based on existing error handling in ad-library-scraper.ts

async function scrapeWithGracefulDegradation<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(`[${context}] Operation failed, using fallback:`, error);
    return fallback;
  }
}

// Usage example
const demographics = await scrapeWithGracefulDegradation(
  () => scrapeAdDemographics(page, adId, demographicsMap),
  null,
  `scrape-demographics-${adId}`
);

if (demographics) {
  results.push(demographics);
}
// Continue to next ad regardless of success/failure
```

### Click with Multiple Fallback Selectors
```typescript
// Handle Facebook's changing DOM selectors
async function clickWithFallbacks(
  page: Page,
  selectors: string[],
  description: string
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return true;
      }
    } catch {
      // Selector failed, try next
    }
  }
  console.warn(`Could not find clickable element for: ${description}`);
  return false;
}

// Usage for "See ad details" button
const seeDetailsSelectors = [
  'div[role="button"][aria-label*="See ad details"]',
  'div[role="button"]:has-text("See ad details")',
  'span:has-text("See ad details")',
  '[data-testid="ad_details_button"]',
];

const clicked = await clickWithFallbacks(page, seeDetailsSelectors, 'See ad details button');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM scraping for ad data | Network response interception | 2024 | More stable; less affected by UI changes |
| puppeteer-extra-plugin-stealth | rebrowser-puppeteer-core | Feb 2025 | Required for Facebook; stealth plugin detected |
| Scraping all ads | Top-performer selection | Standard practice | Efficient use of timeout budget |
| Single selector strategy | Multiple fallback selectors | Standard practice | Resilient to DOM changes |

**Deprecated/outdated:**
- **CSS selector-based scraping:** Facebook changes classes frequently; use network interception
- **Full-page scraping:** Timeout constraints require focused extraction; select top performers

## Open Questions

Things that couldn't be fully resolved:

1. **Exact API Response Structure**
   - What we know: Fields include `demographic_distribution`, `delivery_by_region`, `eu_total_reach`
   - What's unclear: Exact JSON nesting structure may vary; need runtime inspection
   - Recommendation: Log first successful response to debug; build flexible traversal

2. **"See ad details" Button Reliability**
   - What we know: Button exists for EU ads; clicking loads additional data
   - What's unclear: Whether clicking is always necessary or if data loads on page visit
   - Recommendation: Try extracting from page load first; fall back to clicking if needed

3. **Rate Limiting Thresholds**
   - What we know: Facebook rate limits aggressive scraping
   - What's unclear: Exact thresholds and how they apply to Ad Library
   - Recommendation: Start conservative (2-3s delays); monitor for 429s or CAPTCHAs

4. **Non-EU Ad Demographics Availability**
   - What we know: EU/UK ads have full demographics; political/issue ads globally have demographics
   - What's unclear: What data is available for non-EU commercial ads
   - Recommendation: Handle gracefully; report "demographics unavailable" to user

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/ad-library-scraper.ts` - Network interception pattern, error handling
- [Facebook Ads Library API Complete Guide](https://admanage.ai/blog/facebook-ads-library-api) - API field structure, EU-specific fields
- [Data Knowledge Hub: Meta Ads Collection](https://data-knowledge-hub.com/docs/data-collection/03_00_platform-specific%20guidelines/03_04_data-collection_meta_ads/) - Demographic distribution structure

### Secondary (MEDIUM confidence)
- [Meta Ad Library Tools](https://transparency.meta.com/researchtools/ad-library-tools/) - Official transparency data overview
- [Puppeteer Network Response Analysis](https://latenode.com/blog/network-response-analysis-and-processing-in-puppeteer-monitoring-and-modification) - Response interception patterns
- [ScrapeOps: Puppeteer Error Handling](https://scrapeops.io/puppeteer-web-scraping-playbook/nodejs-puppeteer-beginners-guide-part-4/) - Graceful degradation patterns
- [fb_ad_scraper GitHub](https://github.com/ChrisFeldmeier/fb_ad_scraper) - Demographic breakdown data structure example

### Tertiary (LOW confidence)
- [Apify Facebook Ads Library Scraper](https://apify.com/curious_coder/facebook-ads-library-scraper) - EU transparency scraping capability exists
- WebSearch findings on DOM selectors - Facebook changes frequently; verify at runtime

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; extending existing patterns
- Architecture: MEDIUM - Network interception proven; ad detail navigation needs validation
- Pitfalls: HIGH - Common scraping challenges are well-documented
- Code examples: MEDIUM - Based on research; runtime validation recommended

**Research date:** 2026-01-18
**Valid until:** 2026-02-01 (14 days - Facebook may change UI/API)

---

## Implementation Guidance for Planner

### Critical Path
1. **Extend AdData interface** - Add fields for demographics, reach, start date
2. **Capture ad archive IDs** - Already partially done; ensure we get `ad_archive_id` for all ads
3. **Implement top performer selection** - Sort by reach/duration, take top N
4. **Add demographic extraction function** - Parse demographics from API responses
5. **Navigate to ad detail pages** - Loop through top performers, extract demographics
6. **Handle missing data gracefully** - Track success/failure, continue on errors

### Estimated Effort
- Extending data types: 30 minutes
- Top performer selection: 1 hour
- Demographic extraction: 2-3 hours
- Navigation and orchestration: 2 hours
- Error handling and testing: 2 hours
- **Total: 7-9 hours**

### Risk Assessment
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Facebook changes API response format | Medium | Flexible traversal; log responses for debugging |
| Detection/blocking | Low-Medium | rebrowser helps; add delays; limit request count |
| Timeout issues | Medium | Limit to top 5-10 ads; monitor elapsed time |
| Empty demographic data | High for non-EU ads | Graceful handling; user feedback on data availability |
