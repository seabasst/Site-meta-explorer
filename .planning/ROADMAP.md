# Roadmap: Ad Library Pro

## Milestones

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-25</summary>
Phases 1-4
</details>

<details>
<summary>✅ v1.1 Polish (Phase 5) - SHIPPED 2026-01-25</summary>
Phase 5 (phases 6-9 superseded by v2.1)
</details>

<details>
<summary>✅ v2.0 Payments & Auth (Phases 10-13) - SHIPPED 2026-01-27</summary>
Phases 10-13
</details>

<details>
<summary>✅ v2.1 Polish & UX (Phases 14-17.2) - SHIPPED 2026-02-01</summary>
Phases 14-17.2
</details>

<details>
<summary>✅ v3.0 Brand Tracking (Phases 24-27) - SHIPPED 2026-02-02</summary>
Phases 24-27
</details>

<details>
<summary>✅ v3.1 Competitive Intelligence (Phases 28-31) - SHIPPED 2026-02-03</summary>
Phases 28-31
</details>

<details>
<summary>✅ v5.0 Product Refocus (Phases 38-43) - SHIPPED 2026-03-17</summary>
Phases 38-43
</details>

<details>
<summary>✅ v5.1 Visual Consistency (Phases 44-45) - SHIPPED 2026-03-18</summary>
Phases 44-45
</details>

## Current Milestone

### v6.0 Ad Library UX Overhaul

**Milestone Goal:** Transform the ad library from a basic browse grid into a fast, analytical tool — bringing V1 dashboard depth into the V2 ad library while keeping it slim and quick to scan.

## Phases

- [ ] **Phase 46: Component Extraction** - Break up the 1044-line monolith into composable components
- [ ] **Phase 47: Filter & Sort Overhaul** - Streamlined filters, sort controls, partnership filter, sticky bar, grid density
- [ ] **Phase 48: Load-More Pagination** - Replace numbered pagination with load-more batching
- [ ] **Phase 49: Inline Analytics Bar** - Quick stats strip above the ad grid
- [ ] **Phase 50: Ad Detail Lightbox** - Centered modal overlay on ad click with full detail
- [ ] **Phase 51: Demographic Peek** - Per-brand/category mini demographic charts in the browse view

## Phase Details

### Phase 46: Component Extraction
**Goal**: Break the ad library monolith (~1044 lines) into composable components so feature work can land cleanly
**Depends on**: Nothing (first phase)
**Requirements**: FNDN-01
**Research**: Unlikely (standard refactoring patterns)
**Success Criteria** (what must be TRUE):
  1. Ad library page renders identically before and after extraction
  2. AdCard, FilterBar, AdGrid, Pagination, StatsBar exist as separate components
  3. All existing filters, search, pagination, and save-ad functionality still work
  4. No regressions in dark mode or responsive layout
**Plans**: 2 plans
Plans:
- [ ] 46-01-PLAN.md — Extract shared types, AdCard, FilterDropdown, FilterChip, StatsBar, Pagination into component files
- [ ] 46-02-PLAN.md — Rewire page.tsx to compose extracted components, update brand page

### Phase 47: Filter & Sort Overhaul
**Goal**: Make the filter/sort bar fast, intuitive, and complete — add sort options, partnership filter, grid density, and sticky behavior
**Depends on**: Phase 46
**Requirements**: FLTR-01, FLTR-02, FLTR-03, FLTR-04, BRWS-02, BRWS-03
**Research**: Unlikely (standard UI patterns)
**Success Criteria** (what must be TRUE):
  1. User can sort ads by spend, reach, days active, and date
  2. User can toggle between compact and standard grid density (and optional list view)
  3. User can filter ads by partnership/bylines status
  4. Active filter chips are clearly visible with easy removal
  5. Filter bar sticks to top of viewport on scroll
**Plans**: TBD

### Phase 48: Load-More Pagination
**Goal**: Replace numbered page navigation with a "Load more" pattern — faster browsing, no page reloads
**Depends on**: Phase 46
**Requirements**: BRWS-04
**Research**: Unlikely (standard pattern, API already supports offset/limit)
**Success Criteria** (what must be TRUE):
  1. Initial load shows 40-60 ad cards
  2. "Load more" button appends next batch without clearing existing ads
  3. Ads accumulate in the grid as user loads more
  4. Sort and filter changes reset the loaded set
**Plans**: TBD

### Phase 49: Inline Analytics Bar
**Goal**: Replace the 4 stat cards with a slim, information-dense stats strip above the ad grid
**Depends on**: Phase 46
**Requirements**: ANLYT-01
**Research**: Unlikely (redesign of existing stats display)
**Success Criteria** (what must be TRUE):
  1. Stats strip shows total reach, active ad count, format breakdown, top categories
  2. Stats update when filters change (reflect filtered subset)
  3. Strip is compact — single row, not 4 separate cards
**Plans**: TBD

### Phase 50: Ad Detail Lightbox
**Goal**: Clicking an ad card opens a centered modal with large media preview, full copy, stats, targeting, and dates
**Depends on**: Phase 46
**Requirements**: BRWS-01
**Research**: Likely (need to check what ad data is available for detail view — targeting, spend, impressions)
**Success Criteria** (what must be TRUE):
  1. Clicking any ad card opens a centered modal overlay
  2. Modal shows large media preview (image or video), full ad copy, all stats
  3. Modal shows targeting info, start/end dates, platform info
  4. User can close modal with Escape, click outside, or X button
  5. User can save ad and view on Meta from within the lightbox
**Plans**: TBD

### Phase 51: Demographic Peek
**Goal**: Show mini demographic charts (age, gender, country) per-brand or per-category while browsing
**Depends on**: Phase 46, Phase 49
**Requirements**: ANLYT-02
**Research**: Likely (need to check demographic data availability per-brand in current DB/API)
**Success Criteria** (what must be TRUE):
  1. When browsing by brand, a mini demographic chart is visible
  2. Charts show age, gender, or country distribution relevant to the filtered view
  3. Charts don't block or slow down the ad browsing experience
**Plans**: TBD

## Progress

**Execution Order:**
Phases 46 first (foundation), then 47-49 can be parallel (wave 2), then 50-51 (wave 3).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 46. Component Extraction | 0/2 | Not started | - |
| 47. Filter & Sort Overhaul | 0/TBD | Not started | - |
| 48. Load-More Pagination | 0/TBD | Not started | - |
| 49. Inline Analytics Bar | 0/TBD | Not started | - |
| 50. Ad Detail Lightbox | 0/TBD | Not started | - |
| 51. Demographic Peek | 0/TBD | Not started | - |

---
*Last updated: 2026-03-19 after Phase 46 planning*
