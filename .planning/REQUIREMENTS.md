# Requirements: Ad Library Pro — v6.1 Brand Monitoring & Cleanup

**Defined:** 2026-03-20
**Core Value:** Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## v1 Requirements

Requirements for v6.1 release. Each maps to roadmap phases.

### Brand Monitoring

- [x] **BMON-01**: User can click "Monitor brand" and the saved state persists across page navigation and refresh
- [x] **BMON-02**: User can view a per-brand mini dashboard showing top ads grid with demographic charts (reach by country, gender, age)

### Code Health

- [x] **CODE-01**: Orphaned files removed: `stats-bar.tsx`, `pagination.tsx`, `AdLibraryStats` interface

### Build & Deploy

- [x] **BFIX-01**: `next build` succeeds without `useSearchParams` Suspense boundary error *(resolved during v6.0)*

### Infrastructure

- [x] **INFR-01**: Facebook access tokens on Vercel are refreshed/valid so demographics data loads correctly

## v2 Requirements

None — this is a focused cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Industry benchmarks (v4.5) | Separate planned milestone, admin-only feature |
| Brand detail page lightbox integration | Enhancement, not blocking |
| V2 ternary cleanup (308 occurrences) | Separate code quality milestone |
| Competitors/Benchmarking/Compare pages | Hidden, may delete later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BMON-01 | Phase 54 | ✓ Complete |
| BMON-02 | Phase 54 | ✓ Complete |
| CODE-01 | Phase 53 | ✓ Complete |
| BFIX-01 | Phase 52 | ✓ Complete |
| INFR-01 | Phase 53 | ✓ Complete |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-21 after Phase 54 execution — all requirements complete*
