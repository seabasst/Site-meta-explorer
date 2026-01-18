# Pitfalls Research: Facebook Ad Library Demographic Scraping

**Project:** Ad Library Demographics Analyzer
**Researched:** 2026-01-18
**Confidence:** MEDIUM (based on community reports, some official documentation)

## Critical Pitfalls

These will break the project or cause significant rework if not addressed.

---

### Pitfall 1: Demographic Data Only Available via API for EU/Political Ads

**What goes wrong:** Teams assume they can scrape demographic breakdowns (age, gender, region) from any ad's detail page via browser automation. In reality, the demographic distribution data is only programmatically accessible through the official Ad Library API, and the API only returns this data for:
- Ads running in the European Union
- Political/social issue ads (globally)

For non-EU, non-political ads, demographic data may appear visually on the page but is not reliably extractable.

**Why it happens:** The visual Ad Library UI shows demographic charts, but these are rendered client-side from API data that isn't exposed in the page DOM or network responses in a consistent format.

**Consequences:**
- Scraper works in testing (with EU test data) but fails in production
- Significant scope reduction if targeting US/non-EU advertisers
- May need to pivot to API-based approach entirely

**Warning signs:**
- Demographic data appears in UI but not in intercepted network responses
- Empty demographic fields for certain advertisers
- Inconsistent data between ad pages

**Prevention:**
1. **Validate data availability first** - Before building scraping logic, manually inspect network traffic for target advertiser types to confirm demographic data is present
2. **Consider API-first approach** - If demographics are critical, apply for API access (24-48 hour approval, requires ID verification)
3. **Scope to EU advertisers** - If using browser scraping, focus on EU advertisers where demographic data is mandated by DSA (Digital Services Act)

**Phase to address:** Phase 0 (Research/Validation) - Confirm data availability before implementation

**Sources:**
- [Facebook Ads Library API Guide 2025](https://admanage.ai/blog/facebook-ads-library-api)
- [Swipekit Meta Ad Library API Guide](https://swipekit.app/articles/meta-ad-library-api)

---

### Pitfall 2: 60-Second Timeout vs Multi-Page Drilling

**What goes wrong:** Drilling into individual ad detail pages to extract demographics requires multiple page navigations. With Vercel's 60-second timeout (even on Pro), scraping more than a handful of ad detail pages is impossible.

Current scraper scrolls through list page (already consuming ~30-40 seconds for large advertisers). Adding drill-in navigation per ad will exceed timeout for any meaningful sample size.

**Why it happens:** Each ad detail page requires:
- Navigation (~2-3 seconds)
- Wait for dynamic content (~2-3 seconds)
- Data extraction (~1 second)
- Return navigation or new tab overhead

At ~6 seconds per ad, only ~3-5 ads can be processed after initial page load.

**Consequences:**
- Only top 3-5 ads get demographic data
- Timeout errors for advertisers with many ads
- Inconsistent results (sometimes works, sometimes fails)

**Warning signs:**
- Intermittent 504 Gateway Timeout errors
- Successful runs return fewer ads than expected
- Debug logs show navigation starting but not completing

**Prevention:**
1. **Prioritize ruthlessly** - Only drill into top 3-5 ads by reach/impressions (already sorted in current scraper)
2. **Parallel tab strategy** - Open multiple ad detail pages in parallel tabs, extract data concurrently
3. **Two-stage architecture** - First request: get ad list + top performer IDs. Second request: drill specific ads (split the work)
4. **Consider queueing** - Use background jobs (Vercel Cron + database) to process ads over multiple invocations

**Phase to address:** Phase 1 (Architecture) - Design timeout-aware drilling strategy

**Sources:**
- [Vercel Puppeteer Deployment Guide](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel)
- [Puppeteer Parallelization Guide](https://advancedweb.hu/how-to-speed-up-puppeteer-scraping-with-parallelization/)

---

### Pitfall 3: Random CSS Class Names Break Selectors

**What goes wrong:** Facebook uses obfuscated, randomized CSS class names (e.g., `x1lliihq x6ikm8r x10wlt62`). Any scraper using class-based selectors will break when Facebook rebuilds their frontend (happens frequently, often weekly).

**Why it happens:** Facebook's React build process generates hash-based class names for CSS-in-JS. These change on every build. Additionally, Facebook intentionally avoids adding stable identifiers to make scraping harder.

**Consequences:**
- Scraper works today, fails tomorrow
- Constant maintenance burden
- False negatives ("no ads found" when ads exist)

**Warning signs:**
- Scraper suddenly returns empty results
- Class names in error logs don't match current page source
- Elements found in browser DevTools aren't found by Puppeteer

**Prevention:**
1. **Avoid class-based selectors entirely** - Use structural selectors based on element hierarchy, ARIA roles, or data attributes
2. **Use text content matching** - Select elements by their visible text (more stable than classes)
3. **Intercept network responses** - Extract data from API responses (like current scraper does) rather than DOM
4. **Build selector fallbacks** - Try multiple selector strategies, fail gracefully
5. **Monitor for breakage** - Add health checks that verify expected elements exist

**Example - DO:**
```typescript
// Good: Select by role and text content
await page.$$eval('[role="button"]', buttons =>
  buttons.filter(b => b.textContent?.includes('See ad details'))
);

// Good: Extract from network responses (current approach)
page.on('response', async (response) => {
  if (response.url().includes('/api/graphql')) {
    const json = await response.json();
    // Extract from structured API data
  }
});
```

**Example - DON'T:**
```typescript
// Bad: Class-based selector will break
await page.$('.x1lliihq.x6ikm8r.x10wlt62');
```

**Phase to address:** Phase 1 (Implementation) - Use network interception, avoid DOM selectors

**Sources:**
- [Geek Culture: Bypass CSS Class Name Changes](https://medium.com/geekculture/bypass-scraping-websites-that-has-css-class-names-change-frequently-d4877ecd6d8f)
- [n8n Community: Facebook Ads Library Scraper Issues](https://community.n8n.io/t/facebook-ads-library-scraper/52297)

---

### Pitfall 4: IP Blocking and Rate Limiting

**What goes wrong:** Aggressive scraping triggers Facebook's anti-bot detection, resulting in:
- Temporary IP blocks (hours to days)
- CAPTCHAs that halt scraping
- Account restrictions if using authenticated sessions
- "You're Temporarily Blocked" errors

**Why it happens:** Facebook monitors request patterns and blocks scrapers that:
- Make too many requests from single IP
- Navigate too quickly between pages
- Lack human-like interaction patterns
- Have detectable automation fingerprints

**Consequences:**
- Scraper works during development, fails in production
- Vercel's shared IPs may already be flagged
- Users see intermittent failures
- Complete blocking requires waiting or IP change

**Warning signs:**
- CAPTCHA challenges appearing
- "Please verify you're not a robot" messages
- Empty responses from pages that previously worked
- 429 (Too Many Requests) status codes

**Prevention:**
1. **Use puppeteer-extra with stealth plugin** - Masks automation fingerprints
2. **Add realistic delays** - Random delays between actions (1-3 seconds)
3. **Limit request volume** - Cap at 5-10 ad detail pages per invocation
4. **Use residential proxies** - If scaling, rotate through residential IPs (not data center IPs)
5. **Mimic human behavior** - Add scrolling, mouse movements, varied timing
6. **Session persistence** - Reuse cookies between sessions to appear as returning user

**Current scraper status:** Uses basic user agent spoofing but no stealth plugin or delays between navigations. Vulnerable to detection at scale.

**Phase to address:** Phase 1 (Implementation) - Add stealth mode and rate limiting

**Sources:**
- [ZenRows: Puppeteer Avoid Detection](https://www.zenrows.com/blog/puppeteer-avoid-detection)
- [BestEver: Facebook Ad Library Scrapers 2025](https://www.bestever.ai/post/facebook-ad-library-scraper)

---

## Common Mistakes

These slow you down but won't kill the project.

---

### Mistake 1: Not Using puppeteer-core + @sparticuz/chromium-min

**What goes wrong:** Using full `puppeteer` package exceeds Vercel's 250MB bundle size limit.

**Current status:** Project already uses `puppeteer-core` + `@sparticuz/chromium-min` correctly.

**Prevention:** Already addressed in existing codebase. Maintain this pattern.

**Phase:** N/A (already handled)

---

### Mistake 2: Opening New Browser Instance Per Ad

**What goes wrong:** Each ad detail page opens a new browser instance instead of reusing the existing one. This:
- Wastes 5-10 seconds on browser launch per ad
- Consumes excessive memory
- Quickly exceeds timeout

**Prevention:**
1. **Reuse single browser instance** - Open multiple tabs, don't launch new browsers
2. **Use puppeteer-cluster** - Manages tab pool and error recovery
3. **Close tabs immediately after extraction** - Don't accumulate open tabs

**Phase to address:** Phase 1 (Implementation)

---

### Mistake 3: Waiting for networkidle0

**What goes wrong:** Using `waitUntil: 'networkidle0'` (zero network requests for 500ms) on Facebook pages causes indefinite hangs because Facebook constantly polls for updates.

**Current status:** Scraper uses `networkidle2` which is better but still risks slowdowns.

**Prevention:**
1. **Use `domcontentloaded` + explicit waits** - Wait for specific elements rather than network silence
2. **Set aggressive timeouts** - Cap page load at 15-20 seconds
3. **Use `waitForSelector` with timeout** - Wait for the specific data element needed

**Phase to address:** Phase 1 (Implementation)

---

### Mistake 4: Assuming Demographic Data Structure is Stable

**What goes wrong:** Hardcoding expectations about demographic data format (e.g., exact age brackets, percentage precision) when Facebook can change these at any time.

**Prevention:**
1. **Parse flexibly** - Use pattern matching, not exact string matching
2. **Handle missing fields gracefully** - Return partial data if some demographics unavailable
3. **Log structure changes** - Monitor for format changes in production

**Phase to address:** Phase 2 (Data extraction)

---

### Mistake 5: Not Handling "No Demographic Data" Cases

**What goes wrong:** Not all ads have demographic data. Ads with low reach, recently started ads, or certain ad types may show "Not enough data" in the UI. Scraper fails or returns incorrect data.

**Prevention:**
1. **Detect "no data" states** - Check for "Not enough data" text or empty charts
2. **Return null, not error** - Missing demographics for one ad shouldn't fail entire request
3. **Document in UI** - Show users which ads had available demographics vs not

**Phase to address:** Phase 2 (Data extraction)

---

## Facebook-Specific Issues

Quirks unique to Facebook Ad Library that aren't obvious.

---

### Issue 1: Dynamic Content Loading on Scroll

**What it is:** Ad Library uses infinite scroll with lazy loading. Ads and their data only load as user scrolls. Initial page load contains minimal data.

**Impact:** Current scraper handles this with scroll loop. Same pattern needed for detail pages.

**Note:** Current implementation scrolls aggressively (up to 300 iterations). This is appropriate.

---

### Issue 2: GraphQL Response Fragmentation

**What it is:** Facebook's API responses are fragmented across multiple GraphQL calls. Demographic data may arrive in a separate response from ad creative data.

**Impact:** Network interception must capture multiple response types and correlate them.

**Mitigation:** Current scraper intercepts multiple endpoint patterns (`/api/graphql`, `/ads/library/async`). Extend to capture demographic-specific endpoints.

---

### Issue 3: Ad Detail Page URL Structure

**What it is:** Ad detail pages use format: `https://www.facebook.com/ads/library/?id={ad_id}`

The `ad_id` is extracted from current scraper's API interception (`ad_archive_id` field).

**Impact:** Drilling requires constructing these URLs from captured IDs.

**Current status:** Scraper already extracts `ad_archive_id` and constructs `adLibraryLinks`. This is correct.

---

### Issue 4: EU vs Non-EU Data Availability

**What it is:** Due to Digital Services Act (DSA), EU-targeted ads are required to show demographic distribution. Non-EU ads may not have this data visible.

**Impact:** Tool may only work reliably for EU advertisers.

**Mitigation:**
- Document limitation clearly in UI
- Detect user's target region and warn if non-EU
- Consider filtering to EU countries in initial search

---

### Issue 5: Political Ad October 2025 Sunset (EU)

**What it is:** As of October 2025, Meta stopped accepting new political/electoral ads in the EU. The Ad Library still contains historical data but won't have new EU political ads.

**Impact:** If targeting political advertisers in EU, data will be increasingly stale.

**Mitigation:** Document limitation. Focus on commercial advertisers.

---

## Prevention Strategies Summary

| Pitfall | Strategy | Phase |
|---------|----------|-------|
| Demographics API-only | Validate data availability before build | 0 |
| 60s timeout | Limit to top 3-5 ads, parallel tabs | 1 |
| Random CSS classes | Network interception, avoid DOM selectors | 1 |
| IP blocking | Stealth plugin, delays, limits | 1 |
| New browser per ad | Reuse browser, tab pool | 1 |
| networkidle0 hang | domcontentloaded + explicit waits | 1 |
| Unstable data format | Flexible parsing, graceful degradation | 2 |
| Missing demographic data | Null handling, UI messaging | 2 |

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|----------------|------------|
| Research/Validation | Demographics not available for target advertisers | Manual inspection of network traffic first |
| Architecture | Timeout constraints | Design for 3-5 ads max per request |
| Implementation | Detection/blocking | Add stealth plugin, realistic delays |
| Data extraction | Format changes | Flexible parsing, version monitoring |
| UI/Integration | Empty states | Clear messaging for partial/missing data |

---

## Confidence Assessment

| Finding | Confidence | Source |
|---------|------------|--------|
| API-only demographics for non-EU | MEDIUM | Multiple community reports, official API docs |
| 60s timeout limit | HIGH | Vercel documentation |
| CSS class randomization | HIGH | Multiple community reports, easily verifiable |
| IP blocking risk | HIGH | Extensive community documentation |
| Stealth plugin effectiveness | MEDIUM | Community reports, may not fully prevent detection |
| Demographic data format | LOW | Not verified against current production |

---

## Sources

- [Facebook Ads Library API Complete Guide 2025](https://admanage.ai/blog/facebook-ads-library-api)
- [BestEver: Facebook Ad Library Scrapers 2025](https://www.bestever.ai/post/facebook-ad-library-scraper)
- [Vercel: Deploying Puppeteer with Next.js](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel)
- [ZenRows: Puppeteer Avoid Detection](https://www.zenrows.com/blog/puppeteer-avoid-detection)
- [ZenRows: Puppeteer Stealth Evasions](https://www.zenrows.com/blog/puppeteer-stealth-evasions-patching)
- [Advanced Web: Puppeteer Parallelization](https://advancedweb.hu/how-to-speed-up-puppeteer-scraping-with-parallelization/)
- [Geek Culture: Bypass CSS Class Name Changes](https://medium.com/geekculture/bypass-scraping-websites-that-has-css-class-names-change-frequently-d4877ecd6d8f)
- [Swipekit: Meta Ad Library API](https://swipekit.app/articles/meta-ad-library-api)
- [GitHub: facebook-scraper Issues](https://github.com/kevinzg/facebook-scraper/issues/409)
- [Gumloop: Facebook Ads Library Scraping Issues](https://forum.gumloop.com/t/facebook-ads-library-scraping-doesnt-work-again/1896)
