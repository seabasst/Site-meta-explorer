---
phase: 62-classification-foundation
plan: 01
subsystem: classification
tags: [prisma, taxonomy, zod, classification, data-model]

dependency-graph:
  requires: []
  provides:
    - AdClassification Prisma model with 8 indexed category columns
    - ClassificationJob Prisma model for batch tracking
    - ApiCostLog Prisma model for cost aggregation
    - TAXONOMY constant with 8 categories, 71 values, display labels
    - ClassificationOutputSchema Zod schema with enum constraints
  affects:
    - 62-02 (classification prompt and pipeline)
    - 63 (batch classification pipeline)
    - 64 (diversity refactor reads from AdClassification)
    - 65 (UI reads taxonomy labels)

tech-stack:
  added: []
  patterns:
    - Indexed columns per category (not JSON blobs) for SQL filtering
    - Taxonomy-as-const-arrays with derived Zod enums
    - schemaVersion field for taxonomy evolution

key-files:
  created:
    - src/lib/classification/taxonomy.ts
    - src/lib/classification/schemas.ts
  modified:
    - prisma/schema.prisma

decisions:
  - id: taxonomy-8-categories
    description: "8 classification categories with 71 total values, capped at 12 per category"
    rationale: "Balances coverage with LLM accuracy; 'other' escape hatch for edge cases"
  - id: indexed-columns
    description: "Each category stored as individual indexed String column"
    rationale: "Enables SQL WHERE/GROUP BY for filtering and benchmarking without JSON parsing"
  - id: db-date-for-cost
    description: "ApiCostLog.date uses @db.Date for daily cost aggregation"
    rationale: "PostgreSQL DATE type handles daily bucketing natively"

metrics:
  duration: "4 minutes"
  completed: "2026-03-27"
---

# Phase 62 Plan 01: Prisma Models & Taxonomy Schemas Summary

**JWT-style one-liner:** 8-category classification taxonomy with indexed Prisma models and Zod enum validation on Neon DB.

## What Was Done

### Task 1: Create taxonomy and Zod schemas
Created `src/lib/classification/taxonomy.ts` with the TAXONOMY constant defining all 8 classification categories. Each category has a `values` tuple (for type derivation and Zod enums), a `labels` record (for UI display), and a `description` string. Also exports derived TypeScript types (AssetType, VisualFormat, etc.) and CATEGORY_KEYS for iteration.

Created `src/lib/classification/schemas.ts` with ClassificationOutputSchema — a Zod object using `z.enum()` derived from TAXONOMY values for all 8 categories, plus hookScore (1-10), conceptCluster (string), and confidence (0-1). Pure Zod file — no Anthropic SDK imports.

### Task 2: Add Prisma models and push to Neon DB
Added 3 new models to prisma/schema.prisma:

1. **AdClassification** — 8 category columns (each individually indexed), hookScore, conceptCluster, confidence, classifiedBy, classificationSource, schemaVersion, classifiedAt. One-to-one with AdLibraryAd via unique adId.

2. **ClassificationJob** — Batch tracking with status, progress counters, Anthropic batch API reference, cost tracking fields. Many-to-one with AdLibraryBrand.

3. **ApiCostLog** — Daily cost aggregation with @db.Date, model name, operation, token counts, estimated cost. Indexed by date and date+operation.

Added relation fields: `classification` on AdLibraryAd, `classificationJobs` on AdLibraryBrand.

All 3 tables pushed to Neon DB via `prisma db push`.

## Verification Results

| Check | Result |
|-------|--------|
| TAXONOMY has 8 keys | PASS |
| Total taxonomy values = 71 | PASS |
| ClassificationOutputSchema has 11 fields | PASS |
| Sample classification validates | PASS |
| Invalid enum value rejected | PASS |
| prisma db push succeeds | PASS |
| tsc --noEmit passes (project files) | PASS |
| AdClassification has 8 category indexes | PASS |
| schemaVersion field exists | PASS |
| @db.Date works on Neon | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | cc14d66 | feat(62-01): create taxonomy and Zod schemas |
| 2 | 5138699 | feat(62-01): add Prisma models and push to Neon DB |

## Next Phase Readiness

Phase 62 Plan 02 (classification prompt and pipeline) can proceed. It will:
- Import TAXONOMY from taxonomy.ts to build the system prompt
- Import ClassificationOutputSchema from schemas.ts for zodOutputFormat()
- Write to AdClassification and ClassificationJob models
- Log costs to ApiCostLog

No blockers identified.
