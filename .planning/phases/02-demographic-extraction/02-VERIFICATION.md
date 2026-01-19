---
phase: 02-demographic-extraction
verified: 2026-01-19T11:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "User can see age group percentages extracted from ad detail pages"
    - "User can see gender percentages extracted from ad detail pages"
    - "User can see country/region distribution extracted from ad detail pages"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Demographic Extraction Verification Report

**Phase Goal:** Users get per-ad demographic data from top-performing ads
**Verified:** 2026-01-19T11:30:00Z
**Status:** passed
**Re-verification:** Yes - after gap closure (Plan 02-04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see age group percentages extracted from ad detail pages | VERIFIED | API route (line 9) and server action (line 7) accept `scrapeDemographics` param; extractDemographicsFromApiResponse parses `ageGenderBreakdown` array; response includes `demographics.ageGenderBreakdown` per ad |
| 2 | User can see gender percentages extracted from ad detail pages | VERIFIED | Same as #1 - gender is part of `ageGenderBreakdown` array with `gender` field (male/female/unknown) |
| 3 | User can see country/region distribution extracted from ad detail pages | VERIFIED | `demographic-extractor.ts` parses `delivery_by_region` and `region_distribution` fields into `regionBreakdown` array |
| 4 | Top-performing ads are automatically selected for analysis | VERIFIED | `selectTopPerformers` (40 lines) sorts by reach then duration, limits to `maxDemographicAds`; called at line 475 of scraper |
| 5 | Scraping continues when demographic data is unavailable for an ad | VERIFIED | `scrapeAdDemographics` returns null on error (line 202); loop has try/catch at line 508-512 with comment "Continue with next ad (RELY-02)" |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/demographic-types.ts` | Type definitions | VERIFIED | 62 lines, exports DemographicBreakdown, RegionBreakdown, AdDemographics, AdWithMetrics, AdLibraryResultWithDemographics, AdDataWithDemographics, hasAdDemographics |
| `src/lib/top-performer-selector.ts` | Selection logic | VERIFIED | 40 lines, exports selectTopPerformers, filters/sorts/limits ads |
| `src/lib/demographic-extractor.ts` | Extraction logic | VERIFIED | 163 lines, exports extractDemographicsFromApiResponse with recursive traversal, handles multiple field name variations |
| `src/lib/ad-library-scraper.ts` | Extended scraper | VERIFIED | 560+ lines, has scrapeAdDemographics function, scrapeDemographics option, imports all modules |
| `src/actions/scrape-ad-library.ts` | Server action with demographics | VERIFIED | 24 lines, accepts scrapeDemographics and maxDemographicAds params, passes to scrapeAdLibrary |
| `src/app/api/scrape-ads/route.ts` | API route with demographics | VERIFIED | 32 lines, destructures scrapeDemographics and maxDemographicAds from body, passes to scrapeAdLibrary |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| ad-library-scraper.ts | demographic-extractor.ts | import | WIRED | Line 3: `import { extractDemographicsFromApiResponse }` |
| ad-library-scraper.ts | top-performer-selector.ts | import | WIRED | Line 4: `import { selectTopPerformers }` |
| ad-library-scraper.ts | demographic-types.ts | import | WIRED | Line 5: imports AdDemographics, AdWithMetrics, etc. |
| ad-library-scraper.ts | ad detail URL | navigation | WIRED | Line 163: `facebook.com/ads/library/?id=${adArchiveId}` |
| top-performer-selector.ts | demographic-types.ts | import | WIRED | Line 1: `import { AdWithMetrics }` |
| demographic-extractor.ts | demographic-types.ts | import | WIRED | Line 1: imports AdDemographics, DemographicBreakdown, RegionBreakdown |
| scrape-ad-library.ts | scrapeAdLibrary | call with options | WIRED | Line 20: `scrapeAdLibrary(adLibraryUrl, !isProduction, { scrapeDemographics, maxDemographicAds })` |
| api/scrape-ads/route.ts | scrapeAdLibrary | call with options | WIRED | Line 19: `scrapeAdLibrary(adLibraryUrl, !isProduction, { scrapeDemographics, maxDemographicAds })` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| EXTR-01 (age group breakdown) | SATISFIED | - |
| EXTR-02 (gender breakdown) | SATISFIED | - |
| EXTR-03 (country/region distribution) | SATISFIED | - |
| RELY-02 (graceful handling) | SATISFIED | Returns null on error, continues loop |
| RELY-04 (top performer selection) | SATISFIED | selectTopPerformers called with maxDemographicAds |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODO/FIXME/placeholder patterns found in modified files.

### Human Verification Required

### 1. Demographic Extraction Accuracy
**Test:** Run scraper with `{ scrapeDemographics: true }` on known EU advertiser
**Expected:** Age/gender/region percentages match Facebook Ad Library UI
**Why human:** Need to visually compare extracted data with Facebook's displayed data

### 2. Ad Detail Page Navigation
**Test:** Verify scraper successfully navigates to ad detail pages and clicks "See ad details"
**Expected:** Page loads, modal opens, demographic API responses captured
**Why human:** DOM structure may vary, need visual confirmation

### 3. API Response Format
**Test:** Call API endpoint with `{ "adLibraryUrl": "...", "scrapeDemographics": true }`
**Expected:** Response includes `ads[].demographics` with `ageGenderBreakdown` and `regionBreakdown` arrays
**Why human:** Verify actual response structure matches expected format

## Gap Closure Summary

The previous verification (2026-01-19T10:00:00Z) found that demographic extraction capability was complete in the library layer but not exposed via the user-facing API.

**Plan 02-04 fixed this by:**
1. Adding `scrapeDemographics` and `maxDemographicAds` parameters to server action signature (line 7-8)
2. Adding parameter destructuring to API route request body (line 9)
3. Passing options object to `scrapeAdLibrary` in both files (lines 20 and 19 respectively)

**Verification confirms:**
- Server action: `src/actions/scrape-ad-library.ts` accepts and passes `scrapeDemographics` option
- API route: `src/app/api/scrape-ads/route.ts` accepts and passes `scrapeDemographics` option
- Full data flow: User request -> API -> scrapeAdLibrary -> selectTopPerformers -> scrapeAdDemographics -> extractDemographicsFromApiResponse -> response with demographics

All 5 success criteria from ROADMAP.md are now verified. Phase goal "Users get per-ad demographic data from top-performing ads" is achieved.

---

*Verified: 2026-01-19T11:30:00Z*
*Verifier: Claude (gsd-verifier)*
