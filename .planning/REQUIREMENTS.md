# Requirements: Ad Library Demographics Analyzer v2.0

**Defined:** 2026-01-26
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v2.0 Requirements

Requirements for Payments & Auth milestone. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can log in with Google OAuth
- [x] **AUTH-02**: User can log in with email/password *(changed from GitHub per user request)*
- [x] **AUTH-03**: User can log out from any page

### Payments

- [x] **PAY-01**: User can subscribe to Pro tier via Stripe checkout
- [x] **PAY-02**: User can manage subscription (view status, cancel, resume)
- [ ] **PAY-03**: System enforces tier-based feature access

### Tier Features

- [ ] **TIER-01**: Free users get basic analysis (100 ads max)
- [ ] **TIER-02**: Pro users get deep analysis (500-1000 ads)
- [ ] **TIER-03**: Pro users see ad previews (images, videos, creative text)
- [ ] **TIER-04**: Pro users get enhanced charts (more types, better labels)
- [ ] **TIER-05**: Pro users can export analysis results

## Completed (Previous Milestones)

### v1.0 MVP (Shipped 2026-01-25)

- [x] Ad Library URL input and validation
- [x] Ad discovery from Ad Library pages
- [x] Basic results display with Tailwind styling
- [x] Extract age group breakdown per ad
- [x] Extract gender breakdown per ad
- [x] Extract country/region breakdown per ad
- [x] Extract reach/impressions data per ad
- [x] Weight demographics by reach
- [x] Aggregate demographics into summary view
- [x] Display aggregated demographics in UI
- [x] Visual charts for age/gender and country distribution
- [x] Loading states during analysis
- [x] Configurable analysis depth (100/250/500/1000 ads)

### v1.1 Partial (Shipped 2026-01-25)

- [x] **UIUX-01**: Skeleton loading states while data fetches
- [x] **ERRH-01**: Clear, non-technical error messages
- [x] **ERRH-02**: Retry mechanism for failed API requests
- [x] **ERRH-03**: Real-time validation feedback on inputs

## Deferred (v2.1+)

v1.1 features paused for v2.0 monetization. Will revisit after payments ship.

### Ad Preview (from v1.1)

- **PREV-01**: User can click to view ad on Facebook
- **PREV-02**: User can see ad creative text in results
- **PREV-03**: User can distinguish video ads from image ads

### Charts (from v1.1)

- **CHRT-01**: Rich context in chart tooltips on hover
- **CHRT-02**: Charts resize properly within containers
- **CHRT-03**: Click chart element to filter related data

### Export (from v1.1)

- **EXPT-01**: Export analysis results as PDF

### Mobile (from v1.1)

- **MOBL-01**: Responsive layout on mobile devices
- **MOBL-02**: Touch-friendly targets (48x48px minimum)

## Out of Scope

| Feature | Reason |
|---------|--------|
| GitHub OAuth | Simplified to Google + email only |
| Enterprise tier | Keep it simple with Free + Pro |
| Team/organization accounts | Single user accounts only for v2.0 |
| Mobile app | Web responsive only |
| Per-ad demographic breakdown | Aggregated summary only |
| Historical tracking | Point-in-time analysis only |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 10 | Complete |
| AUTH-02 | Phase 10 | Complete |
| AUTH-03 | Phase 10 | Complete |
| PAY-01 | Phase 11 | Complete |
| PAY-02 | Phase 11 | Complete |
| PAY-03 | Phase 12 | Pending |
| TIER-01 | Phase 12 | Pending |
| TIER-02 | Phase 12 | Pending |
| TIER-03 | Phase 13 | Pending |
| TIER-04 | Phase 13 | Pending |
| TIER-05 | Phase 13 | Pending |

**Coverage:**
- v2.0 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-26*
*Previous milestone: v1.1 Phase 5 complete, Phases 6-9 deferred*
