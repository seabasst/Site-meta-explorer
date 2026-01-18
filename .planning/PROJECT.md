# Ad Library Demographics Analyzer

## What This Is

A competitor analysis tool that extracts demographic and reach data from Facebook Ad Library. Users enter an Ad Library page URL, and the app scrapes top-performing ads to show aggregated audience breakdowns — countries, age groups, gender splits, and reach metrics.

## Core Value

Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## Requirements

### Validated

- ✓ Ad Library URL input and validation — existing
- ✓ Puppeteer-based scraping infrastructure — existing
- ✓ Ad discovery from Ad Library pages — existing
- ✓ Basic results display with Tailwind styling — existing

### Active

- [ ] Drill into individual ad detail pages to extract demographic data
- [ ] Extract country/region breakdown per ad
- [ ] Extract age group breakdown per ad
- [ ] Extract gender breakdown per ad
- [ ] Extract reach/impressions data per ad
- [ ] Identify top performers (by reach or run duration)
- [ ] Aggregate demographics into summary view
- [ ] Display aggregated demographics in UI

### Out of Scope

- Sitemap analysis — deprioritized, existing code can remain but not the focus
- Per-ad demographic breakdown — aggregated summary only
- Scraping all ads — focus on top performers for efficiency
- Historical tracking — point-in-time analysis only
- Export functionality — display only for v1

## Context

This is a brownfield project built on an existing Next.js app with:
- Next.js 16 with App Router and Server Actions
- Puppeteer + @sparticuz/chromium-min for headless scraping
- Deployed to Vercel (requires Pro for 60s function timeout)
- Current scraper intercepts network responses and extracts destination URLs

The Facebook Ad Library shows demographic data on individual ad detail pages — accessed by clicking into an ad. This data includes geographic reach, age/gender breakdowns, and impression ranges.

## Constraints

- **Runtime:** Vercel serverless with 60-second timeout — must scrape efficiently
- **Rate limiting:** Facebook may throttle or block aggressive scraping — need careful pacing
- **Data availability:** Demographics only available for ads with sufficient reach
- **Tech stack:** Maintain existing Next.js + Puppeteer architecture

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on top performers only | Efficiency — fewer requests, more signal | — Pending |
| Aggregate summary over per-ad details | User need is competitor patterns, not individual ads | — Pending |
| Pivot from sitemap focus | Demographics is the core value now | — Pending |

---
*Last updated: 2026-01-18 after initialization*
