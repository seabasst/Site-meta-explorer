# Stack Research -- AI Ad Classification & Strategy Engine

**Project:** Facebook Ad Explorer v8.0 -- Creative Strategy Engine
**Researched:** 2026-03-27
**Mode:** Ecosystem (Stack dimension)

## Executive Summary

The existing platform already uses Claude (Anthropic SDK `^0.78.0`) for vision-based ad analysis via Haiku 4.5 and strategy generation via Sonnet 4. The v8.0 milestone scales this from on-demand single-ad analysis to batch classification of entire ad libraries (500+ brands, ~25,000 ads). The critical cost lever is the **Batch API** (50% discount) combined with **prompt caching** (90% discount on cache hits). For batch job orchestration on Vercel's serverless platform, **Inngest** is the recommended approach -- it integrates natively with Vercel and supports long-running step functions without Redis infrastructure. No new AI providers are needed; Claude remains the right choice for both vision classification and strategy generation.

## Vision API Selection

### Recommended: Claude Haiku 4.5 (classification) + Sonnet 4.6 (strategy generation)

**Confidence: HIGH** -- Based on official Anthropic pricing docs and the project's existing successful use of these models.

**Why Claude over alternatives:**

1. **Already integrated.** The codebase uses `@anthropic-ai/sdk` with working vision analysis (`src/app/api/analyze/route.ts`) and strategy generation (`src/app/api/creative-lab/generate-strategy/route.ts`). Switching providers adds integration risk for zero benefit.

2. **Batch API with 50% discount.** Anthropic's Message Batches API processes up to 10,000 requests per batch asynchronously, completing within 24 hours at half price. This is purpose-built for bulk classification.

3. **Prompt caching stacks with batch.** The classification system prompt (taxonomy of 46 formats, 8 mechanics, 35 hooks, etc.) is large and identical across all ads. Cache it once, pay 0.1x on every subsequent hit. Combined with batch: ~75% total cost reduction.

4. **URL-based image input.** Claude accepts image URLs directly -- the platform already stores assets on Cloudflare R2 with public URLs. No base64 encoding overhead, no downloading images to the server.

**Model assignment:**

| Task | Model | Rationale |
|------|-------|-----------|
| Ad visual classification | Claude Haiku 4.5 | Fast, cheap, sufficient for structured classification |
| Strategy matrix generation | Claude Sonnet 4.6 | Complex reasoning, persona development |
| Hook/concept generation | Claude Sonnet 4.6 | Creative output quality matters |
| Gap analysis | Claude Haiku 4.5 | Primarily data comparison, structured output |

### Alternatives Considered

| Provider | Input/MTok | Output/MTok | Vision? | Batch? | Why Not |
|----------|-----------|-------------|---------|--------|---------|
| **Claude Haiku 4.5** | $1.00 | $5.00 | Yes | Yes (50% off) | **RECOMMENDED for classification** |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | Yes | Yes (50% off) | **RECOMMENDED for strategy** |
| GPT-4o (OpenAI) | $2.50 | $10.00 | Yes | Yes | Comparable price, but requires new SDK integration, new API key management, different error handling. No benefit over Claude given existing integration. |
| GPT-4o-mini (OpenAI) | $0.15 | $0.60 | Yes | Yes | Cheapest option but requires new provider integration. Classification accuracy unverified for advertising taxonomy. |
| Gemini 2.0 Flash | ~$0.10 | ~$0.40 | Yes | Yes | Extremely cheap but Google Cloud integration complexity. Would need to evaluate classification accuracy for ad-specific taxonomy. |
| Open-source (LLaVA, etc.) | Free (compute) | Free (compute) | Limited | N/A | Requires GPU infrastructure. Quality insufficient for 46-format taxonomy. Not viable on Vercel. |

**Decision:** Stay with Claude. The 50% batch discount on Haiku 4.5 makes it $0.50/$2.50 per MTok -- competitive with GPT-4o-mini -- without any migration cost. The existing codebase already handles Claude API errors, retries, and JSON parsing.

### Cost Analysis

**Image token formula (from Anthropic docs):** `tokens = (width * height) / 750`

**Typical ad image (1080x1080):** ~1,555 tokens input per image

**Classification prompt:** ~2,000 tokens (taxonomy definitions + instructions)

**Classification output:** ~500 tokens (structured JSON)

**Per-ad cost with Haiku 4.5:**

| Scenario | Input Cost | Output Cost | Total/Ad | 25K Ads Total |
|----------|-----------|-------------|----------|---------------|
| Standard API | $0.00356 | $0.00250 | $0.00606 | $151.40 |
| Batch API (50% off) | $0.00178 | $0.00125 | $0.00303 | $75.70 |
| Batch + Cache (prompt cached) | $0.00078* | $0.00125 | $0.00203 | $50.63 |

*Cache hit on 2,000-token system prompt: 0.1x = $0.0001/MTok for cached portion.

**Strategy generation with Sonnet 4.6 (per brand, ~1 per brand):**

| Component | Input Tokens | Output Tokens | Cost/Brand |
|-----------|-------------|---------------|------------|
| Brand profile | ~3,000 | ~500 | $0.0165 |
| Messaging strategy | ~5,000 | ~2,000 | $0.0450 |
| Hook generation | ~6,000 | ~3,000 | $0.0630 |
| **Total per brand** | | | **$0.1245** |
| **500 brands (batch)** | | | **$31.13** |

**Total v8.0 budget estimate (batch + caching):**
- Classification of 25,000 ads: ~$51
- Strategy generation for 500 brands: ~$31
- **Total: ~$82** (one-time backfill)
- Incremental cost for new ads: ~$0.002/ad

## Batch Processing

### Recommended Approach: Claude Batch API + Inngest Orchestration

**Confidence: HIGH**

**Architecture:**

```
User triggers "Classify Brand" or "Classify All"
        |
        v
  Inngest Event: "ad/classify.requested"
        |
        v
  Inngest Step Function:
    Step 1: Fetch unclassified ads for brand (DB query)
    Step 2: Build batch request (up to 10,000 items)
    Step 3: Submit to Claude Batch API
    Step 4: Poll for completion (Inngest.sleep between polls)
    Step 5: Parse results, write to DB
    Step 6: Trigger strategy generation if all ads classified
```

**Why this pattern:**

1. **Claude Batch API handles the AI processing.** Submit up to 10,000 messages per batch. Results within 24 hours. 50% cost reduction. No rate limit pressure.

2. **Inngest handles orchestration.** Step functions survive Vercel's serverless timeouts. Each step is independently retryable. Sleep between poll checks costs nothing. No Redis, no BullMQ, no infrastructure.

3. **Vercel Cron as fallback trigger.** The project already uses Vercel cron for asset downloads and ingestion. A cron job can trigger Inngest events for scheduled re-classification.

### Why NOT BullMQ

BullMQ requires Redis. The project runs on Vercel (serverless) with Neon PostgreSQL. Adding Redis (via Upstash or Redis Cloud) adds:
- Another managed service to maintain
- Another cost line item
- Connection management complexity in serverless

Inngest replaces BullMQ for this use case with zero infrastructure.

### Why NOT Vercel Cron Alone

Vercel cron jobs are limited to 60 seconds on Pro plan. Classifying 25,000 ads cannot complete in one cron invocation. The project already works around this by processing in batches per cron run (see `BRANDS_PER_RUN = 10` in the ingest cron). But the Claude Batch API is asynchronous (results in hours), which means the cron would need to:
1. Submit batch
2. On next invocation, check if batch is done
3. Process results

This is exactly what Inngest step functions solve elegantly with `inngest.sleep()` between steps.

### Queue/Job System: Inngest

**Version:** `inngest@3.x` (current stable)

**Pricing:** Free tier = 50,000 executions/month. A full 25,000-ad classification run = ~5 Inngest executions (5 batches of 5,000). Monthly incremental = ~50 executions. Well within free tier.

**Integration pattern:**

```typescript
// src/inngest/client.ts
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'ad-explorer' });

// src/inngest/functions/classify-brand.ts
export const classifyBrand = inngest.createFunction(
  { id: 'classify-brand', retries: 3 },
  { event: 'ad/classify.brand' },
  async ({ event, step }) => {
    const ads = await step.run('fetch-ads', async () => {
      // Fetch unclassified ads for this brand
    });

    const batchId = await step.run('submit-batch', async () => {
      // Submit to Claude Batch API
    });

    // Poll every 5 minutes until done
    let result = null;
    while (!result) {
      await step.sleep('wait-for-batch', '5m');
      result = await step.run('check-batch', async () => {
        // Check batch status
      });
    }

    await step.run('save-results', async () => {
      // Parse and save classification results
    });
  }
);
```

## Caching Strategy

### Classification Result Storage: PostgreSQL (Prisma)

**Confidence: HIGH**

**Do NOT add a separate cache layer.** The project already has the `AdAnalysis` model in Prisma that stores per-ad analysis results. Extend this model for the new Motion classification taxonomy.

**Recommended schema extension:**

```prisma
model AdClassification {
  id    String @id @default(cuid())
  adId  String @unique
  ad    AdLibraryAd @relation(fields: [adId], references: [id], onDelete: Cascade)

  // Motion taxonomy
  visualFormat      String    // e.g. "talking-head", "product-demo" (1 of 46)
  creativeMechanic  String    // e.g. "before-after", "unboxing" (1 of 8)
  hookTactic        String    // e.g. "pattern-interrupt", "identity-callout" (1 of 35)
  awarenessStage    String    // e.g. "problem-aware" (1 of 5)
  psychTriggers     String[]  // e.g. ["curiosity-gap", "social-proof"] (from 8)

  // Confidence & metadata
  confidence        Float     // 0-1, model's self-assessed confidence
  modelUsed         String    // "claude-haiku-4-5"
  classifiedAt      DateTime  @default(now())

  // Full structured output for flexibility
  fullClassification Json

  @@index([adId])
  @@index([visualFormat])
  @@index([creativeMechanic])
  @@index([awarenessStage])
}
```

**Why PostgreSQL over Redis/embeddings:**
- Classifications are structured categorical data, not vectors
- Need SQL queries: "Show me all pattern-interrupt hooks for fashion brands"
- Already have Prisma + Neon PostgreSQL
- Indexed columns give fast filtering

### Embedding Approach: NOT Recommended for v8.0

**Confidence: MEDIUM**

pgvector with Prisma is maturing (Prisma 7 adds extension support), but embeddings solve the wrong problem here. The classification system assigns discrete categories (1 of 46 formats, 1 of 8 mechanics, etc.) -- this is structured data, not similarity search. Embeddings would be useful for:
- "Find ads similar to this one" (future feature)
- Clustering ads by visual similarity
- Semantic search across ad copy

**Recommendation:** Defer embeddings to a future milestone. Use indexed PostgreSQL columns for v8.0 classification queries.

### Prompt Caching for Classification

The classification system prompt (taxonomy definitions) is ~2,000 tokens and identical for every ad. Use Anthropic's prompt caching:

```typescript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 500,
  system: [
    {
      type: 'text',
      text: CLASSIFICATION_TAXONOMY_PROMPT, // ~2,000 tokens
      cache_control: { type: 'ephemeral' } // Cache for 5 minutes
    }
  ],
  messages: [{ role: 'user', content: [...] }]
});
```

For batch API, caching is handled differently -- the system prompt is included in each batch request. The batch API itself provides the 50% discount, and within a batch, Anthropic may internally optimize repeated system prompts. The combined discount (batch + any internal caching) makes the per-ad cost minimal.

## Strategy Generation Stack

### LLM for Strategy/Hook Generation: Claude Sonnet 4.6

**Confidence: HIGH**

The existing strategy generation pipeline (`generate-strategy/route.ts`) already uses `claude-sonnet-4-20250514`. Upgrade to `claude-sonnet-4-6` (the latest) for improved reasoning.

**Current 3-step pipeline (keep and extend):**
1. Step 1: Brand Profile (data assembly, no LLM needed)
2. Step 2: Messaging Strategy (Sonnet -- personas, angles, awareness stages)
3. Step 3: Hook Generation (Sonnet -- 15-20 hooks with scoring)

**New steps for v8.0:**
4. Step 4: Gap Analysis (Haiku -- compare brand's classified ads against taxonomy, identify missing formats/mechanics/stages)
5. Step 5: Creative Concepts (Sonnet -- generate concepts that fill identified gaps)
6. Step 6: Category Benchmarking (Haiku -- aggregate classification data across brands in same category)

### Prompt Architecture

**Classification prompt structure (Haiku 4.5):**

```
SYSTEM (cached, ~2,000 tokens):
  - Complete taxonomy definitions
  - 46 visual formats with descriptions
  - 8 creative mechanics with examples
  - 35 hook tactics with examples
  - 5 awareness stages
  - 8 psychological triggers
  - Output JSON schema

USER (per-ad, ~1,555 tokens image + ~200 tokens context):
  - Ad image (URL from R2)
  - Ad copy (body, title, caption)
  - Brand name and category
  - Display format (image/video/carousel)
```

**Strategy prompt structure (Sonnet 4.6):**

```
SYSTEM (cached, ~3,000 tokens):
  - Strategy framework (Eugene Schwartz awareness stages)
  - Five Pillars of Creative Diversity
  - 8 psychological triggers with examples
  - Output schemas per step

USER (per-brand, ~4,000-6,000 tokens):
  - Brand classification summary (aggregated from per-ad classifications)
  - Distribution across taxonomy dimensions
  - Gap identification
  - Top-performing ad patterns
  - Category benchmark comparison
```

## Libraries & Tools

### Recommended

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@anthropic-ai/sdk` | `^0.78.0` (existing) | Claude API -- vision, batch, caching | HIGH |
| `inngest` | `^3.x` | Serverless background job orchestration | HIGH |
| `zod` | `^4.3.6` (existing) | Schema validation for classification outputs | HIGH |
| `prisma` | `^7.4.2` (existing) | ORM for classification storage | HIGH |

**No new major dependencies needed.** The only new package is `inngest`.

### Avoid

| Library/Approach | Why Avoid |
|------------------|-----------|
| `bullmq` | Requires Redis; unnecessary infrastructure for Vercel serverless |
| `openai` SDK | Adds second AI provider with no benefit; Claude already integrated |
| `langchain` | Over-abstraction for direct API calls; adds complexity without value when using single provider |
| `pgvector` / embeddings | Wrong tool for categorical classification; defer to future milestone |
| `sharp` for image preprocessing | Claude handles images natively; resizing adds latency without quality benefit for ad images already at standard sizes |
| Custom queue in PostgreSQL | Inngest solves this without polling-based approaches |
| Upstash Redis | Additional managed service for queue that Inngest replaces |

### Existing Dependencies to Leverage

| Existing | How v8.0 Uses It |
|----------|-----------------|
| `@anthropic-ai/sdk` | Batch API, vision, prompt caching |
| `zod` | Validate all classification and strategy JSON outputs |
| Prisma + Neon PostgreSQL | Store classifications, aggregate for benchmarking |
| Cloudflare R2 | Image URLs passed directly to Claude vision (no download needed) |
| Vercel Cron | Trigger periodic re-classification of new ads |
| `sonner` | Toast notifications for classification progress |

## Installation

```bash
# Only new dependency
npm install inngest

# No other new packages needed
```

## Vercel Configuration

```json
// vercel.json (add Inngest route)
{
  "crons": [
    { "path": "/api/ad-library/cron/ingest", "schedule": "0 */6 * * *" },
    { "path": "/api/ad-library/cron/assets", "schedule": "30 */2 * * *" },
    { "path": "/api/ad-library/cron/classify", "schedule": "0 3 * * *" }
  ]
}
```

## Confidence Assessment

| Component | Confidence | Notes |
|-----------|------------|-------|
| Vision API (Haiku 4.5) | HIGH | Already used in codebase; pricing verified from official docs |
| Batch API | HIGH | Official docs confirm 50% discount, 10K/batch, vision support |
| Cost estimates | HIGH | Formula from official docs: `tokens = (w*h)/750`; pricing from official pricing page |
| Inngest | MEDIUM | Well-documented Vercel integration, but not yet used in this codebase; need to verify Vercel Pro compatibility |
| Prompt caching | HIGH | Official docs confirm 0.1x cache hit pricing; stacks with batch |
| Schema design | HIGH | Extends existing Prisma patterns (AdAnalysis model) |
| Strategy pipeline | HIGH | Extends existing 3-step pipeline that is already working |
| Embeddings deferral | MEDIUM | pgvector+Prisma is maturing but genuinely not needed for categorical classification |

## Sources

- [Anthropic Pricing (official)](https://platform.claude.com/docs/en/about-claude/pricing) -- Model pricing, batch discounts, caching multipliers
- [Claude Vision Docs (official)](https://platform.claude.com/docs/en/build-with-claude/vision) -- Image token calculation, size limits, URL-based input
- [Claude Batch Processing Docs (official)](https://platform.claude.com/docs/en/build-with-claude/batch-processing) -- Batch API usage, 10K limit, 24hr SLA
- [Inngest Pricing](https://www.inngest.com/pricing) -- Free tier: 50K executions/month
- [Inngest + Vercel Integration](https://www.inngest.com/docs/deploy/vercel) -- Native Vercel deployment
- [Prisma pgvector support](https://www.prisma.io/blog/orm-6-13-0-ci-cd-workflows-and-pgvector-for-prisma-postgres) -- Early access, Prisma 7 improvements
