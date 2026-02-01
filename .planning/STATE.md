# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.
**Current focus:** v2.1 Polish & UX — gap closure phases 17.1-17.2

## Current Position

Phase: 17.1 of 23 (Export & Filter Fix) - Complete
Plan: 1 of 1
Status: Phase 17.1 complete, 17.2 pending
Last activity: 2026-02-01 — Completed 17.1-01-PLAN.md

Progress: █████████████████░░░ 85% (v1.0-v2.0 shipped, v2.1 gap closure: 17.1 done, 17.2 pending)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 Polish | Partial (Phase 5 shipped, 6-9 superseded by v2.1) | 2026-01-25 |
| v2.0 Payments & Auth | Complete (Phases 10-13) | 2026-01-27 |
| v2.1 Polish & UX | Gap closure (Phases 14-17 complete, 17.1-17.2 pending) | 2026-02-01 |
| v3.0 Pro Platform | Not started (Phases 18-23) | - |

## Performance Metrics

**Velocity:**
- Total plans completed: 23
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5 (v1.1) | 4 | — | — |
| 10 (Auth Foundation) | 2 | ~19min | ~10min |
| 11 (Stripe Integration) | 4 | 22min | ~5.5min |
| 12 (Tier Enforcement) | 3 | ~9min | ~3min |
| 13 (Pro Features) | 3 | ~12min | ~4min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0: ~~Social OAuth only (Google/GitHub)~~ Changed to Google OAuth + email/password
- v2.0: Two tiers (Free + Pro) — simple pricing model
- v2.0: Stripe for payments
- v2.0: Gate features by tier (depth + feature access)

**From 10-01:**
- JWT session strategy (no database needed for auth)
- Type augmentation to expose user.id in session

**From 10-02:**
- Removed GitHub OAuth (user requested)
- Added Credentials provider for email/password login
- Demo user for testing: demo@example.com / demo123
- Google OAuth conditionally shown when configured
- Custom sign-in page at /auth/signin

**From 11-01:**
- Prisma 7 with SQLite for local development database
- User model has stripeCustomerId, subscriptionStatus, subscriptionId fields
- Stripe API version pinned to 2025-12-15.clover
- Singleton pattern for Prisma and Stripe clients

**From 11-02:**
- Lazy initialization for Prisma and Stripe clients (proxy pattern)
- Server Actions pattern for payment flows: 'use server' + auth() + database + redirect
- UpgradeButton uses useTransition for loading states

**From 11-03:**
- Webhook signature verification uses raw body (request.text() not request.json())
- Stripe statuses mapped to simplified 4-state model: free, pro, past_due, cancelled
- Return 200 on processing errors to prevent Stripe retry loops

**From 11-04:**
- Client-side status fetching via API route (/api/subscription/status)
- SubscriptionStatus is self-contained (badge + action in one component)
- Customer Portal used for subscription management (cancel, resume, payment update)

**From 12-01:**
- Centralized tier configuration in src/lib/tiers.ts
- past_due users get grace period (treated as pro)
- Unauthenticated users get free tier info (not 401)
- useTierAccess hook for client-side tier checking

**From 12-02:**
- Server-side tier enforcement in /api/facebook-ads route
- Graceful degradation: cap requests instead of rejecting
- Logging with [Tier] prefix for debugging
- Both POST and GET handlers enforce limits

**From 12-03:**
- ProBadge component for tier indication (gradient, sm/md sizes)
- DepthSelector replaces old PricingModal approach
- Three depth options: 100 (free), 500/1000 (pro)
- Locked options trigger sign-in or checkout flow

**From 13-01:**
- FeatureGate component for reusable tier-based content gating
- showTeaser=true by default to show blurred teaser (encourages upgrades)
- Blur+lock overlay pattern for locked Pro content
- Ad preview section gated with FeatureGate

**From 13-02:**
- Enhanced age/gender chart with hover tooltips showing Male/Female/Total breakdown
- Enhanced country chart with ranking position and country names
- Dominant segment callout for demographics insights
- useState for controlled hover tracking pattern
- Scale transform (1.02) for hover visual feedback

**From 15-02:**
- Chart click-to-filter: chartFilter state with type/value/label, toggle behavior
- filteredAds useMemo filters ad list by country region or media type
- ActiveChartFilter clearable pill component with emerald accent
- AgeGender click is visual-only (demographics are aggregated, don't map to individual ads)
- Opacity dimming (opacity-40) for non-active chart segments

**From 13-03:**
- PDF export using jspdf + html2canvas with dynamic imports
- Gated behind tier.features.export flag
- Multi-page support for tall content
- ~~Dark theme background matching for screenshots~~ (Changed to white in 16-01)
- Export dropdown shows PDF (Pro) with ProBadge for free users

**From 16-01:**
- Section-based PDF capture via data-pdf-section attributes (replaces single-screenshot approach)
- Cover page with brand name, key stats, generation date
- Headers (brand + date) and footers (page numbers) on every content page
- White background (#ffffff) for print-friendly output
- data-pdf-hide elements hidden during capture, details forced open

**From 16-02:**
- Multi-tab PDF capture: isExporting state renders all three tabs simultaneously during export
- onProgress callback pattern: pdf-export.ts fires progress per section, page.tsx shows in button text
- showAllTabs option with cleanup function keeps exporter framework-agnostic

**From 17-01:**
- Hidden dividers on mobile (hidden sm:block) to avoid broken flex-wrap appearance
- Dual hover+tap for export dropdown: group-hover for desktop, exportOpen state for mobile
- Tab icons hidden on mobile (hidden sm:block) to fit 375px; text-only tabs
- min-h-[48px] touch target pattern for all interactive elements

**From 17-02:**
- Responsive grids via Tailwind breakpoints (grid-cols-1/2 base, sm/lg for larger)
- Touch-friendly copy buttons: p-3 sm:p-2 pattern for mobile-first touch targets
- Click toggles hover state on charts for touch device accessibility
- Country chart labels narrowed on mobile (w-20 sm:w-36)
- Horizontal scroll tables with min-w-[640px] for mobile

**From 17.1-01:**
- Export data source pattern: isExporting ? apiResult.ads : filteredAds (unfiltered PDF)
- Mobile export progress shown on button element (not just dropdown)
- Responsive tooltip positioning: left-20 sm:left-36 matching label column widths

**Carried from v1.1:**
- shadcn/ui for component library (React 19 + Tailwind v4 compatible)
- Link-out approach for ad previews (Facebook blocks embedding)

### Roadmap Evolution

- Phases 14-17 added (v2.1): Deferred v1.1 polish items — ad preview, charts, export, mobile
- Phases 18-23 added (v3.0): Coming-soon pro platform features — brand tracking, competitor monitoring, comparison, tips, trends, dashboard

### Pending Todos

None.

### Blockers/Concerns

- ~~Auth provider selection and setup needed~~ (Complete: Google OAuth + email/password)
- Google OAuth requires user to configure credentials in .env.local
- Stripe account/keys required for payment integration (documented in .env.local.example)
- ~~Database needed for user accounts and subscriptions~~ (Complete: Prisma + SQLite)
- ~~Stripe webhook requires configuration~~ (Complete: documented in 11-03-SUMMARY.md)
- Stripe Customer Portal must be configured in Stripe Dashboard for subscription management

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 17.1-01-PLAN.md (Export & Filter Fix)
Resume file: None
Next: Phase 17.2 (Dashboard Cleanup) if planned
