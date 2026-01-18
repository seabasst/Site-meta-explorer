# Stack Research: Facebook Ad Library Demographic Extraction

**Project:** Competitor Analysis Tool - Demographic Data Extraction
**Researched:** 2026-01-18
**Domain:** Facebook Ad Library scraping with demographic/reach data

## Executive Summary

There are **two distinct approaches** for extracting demographic data from Facebook Ad Library:

1. **Official API** - Structured data, rate-limited (200 calls/hour), requires identity verification, only works for EU/UK ads or political ads globally
2. **Browser Scraping** - Can extract from all ads, but requires anti-detection measures and is subject to terms of service concerns

**Recommendation:** Use a **hybrid approach** - Official API for EU/UK ads (reliable, structured data), browser scraping for ad detail pages when API is insufficient.

---

## Recommended Approach

### Primary: Official Facebook Ad Library API (for EU/UK demographics)

**Why:** The API provides structured demographic data (`demographic_distribution`, `delivery_by_region`, `eu_total_reach`) without anti-bot concerns. For EU/UK-targeted ads, this is the cleanest approach.

**Confidence:** HIGH (verified via official Meta documentation patterns)

#### Setup Requirements

| Step | Description | Time |
|------|-------------|------|
| 1. Identity Verification | Submit government ID at facebook.com/ID | 1-2 days |
| 2. Developer Account | Register at developers.facebook.com | Same day |
| 3. Create App | Create "Consumer" type app (no App Review needed) | 5 min |
| 4. Generate Token | Use Graph API Explorer, extend to 60 days | 10 min |

#### API Endpoint

```
GET https://graph.facebook.com/v23.0/ads_archive
  ?search_terms={query}
  &ad_reached_countries=['GB','DE','FR']
  &fields=id,page_name,page_id,ad_delivery_start_time,ad_delivery_stop_time,demographic_distribution,delivery_by_region,eu_total_reach,impressions,spend,target_ages,target_gender,target_locations
  &access_token={TOKEN}
```

#### Key Limitations

- **Rate limit:** 200 calls/hour
- **Geographic scope:** Only EU/UK ads show demographics; political ads globally
- **Data precision:** Spend/impressions given as ranges, not exact values
- **No direct ID lookup:** Cannot query specific ad by Library ID

### Secondary: Enhanced Browser Scraping (for non-EU ads or detail expansion)

**Why:** Your existing Puppeteer setup already intercepts GraphQL responses. For ads outside EU/UK or when you need additional detail page data, enhanced scraping is required.

**Confidence:** MEDIUM (approach is sound but anti-detection landscape shifts frequently)

#### Recommended Library: rebrowser-puppeteer-core

**Why rebrowser over puppeteer-stealth:**
- `puppeteer-extra-plugin-stealth` is **no longer actively maintained** (as of Feb 2025)
- Cloudflare and DataDome specifically detect puppeteer-stealth patterns now
- rebrowser-patches fix the `Runtime.Enable` CDP leak that modern anti-bot systems detect

```bash
# Replace existing puppeteer-core
npm uninstall puppeteer-core
npm install rebrowser-puppeteer-core@24.8.1
```

**Or use npm aliasing in package.json:**
```json
{
  "dependencies": {
    "puppeteer-core": "npm:rebrowser-puppeteer-core@^24.8.1"
  }
}
```

**Confidence:** HIGH for the rebrowser approach (actively maintained, version 24.8.1 released May 2025)

#### Alternative: puppeteer-real-browser

If you need more comprehensive anti-detection (including cursor movement simulation):

```bash
npm install puppeteer-real-browser
```

**Note:** Requires `xvfb` on Linux for headless mode. The library is currently community-maintained after the original author stepped back in Feb 2026.

---

## Data Formats

### API Response: demographic_distribution

```json
{
  "data": [{
    "id": "1234567890",
    "page_name": "Competitor Brand",
    "demographic_distribution": [
      { "age": "18-24", "gender": "female", "percentage": "0.08" },
      { "age": "18-24", "gender": "male", "percentage": "0.12" },
      { "age": "25-34", "gender": "female", "percentage": "0.22" },
      { "age": "25-34", "gender": "male", "percentage": "0.18" },
      { "age": "35-44", "gender": "female", "percentage": "0.15" },
      { "age": "35-44", "gender": "male", "percentage": "0.10" },
      { "age": "45-54", "gender": "female", "percentage": "0.06" },
      { "age": "45-54", "gender": "male", "percentage": "0.04" },
      { "age": "55-64", "gender": "female", "percentage": "0.03" },
      { "age": "55-64", "gender": "male", "percentage": "0.02" },
      { "age": "65+", "gender": "unknown", "percentage": "0.00" }
    ],
    "delivery_by_region": [
      { "region": "England", "percentage": "0.65" },
      { "region": "Scotland", "percentage": "0.15" },
      { "region": "Wales", "percentage": "0.12" },
      { "region": "Northern Ireland", "percentage": "0.08" }
    ],
    "eu_total_reach": "1500000",
    "impressions": { "lower_bound": "1000000", "upper_bound": "2000000" },
    "spend": { "lower_bound": "5000", "upper_bound": "10000" },
    "target_ages": "25-54",
    "target_gender": "All",
    "target_locations": [
      { "name": "United Kingdom", "type": "country" }
    ]
  }]
}
```

### GraphQL Response (Browser Scraping)

When intercepting `/api/graphql` responses, demographic data appears in nested structures. Look for these fields:

```javascript
// Fields to extract from intercepted responses
const demographicFields = [
  'demographic_distribution',
  'delivery_by_region',
  'age_country_gender_reach_breakdown',
  'eu_total_reach',
  'br_total_reach',  // Brazil-specific
  'target_ages',
  'target_gender',
  'target_locations',
  'estimated_audience_size',
  'impressions_with_index',
  'spend'
];
```

### TypeScript Interface (Recommended)

```typescript
interface DemographicSegment {
  age: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
  gender: 'male' | 'female' | 'unknown';
  percentage: string; // "0.15" format
}

interface RegionSegment {
  region: string;
  percentage: string;
}

interface AdDemographics {
  adId: string;
  demographics: DemographicSegment[];
  regions: RegionSegment[];
  euTotalReach: number | null;
  impressions: { lower: number; upper: number } | null;
  spend: { lower: number; upper: number; currency: string } | null;
  targetAges: string | null;
  targetGender: string | null;
  targetLocations: Array<{ name: string; type: string }>;
}
```

---

## Anti-Detection Considerations

### Rate Limiting Strategy

| Source | Limit | Mitigation |
|--------|-------|------------|
| Official API | 200 calls/hour | Batch requests, cache responses, use pagination efficiently |
| Browser Scraping | Undisclosed | See below |

### Browser Scraping Anti-Detection

**1. Request Timing**
```typescript
// Add random delays between actions
const randomDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Between page loads: 2-5 seconds
await randomDelay(2000, 5000);

// Between scrolls: 800-1500ms
await randomDelay(800, 1500);

// Between clicks: 300-800ms
await randomDelay(300, 800);
```

**2. Session Management**
```typescript
// Rotate user agents per session
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  // Add 5-10 realistic user agents
];

// Don't reuse sessions for more than 50-100 ads
```

**3. IP Rotation (for production)**
- Residential proxies recommended over datacenter
- Rotate IP every 5-15 minutes
- Use proxy providers that support Puppeteer (Bright Data, Oxylabs, etc.)

**4. Behavioral Patterns**
```typescript
// Avoid: Perfectly consistent timing
// Avoid: Scraping same page type repeatedly
// Avoid: Identical action sequences

// Do: Mix read-only browsing with scraping
// Do: Vary scroll patterns
// Do: Include natural pauses
```

### Vercel Timeout Considerations

Your current 60s timeout is tight for demographic extraction. Options:

| Option | Description | Recommendation |
|--------|-------------|----------------|
| Fluid Compute | Up to 800s on Pro | Best for scraping workloads |
| Background Jobs | Use `waitUntil` for post-response work | Good for API calls |
| Chunked Processing | Scrape 5-10 ads per request | Required regardless |
| External Browser | Use Browserless.io or similar | Removes Vercel timeout entirely |

**Recommended approach for demographics:**
```typescript
// Chunk ad IDs, process in batches
export const maxDuration = 60;

async function extractDemographics(adIds: string[]) {
  const BATCH_SIZE = 5; // Process 5 ads per request
  const batches = chunk(adIds, BATCH_SIZE);

  // Return partial results, client continues with next batch
  const results = await processBatch(batches[0]);
  return { results, remaining: batches.slice(1).flat() };
}
```

---

## What to Avoid

### 1. Using puppeteer-extra-plugin-stealth in Production

**Why:** Discontinued Feb 2025, actively detected by Cloudflare/DataDome. Cloudflare has specific signatures for puppeteer-stealth patterns.

**Instead:** Use `rebrowser-puppeteer-core` or `puppeteer-real-browser`

### 2. Scraping Without Rate Limiting

**Why:** Aggressive scraping triggers IP blocks, potentially account restrictions. Facebook ML systems detect behavioral patterns across requests.

**Instead:** Implement exponential backoff, random delays, daily limits

### 3. Storing Access Tokens in Code

**Why:** Tokens are sensitive, expire, and shouldn't be committed

**Instead:** Use environment variables, refresh tokens server-side
```typescript
const token = process.env.FB_AD_LIBRARY_TOKEN;
```

### 4. Expecting Exact Metrics

**Why:** Facebook provides spend/impressions as ranges, not precise values

**Instead:** Store both `lower_bound` and `upper_bound`, display as ranges in UI

### 5. Relying Solely on DOM Scraping

**Why:** Facebook's DOM structure changes frequently, class names are obfuscated

**Instead:** Prioritize API response interception (GraphQL/REST) over DOM parsing. Your current approach of intercepting `/api/graphql` responses is correct.

### 6. Single Long-Running Scrape Sessions

**Why:**
- Vercel timeout (60s max on Pro)
- Higher detection risk for long sessions
- Memory issues with Puppeteer

**Instead:** Chunk into 5-10 ad batches, implement resumable scraping

### 7. Ignoring EU/Political Ad API Access

**Why:** If targeting EU advertisers, the API is significantly more reliable than scraping

**Instead:** Check if competitor ads are EU-targeted before deciding approach

---

## Implementation Checklist

### Phase 1: API Integration (EU/UK Demographics)

- [ ] Complete identity verification at facebook.com/ID
- [ ] Create developer app at developers.facebook.com
- [ ] Generate and extend access token (60 days)
- [ ] Implement `/api/ad-demographics` endpoint using Graph API
- [ ] Add token refresh mechanism
- [ ] Handle rate limiting (200 calls/hour)

### Phase 2: Enhanced Browser Scraping

- [ ] Replace `puppeteer-core` with `rebrowser-puppeteer-core`
- [ ] Add demographic field extraction to GraphQL response parser
- [ ] Implement random delay patterns
- [ ] Add batch processing (5-10 ads per request)
- [ ] Test detection bypass locally before deploying

### Phase 3: Hybrid Logic

- [ ] Detect if ad is EU-targeted (use API)
- [ ] Fall back to browser scraping for non-EU ads
- [ ] Implement caching layer (don't re-fetch unchanged data)
- [ ] Add monitoring for rate limits and blocks

---

## Confidence Assessment

| Component | Confidence | Reasoning |
|-----------|------------|-----------|
| Official API fields/format | HIGH | Verified via Meta documentation and multiple scrapers |
| API rate limits (200/hour) | HIGH | Consistently documented across sources |
| rebrowser-puppeteer-core recommendation | HIGH | Active maintenance, version 24.8.1 May 2025 |
| puppeteer-stealth deprecation | HIGH | Multiple sources confirm Feb 2025 discontinuation |
| Anti-detection patterns | MEDIUM | Landscape shifts; current best practices may change |
| Vercel timeout workarounds | HIGH | Verified via official Vercel documentation |
| GraphQL response structure | MEDIUM | Based on scraper implementations; Facebook may change |

---

## Sources

### Official/Authoritative
- [Facebook Ad Library API Guide (AdManage)](https://admanage.ai/blog/facebook-ads-library-api) - Comprehensive 2025 API documentation
- [APIs for Social Scientists - Facebook Ad Library](https://paulcbauer.github.io/apis_for_social_scientists_a_review/facebook-ad-library-api.html) - Academic review with code examples
- [Vercel Serverless Timeout Guide](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) - Official timeout documentation

### Technical References
- [rebrowser-patches GitHub](https://github.com/rebrowser/rebrowser-patches) - Anti-detection patches documentation
- [rebrowser-puppeteer GitHub](https://github.com/rebrowser/rebrowser-puppeteer) - Drop-in puppeteer replacement
- [minimaxir/facebook-ad-library-scraper](https://github.com/minimaxir/facebook-ad-library-scraper) - Reference Python implementation

### Anti-Detection Research
- [Castle.io - Puppeteer Stealth to Nodriver Evolution](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/) - Framework evolution analysis
- [ZenRows - Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection) - Current detection bypass methods
- [BrightData - Puppeteer Real Browser Guide](https://brightdata.com/blog/web-data/puppeteer-real-browser) - Anti-bot scraping techniques

### Third-Party Tools (Reference)
- [Apify Facebook Ads Library Scraper](https://apify.com/curious_coder/facebook-ads-library-scraper) - Commercial scraping solution
