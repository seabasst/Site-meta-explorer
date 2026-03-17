# Requirements: Ad Library Intelligence Platform

**Defined:** 2026-03-16
**Core Value:** Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## v5.0 Requirements

Requirements for v5.0 Product Refocus. Each maps to roadmap phases.

### Navigation & Structure

- [ ] **NAV-01**: Sidebar restructured with Inspiration section (Ad Library + Saved Ads + Brands + Categories as sub-items), Creative Lab as hero below Dashboard, Hikaru AI prominent
- [ ] **NAV-02**: "Ad Library" renamed to "Inspiration" throughout navigation
- [ ] **NAV-03**: Competitors, Benchmarking, Compare hidden from sidebar (code preserved)
- [ ] **NAV-04**: Downloads shown in sidebar but grayed out with "not available yet" indicator

### Bug Fixes

- [x] **FIX-01**: Saved Ads tied to authenticated user — saves persist per account, graceful fallback when unauthenticated
- [x] **FIX-02**: Brand detail pages load correctly (no more 404)
- [x] **FIX-03**: Category detail pages load correctly (no more 404)
- [x] **FIX-04**: Demographics fallback handles token expiry gracefully with user-visible error state

### Dashboard

- [x] **DASH-01**: Dashboard reworked as configurable analytics view over full ad database (not a duplicate of Ad Library)
- [x] **DASH-02**: Dashboard supports filters and sorting across the ad database
- [x] **DASH-03**: User can save and load dashboard configurations

### Hikaru AI

- [ ] **HIKA-01**: Hikaru AI produces richer output with embedded graphs, charts, and visual answers

### Landing Page

- [ ] **LAND-01**: Landing page at `/` showcasing the tool's value proposition with clear CTA
- [ ] **LAND-02**: Landing page includes try-out access to V1 dashboard as freemium teaser
- [ ] **LAND-03**: Landing page upsells V2 dashboard at $99/month with feature preview/glimpse

## v5.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Competitive Benchmarking

- **BENCH-01**: Benchmark report comparing up to 5 competitors vs one baseline brand
- **BENCH-02**: Batch-fetch multiple ad library pages with rate limit management
- **BENCH-03**: Aggregated benchmark metrics with over/under-indexing vs baseline
- **BENCH-04**: Save benchmark reports as persistent entities

### Performance & Quality

- **PERF-01**: Performance optimization pass for analysis, re-analysis, and page loads
- **QUAL-01**: Improved fuzzy hook matching for similar phrases

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Scheduled re-analysis | Requires background jobs infrastructure |
| AI/LLM insights | Rule-based observations sufficient for now |
| Video hook transcription | Different infrastructure problem |
| Real-time competitor monitoring | Major infrastructure investment |
| Team/organization accounts | Single user only |
| Mobile app | Web responsive only |
| Enterprise tier | Keep Free + Pro for now |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 38 | Complete |
| FIX-02 | Phase 38 | Complete |
| FIX-03 | Phase 38 | Complete |
| FIX-04 | Phase 38 | Complete |
| NAV-01 | Phase 39 | Pending |
| NAV-02 | Phase 39 | Pending |
| NAV-03 | Phase 39 | Pending |
| NAV-04 | Phase 39 | Pending |
| DASH-01 | Phase 40 | Complete |
| DASH-02 | Phase 40 | Complete |
| DASH-03 | Phase 40 | Complete |
| HIKA-01 | Phase 41 | Pending |
| LAND-01 | Phase 42 | Pending |
| LAND-02 | Phase 42 | Pending |
| LAND-03 | Phase 42 | Pending |

**Coverage:**
- v5.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-17 after Phase 40 completion*
