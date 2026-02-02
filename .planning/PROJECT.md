# Ad Library Demographics Analyzer

## What This Is

A competitor analysis SaaS tool that extracts demographic and reach data from Facebook Ad Library. Users enter an Ad Library page URL, and the app fetches ad data via Facebook's Graph API to show aggregated audience breakdowns — countries, age groups, gender splits, and reach metrics. Features tiered access (Free + Pro) with Stripe subscription payments, interactive charts with click-to-filter, professional PDF export, full mobile responsiveness, and a brand tracking dashboard for saving and managing analyzed brands over time.

## Core Value

Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## Requirements

### Validated

- ✓ Ad Library URL input and validation — v1.0
- ✓ Ad discovery from Ad Library pages — v1.0
- ✓ Basic results display with Tailwind styling — v1.0
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
- ✓ Skeleton loading states while data fetches — v1.1
- ✓ Clear, non-technical error messages — v1.1
- ✓ Retry mechanism for failed API requests — v1.1
- ✓ Real-time validation feedback on inputs — v1.1
- ✓ Google OAuth login — v2.0
- ✓ Email/password login — v2.0
- ✓ User can log out from any page — v2.0
- ✓ Stripe subscription integration (checkout, manage, cancel, resume) — v2.0
- ✓ Two tiers: Free (100 ads) and Pro (500-1000 ads) — v2.0
- ✓ Tier enforcement (gate features by subscription status) — v2.0
- ✓ Ad previews with resolved media type badges — v2.0 + v2.1
- ✓ Enhanced charts with hover tooltips and demographic breakdowns — v2.0 + v2.1
- ✓ PDF export with cover page, headers/footers, multi-tab content — v2.0 + v2.1
- ✓ Click-to-filter interactivity across chart types — v2.1
- ✓ Responsive layout on mobile (375px+) — v2.1
- ✓ Touch-friendly targets (48px minimum) — v2.1
- ✓ Save brand after analysis (URL, name, demographic snapshot) — v3.0
- ✓ Dashboard with brand cards grid (key metrics, click to view full results) — v3.0
- ✓ Re-analyze saved brand with fresh demographic data — v3.0
- ✓ Delete saved brand from dashboard — v3.0

### Active

(None yet — define requirements for next milestone)

### Out of Scope

- Per-ad demographic breakdown — aggregated summary only
- Historical trend charts — snapshot comparison over time (v3.1)
- Brand comparisons side-by-side — deferred to v3.1
- Scheduled re-analysis — requires background jobs, too complex for now
- Actionable tips/insights — deferred to future milestone
- Puppeteer-based scraping — removed, using Facebook Graph API
- Enterprise tier — keep it simple with Free + Pro
- Team/organization accounts — single user accounts only
- Mobile app — web responsive only

## Context

**Current State:**
- Shipped v3.0 with ~14,926 LOC TypeScript
- Tech stack: Next.js 16, React 19, Recharts, Tailwind CSS, Auth.js, Stripe, Prisma + SQLite
- Uses Facebook Graph API with EU DSA transparency data
- Deployed to Vercel
- Full mobile responsiveness down to 375px
- Professional PDF export with section-based capture
- Brand tracking dashboard with save, re-analyze, delete, search/sort

**Architecture:**
- `/api/facebook-ads` — Graph API integration with tier enforcement
- `/api/brands/save` — Save brand with demographic snapshot
- `/api/dashboard/*` — Overview, snapshots, competitors, own-brand endpoints
- `facebook-api.ts` — API client with demographic aggregation
- `demographic-aggregator.ts` — Weighted demographic combination
- `snapshot-builder.ts` — Builds aggregated demographic snapshots for storage
- Recharts components with rich tooltips and click-to-filter
- `pdf-export.ts` — Section-based PDF capture with multi-tab support
- Auth.js for authentication (Google OAuth + email/password)
- Stripe for subscription payments with webhook sync
- Prisma + SQLite for user/subscription/brand data

## Constraints

- **API Rate Limits:** Facebook Graph API has rate limits
- **EU Data Only:** Demographics only available for EU-targeted ads via DSA
- **Tech stack:** Maintain existing Next.js architecture
- **Google OAuth requires credentials:** User must configure in .env.local
- **Stripe requires account:** Keys and webhook configuration needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Facebook Graph API over browser scraping | More reliable, faster, official data source | ✓ Good |
| Weight demographics by reach | High-reach ads represent more audience | ✓ Good |
| Aggregate summary over per-ad details | User need is competitor patterns, not individual ads | ✓ Good |
| Recharts for visualization | Lightweight, good React integration | ✓ Good |
| Tiered analysis depth (100-1000) | Balance speed vs completeness | ✓ Good |
| Google OAuth + email/password | Simpler than multi-provider OAuth, covers all users | ✓ Good |
| Two tiers (Free + Pro) | Simple pricing, clear value proposition | ✓ Good |
| Stripe for payments | Industry standard, good Next.js integration | ✓ Good |
| Gate features by tier (not just depth) | Multiple value levers for Pro tier | ✓ Good |
| JWT session strategy | No database needed for auth sessions | ✓ Good |
| Prisma + SQLite | Simple local dev, easy migration to PostgreSQL later | ✓ Good |
| Section-based PDF capture | Reliable rendering vs single-screenshot approach | ✓ Good |
| Click-to-filter with toggle | Intuitive chart interaction pattern | ✓ Good |
| min-h-[48px] touch targets | Mobile accessibility standard | ✓ Good |
| resolvedMediaType for badges | API returns 'unknown', useAdMedia resolves actual type | ✓ Good |
| Brand tracking as Pro-only | Core value-add for paid tier, builds foundation for comparisons | ✓ Good |
| Card grid over table for dashboard | Visual, scannable, better for brand overview | ✓ Good |
| Demographic snapshot storage | Store aggregated results, not raw ad data | ✓ Good |
| trackerId for brand ownership | Composite unique constraint, supports 1:many brands per user | ✓ Good |
| shadcn AlertDialog for deletions | Accessible, keyboard-navigable confirmation dialogs | ✓ Good |
| Bulk delete via comma-separated query param | Simple API, no request body needed for DELETE | ✓ Good |
| Snapshot history with limit=10 | Sufficient history without unbounded growth | ✓ Good |

---
*Last updated: 2026-02-02 after v3.0 milestone*
