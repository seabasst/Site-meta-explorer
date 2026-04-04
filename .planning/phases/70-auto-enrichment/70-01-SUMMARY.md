---
phase: 70
plan: 01
subsystem: enrichment
tags: [ai, haiku, brand-profile, enrichment, change-detection]
dependency-graph:
  requires: [68, 69]
  provides: [enrichment-pipeline, enrichment-api]
  affects: [70-02]
tech-stack:
  added: []
  patterns: [hash-based-change-detection, selective-merge, cost-budgeted-llm]
key-files:
  created:
    - src/lib/enrichment/enrichment-hash.ts
    - src/lib/enrichment/enrich-from-ads.ts
    - src/app/api/brand-profiles/[id]/enrich/route.ts
  modified:
    - prisma/schema.prisma
decisions:
  - id: enrich-model
    choice: "claude-haiku-4-5-20251001 for enrichment synthesis"
    reason: "3x cheaper than Sonnet, sufficient for structured extraction from pre-classified data"
  - id: change-detection
    choice: "SHA-256 hash of classification distribution + ad count + bodies"
    reason: "More reliable than timestamp comparison, catches re-ingested data"
  - id: merge-strategy
    choice: "Fill-empty for strings, append-deduplicate for arrays, forceOverwrite opt-in"
    reason: "User edits are sacred, enrichment should only add value not destroy it"
metrics:
  duration: ~4m
  completed: 2026-04-04
---

# Phase 70 Plan 01: Auto-Enrichment Backend Summary

**One-liner:** Haiku-powered brand profile enrichment from ad library data with hash-based change detection and $2/day cost cap.

## What Was Built

### Task 1: Schema Migration + Enrichment Utilities
- Added `enrichmentHash`, `enrichedAt`, `enrichmentSource` fields to `BrandProfile` model
- Created `enrichment-hash.ts`: SHA-256 hash of input data (classification summary, ad count, bodies) for change detection; returns 16-char hex prefix
- Created `enrich-from-ads.ts`: Core pipeline that gathers AdClassification (100), AdAnalysis (50), and AdLibraryAd (20) data in parallel, builds 8-category distribution, calls Haiku with structured prompt, parses JSON response into `EnrichmentFields` (brandVoice, positioning, demographics, interests, painPoints, missionStatement)

### Task 2: Enrichment API Endpoint
- Created `POST /api/brand-profiles/[id]/enrich` with full orchestration:
  1. Auth + ownership verification (same pattern as existing [id]/route.ts)
  2. Zod validation of `sourcePageId` (required) and `forceOverwrite` (optional, default false)
  3. Source brand existence + minimum data check (>= 3 classified ads)
  4. Daily cost budget check via `getDailySpend()` ($2/day cap, returns 429 if exceeded)
  5. `enrichFromAds()` call to gather data and synthesize via Haiku
  6. Hash-based change detection: skips if hash unchanged and forceOverwrite=false
  7. Selective merge: strings only fill empty fields; arrays append-and-deduplicate
  8. Prisma update with enrichmentHash, enrichedAt, enrichmentSource
  9. Cost logging via `logApiCost()` with operation "enrich-from-ads"
  10. Returns updated profile with `fieldsUpdated` list

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM model | Haiku 4.5 | Sufficient for structured extraction, 3x cheaper than Sonnet |
| Change detection | SHA-256 hash of input data | Reliable, catches re-ingested data that timestamps miss |
| Merge strategy | Fill-empty + append-deduplicate | User edits preserved by default, forceOverwrite available |
| Cost cap | $2/day total API spend | Uses existing getDailySpend(), simple and safe |

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

- Enrichment backend is complete and callable
- Ready for 70-02 (UI integration): frontend needs "Auto-Enrich" button that calls POST /api/brand-profiles/[id]/enrich with the selected source brand's ID
- The `fieldsUpdated` array in the response can drive UI feedback showing which fields were populated
