# Pitfalls Research -- Creative Strategy Engine (v8.0)

**Domain:** AI-powered ad creative classification, strategy generation, and gap analysis
**Researched:** 2026-03-27
**Overall confidence:** HIGH (grounded in codebase analysis + official docs + domain experience)

## Executive Summary

The v8.0 milestone adds Claude Vision-based ad classification (46 visual formats, 8 creative mechanics, 35 hook tactics, 5 awareness stages, 8 psychological triggers), brand strategy intake, gap analysis, hook generation, and creative concept generation. The primary risks are: (1) Vision API costs scaling linearly with ad count without caching, (2) classification inconsistency making strategy outputs unreliable, (3) taxonomy bloat making the UX incomprehensible, (4) Vercel timeout limits colliding with multi-image Vision calls, and (5) LLM-generated strategies converging to generic advice. The existing codebase already shows early signs of several of these pitfalls in the current diversity analysis route.

---

## Critical Pitfalls

### 1. Vision API Cost Explosion on Re-analysis

- **What goes wrong:** The current `diversity/route.ts` classifies up to 100 ads per brand per analysis run using Claude Sonnet. Adding Vision (image input) increases token cost per ad from ~200 tokens (text-only body/title) to ~1,600 tokens per image (1000x1000px = ~1,334 tokens per Anthropic docs). A brand with 100 ads and 1 image each = ~133,400 input tokens per analysis. At Sonnet 4.6 pricing ($3/M input), that is ~$0.40 per brand analysis. Sounds small, but: (a) users re-run analysis when they revisit, (b) category benchmarking runs analysis for multiple brands, (c) there is no cache invalidation strategy -- the current `BrandAnalysisCache` stores scores but not per-ad classifications, so every re-analysis re-classifies everything from scratch.
- **Warning signs:** API costs climbing 5-10x after Vision launch. Users triggering re-analysis on the same brand within hours. Benchmark comparisons triggering N brand analyses simultaneously.
- **Prevention:**
  - Store per-ad Vision classifications in a dedicated `AdClassification` table (keyed by adId + classificationVersion). Only classify new/changed ads on re-analysis.
  - Add a `classifiedAt` timestamp to track staleness. Only re-classify ads older than a configurable threshold (e.g., 7 days).
  - Use the Anthropic Batch API for bulk classification (50% cost reduction, 24h turnaround) for background/batch jobs. Reserve synchronous Vision calls for single-ad or small-batch on-demand analysis.
  - Set per-brand daily classification limits. Track API spend in a `CostLedger` table.
- **Phase to address:** Phase 1 (Ad Classification foundation) -- this must be the architecture before any Vision calls ship.
- **Severity:** Critical

### 2. Vercel Function Timeout on Multi-Image Vision Requests

- **What goes wrong:** The current `diversity/route.ts` already uses `maxDuration = 300` (5 minutes, the Hobby plan maximum). Vision API calls with multiple images take significantly longer than text-only calls. Classifying 50-100 ads with images in a single Claude call could easily exceed 60-120 seconds per call, and the route makes 2 sequential Claude calls (classify + recommend). With Vision, the total could exceed 5 minutes. On Vercel Pro, the max is 800 seconds with Fluid Compute, but the Hobby plan caps at 300s. The existing `generate-strategy/route.ts` only has `maxDuration = 60`, which is too low for any Vision work.
- **Warning signs:** Intermittent 504 timeouts on analysis for brands with many ads. Timeouts appearing more frequently during peak hours (Claude API latency increases). Users seeing "Analysis Failed" after long waits.
- **Prevention:**
  - Never send 100 images in one API call. Batch into groups of 10-20 images per call, run them in parallel (Promise.allSettled), and aggregate results.
  - Use streaming responses for long-running classification. Return partial results to the frontend while classification continues.
  - Move bulk classification to a background job pattern: API route triggers classification, returns immediately with a job ID, frontend polls for completion. Consider Vercel Cron or an external queue (Upstash QStash).
  - Set `maxDuration` appropriately per route: 300s for analysis routes, 60s for strategy generation (text-only).
  - Pre-classify ads in the background (on ingestion or via cron) so the analysis route only reads cached results, never waits for Vision.
- **Phase to address:** Phase 1 (Ad Classification) -- architecture decision before implementation.
- **Severity:** Critical

### 3. Classification Inconsistency Across Runs

- **What goes wrong:** Claude Vision classification is non-deterministic. The same ad image classified twice may get different labels (e.g., "lifestyle" vs "ugc" for a casual photo, or "problem-solving" vs "educational" for an informational ad). The current text-only classification already has this issue -- concept clusters like "discount-offer" vs "sale-promo" vs "price-deal" proliferate because Claude does not normalize consistently. With 46 visual formats, 8 mechanics, 35 hook tactics, 5 awareness stages, and 8 psychological triggers, the combinatorial inconsistency becomes catastrophic. Strategy recommendations built on inconsistent classifications will be unreliable.
- **Warning signs:** Same brand analyzed twice showing different diversity scores (more than 5-point swings). Concept clusters proliferating with near-synonyms. Users noticing recommendations changing without any actual ad changes. Gap analysis contradicting itself across runs.
- **Prevention:**
  - Use `temperature: 0` for all classification calls (reduces but does not eliminate non-determinism).
  - Provide explicit examples in the prompt for each category value (few-shot classification). Current prompts list categories but do not show example ads for each category.
  - Use constrained output: instead of free-text classification, structure the prompt to select from an enum. Consider using Claude's tool_use feature to enforce schema compliance.
  - Store classifications persistently (per-ad, versioned) and only re-classify when the ad creative changes or the classification schema version changes.
  - For concept clusters: define a fixed taxonomy of clusters rather than letting Claude invent labels. The current approach of "assign a short 2-3 word lowercase hyphenated label" guarantees inconsistency.
  - Run classification twice and compare -- flag disagreements for human review or use majority voting (3 runs, take consensus). This triples cost but may be worth it for critical taxonomies.
- **Phase to address:** Phase 1 (Classification schema design + prompt engineering) -- must be validated before building strategy layers on top.
- **Severity:** Critical

---

## High-Priority Pitfalls

### 4. Taxonomy Bloat: 46 Formats x 8 Mechanics x 35 Hooks x 5 Stages x 8 Triggers = Unusable

- **What goes wrong:** The planned taxonomy has 46 visual formats, 8 creative mechanics, 35 hook tactics, 5 awareness stages, and 8 psychological triggers. The cross-product is 515,200 combinations. No brand will ever have enough ads to meaningfully populate this space. Most cells in the strategy matrix will be empty, making gap analysis meaningless ("you're missing a Pattern Interrupt + Product-Shot + Urgency + Most-Aware ad" -- that is not actionable). Users will be overwhelmed by dimensions they do not understand or care about.
- **Warning signs:** Gap analysis producing 50+ recommendations. Users ignoring the strategy output. Diversity scores showing low numbers everywhere because the taxonomy is too fine-grained for any brand to score well. Classification accuracy dropping because Claude cannot reliably distinguish 46 visual formats.
- **Prevention:**
  - Start with the existing 5-pillar taxonomy (format: 6 values, tone: 8, journey: 3, visual: 8, messenger: 5) which is already in production and working. This is 7,200 combinations -- still large but manageable.
  - Add new dimensions incrementally, one at a time, validated against real classification accuracy before shipping.
  - Group the 46 visual formats into 8-10 parent categories for display. Only show sub-categories when drilling down.
  - For the strategy matrix, show only the top 2-3 dimensions that have the most actionable gaps, not all dimensions simultaneously.
  - Use a "progressive disclosure" UX pattern: show high-level scores first, drill into details on click.
  - Hard rule: no dimension should have more than 10 values for classification. If it does, it needs hierarchy (parent > child).
- **Phase to address:** Phase 1 (Taxonomy design) -- must be finalized before any classification implementation.
- **Severity:** High

### 5. Strategy Generation Converging to Generic Advice

- **What goes wrong:** The current `generate-strategy/route.ts` already shows this pattern. LLM-generated personas, messaging angles, and hooks tend toward safe, generic advice because: (a) the prompt asks Claude to "infer from ad copy" but only provides 10 ads with truncated body text, (b) without specific brand knowledge (USPs, competitor positioning, pricing), Claude falls back to category-generic advice, (c) the "8 psychological triggers" framework forces output into a template that makes all brands' hooks sound similar. The result: a fitness brand and a skincare brand get nearly identical strategy outputs with different nouns swapped in.
- **Warning signs:** Users generating strategies for different brands in the same category and getting near-identical output. Hook text feeling templated ("Tired of [pain point]? [Brand] is different."). Personas being obvious archetypes rather than insights. Users not implementing the generated hooks.
- **Prevention:**
  - Feed MORE brand-specific data into the strategy prompt: full ad copy (not truncated to 200-300 chars), actual performance data (reach, engagement), competitor comparison data, brand guidelines from `BrandGuidelines` table.
  - Require the user to provide brand-specific inputs (USPs, pricing, competitive advantages) BEFORE generating strategy. The current Step 1 makes these optional -- they should be required for quality output.
  - Add a "differentiation check": after generating strategy, run a second Claude call that evaluates whether the strategy could apply to any brand in the category or is specific to this brand. Reject and regenerate if generic.
  - Include competitor hooks in the prompt context so Claude can explicitly differentiate: "Your competitors use X approach, so instead try Y."
  - Generate fewer, better hooks (8-10) rather than many generic ones (15-20). Quality over quantity.
- **Phase to address:** Phase 3 (Strategy Generation) and Phase 4 (Hook Generation) -- but the data pipeline must be built in Phase 1-2.
- **Severity:** High

### 6. Database Bloat from Classification Results

- **What goes wrong:** If every ad gets classified across 5+ dimensions with Vision, plus concept clusters, hook scores, and full analysis JSON, the data grows fast. The current `AdAnalysis` model stores `fullAnalysis Json?` which is unbounded. With v8.0 adding per-ad classification across 46 formats + 8 mechanics + 35 hooks + 5 stages + 8 triggers, the JSON blob per ad could be 2-5KB. For a brand with 500 ads, that is 1-2.5MB of classification data per brand. Across 1000+ brands in the database, this becomes significant. More importantly, querying and aggregating this data for benchmarking becomes slow without proper indexing.
- **Warning signs:** Slow benchmark/comparison queries. `BrandAnalysisCache` table growing faster than expected. API routes taking longer to aggregate classification data. Prisma queries timing out on large JSON aggregations.
- **Prevention:**
  - Store classification dimensions as indexed columns, NOT in a JSON blob. Each dimension (format, tone, journey, visual, messenger, mechanic, hookTactic, awarenessStage, trigger) should be its own column with an enum-like constraint.
  - Use a separate `AdClassification` table (one row per ad, columns per dimension) rather than stuffing everything into `AdAnalysis.fullAnalysis`.
  - Pre-aggregate distribution counts into `BrandAnalysisCache` on classification completion. Never aggregate at query time from raw per-ad data.
  - Add database indexes on classification columns for fast filtering/grouping.
  - Implement TTL-based cleanup: delete classifications older than 90 days for inactive ads. Classification data for deleted/inactive ads should be archived or purged.
- **Phase to address:** Phase 1 (Schema design) -- the data model must be right before data starts flowing in.
- **Severity:** High

### 7. Vercel 4.5MB Payload Limit on Classification Responses

- **What goes wrong:** The current diversity route returns full classification results for all ads plus recommendations plus Andromeda metrics in a single JSON response. With Vision classification adding image analysis details, the response payload can easily approach or exceed Vercel's 4.5MB body size limit. This is especially true if `classifications` array contains 100 ads with extended analysis across many dimensions. The error is a hard 413 with no graceful fallback.
- **Warning signs:** `FUNCTION_PAYLOAD_TOO_LARGE` errors in Vercel logs. Brands with 80+ ads failing analysis while smaller brands succeed. Inconsistent behavior based on ad count.
- **Prevention:**
  - Never return raw per-ad classifications in the API response. Return only aggregated scores and distributions.
  - Store per-ad classifications in the database; let the frontend fetch individual ad classifications via a separate paginated endpoint if needed.
  - Compress the response: remove redundant data, use abbreviated keys, omit null values.
  - Add a response size check before sending: if estimated size > 3MB, strip detailed data and return only summaries.
- **Phase to address:** Phase 1 (API design) -- response shape must be designed for the payload limit.
- **Severity:** High

---

## Medium-Priority Pitfalls

### 8. Vision Classification Without Image = Degraded Quality

- **What goes wrong:** Not all ads in the database have downloaded assets. The `AdAsset` table has `downloadStatus` which can be "pending" or "failed". If Vision classification is attempted on ads without images, it falls back to text-only classification, producing inconsistent results compared to ads that were classified with images. The strategy layer does not know which ads were classified with vs without images, leading to unreliable diversity scores.
- **Warning signs:** Diversity scores being artificially low for brands where asset download failed. Visual style classification being random for ads without images. Inconsistent classification quality within the same brand.
- **Prevention:**
  - Track classification method (text-only vs vision) per ad. Include this in quality metrics.
  - Only include vision-classified ads in visual dimension scores. Use text-only classification for non-visual dimensions (tone, journey phase, messenger) regardless.
  - Before running analysis, check asset download coverage. If < 70% of ads have images, warn the user and offer to trigger asset download first.
  - Separate visual classification from text classification: run them as independent pipelines that can be combined.
- **Phase to address:** Phase 1 (Classification pipeline design).
- **Severity:** Medium

### 9. UX: Dashboard-for-Dashboards Problem

- **What goes wrong:** The v8.0 scope includes diversity scores (5 pillars), Andromeda metrics (7+ sub-metrics), awareness stages (5), psychological triggers (8), visual formats (46), creative mechanics (8), hook tactics (35), strategy matrix, personas, messaging angles, prioritized angles, and generated hooks. Presenting all of this creates a "dashboard-for-dashboards" where users see numbers everywhere but cannot determine what to DO. The current analysis view already shows 6 diversity score pills + Andromeda metrics + recommendations -- adding more dimensions will overwhelm.
- **Warning signs:** Users spending time looking at the analysis but not taking action (generating strategies or hooks). Low conversion from analysis view to strategy generation. Users asking "what does this score mean?" Support requests about interpreting metrics.
- **Prevention:**
  - Lead with ONE headline insight: "Your biggest gap is X. Here is what to do about it."
  - Hide detailed breakdowns behind expandable sections. Default view should show: overall score, top 3 gaps, suggested actions.
  - Use the "newspaper front page" pattern: headline (biggest gap), subhead (2-3 supporting insights), body (full details for those who want them).
  - Every metric shown must have a paired action. If a metric does not suggest a clear action, do not show it.
  - Limit the initial view to the 5 existing pillars + 1 new "strategic readiness" score. Only show additional dimensions in a detailed breakdown.
  - A/B test the analysis view: track whether users who see fewer metrics are MORE likely to take action.
- **Phase to address:** Phase 2 (Strategy Matrix UI) and Phase 5 (Gap Analysis UI).
- **Severity:** Medium

### 10. Prompt Caching Not Utilized for Repeated Classification Prompts

- **What goes wrong:** The classification prompt is largely identical across all brands -- only the ad data changes. The system prompt, taxonomy definitions, format rules, and output schema are the same every time. Without prompt caching, these ~2,000 tokens of instructions are charged at full price on every API call. For a platform classifying ads across hundreds of brands, this adds up. Anthropic offers prompt caching that can reduce costs by up to 90% for the cached prefix.
- **Warning signs:** Input token costs being higher than expected relative to actual ad data volume. Classification costs not decreasing as volume increases.
- **Prevention:**
  - Structure classification prompts with a static system prompt (taxonomy + rules + output schema) and dynamic user content (ad data). The system prompt is cacheable.
  - Use Anthropic's prompt caching feature (`cache_control` parameter) on the system prompt portion.
  - For batch classification, group multiple brands' ads into the same prompt format to maximize cache hits.
  - Monitor cache hit rates via Anthropic's API response headers.
- **Phase to address:** Phase 1 (Classification implementation) -- should be built in from the start.
- **Severity:** Medium

### 11. Strategy Steps Losing Context Between Calls

- **What goes wrong:** The current 3-step strategy flow (Brand Profile -> Messaging Strategy -> Ad Hooks) stores intermediate results in the database and passes them to subsequent steps. But each step is a separate Claude call with no conversation memory. Step 3 (hooks) receives the full strategy matrix JSON in its prompt, which can be 3,000-5,000 tokens. As v8.0 adds more steps (mechanics, formats, concepts), each subsequent step needs the full context of all previous steps, bloating prompts and costs. More critically, the LLM can contradict earlier steps because it has no true memory of generating them.
- **Warning signs:** Hooks not aligning with the messaging angles they claim to target. Later strategy steps contradicting earlier ones. Prompt sizes growing past 8,000+ tokens of context per step. Users noticing inconsistencies between strategy layers.
- **Prevention:**
  - Summarize previous step outputs before passing to next step. Instead of passing the full strategy matrix JSON, pass a condensed version (~500 tokens) that captures key decisions.
  - Add explicit consistency checks: after each step, verify that outputs reference valid entities from previous steps (e.g., hook's `messagingAngle` must match an actual angle from step 2).
  - Consider using a single long-context call for the full strategy generation rather than multi-step. Claude's context window supports this, and it ensures internal consistency. Trade-off: longer single call vs. multiple shorter calls.
  - Use Zod validation (already in place) to enforce structural consistency between steps.
- **Phase to address:** Phase 3 (Strategy Generation refactor).
- **Severity:** Medium

### 12. Race Condition on Concurrent Analysis for Same Brand

- **What goes wrong:** If two users (or the same user in two tabs) trigger analysis for the same brand simultaneously, both will: (a) call Claude Vision for classification (doubling API cost), (b) try to upsert the same `BrandAnalysisCache` record (last write wins, potentially with stale data from the slower call), (c) potentially corrupt the `AdClassification` data if both are writing per-ad results. The current code has no concurrency guard.
- **Warning signs:** Double API charges for the same brand in logs. Cache scores flickering between values. Two analysis results returning different scores for the same brand within seconds.
- **Prevention:**
  - Add a `classificationStatus` field to `BrandAnalysisCache` (e.g., "idle", "running", "completed"). Before starting classification, check status and return cached results if "running".
  - Use a database-level advisory lock or a simple "lock row" pattern: UPDATE SET status='running' WHERE status='idle' and check affected rows.
  - Return cached results immediately if they are fresh (< 1 hour old) with a "re-analyze" option for forced refresh.
  - For the frontend: disable the analyze button after click and show progress. Do not allow re-triggering while analysis is in progress.
- **Phase to address:** Phase 1 (Classification pipeline).
- **Severity:** Medium

---

## Vercel-Specific Pitfalls

### 13. Cold Start Latency on AI Routes

- **What goes wrong:** Vercel serverless functions have cold starts of 200-500ms. AI routes that import the Anthropic SDK, Prisma client, and potentially image processing libraries will have larger bundles and longer cold starts (500ms-2s). For the analysis route, this adds to already-long response times.
- **Prevention:**
  - Keep AI route bundles lean. Do not import unnecessary dependencies.
  - Use Vercel Fluid Compute if available on the plan -- it keeps function instances warm longer.
  - Pre-warm critical routes with a lightweight cron ping.
  - Accept cold starts as inevitable; focus on making the UX tolerate them (loading states, progress indicators -- already in place in `analysis-view.tsx`).
- **Phase to address:** Phase 1 (Infrastructure).
- **Severity:** Medium

### 14. maxDuration Mismatch Across Routes

- **What goes wrong:** The codebase currently has `maxDuration = 300` on analysis routes but `maxDuration = 60` on strategy/creative-lab routes. Adding Vision classification to the strategy pipeline without updating `maxDuration` will cause timeouts. On Hobby plan, 300s is the hard cap. If the project stays on Hobby, multi-image Vision calls may simply not be possible within this limit.
- **Prevention:**
  - Audit all routes that will call Claude Vision and set appropriate `maxDuration` values.
  - If on Hobby plan: either upgrade to Pro (800s max with Fluid Compute) or move classification to a background job that does not depend on function duration.
  - Never chain multiple Claude calls sequentially in a single route if each call can take 30+ seconds.
  - Consider the Vercel Pro plan ($20/month) as a cost of doing business for AI features.
- **Phase to address:** Phase 1 (Infrastructure planning).
- **Severity:** High (if staying on Hobby plan), Medium (if on Pro).

---

## Cost Management Pitfalls

### 15. No API Cost Tracking or Budget Limits

- **What goes wrong:** The current codebase has no tracking of Claude API costs. There is no per-user, per-brand, or global spending limit. A single user could trigger analysis on 50 brands in a day, each costing $0.40-$1.00 with Vision, totaling $20-$50 in a single session. Without visibility, costs accumulate silently until the monthly bill arrives.
- **Prevention:**
  - Add a `ApiUsageLog` table: track every Claude API call with model, input tokens, output tokens, estimated cost, user, brand, route.
  - Implement daily/monthly budget caps. Return a "quota exceeded" error when limits are reached.
  - For free users: limit to 3 brand analyses per day. For Pro users: higher limits.
  - Display API usage in an admin dashboard.
  - Set up Anthropic API usage alerts at 50%, 80%, 100% of monthly budget.
- **Phase to address:** Phase 1 (Foundation) -- must exist before Vision classification ships.
- **Severity:** High

### 16. Image Fetching Costs and Latency

- **What goes wrong:** To send images to Claude Vision, the serverless function must fetch the image from R2 storage, potentially resize it, and base64-encode it. For 50-100 images, this means 50-100 HTTP requests to R2 from within a Vercel function. Each fetch adds 50-200ms of latency. The total image fetching time alone could be 5-20 seconds, eating into the function timeout budget. Additionally, holding 100 images in memory simultaneously could approach the 2-4GB memory limit.
- **Prevention:**
  - Use Claude's URL-based image source (`type: "url"`) pointing to R2 public URLs instead of base64 encoding. This offloads the fetch to Anthropic's servers and keeps Vercel function memory low.
  - Pre-generate thumbnails at classification-optimal size (1000x1000 or smaller) during asset download. Store thumbnail URLs in `AdAsset.thumbnailUrl`.
  - Batch images in groups of 10-20 per Vision call, not 100.
  - For images that Claude needs to fetch via URL, ensure R2 URLs are fast and publicly accessible (they already are, per the project config: `pub-25ef069908854da9871d20aea605675a.r2.dev`).
- **Phase to address:** Phase 1 (Classification pipeline).
- **Severity:** Medium

### 17. Not Using Batch API for Background Classification

- **What goes wrong:** All current Claude calls are synchronous. The Anthropic Batch API offers 50% cost reduction for asynchronous processing (results within 24h). For bulk classification tasks (classifying all ads for a new brand, re-classifying after taxonomy changes), not using the Batch API means paying full price unnecessarily.
- **Prevention:**
  - Implement two classification paths: (a) real-time for on-demand single-brand analysis (synchronous, full price), (b) batch for bulk operations (Batch API, 50% off).
  - Use Batch API for: initial brand onboarding classification, periodic re-classification cron jobs, taxonomy migration re-classification.
  - Use synchronous API for: user-triggered analysis, single-ad classification, interactive strategy generation.
  - Combined with prompt caching, batch classification could cost 75% less than current approach.
- **Phase to address:** Phase 2 or Phase 3 (when batch operations become needed).
- **Severity:** Medium

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Vision API costs | HIGH | Based on official Anthropic docs: ~1,334 tokens per 1000x1000 image, Sonnet 4.6 at $3/M input |
| Vercel limits | HIGH | Based on official Vercel docs: 300s Hobby, 800s Pro, 4.5MB payload |
| Classification inconsistency | HIGH | Documented in Anthropic docs ("may hallucinate"), confirmed by existing codebase behavior with concept clusters |
| Taxonomy bloat | HIGH | Based on combinatorial analysis of planned dimensions |
| Strategy generic-ness | MEDIUM | Based on analysis of existing generate-strategy route output patterns and LLM creativity research |
| Batch API savings | HIGH | Based on official Anthropic pricing: 50% discount confirmed |
| Database bloat | MEDIUM | Projected from current schema growth patterns, not yet observed at scale |

## Sources

- [Claude Vision documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- image tokenization, size limits, cost tables
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Sonnet 4.6 at $3/$15 per million tokens
- [Anthropic Batch API](https://platform.claude.com/docs/en/build-with-claude/batch-processing) -- 50% discount, 10K queries per batch
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) -- timeout, memory, payload limits
- [Vercel payload size limit KB](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) -- 4.5MB limit and workarounds
- [Classification with Claude cookbook](https://platform.claude.com/cookbook/capabilities-classification-guide) -- ~70% baseline accuracy, RAG improvement techniques
- [LLM creativity research (HBR)](https://hbr.org/2025/12/research-when-used-correctly-llms-can-unlock-more-creative-ideas) -- "Echoes in AI" phenomenon reducing collective diversity
- [NN/g Taxonomy 101](https://www.nngroup.com/articles/taxonomy-101/) -- taxonomy design best practices
