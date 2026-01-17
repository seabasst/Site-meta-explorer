# Codebase Concerns

**Analysis Date:** 2026-01-18

## Tech Debt

**Duplicate Server Action:**
- Issue: `scrapeAdLibraryAction` in `src/actions/scrape-ad-library.ts` duplicates the API route functionality in `src/app/api/scrape-ads/route.ts`. The server action is not currently used - page.tsx uses the API route directly.
- Files: `src/actions/scrape-ad-library.ts`, `src/app/api/scrape-ads/route.ts`
- Impact: Maintenance burden - changes to scraping logic need to be considered for both files
- Fix approach: Remove unused server action or consolidate to single entry point

**Unused Component:**
- Issue: `URLForm` component exists but is not imported anywhere in the codebase. The form functionality is implemented directly in `src/app/page.tsx`.
- Files: `src/components/url-form.tsx`
- Impact: Dead code increases codebase size, potential confusion for maintainers
- Fix approach: Delete `src/components/url-form.tsx` or refactor page.tsx to use it

**Hardcoded Chromium URL:**
- Issue: Chromium binary download URL is hardcoded with a specific version (v143.0.4) that will become outdated
- Files: `src/lib/ad-library-scraper.ts` (line 5-6)
- Impact: Version lock may cause compatibility issues or security vulnerabilities over time
- Fix approach: Move to environment variable or package.json configuration

**Large Page Component:**
- Issue: `src/app/page.tsx` is 579 lines with mixed concerns (UI components, state management, data processing)
- Files: `src/app/page.tsx`
- Impact: Hard to test, hard to maintain, slow to understand
- Fix approach: Extract `HowItWorksSection`, `LoadingSpinner`, ad library form section, and results summary into separate components

**Large Results Table Component:**
- Issue: `src/components/results-table.tsx` is 458 lines handling multiple table views with complex sorting/filtering logic
- Files: `src/components/results-table.tsx`
- Impact: Difficult to maintain and test individual table features
- Fix approach: Extract sorting logic to custom hook, split advertised vs sitemap table views into separate components

## Known Bugs

**Sort by Ad Count Does Not Sort:**
- Symptoms: Clicking "Ad Count" column header does nothing meaningful - falls through to URL alphabetical sort
- Files: `src/components/results-table.tsx` (lines 120-122)
- Trigger: Click "Ad Count" column header when viewing sitemap URLs
- Workaround: None - sorting by ad count is effectively broken

```typescript
// Line 120-122 shows the bug:
case 'adCount':
  comparison = a.path.localeCompare(b.path); // Should sort by ad count, not path
  break;
```

**Inconsistent Font Loading:**
- Symptoms: Layout loads Geist fonts via next/font but globals.css imports DM Sans and Instrument Serif via Google Fonts CDN
- Files: `src/app/layout.tsx`, `src/app/globals.css`
- Trigger: Page load - results in font flash or unused font downloads
- Workaround: None - fonts load but may cause performance overhead

## Security Considerations

**No Rate Limiting:**
- Risk: API endpoint `/api/scrape-ads` launches Puppeteer browser - resource-intensive operation with no rate limiting
- Files: `src/app/api/scrape-ads/route.ts`
- Current mitigation: None
- Recommendations: Add rate limiting middleware, implement request queuing, or add CAPTCHA for abuse prevention

**No Input Sanitization on Sitemap URLs:**
- Risk: User-provided URLs are passed directly to fetch() without comprehensive validation
- Files: `src/lib/sitemap-parser.ts` (line 44), `src/actions/analyze-sitemap.ts`
- Current mitigation: Basic URL protocol check (http/https)
- Recommendations: Add URL allowlist/blocklist, implement timeout limits, validate against SSRF attacks

**Debug Mode Writes to Filesystem:**
- Risk: Debug mode writes HTML and screenshots to `/tmp` which could be exploited in shared hosting environments
- Files: `src/lib/ad-library-scraper.ts` (lines 290-296)
- Current mitigation: Only enabled in non-production environments
- Recommendations: Remove filesystem writes entirely or use secure temp directories

**External Font CDN Dependency:**
- Risk: External CDN request to Google Fonts could track users or fail, breaking styling
- Files: `src/app/globals.css` (line 1)
- Current mitigation: None
- Recommendations: Self-host fonts or use next/font consistently

## Performance Bottlenecks

**Unoptimized Sitemap Scrolling:**
- Problem: Large sitemaps (thousands of URLs) render all rows in a single table with max-height scroll
- Files: `src/components/results-table.tsx` (line 369)
- Cause: No virtualization - all DOM nodes created regardless of visibility
- Improvement path: Implement react-window or similar virtualized list for large datasets

**Sequential Child Sitemap Fetching:**
- Problem: Child sitemaps are fetched with Promise.allSettled but no concurrency limit
- Files: `src/lib/sitemap-parser.ts` (lines 124-133)
- Cause: Large sitemap indexes could trigger dozens of parallel requests
- Improvement path: Add concurrency limit (e.g., p-limit with max 5 concurrent)

**Aggressive Ad Library Scrolling:**
- Problem: Up to 300 scroll iterations with 800ms waits = potentially 4+ minutes of scraping
- Files: `src/lib/ad-library-scraper.ts` (lines 242-287)
- Cause: No early termination based on expected total ads count
- Improvement path: Use `totalActiveAdsOnPage` to calculate expected completion and terminate early

## Fragile Areas

**XML Regex Parsing:**
- Files: `src/lib/sitemap-parser.ts` (lines 64-83, 92-115)
- Why fragile: Regex-based XML parsing can break on edge cases (CDATA, namespaces, escaped characters)
- Safe modification: Test against diverse real-world sitemaps before changes
- Test coverage: Zero - no test files exist

**Facebook API Response Extraction:**
- Files: `src/lib/ad-library-scraper.ts` (lines 64-123)
- Why fragile: Relies on undocumented Facebook API response structure that can change without notice
- Safe modification: Add comprehensive logging, maintain fallback extraction methods
- Test coverage: Zero - no test files exist

**URL Classification Heuristics:**
- Files: `src/lib/url-classifier.ts` (lines 24-106, 165-207)
- Why fragile: Classification depends on URL pattern matching that varies significantly across e-commerce platforms
- Safe modification: Add platform-specific overrides, log classification decisions for debugging
- Test coverage: Zero - no test files exist

## Scaling Limits

**Vercel Hobby Timeout:**
- Current capacity: 10 second function timeout on Vercel Hobby plan
- Limit: Ad Library scraping requires 60+ seconds, will timeout on Hobby plan
- Scaling path: Requires Vercel Pro plan or background job architecture

**Memory for Large Sitemaps:**
- Current capacity: Holds all URLs in memory during classification
- Limit: Sitemaps with 100k+ URLs may cause memory pressure
- Scaling path: Implement streaming/chunked processing

## Dependencies at Risk

**Puppeteer/Chromium Serverless:**
- Risk: `@sparticuz/chromium-min` is maintained by a single developer, specialized for serverless
- Impact: Breaking changes or abandonment could require major rewrite
- Migration plan: Consider Playwright or browser-as-a-service (Browserless, Puppeteer Cloud)

**Facebook Ad Library Unofficial Access:**
- Risk: Scraping Facebook violates ToS; they can change structure or block access anytime
- Impact: Core feature (ad analysis) could stop working with no notice
- Migration plan: Investigate official Facebook Marketing API access

## Missing Critical Features

**Error Recovery:**
- Problem: No retry logic for failed sitemap or ad library fetches
- Blocks: Transient network errors cause complete failures

**Progress Feedback:**
- Problem: No progress updates during long-running ad library scrapes
- Blocks: Users have no idea if scraping is stuck or progressing

**Export Functionality:**
- Problem: No way to export analysis results
- Blocks: Users cannot save or share findings

## Test Coverage Gaps

**Zero Test Coverage:**
- What's not tested: Entire codebase has no test files
- Files: All files in `src/`
- Risk: Any refactoring could introduce regressions undetected
- Priority: High - especially for `src/lib/sitemap-parser.ts`, `src/lib/url-classifier.ts`, and `src/lib/ad-library-scraper.ts`

**Critical Functions Without Tests:**
- `parseSitemapXML()` - XML parsing edge cases
- `classifyURL()` - URL categorization accuracy
- `extractUrlsFromApiResponse()` - Facebook data extraction reliability
- `isExternalUrl()` - URL filtering correctness

---

*Concerns audit: 2026-01-18*
