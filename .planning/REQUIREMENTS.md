# Requirements: Ad Library Demographics Analyzer

**Defined:** 2026-02-01
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v1 Requirements

Requirements for v3.0 milestone (Brand Tracking & Dashboard). Pro-only feature.

### Brand Storage

- [x] **BRAND-01**: User can save a brand after completing analysis (stores URL, name, demographic snapshot)
- [x] **BRAND-02**: System stores aggregated demographic snapshot (age, gender, country, reach) — not raw ad data
- [x] **BRAND-03**: Brand name is auto-detected from the Facebook page name

### Dashboard

- [ ] **DASH-01**: User can view a grid of saved brand cards with key metrics
- [ ] **DASH-02**: User can click a brand card to view full demographic results
- [ ] **DASH-03**: User can sort brands by date or name, and filter by metrics
- [ ] **DASH-04**: User can search saved brands by name

### Re-analysis

- [ ] **REANA-01**: User can trigger a fresh Facebook API analysis on a saved brand
- [ ] **REANA-02**: Fresh analysis updates the stored demographic snapshot
- [ ] **REANA-03**: System keeps analysis history (multiple snapshots over time)
- [ ] **REANA-04**: Brand card shows when it was last analyzed

### Deletion

- [ ] **DEL-01**: User can delete a saved brand and its data from the dashboard
- [ ] **DEL-02**: System shows a confirmation dialog before deleting a brand
- [ ] **DEL-03**: User can select and delete multiple brands at once

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Brand Storage

- **BRAND-04**: User can add custom name or notes to a saved brand

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Historical trend charts | Deferred to v3.1 — requires snapshot history UI |
| Side-by-side brand comparison | Deferred to v3.1 — needs comparison layout |
| Export brand dashboard data | Not requested; PDF export already covers analysis |
| Scheduled re-analysis | Requires background jobs; too complex for v3.0 |
| Per-ad demographic breakdown | Aggregated summary only (existing constraint) |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 24 | Complete |
| BRAND-02 | Phase 24 | Complete |
| BRAND-03 | Phase 24 | Complete |
| DASH-01 | Phase 25 | Pending |
| DASH-02 | Phase 25 | Pending |
| DASH-03 | Phase 25 | Pending |
| DASH-04 | Phase 25 | Pending |
| REANA-01 | Phase 26 | Pending |
| REANA-02 | Phase 26 | Pending |
| REANA-03 | Phase 26 | Pending |
| REANA-04 | Phase 26 | Pending |
| DEL-01 | Phase 27 | Pending |
| DEL-02 | Phase 27 | Pending |
| DEL-03 | Phase 27 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-02 after roadmap creation*
