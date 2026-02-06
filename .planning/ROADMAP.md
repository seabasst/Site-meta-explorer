# Roadmap: Ad Library Demographics Analyzer v4.0

## Overview

Transform the brand tracking dashboard into a full analytics platform with trend visualization, competitive benchmarking, and improved UX. Users will be able to track demographic changes over time, compare their brand against up to 5 competitors with aggregate benchmarks, and navigate a more polished dashboard experience.

## Phases

**Phase Numbering:**
- Integer phases (32, 33, 34): Planned milestone work
- Decimal phases (33.1, 33.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 32: Trend Analysis** - Visualize demographic shifts across historical snapshots
- [ ] **Phase 33: Benchmark Foundation** - Create benchmark reports comparing competitors
- [ ] **Phase 34: Benchmark Aggregation** - Display aggregate metrics with indexing
- [ ] **Phase 35: Dashboard UX** - Improve navigation, cards, and organization
- [ ] **Phase 36: Performance & Quality** - Faster analysis, better data accuracy

## Phase Details

### Phase 32: Trend Analysis
**Goal**: Users can visualize how demographics change over time for saved brands
**Depends on**: Nothing (first v4.0 phase)
**Requirements**: TREND-01
**Success Criteria** (what must be TRUE):
  1. User can view age distribution trend chart for a saved brand
  2. User can view gender distribution trend chart for a saved brand
  3. User can view country distribution trend chart for a saved brand
  4. Charts show data points across multiple historical snapshots
**Plans**: 2 plans

Plans:
- [x] 32-01-PLAN.md — Backend: demographics normalizer + trends API endpoint
- [x] 32-02-PLAN.md — Frontend: trend chart component + brand page integration

### Phase 33: Benchmark Foundation
**Goal**: Users can create and save benchmark reports comparing competitors against a baseline
**Depends on**: Phase 32 (uses similar chart patterns)
**Requirements**: BENCH-01, BENCH-02, BENCH-04
**Success Criteria** (what must be TRUE):
  1. User can select up to 5 competitor pages and one baseline brand
  2. System fetches all pages with rate limiting (no API failures)
  3. User can save the benchmark report as a persistent entity
  4. Benchmark report stores all brands with baseline designation
**Plans**: TBD

Plans:
- [ ] 33-01: TBD
- [ ] 33-02: TBD

### Phase 34: Benchmark Aggregation
**Goal**: Users can see meaningful aggregate comparisons with over/under indexing
**Depends on**: Phase 33
**Requirements**: BENCH-03
**Success Criteria** (what must be TRUE):
  1. User can see average demographics across competitor set
  2. User can see over/under-indexing vs baseline for each metric
  3. Comparison visualization makes indexing differences clear
**Plans**: TBD

Plans:
- [ ] 34-01: TBD

### Phase 35: Dashboard UX
**Goal**: Dashboard is more navigable, visually rich, and organized
**Depends on**: Phase 34 (benchmark entities need dashboard integration)
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Dashboard has clear navigation structure
  2. Brand cards show richer metrics at a glance
  3. User can filter brands by tags
  4. User can organize brands into groups
**Plans**: TBD

Plans:
- [ ] 35-01: TBD
- [ ] 35-02: TBD

### Phase 36: Performance & Quality
**Goal**: Faster analysis and better data accuracy
**Depends on**: Phase 35 (optimization applies to final UI)
**Requirements**: PERF-01, QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Initial page loads are faster
  2. Analysis and re-analysis complete faster
  3. Hook grouping produces more accurate similar phrase clusters
  4. Missing demographic data is handled consistently
**Plans**: TBD

Plans:
- [ ] 36-01: TBD
- [ ] 36-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 32 → 33 → 34 → 35 → 36

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. Trend Analysis | 2/2 | Complete | 2026-02-06 |
| 33. Benchmark Foundation | 0/2 | Not started | - |
| 34. Benchmark Aggregation | 0/1 | Not started | - |
| 35. Dashboard UX | 0/2 | Not started | - |
| 36. Performance & Quality | 0/2 | Not started | - |

---
*Created: 2026-02-06*
*Milestone: v4.0 Analytics Platform*
