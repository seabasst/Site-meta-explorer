# Architecture Research -- Creative Strategy Engine (v8.0)

**Researched:** 2026-03-27
**Overall confidence:** HIGH (based on existing codebase analysis + verified API documentation)

## Executive Summary

The v8.0 Creative Strategy Engine adds vision-based ad classification, a multi-step strategy generation pipeline, and gap analysis to the existing ad intelligence platform. The key architectural challenge is handling vision classification of potentially thousands of ads per brand within Vercel's serverless constraints (60s hobby / 300s pro timeout) while controlling Claude Vision API costs (~$4.80 per 1,000 images at standard rates, ~$2.40 with Batch API).

The existing codebase already has a strong pattern to follow: the `/api/analyze/diversity` route classifies up to 100 ads via text-only Claude calls in a single request, and `/api/analyze` route does per-ad Vision analysis with batched `Promise.allSettled` calls. The v8.0 architecture should formalize these into a proper job queue with persistent classification results (not ephemeral like the current diversity route), and introduce the Anthropic Message Batches API for bulk historical classification.

The strategy generation pipeline (`/api/creative-lab/generate-strategy`) already implements a 3-step sequential pattern (Brand Profile -> Messaging Strategy -> Ad Hooks). v8.0 extends this with classification data as input, adds mechanics/formats dimensions, and introduces gap analysis. The existing `BrandStrategy` model already has `mechanics` and `formats` JSON columns reserved for this.

## System Overview

### Component Diagram (ASCII)

```
+------------------------------------------------------------------+
|                        FRONTEND (React 19)                        |
|                                                                   |
|  [Brand Search] -> [Analysis View] -> [Strategy View]            |
|       |                  |                    |                   |
|       v                  v                    v                   |
|  /api/creative-lab/  /api/analyze/       /api/creative-lab/      |
|  scrape-brand        diversity           generate-strategy       |
+------------------------------------------------------------------+
         |                  |                    |
         v                  v                    v
+------------------------------------------------------------------+
|                      API LAYER (Next.js Routes)                   |
|                                                                   |
|  NEW ROUTES:                                                      |
|  /api/classify/vision    -- single-ad vision classification      |
|  /api/classify/batch     -- trigger batch job for brand          |
|  /api/classify/status    -- poll batch job status                |
|  /api/classify/cron      -- cron-triggered batch processor       |
|                                                                   |
|  EXTENDED ROUTES:                                                 |
|  /api/analyze/diversity  -- use stored classifications (no AI)   |
|  /api/creative-lab/generate-strategy  -- add steps 4-6           |
+------------------------------------------------------------------+
         |                  |                    |
         v                  v                    v
+------------------------------------------------------------------+
|                    SERVICE LAYER (src/lib/)                        |
|                                                                   |
|  NEW:                                                             |
|  src/lib/classification.ts    -- classification logic + schemas  |
|  src/lib/batch-classifier.ts  -- Anthropic Batch API wrapper     |
|  src/lib/strategy-engine.ts   -- strategy pipeline orchestration |
|  src/lib/cost-tracker.ts      -- API cost tracking & limits      |
|                                                                   |
|  EXISTING:                                                        |
|  src/lib/prisma.ts            -- DB client                       |
+------------------------------------------------------------------+
         |                                       |
         v                                       v
+----------------------------+    +----------------------------+
|     Neon PostgreSQL        |    |   Anthropic Claude API     |
|                            |    |                            |
|  AdClassification (NEW)    |    |  Vision: Haiku 4.5         |
|  ClassificationJob (NEW)   |    |  Strategy: Sonnet 4        |
|  BrandStrategy (EXTEND)    |    |  Batch API: 50% discount   |
|  AdLibraryAd (existing)    |    |                            |
|  AdAsset (existing)        |    +----------------------------+
+----------------------------+               |
         |                                   v
         |                    +----------------------------+
         |                    |   Cloudflare R2            |
         |                    |   (ad images/videos)       |
         +--------------------+   PUBLIC_URL used as       |
                              |   source for Vision API    |
                              +----------------------------+
```

### Data Flow

**Flow 1: Single Ad Classification (on-demand)**
```
User views ad detail
  -> Frontend requests classification
  -> GET /api/classify/vision?adId=xxx
  -> Check AdClassification cache in DB
  -> IF cached: return immediately
  -> IF not cached:
     -> Fetch AdAsset.storedUrl from R2
     -> Call Claude Haiku 4.5 Vision with image URL
     -> Parse structured classification JSON
     -> Store in AdClassification table
     -> Return to frontend
  -> ~2-4 seconds per ad
```

**Flow 2: Brand Batch Classification (background)**
```
User clicks "Analyze Brand" or cron triggers
  -> POST /api/classify/batch { brandId, mode: "uncached" }
  -> Create ClassificationJob record (status: "queued")
  -> Return jobId immediately to frontend
  -> Use after() to continue processing:
     -> Fetch all unclassified ads for brand
     -> Build Anthropic Batch API request (up to 10,000 items)
     -> Submit batch to Anthropic (async, ~1 hour processing)
     -> Store batchId in ClassificationJob
  -> Frontend polls GET /api/classify/status?jobId=xxx
  -> Cron route /api/classify/cron polls Anthropic batch status
     -> When complete: parse results, upsert AdClassification rows
     -> Update ClassificationJob status to "completed"
```

**Flow 3: Strategy Generation Pipeline (sequential)**
```
Step 1: Brand Profile (existing, extends)
  -> Auto-generate from DB data + classification aggregates
  -> No AI call needed (pure computation)

Step 2: Messaging Strategy (existing)
  -> Claude Sonnet call with brand context + classification gaps
  -> Stores strategyMatrix JSON

Step 3: Ad Hooks (existing)
  -> Claude Sonnet call with strategy context
  -> Stores hooks JSON

Step 4: Creative Mechanics (NEW)
  -> Input: classification distribution + gaps
  -> Claude Sonnet call with awareness stage gaps
  -> Stores mechanics JSON in BrandStrategy

Step 5: Visual Formats (NEW)
  -> Input: format distribution + gaps
  -> Claude Sonnet call with format recommendations
  -> Stores formats JSON in BrandStrategy

Step 6: Gap Analysis Report (NEW)
  -> Pure computation: compare brand classification
    distribution against category benchmarks
  -> No AI call needed
  -> Returns structured gap report
```

## Classification Pipeline

### Where It Runs

**Recommendation: Two-tier approach.**

**Tier 1 -- On-demand single-ad classification (API route, synchronous)**
- Runs in a standard Next.js API route
- Uses Claude Haiku 4.5 Vision (cheapest vision model, ~$0.00016/image at 200x200, ~$0.004/image at 1000x1000)
- Timeout: well within 60s (single Vision call takes 2-4s)
- Triggered: when user views an ad that lacks classification
- Caches result in `AdClassification` table

**Tier 2 -- Brand batch classification (Anthropic Batch API, asynchronous)**
- Triggered by user action ("Classify all ads for brand X") or cron
- Uses Anthropic Message Batches API for 50% cost reduction
- Does NOT run in a serverless function -- submits batch and returns
- Polling via cron route (`/api/classify/cron`) every 5 minutes
- Batch typically completes in <1 hour for hundreds of ads
- Results stored in `AdClassification` table

**Why NOT a separate service:**
- The existing pattern (API routes + cron) works for this scale
- Adding a separate service (e.g., a long-running worker on Railway/Fly) adds deployment complexity for marginal benefit
- The Anthropic Batch API offloads the actual processing -- Vercel just submits and polls
- If scale exceeds ~50,000 ads total, reconsider (but current DB has thousands, not millions)

### How It Scales

| Scale | Approach | Est. Time | Est. Cost |
|-------|----------|-----------|-----------|
| 1 ad | On-demand Vision call | 2-4s | ~$0.005 |
| 10-50 ads | On-demand with `Promise.allSettled` batches of 5 | 20-40s | ~$0.05-0.25 |
| 50-500 ads | Anthropic Batch API | <1 hour | ~$0.12-1.20 (50% discount) |
| 500-5000 ads | Anthropic Batch API | <1 hour | ~$1.20-12.00 (50% discount) |
| 5000+ ads | Anthropic Batch API, split into multiple batches | <2 hours | ~$12+ |

**Note:** Cost estimates assume ~1000x1000 px images (~1,334 tokens each) using Haiku 4.5 pricing. Actual costs depend on image sizes and output tokens.

### Cost Controls

**Architecture for cost management:**

```
+-----------------------------------------------------------+
|                    COST CONTROL LAYER                      |
|                                                           |
|  1. Classification Cache (DB)                             |
|     -> Never re-classify an already-classified ad         |
|     -> AdClassification has classifiedAt timestamp        |
|     -> Reclassify only if schema version changes          |
|                                                           |
|  2. Daily Budget Tracker (DB or in-memory)                |
|     -> Track tokens consumed per day                      |
|     -> Hard cap: e.g., $20/day for Vision calls           |
|     -> Soft cap: e.g., $10/day triggers warning           |
|                                                           |
|  3. Model Selection Strategy                              |
|     -> Vision classification: Haiku 4.5 (cheapest)       |
|     -> Strategy generation: Sonnet 4 (existing)           |
|     -> Batch jobs: Batch API (50% discount)               |
|                                                           |
|  4. Image Optimization                                    |
|     -> Resize to max 1092x1092 before sending             |
|     -> Use URL source (R2 public URL) not base64          |
|     -> Skip video ads (text-only classification)          |
|                                                           |
|  5. Prompt Caching                                        |
|     -> Classification prompt is identical across ads      |
|     -> System prompt + taxonomy cached (90% discount)     |
|     -> Only image + ad metadata varies per request        |
+-----------------------------------------------------------+
```

**Implementation: `CostTracker` model in DB:**

```prisma
model ApiCostLog {
  id          String   @id @default(cuid())
  date        DateTime @default(now()) @db.Date
  model       String   // "claude-haiku-4.5", "claude-sonnet-4"
  operation   String   // "classify-vision", "classify-batch", "strategy-gen"
  inputTokens  Int
  outputTokens Int
  estimatedCost Float  // in USD
  brandId     String?

  @@index([date, operation])
}
```

**Daily budget check before each API call:**
```typescript
async function checkBudget(operation: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const spent = await prisma.apiCostLog.aggregate({
    where: { date: { gte: today } },
    _sum: { estimatedCost: true },
  });
  return (spent._sum.estimatedCost || 0) < DAILY_BUDGET_USD;
}
```

## Data Model

### New Prisma Models

```prisma
// =============================================================================
// v8.0 Vision Classification
// =============================================================================

model AdClassification {
  id    String @id @default(cuid())
  adId  String @unique
  ad    AdLibraryAd @relation(fields: [adId], references: [id], onDelete: Cascade)

  // Visual Format (46 formats -> grouped into categories)
  visualFormat      String   // e.g., "static-product-shot", "ugc-testimonial", "motion-graphic"
  visualFormatGroup String   // e.g., "static", "ugc", "motion", "editorial"

  // Creative Mechanic (8 mechanics)
  creativeMechanic  String   // e.g., "before-after", "problem-solution", "demo", "unboxing"

  // Hook Tactic (35 tactics -> grouped)
  hookTactic        String   // e.g., "curiosity-gap", "pain-agitation", "social-proof"
  hookTacticGroup   String   // e.g., "curiosity", "pain", "social", "urgency"

  // Awareness Stage (5 stages - Schwartz)
  awarenessStage    String   // "unaware", "problem-aware", "solution-aware", "product-aware", "most-aware"

  // Psychological Trigger (8 triggers)
  psychTrigger      String   // "pattern-interrupt", "identity", "pain", "curiosity", "social-proof", "contrarian", "aspiration", "urgency"

  // Tone & Emotion
  tone              String   // "aspirational", "problem-solving", "educational", "social-proof", "humor", "urgency", "price-focused", "emotional"
  emotionalValence  String?  // "positive", "negative", "neutral"

  // Visual attributes (from Vision)
  dominantColors    String[] // hex colors
  hasText           Boolean  @default(false)
  hasHuman          Boolean  @default(false)
  hasProduct        Boolean  @default(false)

  // Hook quality (replicates existing hookScore from diversity analysis)
  hookScore         Int      // 1-10

  // Concept clustering (replicates existing conceptCluster)
  conceptCluster    String

  // Metadata
  classifiedBy      String   @default("haiku-4.5-vision") // model used
  schemaVersion     Int      @default(1)   // bump when taxonomy changes
  confidence        Float    @default(0.8) // model's self-reported confidence
  classifiedAt      DateTime @default(now())

  // Source: was this from vision or text-only?
  classificationSource String @default("vision") // "vision" | "text-only" | "batch"

  @@index([adId])
  @@index([awarenessStage])
  @@index([visualFormatGroup])
  @@index([creativeMechanic])
}

model ClassificationJob {
  id        String   @id @default(cuid())
  brandId   String
  brand     AdLibraryBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Job state
  status         String   @default("queued")  // queued, submitting, processing, completed, failed
  totalAds       Int      @default(0)
  classifiedAds  Int      @default(0)
  failedAds      Int      @default(0)
  skippedAds     Int      @default(0)  // already cached

  // Anthropic Batch API reference
  anthropicBatchId String?  // returned by Anthropic when batch submitted
  batchSubmittedAt DateTime?
  batchCompletedAt DateTime?

  // Cost tracking
  estimatedCostUsd Float?
  actualCostUsd    Float?
  inputTokens      Int?
  outputTokens     Int?

  // Error info
  errorMessage     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId, status])
  @@index([status, createdAt])
  @@index([anthropicBatchId])
}

model ApiCostLog {
  id            String   @id @default(cuid())
  date          DateTime @db.Date
  model         String
  operation     String
  inputTokens   Int
  outputTokens  Int
  estimatedCost Float
  brandId       String?

  createdAt DateTime @default(now())

  @@index([date, operation])
  @@index([date])
}
```

### Relationships to Existing Models

```
AdLibraryAd (existing)
  |-- AdClassification (NEW, 1:1)     -- replaces ephemeral diversity classifications
  |-- AdAnalysis (existing, 1:1)      -- remains for legacy per-ad Vision analysis
  |-- AdAsset (existing, 1:many)      -- source images for Vision classification

AdLibraryBrand (existing)
  |-- ClassificationJob (NEW, 1:many) -- batch classification jobs
  |-- BrandStrategy (existing)        -- extended with steps 4-6
  |-- BrandAnalysisCache (existing)   -- updated to use stored classifications

BrandStrategy (existing, EXTENDED)
  |-- mechanics Json?   -- already exists, unused
  |-- formats Json?     -- already exists, unused
  |-- gapAnalysis Json? -- NEW FIELD to add
```

**Key change:** The current `analyze/diversity` route classifies ads ephemerally (classifications are computed, used, and discarded -- only aggregates are cached in `BrandAnalysisCache`). v8.0 persists per-ad classifications in `AdClassification`, making the diversity analysis route a pure aggregation query instead of an AI call.

**Migration path:**
1. Add `AdClassification`, `ClassificationJob`, `ApiCostLog` tables
2. Add `gapAnalysis Json?` to `BrandStrategy`
3. Add `classificationJobs ClassificationJob[]` relation to `AdLibraryBrand`
4. Add `classification AdClassification?` relation to `AdLibraryAd`
5. Refactor `/api/analyze/diversity` to read from `AdClassification` table

## Strategy Generation Pipeline

### Pipeline Stages

```
+------------------+     +------------------+     +------------------+
| Step 1           |     | Step 2           |     | Step 3           |
| Brand Profile    | --> | Messaging        | --> | Ad Hooks         |
| (computation)    |     | Strategy         |     | (AI: Sonnet)     |
|                  |     | (AI: Sonnet)     |     |                  |
| Input:           |     | Input:           |     | Input:           |
| - DB brand data  |     | - Brand profile  |     | - Strategy matrix|
| - Classification |     | - Ad copy        |     | - Brand copy     |
|   aggregates     |     | - Diversity gaps  |     |                  |
|                  |     |                  |     | Output:          |
| Output:          |     | Output:          |     | - 15-20 hooks    |
| - brandContext   |     | - personas       |     | - scored + tagged|
| - gap summary    |     | - angles         |     |                  |
+------------------+     +------------------+     +------------------+
         |
         v
+------------------+     +------------------+     +------------------+
| Step 4           |     | Step 5           |     | Step 6           |
| Creative         | --> | Visual Formats   | --> | Gap Analysis     |
| Mechanics        |     | (AI: Sonnet)     |     | Report           |
| (AI: Sonnet)     |     |                  |     | (computation)    |
|                  |     | Input:           |     |                  |
| Input:           |     | - Brand context  |     | Input:           |
| - Brand context  |     | - Format gaps    |     | - Classifications|
| - Mechanic gaps  |     | - Existing ads   |     | - Category avg   |
| - Strategy matrix|     |                  |     | - Brand strategy |
|                  |     | Output:          |     |                  |
| Output:          |     | - Format recs    |     | Output:          |
| - Mechanic recs  |     | - Aspect ratios  |     | - Gap report     |
| - Stage mappings |     | - Platform recs  |     | - Priority matrix|
+------------------+     +------------------+     +------------------+
```

### Data Flow

**Pipeline orchestration pattern (matches existing generate-strategy):**

Each step is a separate API call from the frontend, using the step parameter:
```
POST /api/creative-lab/generate-strategy
{ pageId, step: 1 }  -> returns { strategyId, brandContext }
{ strategyId, step: 2 }  -> returns { strategyMatrix }
{ strategyId, step: 3 }  -> returns { hooks }
{ strategyId, step: 4 }  -> returns { mechanics }
{ strategyId, step: 5 }  -> returns { formats }
{ strategyId, step: 6 }  -> returns { gapAnalysis }
```

This matches the existing pattern exactly. The frontend shows a stepper UI and calls each step sequentially. This is already implemented for steps 1-3.

**Why sequential steps instead of one big call:**
1. Each step fits within Vercel's 60s timeout
2. User sees progressive results (better UX)
3. If one step fails, earlier results are preserved
4. Each step's output feeds the next step's prompt (chain-of-thought)
5. Token limits: combining all steps would exceed max_tokens

## Integration Points

### Existing API Routes to Extend

**`/api/analyze/diversity` (MAJOR refactor)**
- Currently: fetches ads, calls Claude for classification, computes scores, calls Claude for recommendations
- After v8.0: reads from `AdClassification` table, computes scores (pure DB query), calls Claude only for recommendations
- Benefit: 10x faster (no classification AI call), cheaper, deterministic aggregation
- Fallback: if no classifications exist, trigger batch job and show "Classification in progress"

**`/api/creative-lab/generate-strategy` (extend steps)**
- Add steps 4, 5, 6 to existing step handler
- Step 1 (Brand Profile) now includes classification aggregates
- No structural change, just additional cases in the step switch

**`/api/ad-library/ads` (minor extension)**
- Add `include: { classification: true }` option
- Return classification data alongside ad data when requested
- Enables filtered views (e.g., "show me all Problem-Aware ads")

### New API Routes Needed

| Route | Method | Purpose | Timeout |
|-------|--------|---------|---------|
| `/api/classify/vision` | POST | Classify single ad with Vision | 60s |
| `/api/classify/batch` | POST | Submit batch classification job | 60s |
| `/api/classify/status` | GET | Poll batch job status | 10s |
| `/api/classify/cron` | GET | Cron: poll Anthropic Batch API, store results | 300s |
| `/api/classify/stats` | GET | Classification coverage stats per brand | 10s |

**Cron configuration (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/classify/cron",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Vercel Constraints and Workarounds

### Constraint 1: Function Timeout (60s hobby / 300s pro)

**Problem:** Classifying 100+ ads with Vision takes longer than 60s.

**Solution:** Do NOT classify in the serverless function. Use the Anthropic Batch API.

1. User triggers classification -> API route submits batch to Anthropic -> returns immediately
2. Anthropic processes batch asynchronously (typically <1 hour)
3. Cron route (`*/5 * * * *`) polls Anthropic for batch completion
4. When complete, cron route fetches results and stores in DB

**For small ad counts (< 20):** Use `after()` from `next/server` to classify in the background after returning a response. The function continues running (up to maxDuration) after the response is sent.

```typescript
import { after } from 'next/server';

export async function POST(request: NextRequest) {
  const { brandId, adIds } = await request.json();

  // Return immediately
  const response = Response.json({ status: 'processing', jobId });

  // Continue classification in background
  after(async () => {
    for (const adId of adIds) {
      await classifySingleAd(adId);
    }
  });

  return response;
}
```

### Constraint 2: Cron Job Frequency (Vercel hobby: limited crons)

**Problem:** Vercel hobby plan supports limited cron jobs.

**Solution:** Batch the cron work:
- Single cron route handles both asset downloads AND classification polling
- OR: Use the existing `/api/ad-library/cron/ingest` pattern -- add classification polling as a secondary task

### Constraint 3: Cold Starts + Neon Serverless

**Problem:** Cold starts + Neon connection latency can eat 2-5s on first request.

**Solution:** Already mitigated by existing patterns:
- Prisma connection pooling (already configured)
- Neon serverless driver handles connection resumption
- Classification reads are simple indexed queries (fast)

### Constraint 4: Memory Limits (1024 MB default)

**Problem:** Processing large batch results (thousands of classifications) in a single function invocation.

**Solution:** Process batch results in chunks:
- Fetch batch results from Anthropic in pages
- Process 50-100 classifications per DB transaction
- Use `prisma.$transaction` for atomicity within chunks

### Constraint 5: Request Body Size (4.5 MB on Vercel)

**Problem:** Sending many image URLs in a single request.

**Solution:** Not an issue -- we use the Anthropic Batch API which handles this server-side. We only send the batch creation request, which contains request objects with image URLs (not image data). Each request is small.

## Build Order

### Phase Dependencies

```
Phase 1: Classification Foundation
  |-- AdClassification model + migration
  |-- ClassificationJob model + migration
  |-- ApiCostLog model + migration
  |-- Cost tracking utility (src/lib/cost-tracker.ts)
  |-- Classification schema/types (src/lib/classification.ts)
  |
  v
Phase 2: Single-Ad Classification
  |-- /api/classify/vision route (on-demand)
  |-- Vision prompt with full taxonomy
  |-- AdClassification cache logic (check before calling)
  |-- Integration with ad detail view (frontend)
  |
  v
Phase 3: Batch Classification
  |-- Anthropic Batch API wrapper (src/lib/batch-classifier.ts)
  |-- /api/classify/batch route (submit job)
  |-- /api/classify/status route (poll status)
  |-- /api/classify/cron route (process results)
  |-- ClassificationJob lifecycle management
  |
  v
Phase 4: Diversity Analysis Refactor
  |-- Refactor /api/analyze/diversity to read from AdClassification
  |-- Remove ephemeral AI classification call
  |-- Keep recommendation AI call
  |-- Update BrandAnalysisCache from stored classifications
  |-- Update frontend to trigger batch classification first
  |
  v
Phase 5: Strategy Engine Extension
  |-- Step 1 enhancement (include classification aggregates)
  |-- Step 4: Creative Mechanics generation
  |-- Step 5: Visual Formats generation
  |-- Step 6: Gap Analysis computation
  |-- Frontend stepper extension
  |
  v
Phase 6: Category Benchmarking
  |-- Aggregate classifications across brands in same category
  |-- Compare brand vs category averages
  |-- Category-level gap analysis
  |-- Benchmark dashboard UI
```

**Critical dependency:** Phase 2 must be complete before Phase 4, because the diversity refactor assumes classifications exist in the DB. Phase 3 (batch) can run in parallel with Phase 2 but should complete before Phase 4.

**Independent work that can parallelize:**
- Phase 1 (DB models) has no dependencies
- Phase 5 (strategy steps 4-6) only depends on Phase 1 for the gapAnalysis field
- Frontend work for Phase 5 can start as soon as the API shape is defined

### Estimated Effort per Phase

| Phase | Effort | Risk | Notes |
|-------|--------|------|-------|
| 1. Foundation | Small (1-2 tasks) | Low | Standard Prisma migration |
| 2. Single-Ad Classification | Medium (2-3 tasks) | Medium | Prompt engineering for 46 formats + validation |
| 3. Batch Classification | Medium (3-4 tasks) | Medium | Anthropic Batch API integration, polling logic |
| 4. Diversity Refactor | Medium (2-3 tasks) | Low | Straightforward refactor, existing tests |
| 5. Strategy Extension | Large (4-5 tasks) | Medium | 3 new AI steps + frontend |
| 6. Category Benchmarking | Medium (2-3 tasks) | Low | Pure aggregation queries |

## Key Architectural Decisions

### Decision 1: Persist per-ad classifications (not ephemeral)

**Current state:** The diversity route classifies ads, uses the classifications for scoring, then discards them. Only aggregates are cached in `BrandAnalysisCache`.

**v8.0 change:** Store every classification in `AdClassification` table.

**Why:**
- Eliminates redundant AI calls (classify once, use everywhere)
- Enables ad-level filtering ("show me all UGC-style conversion ads")
- Enables batch processing (classify in background, use instantly)
- Enables category benchmarking (aggregate across brands)
- Cost savings: classify each ad once (~$0.005) vs. every analysis request

### Decision 2: Haiku 4.5 for classification, Sonnet 4 for strategy

**Why not Sonnet for classification?**
- Classification is a structured extraction task (choose from fixed categories)
- Haiku 4.5 Vision is sufficient for this -- cheaper and faster
- Sonnet is reserved for creative reasoning (strategy, hooks, concepts)

**Why not Haiku for strategy?**
- Strategy generation requires nuanced reasoning about marketing concepts
- Sonnet produces meaningfully better creative output

### Decision 3: Anthropic Batch API for historical backfill, not queue service

**Alternatives considered:**
- Inngest (serverless job queue): adds dependency, monthly cost, complexity
- QStash (Upstash): simpler but still an added service
- Railway/Fly worker: separate deployment to maintain
- Vercel Cron + after(): limited to maxDuration per invocation

**Why Batch API wins:**
- Already using Anthropic SDK -- no new dependency
- 50% cost discount on all batch requests
- Handles up to 100,000 requests per batch
- Anthropic handles retries, rate limits, and processing
- We just submit and poll -- minimal infrastructure

### Decision 4: Schema version field for taxonomy evolution

The `schemaVersion` field on `AdClassification` allows re-classifying ads when the taxonomy changes (e.g., adding new visual formats). When schema version bumps, the batch classifier marks old classifications as stale and re-queues them.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Data model | HIGH | Directly extends existing Prisma patterns, verified against current schema |
| Vision classification | HIGH | Existing `/api/analyze` route already does Vision calls; proven pattern |
| Batch API integration | HIGH | Verified against Anthropic official docs (50% discount, 100K limit, <1hr typical) |
| Strategy pipeline extension | HIGH | Existing 3-step pattern is clean; steps 4-6 are straightforward additions |
| Cost management | MEDIUM | Cost estimates based on official pricing docs; actual usage patterns may vary |
| Vercel constraints | HIGH | Verified timeout limits, cron patterns match existing `/api/ad-library/cron/` routes |
| Category benchmarking | MEDIUM | Depends on having enough classified ads across brands in same category |

## Sources

- [Anthropic Batch Processing Documentation](https://platform.claude.com/docs/en/build-with-claude/batch-processing) -- 50% discount, 100K limit, processing details
- [Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- image pricing, size limits, URL source support
- [Vercel Function Timeout Limits](https://vercel.com/docs/functions/limitations) -- 60s hobby, 300s pro, 800s Fluid Compute
- [Next.js after() Documentation](https://nextjs.org/docs/app/api-reference/functions/after) -- background processing after response
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- scheduling background work
- Existing codebase: `/api/analyze/diversity/route.ts`, `/api/analyze/route.ts`, `/api/creative-lab/generate-strategy/route.ts`
