# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.
**Current focus:** v2.1 Polish & UX — shipping deferred v1.1 items

## Current Position

Phase: 14 of 23 (Ad Preview) - COMPLETE
Plan: 1 of 1 — complete
Status: Phase complete
Last activity: 2026-02-01 — Completed 14-01-PLAN.md

Progress: ███████████████░░░░░ 68% (v1.0-v2.0 shipped, Phase 14 done, v2.1 continues)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 Polish | Partial (Phase 5 shipped, 6-9 superseded by v2.1) | 2026-01-25 |
| v2.0 Payments & Auth | Complete (Phases 10-13) | 2026-01-27 |
| v2.1 Polish & UX | Not started (Phases 14-17) | - |
| v3.0 Pro Platform | Not started (Phases 18-23) | - |

## Performance Metrics

**Velocity:**
- Total plans completed: 18
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

**From 13-03:**
- PDF export using jspdf + html2canvas with dynamic imports
- Gated behind tier.features.export flag
- Multi-page support for tall content
- Dark theme background matching for screenshots
- Export dropdown shows PDF (Pro) with ProBadge for free users

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
Stopped at: Completed 14-01-PLAN.md (Phase 14 complete)
Resume file: None
Next: Execute Phase 15
