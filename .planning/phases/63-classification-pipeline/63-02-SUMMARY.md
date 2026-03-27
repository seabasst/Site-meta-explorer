---
phase: 63-classification-pipeline
plan: 02
subsystem: classification
tags: [anthropic-batch-api, cron, classification, prisma]

dependency-graph:
  requires: [62-01, 62-02]
  provides: [batch-classification-pipeline, classification-cron-polling]
  affects: [63-03, 63-04]

tech-stack:
  added: []
  patterns: [fire-and-forget-submission, cron-polling, bulk-insert-with-skipDuplicates]

key-files:
  created:
    - src/lib/classification/classify-batch.ts
    - src/app/api/classify/batch/route.ts
    - src/app/api/classify/batch/status/route.ts
    - src/app/api/ad-library/cron/classify-poll/route.ts
  modified:
    - vercel.json

decisions:
  - id: batch-fire-and-forget
    decision: "POST /api/classify/batch returns immediately; submission runs in background with .catch() error handler"
    reason: "Avoids HTTP timeout for large batches; job status tracks progress"
  - id: cron-5min-polling
    decision: "Cron polls every 5 minutes (*/5 * * * *) for active batch jobs"
    reason: "Responsive UX while keeping costs minimal (just a DB query when idle)"
  - id: skip-duplicates
    decision: "createMany with skipDuplicates prevents double-insertion if cron runs twice"
    reason: "Idempotent result processing is critical for cron reliability"

metrics:
  duration: "3m 2s"
  completed: "2026-03-27"
---

# Phase 63 Plan 02: Batch Classification Pipeline Summary

**Batch classification pipeline with Anthropic Batch API submission, progress tracking, cost estimation, and cron-based result polling.**

## What Was Built

### 1. classify-batch.ts Library (src/lib/classification/classify-batch.ts)

Two exported functions:

- **submitBatchClassification(jobId)**: Queries unclassified ads for a brand, builds batch requests with optional vision (image URLs from R2), submits to `client.messages.batches.create()`. Handles 10K batch size limit with truncation. Updates job status to "processing".

- **processBatchResults(jobId)**: Retrieves batch status, streams results when ended, validates each with `ClassificationOutputSchema.parse()`, determines classificationSource (vision vs text) via bulk AdAsset query, bulk-inserts via `prisma.adClassification.createMany({ skipDuplicates: true })`. Logs cost via fire-and-forget.

### 2. Batch API Routes

- **POST /api/classify/batch**: Accepts `{ brandId }`, checks for active jobs (409 conflict), counts unclassified ads, estimates cost using Haiku batch pricing, creates ClassificationJob, fires-and-forgets submission. Returns `{ jobId, estimatedCost, unclassifiedAds, alreadyClassified }`.

- **GET /api/classify/batch/status?jobId=X**: Returns job with computed `progress` (0-1 fraction) and `isComplete` boolean.

### 3. Cron Polling Route (src/app/api/ad-library/cron/classify-poll/route.ts)

Polls all active batch jobs (status: "processing" with anthropicBatchId). Processes each independently -- failure in one does not block others. Failed jobs marked with error message. Same auth pattern as existing asset cron.

### 4. vercel.json Update

Added 4th cron entry: classify-poll at `*/5 * * * *` (every 5 minutes).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. TypeScript compiles with no errors in new files
2. vercel.json is valid JSON with 4 cron entries
3. Exports verified: submitBatchClassification, processBatchResults from classify-batch.ts
4. POST, GET handlers exported from respective route files

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a3e6630 | classify-batch.ts with batch submission and result processing |
| 2 | 3765f68 | Batch API routes (start + status) |
| 3 | f51302b | Cron polling route + vercel.json entry |
