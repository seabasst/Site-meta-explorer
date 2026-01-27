# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.
**Current focus:** Phase 13 in progress — Pro Features (feature gating)

## Current Position

Phase: 13 of 13 (Pro Features)
Plan: 01 of 03 complete
Status: In progress
Last activity: 2026-01-27 — Completed 13-01-PLAN.md (Feature Gating - Ad Previews)

Progress: ██████████████████░░ 93% (v1.0 shipped, v1.1 partial, v2.0 Phases 10-12 complete, 13 in progress)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 Polish | Partial (Phase 5 shipped, 6-9 deferred) | 2026-01-25 |
| v2.0 Payments & Auth | In Progress (Phase 10-12 complete, 13 in progress) | - |

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5 (v1.1) | 4 | — | — |
| 10 (Auth Foundation) | 2 | ~19min | ~10min |
| 11 (Stripe Integration) | 4 | 22min | ~5.5min |
| 12 (Tier Enforcement) | 3 | ~9min | ~3min |
| 13 (Pro Features) | 1/3 | 2min | 2min |

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

**Carried from v1.1:**
- shadcn/ui for component library (React 19 + Tailwind v4 compatible)
- Link-out approach for ad previews (Facebook blocks embedding)

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

Last session: 2026-01-27
Stopped at: Completed 13-01-PLAN.md (Feature Gating - Ad Previews)
Resume file: None
Next: Phase 13 Plan 02 — Export gating (or 13-03 Enhanced Charts)
