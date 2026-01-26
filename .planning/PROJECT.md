# Ad Library Demographics Analyzer

## What This Is

A competitor analysis tool that extracts demographic and reach data from Facebook Ad Library. Users enter an Ad Library page URL, and the app fetches ad data via Facebook's Graph API to show aggregated audience breakdowns — countries, age groups, gender splits, and reach metrics.

## Core Value

Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## Current Milestone: v2.0 Payments & Auth

**Goal:** Monetize the tool with Stripe subscriptions and tiered access, gating premium features behind a Pro plan.

**Target features:**
- User authentication (Google/GitHub OAuth)
- Stripe subscription payments (Free + Pro tiers)
- Tiered feature access (depth limits, feature gating)
- Pro features: ad previews, enhanced charts, export, deeper analysis (500-1000 ads)

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

**Authentication & Payments:**
- [ ] Google OAuth login
- [ ] GitHub OAuth login
- [ ] Stripe subscription integration
- [ ] Two tiers: Free and Pro
- [ ] Tier enforcement (gate features by subscription status)

**Pro-only features:**
- [ ] Deep analysis (500-1000 ads) — Pro only
- [ ] Ad preview display (images, videos, creative text) — Pro only
- [ ] Enhanced charts (more types, hover/drill-down, better labels) — Pro only
- [ ] Export/download analysis results — Pro only

**All users:**
- [ ] Basic analysis (100 ads)
- [ ] Clear error feedback when operations fail

### Out of Scope

- Per-ad demographic breakdown — aggregated summary only
- Historical tracking — point-in-time analysis only
- Puppeteer-based scraping — removed, using Facebook Graph API
- Email/password authentication — social OAuth only for simplicity
- Enterprise tier — keep it simple with Free + Pro
- Team/organization accounts — single user accounts only for v2.0
- Mobile app — web responsive only

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
| Social OAuth only (Google/GitHub) | No password management, simpler UX | — Pending |
| Two tiers (Free + Pro) | Simple pricing, clear value proposition | — Pending |
| Stripe for payments | Industry standard, good Next.js integration | — Pending |
| Gate features by tier (not just depth) | Multiple value levers for Pro tier | — Pending |

---
*Last updated: 2026-01-26 after v2.0 milestone started*
