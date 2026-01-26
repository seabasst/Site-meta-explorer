# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.
**Current focus:** Phase 10 complete — Ready for Phase 11 (User/Subscription Data Model)

## Current Position

Phase: 10 of 13 (Auth Foundation) - COMPLETE
Plan: 02 of 02 complete
Status: Phase complete
Last activity: 2026-01-26 — Completed 10-02-PLAN.md (Auth UI Components)

Progress: ███████████░░░░░░░░░ 56% (v1.0 shipped, v1.1 partial, v2.0 Phase 10 done)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 Polish | Partial (Phase 5 shipped, 6-9 deferred) | 2026-01-25 |
| v2.0 Payments & Auth | In Progress (Phase 10 complete) | - |

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5 (v1.1) | 4 | — | — |
| 10 (Auth Foundation) | 2 | ~19min | ~10min |
| 11-13 (v2.0) | 0 | TBD | — |

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

**Carried from v1.1:**
- shadcn/ui for component library (React 19 + Tailwind v4 compatible)
- Link-out approach for ad previews (Facebook blocks embedding)

### Pending Todos

None.

### Blockers/Concerns

- ~~Auth provider selection and setup needed~~ (Complete: Google OAuth + email/password)
- Google OAuth requires user to configure credentials in .env.local
- Stripe account/keys required for payment integration
- Database needed for user accounts and subscriptions

## Session Continuity

Last session: 2026-01-26
Stopped at: Completed 10-02-PLAN.md (Auth UI Components)
Resume file: None
Next: Phase 11 — User/Subscription Data Model
