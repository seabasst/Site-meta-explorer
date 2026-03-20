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

<details>
<summary>✅ v6.0 Ad Library UX Overhaul (Phases 46-51) - SHIPPED 2026-03-20</summary>
Phases 46-51 — See milestones/v6.0-ROADMAP.md for full details
</details>

## 🚧 v6.1 Brand Monitoring & Cleanup (In Progress)

**Milestone Goal:** Fix broken brand monitoring, add per-brand dashboard, clean up tech debt and build issues.

- [ ] **Phase 52: Build Fix** — Fix useSearchParams Suspense boundary build failure
- [ ] **Phase 53: Infrastructure & Cleanup** — Refresh Facebook tokens, remove dead code
- [ ] **Phase 54: Brand Monitoring** — Fix monitor button persistence, add per-brand dashboard

## Phase Details

### Phase 52: Build Fix
**Goal**: `next build` succeeds without errors
**Depends on**: Nothing (first phase — unblocks deployment)
**Requirements**: BFIX-01
**Success Criteria** (what must be TRUE):
  1. `next build` completes successfully without useSearchParams Suspense boundary error
  2. Production deployment on Vercel builds without intervention
**Research**: Unlikely — standard Next.js Suspense boundary pattern
**Plans**: TBD

### Phase 53: Infrastructure & Cleanup
**Goal**: Resolve token issues and remove dead code from v6.0
**Depends on**: Phase 52 (clean build needed to verify changes)
**Requirements**: INFR-01, CODE-01
**Success Criteria** (what must be TRUE):
  1. Facebook access tokens on Vercel are valid and demographics data loads correctly
  2. Orphaned files (stats-bar.tsx, pagination.tsx, AdLibraryStats interface) are removed
  3. No dead imports or broken references after cleanup
**Research**: Unlikely — known files, known token refresh process
**Plans**: TBD

### Phase 54: Brand Monitoring
**Goal**: Working brand monitoring with per-brand dashboards
**Depends on**: Phase 53 (valid tokens needed for demographic data)
**Requirements**: BMON-01, BMON-02
**Success Criteria** (what must be TRUE):
  1. User clicks "Monitor brand" and the saved state persists across page navigation and refresh
  2. User can view a per-brand mini dashboard with top ads grid
  3. Per-brand dashboard shows demographic charts (reach by country, gender, age)
**Research**: Likely — need to understand current monitor button implementation and dashboard layout approach
**Plans**: TBD

## Progress

**Execution Order:** 52 → 53 → 54

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 52. Build Fix | 0/TBD | Not started | - |
| 53. Infrastructure & Cleanup | 0/TBD | Not started | - |
| 54. Brand Monitoring | 0/TBD | Not started | - |

---
*Last updated: 2026-03-20 after v6.1 roadmap creation*
