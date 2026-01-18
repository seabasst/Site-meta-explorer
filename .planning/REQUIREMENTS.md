# Requirements: Ad Library Demographics Analyzer

**Defined:** 2026-01-18
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v1 Requirements

### Extraction

- [ ] **EXTR-01**: Extract age group breakdown (percentage per age bracket) from ad detail pages
- [ ] **EXTR-02**: Extract gender breakdown (male/female percentages) from ad detail pages
- [ ] **EXTR-03**: Extract country/region reach distribution from ad detail pages
- [ ] **EXTR-04**: Weight aggregated demographics by reach/impressions, not just ad count

### Display

- [ ] **DISP-01**: Show aggregated text summary of demographics (e.g., "55% female, 60% ages 25-44")
- [ ] **DISP-02**: Display age/gender breakdown as visual chart
- [ ] **DISP-03**: Display country distribution as visual chart
- [ ] **DISP-04**: Show loading states with progress during demographic scraping

### Reliability

- [ ] **RELY-01**: Upgrade to rebrowser-puppeteer-core for stealth (avoid detection)
- [ ] **RELY-02**: Handle missing/unavailable demographic data gracefully without crashing
- [ ] **RELY-03**: Allow user to configure how many ads to analyze (within timeout constraints)
- [ ] **RELY-04**: Auto-select top performing ads (by reach or run duration) for analysis

## v2 Requirements

### Export

- **EXPO-01**: Export demographic data as CSV
- **EXPO-02**: Export demographic data as JSON

### Historical

- **HIST-01**: Track demographic changes over time for an advertiser
- **HIST-02**: Compare demographics between time periods

### Multi-Account

- **MULT-01**: Compare demographics across multiple advertisers
- **MULT-02**: Side-by-side competitor comparison view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-ad demographic details | Aggregated summary only; reduces complexity |
| Non-EU demographic scraping | Data not reliably available from Facebook for non-EU commercial ads |
| Historical tracking | Point-in-time analysis only for v1 |
| Account/login system | Public tool, no user accounts needed |
| Mobile app | Web-first |
| Sitemap analysis improvements | Deprioritized; demographics is the focus |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Pending |
| EXTR-03 | Phase 2 | Pending |
| EXTR-04 | Phase 3 | Pending |
| DISP-01 | Phase 4 | Pending |
| DISP-02 | Phase 4 | Pending |
| DISP-03 | Phase 4 | Pending |
| DISP-04 | Phase 4 | Pending |
| RELY-01 | Phase 1 | Complete |
| RELY-02 | Phase 2 | Pending |
| RELY-03 | Phase 4 | Pending |
| RELY-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 - Phase mappings added*
