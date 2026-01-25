# Roadmap

**Project:** Ad Library Demographics Analyzer
**Created:** 2026-01-18
**Phases:** 4

## Overview

This roadmap delivers demographic extraction and aggregation capabilities for Facebook Ad Library analysis. Phases follow natural dependencies: foundation upgrades enable reliable scraping, extraction pulls per-ad data, aggregation combines it meaningfully, and display presents results to users. All 12 v1 requirements map to exactly one phase.

## Phases

### Phase 1: Foundation

**Goal:** Scraping infrastructure is upgraded for reliable, undetected operation
**Depends on:** Nothing (first phase)
**Requirements:** RELY-01

**Success Criteria:**
1. Scraper uses rebrowser-puppeteer-core instead of puppeteer-core
2. Existing ad discovery functionality continues to work after upgrade
3. No detection/blocking observed during normal scraping operations

**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md - Upgrade to rebrowser-puppeteer-core via npm aliasing

---

### Phase 2: Demographic Extraction

**Goal:** Users get per-ad demographic data from top-performing ads
**Depends on:** Phase 1
**Requirements:** EXTR-01, EXTR-02, EXTR-03, RELY-02, RELY-04

**Success Criteria:**
1. User can see age group percentages extracted from ad detail pages
2. User can see gender percentages extracted from ad detail pages
3. User can see country/region distribution extracted from ad detail pages
4. Top-performing ads (by reach or duration) are automatically selected for analysis
5. When demographic data is unavailable for an ad, scraping continues with remaining ads

**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md - Types and top performer selection
- [x] 02-02-PLAN.md - Demographic extraction parser
- [x] 02-03-PLAN.md - Navigation and orchestration
- [x] 02-04-PLAN.md - API layer wiring (gap closure)

---

### Phase 3: Aggregation

**Goal:** Per-ad demographic data is combined into meaningful weighted summaries
**Depends on:** Phase 2
**Requirements:** EXTR-04

**Success Criteria:**
1. Demographics are weighted by reach/impressions, not just ad count
2. Aggregated summary reflects contribution of high-reach ads more than low-reach ads
3. Aggregation handles missing data gracefully (ads without reach data still contribute)

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md - Aggregation module (types and pure functions)
- [x] 03-02-PLAN.md - Integration and verification

---

### Phase 4: Display

**Goal:** Users can view and understand aggregated demographic insights
**Depends on:** Phase 3
**Requirements:** DISP-01, DISP-02, DISP-03, DISP-04, RELY-03

**Success Criteria:**
1. User sees text summary of demographics (e.g., "55% female, 60% ages 25-44")
2. User sees age/gender breakdown as visual chart
3. User sees country distribution as visual chart
4. User sees loading progress during demographic scraping
5. User can configure how many ads to analyze before starting scrape

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md - Install Recharts, create config input
- [x] 04-02-PLAN.md - Create chart and summary components
- [x] 04-03-PLAN.md - Integrate components into main page

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 - Foundation | Complete | 2026-01-18 |
| 2 - Demographic Extraction | Complete | 2026-01-19 |
| 3 - Aggregation | Complete | 2026-01-19 |
| 4 - Display | Complete | 2026-01-25 |

---

*Roadmap for milestone: v1.0*
