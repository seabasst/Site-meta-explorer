# Roadmap: Ad Library Demographics Analyzer

## Overview

v3.0 adds brand tracking and a dashboard to the Ad Library Demographics Analyzer. Users can save brands after analysis, view them in a central dashboard, re-analyze with fresh data, and manage (delete) saved brands. This is a Pro-only feature set that builds on the existing analysis flow.

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped)
- ✅ **v1.1 Polish** - Phases 5-13 (shipped)
- ✅ **v2.0 Auth & Payments** - Phases 14-17 (shipped)
- ✅ **v2.1 Interactivity & Mobile** - Phases 18-23 (shipped)
- 🚧 **v3.0 Brand Tracking & Dashboard** - Phases 24-27 (in progress)

## Phases

- [x] **Phase 24: Brand Data Model & Storage** - Prisma schema + save brand after analysis
- [ ] **Phase 25: Dashboard** - Brand cards grid with metrics and navigation
- [ ] **Phase 26: Re-analysis & History** - Fresh analysis on saved brands with snapshot history
- [ ] **Phase 27: Brand Deletion** - Delete brands with confirmation and bulk actions

## Phase Details

### Phase 24: Brand Data Model & Storage
**Goal**: Pro users can save a brand after completing analysis, storing the page URL, auto-detected name, and aggregated demographic snapshot
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: BRAND-01, BRAND-02, BRAND-03
**Success Criteria** (what must be TRUE):
  1. Pro user can click "Save Brand" after completing analysis
  2. Brand name is auto-detected from the Facebook page name
  3. Saved brand stores aggregated demographic snapshot (age, gender, country, reach) — not raw ad data
**Research**: Complete (24-RESEARCH.md)
**Plans**: 1 plan
Plans:
- [x] 24-01-PLAN.md — Save Brand API endpoint + button in results header

### Phase 25: Dashboard
**Goal**: Users can view saved brands in a card grid, see key metrics at a glance, click through to full results, and search/sort brands
**Depends on**: Phase 24
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. User sees a grid of saved brand cards at `/dashboard`
  2. Each card shows key metrics (reach, top country, last analyzed date)
  3. User can click a card to view full demographic results
  4. User can sort by date/name and search brands by name
**Research**: Unlikely — standard Next.js page with card components
**Plans**: 1 plan
Plans:
- [ ] 25-01-PLAN.md — Enhance cards with metrics, add brand detail page, add search/sort controls

### Phase 26: Re-analysis & History
**Goal**: Users can trigger fresh Facebook API analysis on saved brands, with historical snapshots preserved
**Depends on**: Phase 24, Phase 25
**Requirements**: REANA-01, REANA-02, REANA-03, REANA-04
**Success Criteria** (what must be TRUE):
  1. User can trigger fresh analysis from a brand card
  2. Fresh results update the displayed demographic snapshot
  3. System keeps historical snapshots (multiple per brand)
  4. Brand card shows "last analyzed" timestamp
**Research**: Unlikely — reuses existing API flow, adds snapshot versioning
**Plans**: TBD

### Phase 27: Brand Deletion
**Goal**: Users can delete brands with confirmation dialog and bulk selection
**Depends on**: Phase 25
**Requirements**: DEL-01, DEL-02, DEL-03
**Success Criteria** (what must be TRUE):
  1. User can delete a brand from the dashboard
  2. Confirmation dialog prevents accidental deletion
  3. User can select and delete multiple brands at once
**Research**: Unlikely — standard CRUD delete with UI confirmation
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 24 → 25 → 26 → 27

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Brand Data Model & Storage | 1/1 | Complete | 2026-02-02 |
| 25. Dashboard | 0/1 | Not started | - |
| 26. Re-analysis & History | 0/TBD | Not started | - |
| 27. Brand Deletion | 0/TBD | Not started | - |
