# Roadmap: Ad Library Demographics Analyzer

## Overview

Transform the v1.0 MVP into a monetized SaaS product with user authentication and Stripe subscription payments. Free tier provides basic analysis, Pro tier unlocks deep analysis and premium features.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-25)
- ✅ **v1.1 Partial** - Phase 5 (shipped 2026-01-25, phases 6-9 deferred)
- ✅ **v2.0 Payments & Auth** - Phases 10-13 (shipped 2026-01-27)
- ✅ **v2.1 Polish & UX** - Phases 14-17.2 (shipped 2026-02-01, gap closure in progress)
- ○ **v3.0 Pro Platform** - Phases 18-23 (coming-soon features)

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

<details>
<summary>✅ v2.0 Payments & Auth (Phases 10-13) - SHIPPED 2026-01-27</summary>

**Milestone Goal:** Monetize with Stripe subscriptions and tiered access (Free + Pro).

- [x] **Phase 10: Auth Foundation** - OAuth login with Google + email (completed 2026-01-26)
- [x] **Phase 11: Stripe Integration** - Subscription payments and management (completed 2026-01-26)
- [x] **Phase 12: Tier Enforcement** - Gate features by subscription status (completed 2026-01-27)
- [x] **Phase 13: Pro Features** - Build gated Pro capabilities (completed 2026-01-27)

</details>

### v2.1 Polish & UX — Gap Closure

**Milestone Goal:** Ship the deferred v1.1 polish items — ad previews, chart interactions, export improvements, and mobile responsiveness.

- [x] **Phase 14: Ad Preview** - Click-to-view, creative text display, video/image distinction (completed 2026-02-01)
- [x] **Phase 15: Chart Improvements** - Rich tooltips, responsive charts, click-to-filter (completed 2026-02-01)
- [x] **Phase 16: Export Enhancement** - Improved PDF export experience (completed 2026-02-01)
- [x] **Phase 17: Mobile Polish** - Responsive layout, touch-friendly targets (completed 2026-02-01)
- [ ] **Phase 17.1: Export & Filter Fix** - INSERTED — Fix filtered PDF output, mobile export progress, tooltip overflow
- [ ] **Phase 17.2: Dead Code Cleanup** - INSERTED — Remove orphaned MediaTypeChart and ResultsTable components

### ○ v3.0 Pro Platform

**Milestone Goal:** Transform from single-use analyzer into a persistent pro platform with brand tracking, competitor monitoring, comparisons, and actionable insights.

- [ ] **Phase 18: Brand Tracking** - Set your brand as baseline, automated snapshots and trend tracking
- [ ] **Phase 19: Competitor Monitoring** - Add up to 10 competitors, automatic weekly snapshots
- [ ] **Phase 20: Side-by-Side Comparison** - Compare ads against competitors (targeting, creative, reach)
- [ ] **Phase 21: Actionable Tips** - Personalized recommendations based on competitor differences
- [ ] **Phase 22: Historical Trends** - Track strategy evolution over weeks/months, spot patterns
- [ ] **Phase 23: Dashboard & Reports** - Dedicated dashboard with all tracked brands, export reports

## Phase Details

### Phase 10: Auth Foundation ✓
**Goal**: OAuth login with Google + email sign-in
**Depends on**: Phase 5 (v1.1 complete)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Status**: Complete (2026-01-26)
**Success Criteria** (what must be TRUE):
  1. User can click "Sign in with Google" and be authenticated ✓
  2. User can sign in with email/password ✓ *(changed from GitHub per user request)*
  3. User sees their logged-in state (name/avatar) in UI ✓
  4. User can log out from any page ✓
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Auth infrastructure (Auth.js config, route handler, SessionProvider)
- [x] 10-02-PLAN.md — Auth UI components (sign-in/out buttons, user menu, page integration)

### Phase 11: Stripe Integration ✓
**Goal**: Subscription payments and management
**Depends on**: Phase 10
**Requirements**: PAY-01, PAY-02
**Status**: Complete (2026-01-26)
**Success Criteria** (what must be TRUE):
  1. User can click "Upgrade to Pro" and complete Stripe checkout ✓
  2. User can view their current subscription status ✓
  3. User can cancel their subscription ✓
  4. User can resume a cancelled subscription ✓
**Plans**: 4 plans in 3 waves

Plans:
- [x] 11-01-PLAN.md — Database & Stripe foundation (Prisma, User model, Stripe client)
- [x] 11-02-PLAN.md — Checkout flow (Server Action, UpgradeButton, UI integration)
- [x] 11-03-PLAN.md — Webhook handler & subscription sync (signature verification, status updates)
- [x] 11-04-PLAN.md — Subscription UI (status display, Customer Portal access)

### Phase 12: Tier Enforcement ✓
**Goal**: Gate features by subscription status
**Depends on**: Phase 11
**Requirements**: PAY-03, TIER-01, TIER-02
**Status**: Complete (2026-01-27)
**Success Criteria** (what must be TRUE):
  1. Free user sees analysis limited to 100 ads
  2. Pro user can select 500 or 1000 ad depth
  3. Free user sees "Pro feature" badges on locked features
  4. System correctly reflects subscription changes in real-time
**Plans**: 3 plans in 2 waves

Plans:
- [x] 12-01-PLAN.md — Tier configuration foundation (tier constants, useTierAccess hook, API enhancement)
- [x] 12-02-PLAN.md — Server-side tier enforcement (API limit capping, logging)
- [x] 12-03-PLAN.md — Tier UI components (ProBadge, DepthSelector, page integration)

### Phase 13: Pro Features ✓
**Goal**: Build gated Pro capabilities
**Depends on**: Phase 12
**Requirements**: TIER-03, TIER-04, TIER-05
**Status**: Complete (2026-01-27)
**Success Criteria** (what must be TRUE):
  1. Pro user sees ad previews (images, videos, creative text) ✓
  2. Pro user sees enhanced charts with better labels ✓
  3. Pro user can export analysis results ✓
  4. Free user sees these features as locked/teased ✓
**Plans**: 3 plans in 1 wave

Plans:
- [x] 13-01-PLAN.md — FeatureGate component and ad preview gating (TIER-03)
- [x] 13-02-PLAN.md — Enhanced chart tooltips and labels (TIER-04)
- [x] 13-03-PLAN.md — PDF export with tier gating (TIER-05)

### Phase 14: Ad Preview
**Goal**: Fix ad preview gaps — media type badges use resolved type, creative text shows in full
**Depends on**: Phase 13
**Requirements**: PREV-01, PREV-02, PREV-03
**Status**: Complete (2026-02-01)
**Success Criteria** (what must be TRUE):
  1. User can click to view ad on Facebook ✓
  2. User can see ad creative text in results ✓
  3. User can distinguish video ads from image ads ✓
**Plans**: 1 plan

Plans:
- [x] 14-01-PLAN.md — Fix media type badge and remove creative text truncation

### Phase 15: Chart Improvements
**Goal**: Interactive charts with rich tooltips, responsive sizing, and click-to-filter
**Depends on**: Phase 13
**Requirements**: CHRT-01, CHRT-02, CHRT-03
**Status**: Complete (2026-02-01)
**Success Criteria** (what must be TRUE):
  1. Charts show rich context in tooltips on hover ✓
  2. Charts resize properly within containers ✓
  3. User can click chart element to filter related data ✓
**Plans**: 2 plans in 2 waves

Plans:
- [x] 15-01-PLAN.md — Rich tooltips and responsive sizing for Recharts charts (MediaTypeChart, TimeTrends)
- [x] 15-02-PLAN.md — Click-to-filter interactivity for CountryChart, AgeGenderChart, and MediaTypeChart

### Phase 16: Export Enhancement ✓
**Goal**: Professional PDF export with section-based capture, cover page, headers/footers, multi-tab content, and progress feedback
**Depends on**: Phase 13
**Requirements**: EXPT-01
**Status**: Complete (2026-02-01)
**Success Criteria** (what must be TRUE):
  1. PDF export produces well-formatted, professional output with cover page
  2. Charts and data render cleanly without splitting across page boundaries
  3. PDF includes content from all three tabs (audience, ads, expert)
  4. User sees progress feedback during export
**Plans**: 2 plans in 2 waves

Plans:
- [x] 16-01-PLAN.md — Section tagging and section-based PDF capture with cover page and headers/footers
- [x] 16-02-PLAN.md — Multi-tab content capture, DOM preparation, and export progress UI

### Phase 17: Mobile Polish
**Goal**: Responsive layout and touch-friendly interaction on mobile devices
**Depends on**: Phase 14, 15
**Requirements**: MOBL-01, MOBL-02
**Status**: Complete (2026-02-01)
**Success Criteria** (what must be TRUE):
  1. Layout adapts properly to mobile screen sizes ✓
  2. All interactive targets are at least 48x48px ✓
  3. Charts and tables are usable on mobile ✓
**Plans**: 2 plans in 1 wave

Plans:
- [x] 17-01-PLAN.md — Main page responsive fixes (options bar, media type, tabs, table, export dropdown, touch targets)
- [x] 17-02-PLAN.md — Component responsive fixes (analytics grids, results tables, chart touch interactions)

### Phase 17.1: Export & Filter Fix (INSERTED)
**Goal**: Fix filtered PDF output, mobile export progress, and tooltip overflow
**Depends on**: Phase 17
**Requirements**: None (integration/tech debt fixes from audit)
**Gap Closure**: Closes gaps from v2.1-MILESTONE-AUDIT.md
**Status**: Planned
**Success Criteria** (what must be TRUE):
  1. PDF export uses unfiltered ad data regardless of active chart filter
  2. Mobile users see export progress feedback (not trapped in closed dropdown)
  3. Country chart tooltip doesn't overflow on 375px mobile viewports
**Plans**: 1 plan

Plans:
- [ ] 17.1-01-PLAN.md — Fix filtered PDF ads, mobile export progress, and tooltip overflow

### Phase 17.2: Dead Code Cleanup (INSERTED)
**Goal**: Remove orphaned components that are exported but never imported
**Depends on**: Phase 17.1
**Requirements**: None (tech debt cleanup from audit)
**Gap Closure**: Closes gaps from v2.1-MILESTONE-AUDIT.md
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. MediaTypeChart component is either removed or wired into the page
  2. ResultsTable component is either removed or wired into the page
  3. No orphaned exports remain from Phase 15/17 work
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 17.2 to break down)

### Phase 18: Brand Tracking
**Goal**: Users can set their own brand as a baseline and get automated snapshots with trend tracking
**Depends on**: Phase 13
**Requirements**: BRAND-01, BRAND-02
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User can set their brand as the baseline
  2. System takes automated snapshots of brand ad data
  3. User can see how their ad strategy changes over time
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 18 to break down)

### Phase 19: Competitor Monitoring
**Goal**: Track up to 10 competitors with automatic weekly snapshots
**Depends on**: Phase 18
**Requirements**: COMP-01, COMP-02
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User can add up to 10 competitors to track
  2. System takes automatic weekly snapshots of competitor ads
  3. User is notified when a competitor changes strategy
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 19 to break down)

### Phase 20: Side-by-Side Comparison
**Goal**: Compare your ads directly against competitors across targeting, creative, and reach
**Depends on**: Phase 19
**Requirements**: COMP-03
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User can select two brands to compare
  2. Comparison shows audience targeting differences
  3. Comparison shows creative format and copy style differences
  4. Comparison shows reach differences
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 20 to break down)

### Phase 21: Actionable Tips
**Goal**: Personalized recommendations based on competitor analysis
**Depends on**: Phase 20
**Requirements**: TIPS-01
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User sees personalized recommendations based on competitor differences
  2. Tips are specific and actionable (what to test next)
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 21 to break down)

### Phase 22: Historical Trends
**Goal**: Track brand strategy evolution over weeks/months, spot seasonal patterns
**Depends on**: Phase 19
**Requirements**: HIST-01, HIST-02
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User can view strategy changes over weeks and months
  2. System highlights seasonal patterns and strategic shifts
  3. Trend data is visualized with clear timeline charts
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 22 to break down)

### Phase 23: Dashboard & Reports
**Goal**: Dedicated dashboard with all tracked brands, snapshots, insights, and exportable reports
**Depends on**: Phase 18, 19, 22
**Requirements**: DASH-01, DASH-02
**Status**: Not planned
**Success Criteria** (what must be TRUE):
  1. User sees a dashboard with all tracked brands
  2. Dashboard shows latest snapshots and key insights
  3. User can export reports to share with team
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 23 to break down)

## Progress

**Execution Order:**
- v2.1: Phases 14, 15 (parallel) → 16 → 17 → 17.1 → 17.2
- v3.0: Phase 18 → 19 → 20, 21, 22 (parallel) → 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4 | v1.0 | - | Complete | 2026-01-25 |
| 5 | v1.1 | 4/4 | Complete | 2026-01-25 |
| 6-9 | v1.1 | - | Superseded by v2.1 | - |
| 10. Auth Foundation | v2.0 | 2/2 | Complete | 2026-01-26 |
| 11. Stripe Integration | v2.0 | 4/4 | Complete | 2026-01-26 |
| 12. Tier Enforcement | v2.0 | 3/3 | Complete | 2026-01-27 |
| 13. Pro Features | v2.0 | 3/3 | Complete | 2026-01-27 |
| 14. Ad Preview | v2.1 | 1/1 | Complete | 2026-02-01 |
| 15. Chart Improvements | v2.1 | 2/2 | Complete | 2026-02-01 |
| 16. Export Enhancement | v2.1 | 2/2 | Complete | 2026-02-01 |
| 17. Mobile Polish | v2.1 | 2/2 | Complete | 2026-02-01 |
| 17.1 Export & Filter Fix | v2.1 | 0/1 | Planned | - |
| 17.2 Dead Code Cleanup | v2.1 | 0/0 | Not planned | - |
| 18. Brand Tracking | v3.0 | 0/0 | Not planned | - |
| 19. Competitor Monitoring | v3.0 | 0/0 | Not planned | - |
| 20. Side-by-Side Comparison | v3.0 | 0/0 | Not planned | - |
| 21. Actionable Tips | v3.0 | 0/0 | Not planned | - |
| 22. Historical Trends | v3.0 | 0/0 | Not planned | - |
| 23. Dashboard & Reports | v3.0 | 0/0 | Not planned | - |
