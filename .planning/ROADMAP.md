# Roadmap: Ad Library Intelligence Platform v5.0

## Overview

Transform from experiment to focused product — fix broken features, restructure navigation around an "Inspiration" concept, rework the dashboard as a configurable analytics view over the full ad database, enhance Hikaru AI with visual output, and build a landing page that drives conversion from free to Pro.

## Milestones

- v1.0 MVP - Phases 1-7 (shipped)
- v1.1 UX Polish - Phases 8-12 (shipped)
- v2.0 Auth & Payments - Phases 13-18 (shipped)
- v2.1 Interactive Analytics - Phases 19-22 (shipped)
- v3.0 Brand Tracking - Phases 23-26 (shipped)
- v3.1 Competitive Intelligence - Phases 27-31 (shipped)
- v4.0 Analytics Platform - Phases 32-37 (shipped)
- **v5.0 Product Refocus** - Phases 38-43 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (38, 39, 40): Planned milestone work
- Decimal phases (38.1, 38.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 38: Bug Fixes** - Fix Saved Ads auth, Brand/Category 404s, demographics fallback
- [x] **Phase 39: Navigation Restructure** - Sidebar reorg with Inspiration section, hide/gray unused features
- [x] **Phase 40: Dashboard Rework** - Configurable analytics view with filters, sorting, saveable configs
- [x] **Phase 41: Hikaru AI Enhancement** - Richer output with graphs, charts, and visual answers
- [x] **Phase 42: Landing Page** - Value proposition, freemium teaser, 3-tier pricing ($0/$49/$149)
- [x] **Phase 43: Ad Library Deep-Link Filters** - Fix URL param hydration so Dashboard/Category drill-downs work

## Phase Details

### Phase 38: Bug Fixes
**Goal**: Fix all broken features so the product works correctly before restructuring
**Depends on**: Nothing (first v5.0 phase)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. Saved Ads are tied to authenticated user — saves persist per account, unauthenticated users see graceful fallback
  2. Brand detail pages load correctly (no 404)
  3. Category detail pages load correctly (no 404)
  4. Demographics fallback shows user-visible error state when tokens expire instead of failing silently
**Research**: Complete (38-RESEARCH.md)
**Plans**: 3 plans
Plans:
- [x] 38-01-PLAN.md — Saved Ads auth fallback + Category slug normalization (FIX-01, FIX-03)
- [x] 38-02-PLAN.md — Brand detail page creation (FIX-02)
- [x] 38-03-PLAN.md — Demographics error state for token expiry (FIX-04)

### Phase 39: Navigation Restructure
**Goal**: Sidebar restructured around Inspiration concept, unused features hidden, Downloads grayed out
**Depends on**: Phase 38 (fixes should land before nav changes reference fixed pages)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Sidebar shows Inspiration section with Ad Library, Saved Ads, Brands, Categories as sub-items
  2. "Inspiration" section header in sidebar groups Ad Library, Saved Ads, Brands, Categories as sub-items
  3. Competitors, Benchmarking, Compare are hidden from sidebar (code preserved)
  4. Downloads appears in sidebar but grayed out with "not available yet" indicator
**Research**: Unlikely — UI restructure of existing sidebar component
**Plans**: 1 plan
Plans:
- [x] 39-01-PLAN.md — Restructure sidebar with Inspiration section, hide/disable features

### Phase 40: Dashboard Rework
**Goal**: Dashboard is a configurable analytics view over the full ad database, not a duplicate of Ad Library
**Depends on**: Phase 39 (navigation must be in place for dashboard positioning)
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Dashboard shows analytics overview (charts, metrics, summaries) over the full ad database
  2. User can filter and sort the analytics view across the ad database
  3. User can save and load dashboard configurations
**Research**: Complete (40-RESEARCH.md)
**Plans**: 3 plans
Plans:
- [x] 40-01-PLAN.md — Analytics widgets and dashboard page rework (DASH-01)
- [x] 40-02-PLAN.md — Filter bar with URL sync and stats API extension (DASH-02)
- [x] 40-03-PLAN.md — Dashboard configuration save/load via localStorage (DASH-03)

### Phase 41: Hikaru AI Enhancement
**Goal**: Hikaru AI produces richer, more visual answers with embedded charts and graphs
**Depends on**: Phase 40 (can reuse chart components from dashboard)
**Requirements**: HIKA-01
**Success Criteria** (what must be TRUE):
  1. Hikaru AI responses include embedded graphs and charts when answering data questions
  2. Visual answers are interactive and consistent with the dashboard's chart style
**Research**: Complete (41-RESEARCH.md)
**Plans**: 2 plans
Plans:
- [x] 41-01-PLAN.md — Chart component library and system prompt enhancement
- [x] 41-02-PLAN.md — Wire chart rendering into chat message flow

### Phase 42: Landing Page
**Goal**: Landing page at `/` showcases the tool and drives conversion from free to Pro
**Depends on**: Phase 41 (landing page should showcase latest features including AI)
**Requirements**: LAND-01, LAND-02, LAND-03
**Success Criteria** (what must be TRUE):
  1. Landing page at `/` presents clear value proposition with compelling CTA
  2. Landing page includes try-out access to V1 dashboard as freemium teaser
  3. Landing page upsells V2 dashboard at $99/month with feature preview/glimpse
**Research**: Complete (42-RESEARCH.md)
**Plans**: 2 plans
Plans:
- [x] 42-01-PLAN.md — Move V1 to /analyser route and fix Stripe redirect URLs
- [x] 42-02-PLAN.md — Build landing page with hero, features, V2 preview, and pricing

### Phase 43: Ad Library Deep-Link Filters
**Goal**: Ad Library page hydrates filter state from URL search params so drill-downs from Dashboard and Category Detail work
**Depends on**: Phase 40, Phase 38 (both complete — this closes integration gaps between them)
**Requirements**: None (gap closure — fixes integration between DASH-02 and FIX-03)
**Gap Closure**: Closes audit gaps from v5.0-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. Navigating to `/dashboard/v2/ad-library?brandPageId=123` pre-fills the brand filter and shows filtered results
  2. TopBrandsTable links use correct param name (`brandPageId`, not `brand`)
  3. Category Detail "View Ads" links land on Ad Library with brand filter applied
**Research**: Not needed — root cause identified in audit
\*\*Plans\*\*: 1 plan
Plans:
- [x] 43-01-PLAN.md — Hydrate Ad Library filters from URL params + fix TopBrandsTable param name

## Progress

**Execution Order:**
Phases execute in numeric order: 38 -> 39 -> 40 -> 41 -> 42 -> 43

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Bug Fixes | 3/3 | Complete | 2026-03-17 |
| 39. Navigation Restructure | 1/1 | Complete | 2026-03-17 |
| 40. Dashboard Rework | 3/3 | Complete | 2026-03-17 |
| 41. Hikaru AI Enhancement | 2/2 | Complete | 2026-03-17 |
| 42. Landing Page | 2/2 | Complete | 2026-03-17 |
| 43. Ad Library Deep-Link Filters | 1/1 | Complete | 2026-03-17 |

---
*Created: 2026-03-17*
*Milestone: v5.0 Product Refocus*
