# Roadmap: Ad Library Intelligence Platform v5.0

## Overview

Transform from experiment to focused product — fix broken features, restructure navigation around an "Inspiration" concept, rework the dashboard as a configurable analytics view over the full ad database, enhance Hikaru AI with visual output, and build a landing page that drives conversion from free to Pro.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 (shipped)
- ✅ **v1.1 UX Polish** - Phases 8-12 (shipped)
- ✅ **v2.0 Auth & Payments** - Phases 13-18 (shipped)
- ✅ **v2.1 Interactive Analytics** - Phases 19-22 (shipped)
- ✅ **v3.0 Brand Tracking** - Phases 23-26 (shipped)
- ✅ **v3.1 Competitive Intelligence** - Phases 27-31 (shipped)
- ✅ **v4.0 Analytics Platform** - Phases 32-37 (shipped)
- 🚧 **v5.0 Product Refocus** - Phases 38-42 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (38, 39, 40): Planned milestone work
- Decimal phases (38.1, 38.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 38: Bug Fixes** - Fix Saved Ads auth, Brand/Category 404s, demographics fallback
- [ ] **Phase 39: Navigation Restructure** - Sidebar reorg with Inspiration section, hide/gray unused features
- [ ] **Phase 40: Dashboard Rework** - Configurable analytics view with filters, sorting, saveable configs
- [ ] **Phase 41: Hikaru AI Enhancement** - Richer output with graphs, charts, and visual answers
- [ ] **Phase 42: Landing Page** - Value proposition, freemium teaser, Pro upsell at $99/mo

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
  2. "Ad Library" renamed to "Inspiration" in navigation
  3. Competitors, Benchmarking, Compare are hidden from sidebar (code preserved)
  4. Downloads appears in sidebar but grayed out with "not available yet" indicator
**Research**: Unlikely — UI restructure of existing sidebar component
**Plans**: TBD

### Phase 40: Dashboard Rework
**Goal**: Dashboard is a configurable analytics view over the full ad database, not a duplicate of Ad Library
**Depends on**: Phase 39 (navigation must be in place for dashboard positioning)
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Dashboard shows analytics overview (charts, metrics, summaries) over the full ad database
  2. User can filter and sort the analytics view across the ad database
  3. User can save and load dashboard configurations
**Research**: Likely — need to determine analytics metrics, chart types, and configuration persistence approach
**Plans**: TBD

### Phase 41: Hikaru AI Enhancement
**Goal**: Hikaru AI produces richer, more visual answers with embedded charts and graphs
**Depends on**: Phase 40 (can reuse chart components from dashboard)
**Requirements**: HIKA-01
**Success Criteria** (what must be TRUE):
  1. Hikaru AI responses include embedded graphs and charts when answering data questions
  2. Visual answers are interactive and consistent with the dashboard's chart style
**Research**: Likely — need to determine how to render charts within chat responses, what chart types to support
**Plans**: TBD

### Phase 42: Landing Page
**Goal**: Landing page at `/` showcases the tool and drives conversion from free to Pro
**Depends on**: Phase 41 (landing page should showcase latest features including AI)
**Requirements**: LAND-01, LAND-02, LAND-03
**Success Criteria** (what must be TRUE):
  1. Landing page at `/` presents clear value proposition with compelling CTA
  2. Landing page includes try-out access to V1 dashboard as freemium teaser
  3. Landing page upsells V2 dashboard at $99/month with feature preview/glimpse
**Research**: Unlikely — standard landing page with existing V1 integration
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 38 → 39 → 40 → 41 → 42

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Bug Fixes | 3/3 | Complete | 2026-03-17 |
| 39. Navigation Restructure | 0/TBD | Not started | - |
| 40. Dashboard Rework | 0/TBD | Not started | - |
| 41. Hikaru AI Enhancement | 0/TBD | Not started | - |
| 42. Landing Page | 0/TBD | Not started | - |

---
*Created: 2026-03-17*
*Milestone: v5.0 Product Refocus*
