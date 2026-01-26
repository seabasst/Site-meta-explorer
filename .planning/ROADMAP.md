# Roadmap: Ad Library Demographics Analyzer

## Overview

Transform the v1.0 MVP into a monetized SaaS product with user authentication and Stripe subscription payments. Free tier provides basic analysis, Pro tier unlocks deep analysis and premium features.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-25)
- ✅ **v1.1 Partial** - Phase 5 (shipped 2026-01-25, phases 6-9 deferred)
- 🚧 **v2.0 Payments & Auth** - Phases 10-13 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-25</summary>

### Phase 1: Foundation
**Goal**: Project setup and API integration
**Status**: Complete

### Phase 2: Data Extraction
**Goal**: Demographic data extraction from Facebook Graph API
**Status**: Complete

### Phase 3: Aggregation
**Goal**: Weighted demographic aggregation
**Status**: Complete

### Phase 4: Display
**Goal**: Results visualization with Recharts
**Status**: Complete

</details>

<details>
<summary>✅ v1.1 Partial (Phase 5) - SHIPPED 2026-01-25</summary>

### Phase 5: Error Handling & Foundation
**Goal**: Stable foundation with error handling and loading states
**Status**: Complete
**Note**: Phases 6-9 (Ad Preview, Charts, Export, Mobile) deferred to v2.1+

</details>

### 🚧 v2.0 Payments & Auth (In Progress)

**Milestone Goal:** Monetize with Stripe subscriptions and tiered access (Free + Pro).

- [ ] **Phase 10: Auth Foundation** - OAuth login with Google/GitHub
- [ ] **Phase 11: Stripe Integration** - Subscription payments and management
- [ ] **Phase 12: Tier Enforcement** - Gate features by subscription status
- [ ] **Phase 13: Pro Features** - Build gated Pro capabilities

## Phase Details

### Phase 10: Auth Foundation
**Goal**: OAuth login with Google/GitHub
**Depends on**: Phase 5 (v1.1 complete)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can click "Sign in with Google" and be authenticated
  2. User can click "Sign in with GitHub" and be authenticated
  3. User sees their logged-in state (name/avatar) in UI
  4. User can log out from any page
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Auth infrastructure (Auth.js config, route handler, SessionProvider)
- [ ] 10-02-PLAN.md — Auth UI components (sign-in/out buttons, user menu, page integration)

### Phase 11: Stripe Integration
**Goal**: Subscription payments and management
**Depends on**: Phase 10
**Requirements**: PAY-01, PAY-02
**Success Criteria** (what must be TRUE):
  1. User can click "Upgrade to Pro" and complete Stripe checkout
  2. User can view their current subscription status
  3. User can cancel their subscription
  4. User can resume a cancelled subscription
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Tier Enforcement
**Goal**: Gate features by subscription status
**Depends on**: Phase 11
**Requirements**: PAY-03, TIER-01, TIER-02
**Success Criteria** (what must be TRUE):
  1. Free user sees analysis limited to 100 ads
  2. Pro user can select 500 or 1000 ad depth
  3. Free user sees "Pro feature" badges on locked features
  4. System correctly reflects subscription changes in real-time
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: Pro Features
**Goal**: Build gated Pro capabilities
**Depends on**: Phase 12
**Requirements**: TIER-03, TIER-04, TIER-05
**Success Criteria** (what must be TRUE):
  1. Pro user sees ad previews (images, videos, creative text)
  2. Pro user sees enhanced charts with better labels
  3. Pro user can export analysis results
  4. Free user sees these features as locked/teased
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4 | v1.0 | - | Complete | 2026-01-25 |
| 5 | v1.1 | 4/4 | Complete | 2026-01-25 |
| 6-9 | v1.1 | - | Deferred | - |
| 10. Auth Foundation | v2.0 | 0/2 | Planned | - |
| 11. Stripe Integration | v2.0 | 0/TBD | Not started | - |
| 12. Tier Enforcement | v2.0 | 0/TBD | Not started | - |
| 13. Pro Features | v2.0 | 0/TBD | Not started | - |
