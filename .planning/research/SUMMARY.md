# Research Summary

**Project:** Facebook Ad Library Demographics Analyzer
**Domain:** Web scraping / Ad data aggregation
**Researched:** 2026-01-18

## Key Insight

**Demographic data is only reliably available for EU/UK-targeted ads and political ads globally.** This is the single most important discovery. The tool must either scope to EU advertisers, use the official API (requires identity verification), or accept that non-EU/non-political ads will have limited demographic data. The browser scraping approach works for ad discovery but demographic extraction requires either API access or targeting EU advertisers where DSA mandates transparency.

## Stack Recommendation

**Hybrid approach: Official API + Enhanced Browser Scraping**

- **Official Ad Library API:** For EU/UK demographic data. Requires identity verification (1-2 days), 200 calls/hour rate limit. Provides structured `demographic_distribution`, `delivery_by_region`, and reach data.
- **rebrowser-puppeteer-core:** Replace current `puppeteer-core` for anti-detection. `puppeteer-extra-plugin-stealth` is deprecated (Feb 2025) and actively detected by Cloudflare/DataDome.
- **Existing stack (Next.js, Tailwind, @sparticuz/chromium-min):** Already correctly configured for Vercel serverless.

**Critical versions:**
- `rebrowser-puppeteer-core@24.8.1` (May 2025, actively maintained)
- Facebook Graph API v23.0

## Table Stakes Features

These are non-negotiable for a usable product:

1. **URL input with validation** - Handle Ad Library URL variations
2. **Ad discovery from page** - Already implemented in current scraper
3. **Demographic breakdown display** - Age, gender, region percentages
4. **Loading/progress indication** - Critical for 60s operations
5. **Error handling with clear messages** - Rate limits, missing data, invalid URLs
6. **Top performer identification** - By reach or ad duration

**Key differentiator:** Aggregated demographic summary across multiple ads. No competitor does this. Current tools show per-ad data; this tool should answer "What audience does this competitor reach across their top ads?"

## Critical Pitfalls

**1. Demographics API-only for non-EU ads**
- Demographic data only accessible via API for EU/political ads
- Visual charts on page not reliably extractable via scraping
- **Prevention:** Validate data availability before building; scope to EU advertisers or use API

**2. 60-second Vercel timeout vs multi-page drilling**
- Current scraper uses ~30-40s for ad discovery
- Each ad detail page needs ~6s (navigation + wait + extraction)
- **Prevention:** Limit to top 3-5 ads; use parallel tabs; consider two-stage architecture

**3. Random CSS class names break selectors**
- Facebook uses obfuscated, randomized class names that change weekly
- **Prevention:** Use network interception (current approach); avoid DOM selectors; match by text content or ARIA roles

**4. IP blocking and rate limiting**
- Aggressive scraping triggers blocks, CAPTCHAs
- Vercel shared IPs may already be flagged
- **Prevention:** Add stealth plugin (rebrowser); realistic delays (1-3s); limit to 5-10 ads per request

## Architecture Notes

**Two-phase scraping within single request:**

1. **Ad Discovery (existing):** Scroll, intercept GraphQL responses, extract ad IDs + destination URLs
2. **Demographic Extraction (new):** Reuse browser session, drill into top N ad detail pages, extract EU Transparency data

**New modules needed:**
- `lib/demographic-scraper.ts` - Per-ad detail page scraping
- `lib/demographic-aggregator.ts` - Combine per-ad data into summary
- `lib/types/demographics.ts` - TypeScript interfaces
- `components/demographics-panel.tsx` - UI display

**Key patterns:**
- Reuse browser instance across all operations (no new browser per ad)
- Use `Promise.allSettled` not `Promise.all` (one ad failure should not fail batch)
- Batch 3-5 concurrent ad detail fetches
- Use `domcontentloaded` + explicit waits, not `networkidle0`

**Build order:** Interfaces -> Scraper skeleton -> Navigation -> Extraction -> Batching -> Aggregator -> API integration -> UI

## Open Questions

1. **API access timeline:** Identity verification takes 1-2 days. Should we block on API or build scraping first?

2. **Geographic scope:** Is the tool targeting EU advertisers only, or global advertisers with degraded experience for non-EU?

3. **Accuracy vs speed tradeoff:** With 60s timeout, how many ads should be analyzed? 3-5 is safe, 10+ risks timeouts.

4. **Background processing need:** If users want 50+ ads analyzed, requires architecture change (job queue, polling). Is this MVP?

5. **Data freshness expectations:** Ad Library data is near-real-time. Do users expect cached results or always-fresh scrapes?

---
*Research completed: 2026-01-18*
*Ready for roadmap: yes*
