# Roadmap: Ad Library Pro

## Milestones

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-25</summary>
Phases 1-4
</details>

<details>
<summary>✅ v1.1 Polish (Phase 5) - SHIPPED 2026-01-25</summary>
Phase 5 (phases 6-9 superseded by v2.1)
</details>

<details>
<summary>✅ v2.0 Payments & Auth (Phases 10-13) - SHIPPED 2026-01-27</summary>
Phases 10-13
</details>

<details>
<summary>✅ v2.1 Polish & UX (Phases 14-17.2) - SHIPPED 2026-02-01</summary>
Phases 14-17.2
</details>

<details>
<summary>✅ v3.0 Brand Tracking (Phases 24-27) - SHIPPED 2026-02-02</summary>
Phases 24-27
</details>

<details>
<summary>✅ v3.1 Competitive Intelligence (Phases 28-31) - SHIPPED 2026-02-03</summary>
Phases 28-31
</details>

<details>
<summary>✅ v5.0 Product Refocus (Phases 38-43) - SHIPPED 2026-03-17</summary>
Phases 38-43
</details>

<details>
<summary>✅ v5.1 Visual Consistency (Phases 44-45) - SHIPPED 2026-03-18</summary>
Phases 44-45
</details>

<details>
<summary>✅ v6.0 Ad Library UX Overhaul (Phases 46-51) - SHIPPED 2026-03-20</summary>
Phases 46-51 — See milestones/v6.0-ROADMAP.md for full details
</details>

<details>
<summary>✅ v6.1 Brand Monitoring & Cleanup (Phases 52-54) — SHIPPED 2026-03-21</summary>
Phases 52-54 — See milestones/v6.1-ROADMAP.md for full details
</details>

<details>
<summary>✅ v7.0 Creative Lab (Phases 55-61) — SHIPPED 2026-03-26</summary>
Phases 55-61 — Creative analysis, AI generation, UGC briefs, brand guidelines, gap closure
</details>

---

### v8.0 Creative Strategy Engine (In Progress)

**Milestone Goal:** Replace Five Pillars with Motion-powered ad classification, then build competitor-grounded strategy generation and category benchmarking on top.

## Phases

- [x] **Phase 62: Classification Foundation** - Prisma models, taxonomy definition, cost tracking utility
- [x] **Phase 63: Classification Pipeline** - On-demand single-ad + Anthropic Batch API bulk classification
- [x] **Phase 64: Diversity Refactor** - Rewrite diversity route to read stored classifications instead of re-classifying
- [x] **Phase 65: Classification UI** - Distribution charts per dimension + classification tags in ad detail
- [ ] **Phase 66: Strategy Engine** - Brand context auto-populate, gap matrix, concept generation from gaps
- [ ] **Phase 67: Category Benchmarking** - Brand vs category comparison across classification dimensions

## Phase Details

### Phase 62: Classification Foundation
**Goal**: Define the classification data model and taxonomy that all downstream features depend on
**Depends on**: Nothing (first phase)
**Requirements**: CLSF-02, CLSF-04
**Plans:** 2 plans

Plans:
- [ ] 62-01-PLAN.md — Prisma models (AdClassification, ClassificationJob, ApiCostLog) + taxonomy + Zod schemas
- [ ] 62-02-PLAN.md — Classification prompt with few-shot examples + cost tracker utility

**Success Criteria** (what must be TRUE):
  1. AdClassification, ClassificationJob, and ApiCostLog Prisma models exist with indexed columns (not JSON blobs)
  2. Classification taxonomy is defined with ~8-10 categories and ~10 tags each (visual format, hook tactic, messaging angle, awareness stage, creative mechanic, offer type, intended audience, asset type)
  3. Classification prompt with few-shot examples produces consistent results across sample ads
  4. Cost tracker utility can log API spend per classification job

### Phase 63: Classification Pipeline
**Goal**: Users can classify individual ads on-demand and trigger batch classification of entire brands
**Depends on**: Phase 62
**Requirements**: CLSF-01, CLSF-03, CLSF-05
**Research flag**: Likely — verify Anthropic Batch API behavior with Vision requests
**Success Criteria** (what must be TRUE):
  1. User can trigger AI classification of a single ad and see results in 2-4 seconds
  2. User can trigger batch classification of a brand's ads via Anthropic Batch API
  3. Batch jobs track progress (pending/processing/complete/failed) and display estimated cost
  4. Classifications are persisted to AdClassification table and never re-computed for already-classified ads
**Plans:** 2 plans

Plans:
- [ ] 63-01-PLAN.md — Single-ad on-demand classification (classify-single lib + POST API route)
- [ ] 63-02-PLAN.md — Batch classification pipeline (classify-batch lib + batch API routes + cron polling)

### Phase 64: Diversity Refactor
**Goal**: Eliminate redundant AI calls by making diversity analysis read from stored classifications
**Depends on**: Phase 63 (classifications must exist in DB)
**Requirements**: CLSF-06
**Research flag**: Unlikely — straightforward refactor of existing route
**Success Criteria** (what must be TRUE):
  1. `/api/analyze/diversity` reads from AdClassification table instead of calling Claude Vision per-request
  2. Diversity scores reflect actual stored classification data
  3. BrandAnalysisCache is updated with classification-based scores
  4. No AI classification calls are made during diversity analysis (only recommendation generation)
**Plans:** 2 plans

Plans:
- [ ] 64-01-PLAN.md — Schema migration + diversity route refactor (DB read replaces Claude classification)
- [ ] 64-02-PLAN.md — Frontend + benchmark + creative-lab routes updated to 8-category taxonomy

### Phase 65: Classification UI
**Goal**: Make classification data visible — distribution charts and per-ad tags
**Depends on**: Phase 64 (data should be real, not ephemeral)
**Requirements**: REPT-01, REPT-02
**Research flag**: Unlikely — frontend work with data already available
**Success Criteria** (what must be TRUE):
  1. User sees distribution bar charts per classification dimension (e.g., "30% testimonial, 5% listicle")
  2. Individual ads display their classification tags in ad detail view
  3. Brand classification coverage is visible (X of Y ads classified)
**Plans:** 2 plans

Plans:
- [ ] 65-01-PLAN.md — Distribution charts + coverage indicator on brand detail page
- [ ] 65-02-PLAN.md — Classification tags in ad detail lightbox

### Phase 66: Strategy Engine
**Goal**: Users can analyze any brand's creative strategy and generate concepts that fill identified gaps
**Depends on**: Phase 65 (users need to see classification data before strategy builds on it)
**Requirements**: BRND-01, STRT-01, STRT-02, STRT-03, STRT-04, STRT-05
**Plans:** 2 plans

Plans:
- [ ] 66-01-PLAN.md — Strategy API + brand context (GET /api/strategy/[pageId] with gap matrix, POST /api/strategy/generate-concept)
- [ ] 66-02-PLAN.md — Strategy UI (rewrite strategy-view.tsx, gap-matrix.tsx component, concept generation modal)

**Success Criteria** (what must be TRUE):
  1. Brand profile auto-populates from existing DB data (ads, category, demographics) without manual input
  2. User can select any brand and see their full creative taxonomy breakdown (format distribution, tactic usage, awareness stage coverage)
  3. User can view an interactive gap matrix crossing awareness stages x creative formats with coverage heatmap
  4. User can click a gap cell to auto-generate creative concepts targeting that gap
  5. Generated concepts include visual format, creative mechanic, hook, messaging angle, and production brief

### Phase 67: Category Benchmarking
**Goal**: Users can compare a brand's creative strategy against category averages
**Depends on**: Phase 66 (strategy engine provides the per-brand data)
**Requirements**: BNCH-01, BNCH-02
**Research flag**: Likely — evaluate data coverage (brands per category with enough classified ads)
**Success Criteria** (what must be TRUE):
  1. User can compare a brand's classification dimension distribution against category averages
  2. Comparison shows index scores (e.g., "2x over-indexed on testimonials, 0.5x under-indexed on listicles")
  3. Category averages are computed from all classified brands in that category
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 62 → 63 → 64 → 65 → 66 → 67

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 62. Classification Foundation | 2/2 | ✓ Complete | 2026-03-27 |
| 63. Classification Pipeline | 2/2 | ✓ Complete | 2026-03-27 |
| 64. Diversity Refactor | 2/2 | ✓ Complete | 2026-03-27 |
| 65. Classification UI | 2/2 | ✓ Complete | 2026-03-27 |
| 66. Strategy Engine | 0/2 | Planned | — |
| 67. Category Benchmarking | 0/TBD | Not started | — |

---
*Last updated: 2026-03-27 — Phase 66 planned*
