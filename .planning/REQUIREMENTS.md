# Requirements: Ad Library Demographics Analyzer v1.1

**Defined:** 2026-01-25
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### UI/UX Polish

- [ ] **UIUX-01**: User sees skeleton loading states while data fetches

### Mobile/Responsive

- [ ] **MOBL-01**: App displays properly on mobile devices with responsive layout
- [ ] **MOBL-02**: All interactive elements have touch-friendly targets (48x48px minimum)

### Ad Preview

- [ ] **PREV-01**: User can click to view ad on Facebook (opens in new tab)
- [ ] **PREV-02**: User can see ad creative text in the results
- [ ] **PREV-03**: User can distinguish video ads from image ads via indicators

### Charts

- [ ] **CHRT-01**: User sees rich context in chart tooltips on hover
- [ ] **CHRT-02**: Charts resize properly within their containers
- [ ] **CHRT-03**: User can click a chart element to filter related data

### Export

- [ ] **EXPT-01**: User can export analysis results as PDF

### Error Handling

- [ ] **ERRH-01**: User sees clear, non-technical error messages when operations fail
- [ ] **ERRH-02**: User can retry failed API requests
- [ ] **ERRH-03**: User receives real-time validation feedback on inputs

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### UI/UX Polish

- **UIUX-02**: Empty states with helpful messaging
- **UIUX-03**: Microinteractions (hover states, transitions)
- **UIUX-04**: Dark mode toggle

### Mobile/Responsive

- **MOBL-03**: Gesture-based interactions (swipe, pinch)

### Ad Preview

- **PREV-04**: Thumbnail gallery with click-to-expand
- **PREV-05**: Video click-to-play modal

### Charts

- **CHRT-04**: Cross-chart filtering (click one chart filters all)
- **CHRT-05**: Animated chart transitions
- **CHRT-06**: Export chart as image (PNG)

### Export

- **EXPT-02**: CSV export verification (existing)
- **EXPT-03**: Excel (XLSX) export

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Inline ad thumbnails | Facebook blocks embedding (X-Frame-Options: DENY); requires server-side screenshot proxy |
| Video hover autoplay | Browser restrictions; complex to implement reliably |
| Carousel ad preview | High complexity; rare ad format |
| Deep drill-down (3+ levels) | Complexity exceeds value for v1.1 |
| Real-time live updates | Overkill for ad analysis; manual refresh sufficient |
| User accounts/auth | Scope creep; not needed for single-user tool |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UIUX-01 | Phase 5 | Complete |
| ERRH-01 | Phase 5 | Complete |
| ERRH-02 | Phase 5 | Complete |
| ERRH-03 | Phase 5 | Complete |
| PREV-01 | Phase 6 | Pending |
| PREV-02 | Phase 6 | Pending |
| PREV-03 | Phase 6 | Pending |
| CHRT-01 | Phase 7 | Pending |
| CHRT-02 | Phase 7 | Pending |
| CHRT-03 | Phase 7 | Pending |
| EXPT-01 | Phase 8 | Pending |
| MOBL-01 | Phase 9 | Pending |
| MOBL-02 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after roadmap created*
