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
- [ ] 01-01-PLAN.md - Upgrade to rebrowser-puppeteer-core via npm aliasing

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

**Plans:** (created by /gsd:plan-phase)

---

### Phase 3: Aggregation

**Goal:** Per-ad demographic data is combined into meaningful weighted summaries
**Depends on:** Phase 2
**Requirements:** EXTR-04

**Success Criteria:**
1. Demographics are weighted by reach/impressions, not just ad count
2. Aggregated summary reflects contribution of high-reach ads more than low-reach ads
3. Aggregation handles missing data gracefully (ads without reach data still contribute)

**Plans:** (created by /gsd:plan-phase)

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

**Plans:** (created by /gsd:plan-phase)

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 - Foundation | Planned | - |
| 2 - Demographic Extraction | Not started | - |
| 3 - Aggregation | Not started | - |
| 4 - Display | Not started | - |

---

*Roadmap for milestone: v1.0*
