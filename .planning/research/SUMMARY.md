# Research Summary -- v8.0 Creative Strategy Engine

**Synthesized:** 2026-03-27
**Dimensions:** Stack, Features, Architecture, Pitfalls
**Overall confidence:** HIGH

## Executive Summary

The v8.0 Creative Strategy Engine adds AI Vision-based ad classification, strategy gap analysis, and creative concept generation to an existing ad intelligence platform with 514+ brands. Research across all 4 dimensions converges on a clear architecture: **persist per-ad classifications** (the single biggest architectural change), use **Claude Haiku 4.5 Vision + Batch API** for cost-effective classification (~$51 for 25K ads), extend the **existing 3-step strategy pipeline** to 6 steps, and manage costs with a **daily budget tracker**.

The platform's unique differentiator is **competitor-grounded strategy** -- Motion requires your own ad account, Foreplay requires manual saving, but this platform already has 514+ brands of competitor data. No competitor offers "pick any brand, see their creative taxonomy, generate strategy exploiting their gaps."

### Three Critical Decisions

1. **Start with ~8-10 categories, not 46 formats.** The planned 46x8x35x5x8 taxonomy (515K combinations) is unusable. Motion uses 8 categories. Start there, expand after validation.

2. **Persist classifications, don't recompute.** The current diversity route classifies-and-discards on every run. Storing per-ad classifications in an `AdClassification` table eliminates redundant AI calls and enables all downstream features (gap analysis, benchmarking, filtering).

3. **Batch API + cron polling, not Inngest.** The Anthropic Batch API (50% discount, up to 100K requests) handles the heavy lifting. Vercel cron polls for completion. No new infrastructure dependencies needed beyond what already exists.

## Key Findings by Dimension

### Stack
- **Stay with Claude.** Haiku 4.5 for classification ($0.002/ad with batch+cache), Sonnet 4.6 for strategy ($0.12/brand).
- **One-time backfill cost: ~$82** (25K ads classification + 500 brands strategy).
- **Incremental cost: ~$0.002/ad** for new ads.
- **Only new dependency:** Potentially `inngest` for job orchestration, but Batch API + cron may suffice.
- **Avoid:** OpenAI/Gemini (no benefit over existing Claude integration), LangChain (over-abstraction), pgvector/embeddings (wrong tool for categorical data), BullMQ/Redis (unnecessary infrastructure).

### Features
- **Table stakes:** Per-ad classification taxonomy, brand context auto-population, strategy from data, hook generation, visual reporting.
- **Differentiators:** Competitor-grounded strategy (primary), interactive gap matrix, category benchmarking, creative concept generation from gaps.
- **Anti-features:** Full image generation (AdCreative.ai owns this), swipe file/Chrome extension (Foreplay owns this), ad account connection (removes competitor intelligence advantage), team collaboration.
- **Critical path:** Classification Engine -> Gap Matrix -> Concept Generation.
- **Motion's taxonomy:** 8 categories (Asset Type, Visual Format, Hook Tactic, Messaging Angle, Seasonality, Offer Type, Intended Audience, Creative Angle). Start here, not with 46 formats.

### Architecture
- **Two-tier classification:** On-demand single-ad (Haiku 4.5, 2-4s, ~$0.005/ad) + Anthropic Batch API (50% discount, async <1hr) for bulk.
- **New Prisma models:** `AdClassification` (per-ad, indexed columns not JSON), `ClassificationJob` (batch state), `ApiCostLog` (cost tracking).
- **Diversity route refactor:** Currently ephemeral (classify-discard-aggregate). Becomes pure DB aggregation from stored classifications.
- **Strategy pipeline:** Extend existing 3-step to 6-step. Steps 4-6 add mechanics, formats, gap analysis.
- **Vercel constraints solvable:** `after()` for small batches, Batch API for large ones, cron polling for completion.

### Pitfalls (by severity)
- **Critical:** Vision API cost explosion without caching, Vercel timeout on multi-image calls, classification inconsistency across runs.
- **High:** Taxonomy bloat (46 formats unusable), strategy converging to generic advice, database bloat from JSON classifications, 4.5MB payload limit, no cost tracking.
- **Medium:** Missing images degrading quality, dashboard-for-dashboards UX, prompt caching not utilized, strategy context loss between steps, race conditions on concurrent analysis, cold starts, maxDuration mismatches.

## Cross-Cutting Themes

1. **Classification is the foundation.** Every research dimension identifies per-ad classification as the prerequisite for all other features. Build it first, build it right.

2. **Cost control is non-negotiable.** At ~$0.005/ad standard rate, costs scale linearly. Batch API (50% off) + prompt caching (90% off on system prompt) + persistent caching (classify once) are all required.

3. **Start simple, expand later.** Both Features and Pitfalls research strongly recommend starting with Motion's 8-category approach (~10 tags per category) rather than the planned 46x8x35x5x8 taxonomy.

4. **The existing codebase is a strong foundation.** The 3-step strategy pipeline, diversity analysis, brand analysis cache, and Anthropic SDK integration all extend cleanly. No rewrites needed.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Classification Foundation
- **Rationale:** Every feature depends on stored per-ad classifications. This is the foundation.
- **Scope:** AdClassification + ClassificationJob + ApiCostLog Prisma models, cost tracker utility, classification taxonomy definition (8-10 categories, ~10 tags each), classification prompt with few-shot examples
- **Addresses:** TS-1 (Features), Decision 1 (Architecture), Pitfalls 1/3/6/15
- **Risk:** Medium (prompt engineering for taxonomy accuracy)

### Phase 2: Single-Ad + Batch Classification Pipeline
- **Rationale:** Two-tier classification enables both interactive and bulk use cases.
- **Scope:** `/api/classify/vision` route (on-demand), Anthropic Batch API wrapper, `/api/classify/batch` + `/api/classify/cron` routes, ClassificationJob lifecycle
- **Addresses:** Architecture Tier 1+2, Pitfalls 2/10/16/17
- **Risk:** Medium (Batch API integration, polling logic)

### Phase 3: Diversity Analysis Refactor
- **Rationale:** Highest-value refactor -- eliminates redundant AI calls from the most-used analysis route.
- **Scope:** Refactor `/api/analyze/diversity` to read from AdClassification table, remove ephemeral classification, keep recommendation AI call, update BrandAnalysisCache
- **Addresses:** Architecture Decision 1, Pitfalls 1/7/12
- **Risk:** Low (straightforward refactor)

### Phase 4: Classification UI + Distribution Charts
- **Rationale:** Make classification data visible and browsable before building strategy on top.
- **Scope:** Distribution charts per dimension, classification tags in ad detail, filtered views by classification, brand classification coverage stats
- **Addresses:** TS-5 (Features), Pitfall 9 (progressive disclosure UX)
- **Risk:** Low (frontend work, data already available)

### Phase 5: Strategy Engine Extension
- **Rationale:** Extend proven 3-step pipeline with classification-informed gap analysis.
- **Scope:** Steps 4-6 (mechanics, formats, gap analysis), competitor-grounded strategy, gap matrix UI, concept generation from gaps
- **Addresses:** DF-1/DF-2/DF-4 (Features), Strategy pipeline (Architecture), Pitfall 5/11
- **Risk:** Medium (LLM output quality, UX complexity)

### Phase 6: Category Benchmarking
- **Rationale:** Requires sufficient classified brands per category. Run after bulk classification.
- **Scope:** Cross-brand aggregation, brand vs category comparison, index scores, benchmark UI
- **Addresses:** DF-3 (Features), Phase 6 (Architecture)
- **Risk:** Medium (data coverage dependency)

### Phase Ordering Rationale
- **Phase 1 before all:** Everything depends on the classification data model and taxonomy definition.
- **Phase 2 before 3:** Diversity refactor assumes classifications exist in DB.
- **Phase 3 before 4:** UI should show real classified data, not ephemeral results.
- **Phase 4 before 5:** Users need to see classification data before strategy builds on it.
- **Phase 5 before 6:** Benchmarking is additive; strategy is the core value.
- **Phases 2+4 could partially overlap:** Batch classification (backend) and UI work can proceed in parallel once Phase 1 is done.

### Research Flags for Phases
- **Phase 1:** Needs taxonomy validation spike -- classify 50 sample ads, measure accuracy across proposed categories. This is the riskiest design decision.
- **Phase 2:** Verify Anthropic Batch API behavior with Vision requests (batch + vision + caching interaction).
- **Phase 5:** Strategy quality needs testing -- generate strategies for 5 brands, evaluate specificity vs. generic-ness.
- **Phase 6:** Evaluate data coverage first -- how many brands per category have enough ads for meaningful benchmarks?

## Open Questions

1. **Vercel plan tier?** Hobby (300s max) vs Pro (800s max) significantly affects architecture. Pro is recommended ($20/mo).
2. **Exact taxonomy values?** Motion's 8 categories are confirmed but exact tag lists per category are product IP. Need to define our own.
3. **Inngest vs cron-only?** Stack research recommends Inngest; Architecture research shows cron+Batch API may suffice. Decision can be deferred to Phase 2.
4. **AdAnalysis deprecation?** Existing per-ad Vision analysis (`AdAnalysis` model) overlaps with `AdClassification`. Decide whether to deprecate or keep for different purpose.

## Confidence Assessment

| Dimension | Confidence | Key Uncertainty |
|-----------|------------|-----------------|
| Stack | HIGH | Inngest vs cron decision |
| Features | MEDIUM-HIGH | Motion taxonomy exact values |
| Architecture | HIGH | Batch API + Vision + caching interaction |
| Pitfalls | HIGH | Actual classification accuracy at scale |
