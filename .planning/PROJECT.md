# Ad Library Demographics Analyzer

## What This Is

A competitor analysis tool that extracts demographic and reach data from Facebook Ad Library. Users enter an Ad Library page URL, and the app fetches ad data via Facebook's Graph API to show aggregated audience breakdowns — countries, age groups, gender splits, and reach metrics.

## Core Value

Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## Current Milestone: v1.1 Polish & Preview

**Goal:** Improve the existing experience with better UI, ad previews, and refined visualizations.

**Target features:**
- UI/UX overhaul (visual design, input experience, layout, mobile)
- Ad preview display (images/videos/text from ads)
- Chart improvements (more types, interactivity, formatting)
- Error handling (clear, helpful feedback)
- Export capability (download/save results)

## Requirements

### Validated

- ✓ Ad Library URL input and validation — existing
- ✓ Ad discovery from Ad Library pages — existing
- ✓ Basic results display with Tailwind styling — existing
- ✓ Extract age group breakdown per ad — v1.0
- ✓ Extract gender breakdown per ad — v1.0
- ✓ Extract country/region breakdown per ad — v1.0
- ✓ Extract reach/impressions data per ad — v1.0
- ✓ Weight demographics by reach (not ad count) — v1.0
- ✓ Aggregate demographics into summary view — v1.0
- ✓ Display aggregated demographics in UI — v1.0
- ✓ Visual charts for age/gender and country distribution — v1.0
- ✓ Loading states during analysis — v1.0
- ✓ Configurable analysis depth (100/250/500/1000 ads) — v1.0

### Active

- [ ] Visual design refresh (colors, spacing, typography)
- [ ] Improved input experience and results layout
- [ ] Mobile/responsive support
- [ ] Ad preview display (images, videos, creative text)
- [ ] Enhanced charts (more types, hover/drill-down, better labels)
- [ ] Clear error feedback when operations fail
- [ ] Export/download analysis results

### Out of Scope

- Per-ad demographic breakdown — aggregated summary only
- Historical tracking — point-in-time analysis only
- Export functionality — display only for v1
- Puppeteer-based scraping — removed, using Facebook Graph API

## Context

**Current State:**
- Shipped v1.0 with ~7,700 LOC TypeScript
- Tech stack: Next.js 16, React 19, Recharts, Tailwind CSS
- Uses Facebook Graph API with EU DSA transparency data
- Deployed to Vercel

**Architecture:**
- `/api/facebook-ads` — Graph API integration
- `facebook-api.ts` — API client with demographic aggregation
- `demographic-aggregator.ts` — Weighted demographic combination
- Recharts components for visualization

## Constraints

- **API Rate Limits:** Facebook Graph API has rate limits
- **EU Data Only:** Demographics only available for EU-targeted ads via DSA
- **Tech stack:** Maintain existing Next.js architecture

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Facebook Graph API over browser scraping | More reliable, faster, official data source | ✓ Good |
| Weight demographics by reach | High-reach ads represent more audience | ✓ Good |
| Aggregate summary over per-ad details | User need is competitor patterns, not individual ads | ✓ Good |
| Recharts for visualization | Lightweight, good React integration | ✓ Good |
| Tiered analysis depth (100-1000) | Balance speed vs completeness | ✓ Good |

---
*Last updated: 2026-01-25 after v1.1 milestone started*
