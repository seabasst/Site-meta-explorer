---
phase: 62-classification-foundation
plan: 02
subsystem: classification
tags: [prompt-engineering, cost-tracking, few-shot, llm, anthropic]

dependency-graph:
  requires:
    - 62-01 (taxonomy.ts for dynamic prompt building)
  provides:
    - Classification system prompt with 8 categories and 5 few-shot examples
    - buildAdContext() for consistent ad message formatting
    - logApiCost() fire-and-forget cost logger
    - getDailySpend() and getSpendByOperation() cost query functions
  affects:
    - 63 (classification pipeline consumes prompt and cost tracker)
    - 64 (diversity refactor may use cost tracking)

tech-stack:
  added: []
  patterns:
    - Dynamic prompt building from TAXONOMY constant (prompt stays in sync)
    - Fire-and-forget error handling for non-critical logging
    - Per-million-token pricing map for cost estimation

key-files:
  created:
    - src/lib/classification/prompt.ts
    - src/lib/classification/cost-tracker.ts
  modified: []

decisions:
  - id: dynamic-prompt-from-taxonomy
    description: "Prompt categories built dynamically from TAXONOMY, not hardcoded"
    rationale: "Adding/removing taxonomy values automatically updates the prompt"
  - id: fire-and-forget-cost-logging
    description: "logApiCost wraps in try/catch and never throws"
    rationale: "Cost logging failure must never break classification operations"
  - id: value-descriptions-in-prompt
    description: "Each taxonomy value gets a 1-line description explaining when to use it"
    rationale: "LLM needs disambiguation between similar values (e.g., testimonial vs social-proof)"

metrics:
  duration: "5 minutes"
  completed: "2026-03-27"
---

# Phase 62 Plan 02: Classification Prompt & Cost Tracker Summary

**JWT-style one-liner:** Dynamic LLM prompt with 8 taxonomy categories, 5 few-shot examples, and fire-and-forget cost logging to ApiCostLog.

## What Was Done

### Task 1: Create classification system prompt
Created `src/lib/classification/prompt.ts` with two exports:

**`buildClassificationPrompt()`** returns a ~12,800 character system prompt that:
- Dynamically builds category sections from TAXONOMY (values and descriptions)
- Includes VALUE_DESCRIPTIONS map with 1-line explanations for all 71 values
- Provides 5 diverse few-shot examples covering: studio product demo (Nike), UGC testimonial (CeraVe), graphic design sale (Notion), lifestyle skit (AG1), text-overlay listicle (Ritual)
- Ends with 7 classification rules covering hookScore scale, conceptCluster conventions, and confidence calibration

**`buildAdContext()`** formats ad data into a consistent user message string for both single and batch classification.

### Task 2: Create cost tracker utility
Created `src/lib/classification/cost-tracker.ts` with three exports:

1. **`logApiCost(entry)`** - Calculates estimated cost from token counts and PRICING map, writes to ApiCostLog. Entire function body wrapped in try/catch that swallows errors with console.error.
2. **`getDailySpend()`** - Aggregates today's total estimated cost via prisma.apiCostLog.aggregate().
3. **`getSpendByOperation(days)`** - Groups cost by operation name over N days via prisma.apiCostLog.groupBy().

PRICING map covers claude-haiku-4-5-20251001 ($1/$5) and claude-sonnet-4-6-20260327 ($3/$15) with a default fallback.

## Verification Results

| Check | Result |
|-------|--------|
| tsc --noEmit passes for new files | PASS |
| Prompt length > 2000 chars (12,774) | PASS |
| All 8 category names in prompt | PASS |
| 5 few-shot examples in prompt | PASS |
| logApiCost has try/catch (fire-and-forget) | PASS |
| PRICING map has 2 model entries | PASS |
| No new npm dependencies | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS7053 implicit any on category labels access**
- **Found during:** Task 2 verification (full project type-check)
- **Issue:** `category.labels[value]` in buildCategorySection() caused TS7053 because value type spans all categories but labels is typed per-category
- **Fix:** Cast labels to `Record<string, string>` for fallback access
- **Files modified:** src/lib/classification/prompt.ts
- **Commit:** b5f8b94

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | fe68ee7 | feat(62-02): create classification system prompt |
| 2 | b5f8b94 | feat(62-02): create cost tracker utility |

## Next Phase Readiness

Phase 63 (classification pipeline) can proceed. It will:
- Import `buildClassificationPrompt()` and `buildAdContext()` for API calls
- Import `ClassificationOutputSchema` from schemas.ts for zodOutputFormat()
- Call `logApiCost()` after each classification API call
- Write results to AdClassification model

All 4 files in `src/lib/classification/` compile together without errors:
- taxonomy.ts (62-01)
- schemas.ts (62-01)
- prompt.ts (62-02)
- cost-tracker.ts (62-02)
