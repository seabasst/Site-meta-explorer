---
phase: 66-strategy-engine
plan: 01
subsystem: api
tags: [strategy, gap-matrix, concept-generation, claude-haiku, taxonomy]
dependency-graph:
  requires: [62-01, 63-01, 64-01, 65-01]
  provides: [strategy-data-api, concept-generation-api]
  affects: [66-02]
tech-stack:
  added: []
  patterns: [gap-matrix-computation, parallel-prisma-queries, zod-enum-validation, llm-retry]
key-files:
  created:
    - src/app/api/strategy/[pageId]/route.ts
    - src/app/api/strategy/generate-concept/route.ts
  modified: []
decisions:
  - id: 66-01-a
    decision: "Gap matrix computed from AdClassification co-occurrences (awarenessStage x visualFormat), not from BrandAnalysisCache"
    reason: "Real-time accuracy from source data; cache may be stale"
  - id: 66-01-b
    decision: "Concept generation uses inline JSON parse + retry, not zodOutputFormat"
    reason: "Haiku 4 handles JSON well; inline approach avoids SDK helper dependency and matches plan spec"
  - id: 66-01-c
    decision: "distributionJson from BrandAnalysisCache used for taxonomyBreakdown with fallback to live computation"
    reason: "Cache-first for performance; live fallback ensures correctness when cache is missing"
metrics:
  duration: ~8min
  completed: 2026-03-27
---

# Phase 66 Plan 01: Strategy Engine API Routes Summary

JWT-free brand strategy data assembly from existing classification DB tables, plus on-demand Claude Haiku concept generation for gap matrix cells.

## What Was Built

### Task 1: GET /api/strategy/[pageId]

Pure data assembly endpoint that reads from AdClassification and BrandAnalysisCache to return:

- **Brand profile** (pageName, category, website, activeAdCount, demographics)
- **classificationCoverage** (classified count vs total active ads)
- **taxonomyBreakdown** (8-category distribution from cache or live computation)
- **diversityScores** (8 category scores + overall from BrandAnalysisCache)
- **gapMatrix** (5 awarenessStage x 12 visualFormat co-occurrence counts)
- **maxCellCount** (highest cell value for frontend heatmap color scaling)

Returns 422 with `needsClassification: true` when fewer than 3 ads are classified. Returns 404 for unknown brands.

### Task 2: POST /api/strategy/generate-concept

Concept generation endpoint that:

- Validates input with Zod enums derived from TAXONOMY (awarenessStage + visualFormat)
- Fetches brand context (distributionJson + top 5 ad copy excerpts by reach)
- Calls Claude Haiku with brand context + gap coordinates
- Returns 5-field concept: visualFormat, creativeMechanic, hook, messagingAngle, productionBrief
- Retries once on malformed JSON output

Concepts are ephemeral (not persisted) -- shown in modal, user can copy.

## Decisions Made

1. **Gap matrix from source data, not cache** -- The gap matrix is computed directly from AdClassification records via a findMany with just awarenessStage + visualFormat selected. This ensures real-time accuracy as classifications are added, rather than depending on potentially stale BrandAnalysisCache data.

2. **Inline JSON parse with retry** -- Used direct JSON.parse + Zod validation rather than the SDK's zodOutputFormat helper. Haiku handles JSON instructions well and the retry pattern (sending back the malformed response with a correction prompt) matches the project's existing callClaudeWithRetry pattern.

3. **Cache-first taxonomyBreakdown** -- distributionJson from BrandAnalysisCache is used when available (avoids re-fetching all 8 classification fields). Falls back to live computation from AdClassification when cache is missing.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. TypeScript compilation clean (no errors in new strategy files)
2. No references to Five Pillars, BrandStrategy model, or old strategy patterns
3. Both routes use proper Next.js 16 params pattern (Promise-based)
4. Input validation with Zod enums tied to TAXONOMY source of truth

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cbe77ad | GET /api/strategy/[pageId] brand strategy data endpoint |
| 2 | b63004e | POST /api/strategy/generate-concept gap cell concept generation |
