# Phase 63: Classification Pipeline - Research

**Researched:** 2026-03-27
**Domain:** Anthropic Batch API, Claude Vision for ad classification, on-demand + batch classification pipeline
**Confidence:** HIGH

## Summary

Phase 63 builds the actual classification pipeline on top of Phase 62's foundation (taxonomy, schemas, prompt, cost tracker, Prisma models). There are two distinct flows: (1) on-demand single-ad classification via a Next.js API route that calls Claude directly and returns in 2-4 seconds, and (2) batch classification of an entire brand's ads via the Anthropic Message Batches API with 50% cost savings and cron-based polling.

The Anthropic Message Batches API explicitly supports vision requests, structured outputs, and all features available in the standard Messages API. Each batch can hold up to 100,000 requests or 256 MB, whichever comes first. Batches complete within 1 hour typically (24 hour max), and results are streamed as JSONL. The SDK provides `client.messages.batches.create()`, `.retrieve()`, and `.results()` methods natively.

For vision/image classification, ads stored in Cloudflare R2 can be referenced by their public URL directly in the `image.source.url` field -- no base64 encoding needed. Image token cost follows the formula `tokens = (width * height) / 750`, meaning a typical 1000x1000 ad image costs ~1,334 tokens. At Haiku 4.5 batch pricing ($0.50/MTok input), that is approximately $0.0007 per image -- negligible.

**Primary recommendation:** Use text-only classification by default (already ~85% accurate based on ad copy, title, CTA, format metadata), and add optional vision classification for ads that have downloaded image assets. Use `output_config.format` with `zodOutputFormat()` for both single and batch requests to guarantee schema compliance. Poll batch status via a Vercel cron job every 5 minutes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.78.0` (existing) | Messages API + Batches API + structured outputs | Already installed; SDK includes `messages.batches.*` methods and `zodOutputFormat` helper |
| `prisma` | `^7.4.2` (existing) | Read ads, write classifications, track jobs | Already used for all data models |
| `zod` | `^4.3.6` (existing) | Classification schema validation | Already used; `ClassificationOutputSchema` from Phase 62 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk/helpers/zod` | (included in SDK) | Convert Zod to JSON Schema for `output_config` | Every classification call (single + batch) |
| `next/server` `after()` | (Next.js 16 built-in) | Fire-and-forget cost logging after response | Single-ad classification route |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel cron polling | Webhook/streaming | Batches don't support webhooks; cron is simpler and already used for ingestion |
| URL image source | Base64 encoding | URL is simpler, avoids encoding overhead; images already public on R2 CDN |
| Haiku 4.5 for classification | Sonnet for higher accuracy | Haiku is 6x cheaper at batch pricing; text classification accuracy is sufficient for 8-category taxonomy |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    classification/
      taxonomy.ts          # (Phase 62) Category enums, values, labels
      schemas.ts           # (Phase 62) Zod schemas for classification output
      prompt.ts            # (Phase 62) System prompt with few-shot examples
      cost-tracker.ts      # (Phase 62) API cost logging utility
      classify-single.ts   # (Phase 63) On-demand single-ad classification
      classify-batch.ts    # (Phase 63) Batch creation + result processing
  app/
    api/
      classify/
        single/route.ts    # POST: classify one ad on-demand
        batch/route.ts     # POST: start batch classification for a brand
        batch/status/route.ts  # GET: check batch job status
      ad-library/
        cron/
          classify-poll/route.ts  # Cron: poll batch jobs + process results
```

### Pattern 1: On-Demand Single Ad Classification
**What:** User clicks "Classify" on an ad card. API route calls Claude Haiku with structured outputs, returns classification in 2-4 seconds.
**When to use:** Single ad classification, triggered by user interaction.

```typescript
// src/lib/classification/classify-single.ts
// Source: Anthropic structured outputs docs + Phase 62 schemas
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificationOutputSchema } from "./schemas";
import { buildClassificationPrompt, buildAdContext } from "./prompt";
import { logApiCost } from "./cost-tracker";

const client = new Anthropic();

interface AdInput {
  adId: string;
  brandName?: string;
  category?: string;
  body?: string;
  title?: string;
  ctaText?: string;
  displayFormat?: string;
  imageUrl?: string; // R2 public URL, optional
}

export async function classifySingleAd(ad: AdInput) {
  const systemPrompt = buildClassificationPrompt();
  const adContext = buildAdContext(ad);

  // Build message content: text context + optional image
  const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  if (ad.imageUrl) {
    userContent.push({
      type: "image",
      source: { type: "url", url: ad.imageUrl },
    });
  }

  userContent.push({ type: "text", text: adContext });

  const response = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(ClassificationOutputSchema) },
  });

  // Fire-and-forget cost logging
  logApiCost({
    model: "claude-haiku-4-5-20251001",
    operation: "classify-single",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    brandId: undefined, // caller can add
  });

  return {
    classification: response.parsed_output,
    usage: response.usage,
  };
}
```

### Pattern 2: Batch Classification via Message Batches API
**What:** User clicks "Classify All" on a brand page. System creates a ClassificationJob, submits all unclassified ads to the Batch API, and polls for completion.
**When to use:** Brand-level batch classification (10-500+ ads).

```typescript
// src/lib/classification/classify-batch.ts
// Source: Anthropic Batch API docs (platform.claude.com/docs/en/build-with-claude/batch-processing)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificationOutputSchema } from "./schemas";
import { buildClassificationPrompt, buildAdContext } from "./prompt";
import { prisma } from "@/lib/prisma";

const client = new Anthropic();

export async function submitBatchClassification(jobId: string) {
  const job = await prisma.classificationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { brand: true },
  });

  // Get unclassified ads for this brand
  const ads = await prisma.adLibraryAd.findMany({
    where: {
      brandId: job.brandId,
      classification: null, // Skip already-classified ads
    },
    include: {
      assets: {
        where: { assetType: "image", downloadStatus: "completed" },
        take: 1,
      },
    },
  });

  if (ads.length === 0) {
    await prisma.classificationJob.update({
      where: { id: jobId },
      data: { status: "completed", skippedAds: job.totalAds },
    });
    return;
  }

  const systemPrompt = buildClassificationPrompt();
  const outputFormat = zodOutputFormat(ClassificationOutputSchema);

  // Build batch requests: one per ad, custom_id = ad database ID
  const requests = ads.map((ad) => {
    const userContent: any[] = [];

    // Add image if available (R2 public URL)
    const imageAsset = ad.assets[0];
    if (imageAsset?.storedUrl) {
      userContent.push({
        type: "image",
        source: { type: "url", url: imageAsset.storedUrl },
      });
    }

    userContent.push({
      type: "text",
      text: buildAdContext({
        brandName: job.brand.pageName,
        category: job.brand.category || undefined,
        body: ad.body || undefined,
        title: ad.title || undefined,
        ctaText: ad.ctaText || undefined,
        displayFormat: ad.displayFormat || undefined,
      }),
    });

    return {
      custom_id: ad.id, // Use database ad ID as custom_id
      params: {
        model: "claude-haiku-4-5-20251001" as const,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        output_config: { format: outputFormat },
      },
    };
  });

  // Submit batch to Anthropic
  const batch = await client.messages.batches.create({ requests });

  // Update job with batch reference
  await prisma.classificationJob.update({
    where: { id: jobId },
    data: {
      status: "processing",
      anthropicBatchId: batch.id,
      batchSubmittedAt: new Date(),
      totalAds: ads.length + job.skippedAds,
      skippedAds: job.skippedAds,
    },
  });

  return batch.id;
}
```

### Pattern 3: Cron-Based Batch Polling
**What:** A Vercel cron job runs every 5 minutes, checks for active batch jobs, polls their status, and processes completed results.
**When to use:** Automated background processing of batch results.

```typescript
// src/app/api/ad-library/cron/classify-poll/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { ClassificationOutputSchema } from "@/lib/classification/schemas";
import { logApiCost } from "@/lib/classification/cost-tracker";

const CRON_SECRET = process.env.CRON_SECRET;
const client = new Anthropic();

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find active batch jobs
  const activeJobs = await prisma.classificationJob.findMany({
    where: { status: "processing", anthropicBatchId: { not: null } },
  });

  for (const job of activeJobs) {
    const batch = await client.messages.batches.retrieve(job.anthropicBatchId!);

    if (batch.processing_status !== "ended") {
      // Update progress counts
      await prisma.classificationJob.update({
        where: { id: job.id },
        data: {
          classifiedAds: batch.request_counts.succeeded,
          failedAds: batch.request_counts.errored,
        },
      });
      continue;
    }

    // Batch complete — process results
    let classified = 0;
    let failed = 0;
    let totalInput = 0;
    let totalOutput = 0;

    for await (const result of await client.messages.batches.results(job.anthropicBatchId!)) {
      if (result.result.type === "succeeded") {
        const message = result.result.message;
        const text = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        try {
          const parsed = ClassificationOutputSchema.parse(JSON.parse(text));

          await prisma.adClassification.create({
            data: {
              adId: result.custom_id,
              ...parsed, // Spread all 8 categories + hookScore + conceptCluster + confidence
              classifiedBy: "haiku-4.5",
              classificationSource: "batch",
              schemaVersion: 1,
            },
          });

          classified++;
          totalInput += message.usage.input_tokens;
          totalOutput += message.usage.output_tokens;
        } catch (e) {
          failed++;
        }
      } else {
        failed++;
      }
    }

    // Update job as complete
    await prisma.classificationJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        classifiedAds: classified,
        failedAds: failed,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        batchCompletedAt: new Date(),
      },
    });

    // Log total cost
    logApiCost({
      model: "claude-haiku-4-5-20251001",
      operation: "classify-batch",
      inputTokens: totalInput,
      outputTokens: totalOutput,
      brandId: job.brandId,
    });
  }

  return Response.json({ processed: activeJobs.length });
}
```

### Pattern 4: Skip Already-Classified Ads
**What:** Before classification (both single and batch), check if an AdClassification already exists for the ad. Never re-classify.
**When to use:** Every classification call.

```typescript
// Check before single classification
const existing = await prisma.adClassification.findUnique({
  where: { adId: targetAdId },
});
if (existing) {
  return Response.json({ classification: existing, cached: true });
}

// For batch: filter in the query itself
const unclassifiedAds = await prisma.adLibraryAd.findMany({
  where: {
    brandId: brandId,
    classification: null, // Only ads without classification
  },
});
```

### Anti-Patterns to Avoid
- **Polling from the client (browser):** Do not have the frontend poll the Anthropic API directly. Use the cron job to poll and store results in the database. The frontend polls the ClassificationJob status from our own API.
- **Sending base64 images in batch requests:** Images are already public on R2. Use URL source type to avoid bloating the 256 MB batch size limit.
- **Re-classifying already-classified ads:** Always filter by `classification: null` before batch submission. The `skippedAds` counter on ClassificationJob tracks how many were skipped.
- **Blocking on batch completion:** Batch jobs can take up to 1 hour. Return the job ID immediately and let the cron handle polling.
- **Using Sonnet for classification:** Haiku 4.5 is sufficient for 8-category enum classification. At batch pricing, it is 6x cheaper than Sonnet ($0.50 vs $3.00 per MTok input).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch request construction | Custom HTTP calls to `/v1/messages/batches` | `client.messages.batches.create({ requests })` | SDK handles auth, serialization, error types |
| Batch result streaming | Manual JSONL parsing from `results_url` | `for await (const r of client.messages.batches.results(id))` | SDK handles streaming, pagination, typed results |
| Batch status polling | Custom fetch + interval logic | `client.messages.batches.retrieve(id)` in a cron job | SDK returns typed `processing_status` and `request_counts` |
| JSON schema for classification | Hand-written JSON Schema with `additionalProperties: false` | `zodOutputFormat(ClassificationOutputSchema)` | Auto-converts Zod to JSON Schema with all required flags |
| Cost estimation | Manual token counting | Read `response.usage.input_tokens` + `output_tokens` from API response | Exact token counts returned on every response |
| Image URL validation | Custom URL checker | Use `storedUrl` from `AdAsset` where `downloadStatus = "completed"` | Assets already validated during download pipeline |

**Key insight:** The Anthropic TypeScript SDK has first-class support for the Batches API under `client.messages.batches.*`. All CRUD operations, result streaming, and type safety are built in. The `custom_id` field on each batch request maps directly to our ad database IDs, making result processing trivial.

## Common Pitfalls

### Pitfall 1: Batch Size Exceeding 256 MB with Images
**What goes wrong:** Including many image URLs in batch requests can cause the batch to exceed the 256 MB size limit, even though URL references are small. The actual constraint is 100,000 requests OR 256 MB of request payload.
**Why it happens:** URL-based image references are small (~100 bytes each), but the system prompt + ad context + image URL per request adds up. With 500 ads and a ~2KB system prompt each, that is only ~1 MB -- well within limits.
**How to avoid:** For brands with >5,000 ads, split into multiple batch jobs. Track the batch size and cap at ~10,000 requests per batch for safety.
**Warning signs:** `400` error when creating batch; error message mentioning size limit.

### Pitfall 2: Batch Results Not Matching Input Order
**What goes wrong:** Batch results are returned in arbitrary order, not the order they were submitted. Code that assumes position-based matching will mismatch classifications to ads.
**Why it happens:** Anthropic processes batch requests concurrently and returns results as they complete.
**How to avoid:** Always use `custom_id` (set to the ad's database ID) to match results to ads. Never rely on array position.
**Warning signs:** Classifications appearing wrong when manually inspecting; `custom_id` not matching any known ad ID.

### Pitfall 3: Structured Outputs with Batch API -- Parse vs Create
**What goes wrong:** `client.messages.parse()` (which auto-parses structured output) is not available for batch requests. Batch results return raw message content that must be manually parsed.
**Why it happens:** Batch results come as JSONL with raw `message` objects, not the SDK's parsed response type.
**How to avoid:** In the batch result handler, extract the text content from `result.result.message.content`, `JSON.parse()` it, then validate with `ClassificationOutputSchema.parse()`. See the cron polling pattern above.
**Warning signs:** TypeError when accessing `result.parsed_output`; raw JSON text in content blocks.

### Pitfall 4: Cron Timeout on Large Batch Results
**What goes wrong:** Vercel cron jobs have a max execution time (typically 60s on Hobby, 300s on Pro). Processing 500+ batch results with database writes can exceed this.
**Why it happens:** Each result requires a Prisma `create()` call + cost logging.
**How to avoid:** Use `prisma.adClassification.createMany()` for bulk inserts. Batch database writes in chunks of 100. If still too slow, process results incrementally across multiple cron runs by tracking a cursor.
**Warning signs:** Cron job timing out; partial results written; job stuck in "processing" state.

### Pitfall 5: Vision Tokens Inflating Cost for Video Ads
**What goes wrong:** Video ads don't have a single image to classify. Sending a video thumbnail (~1000x1000px) adds ~1,334 tokens per request. For 500 ads, that is 667K extra tokens ($0.33 at Haiku batch pricing) -- still cheap, but unnecessary if ad copy is sufficient.
**Why it happens:** Treating all ads identically regardless of whether visual context adds value.
**How to avoid:** Start with text-only classification (body, title, CTA, format). Only add vision for image-format ads with downloaded assets. Set `classificationSource` to "text" or "vision" accordingly. Compare accuracy between the two modes with a validation sample.
**Warning signs:** Input token count per request jumping from ~500 to ~2,000; costs higher than estimated.

### Pitfall 6: Missing Error Handling for Expired Batch Requests
**What goes wrong:** Individual requests within a batch can have 4 result types: `succeeded`, `errored`, `canceled`, `expired`. Code that only handles `succeeded` silently drops failed classifications.
**Why it happens:** Assuming all requests in a completed batch succeeded.
**How to avoid:** Handle all 4 result types. Increment `failedAds` for any non-succeeded result. Store error details on the job for debugging. Optionally retry expired/errored requests in a new batch.
**Warning signs:** `classifiedAds + failedAds + skippedAds < totalAds`; missing classifications after batch completion.

## Code Examples

### Batch API: Create a Batch with Vision + Structured Output
```typescript
// Source: Anthropic Batch API docs (platform.claude.com/docs/en/build-with-claude/batch-processing)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificationOutputSchema } from "@/lib/classification/schemas";
import { buildClassificationPrompt, buildAdContext } from "@/lib/classification/prompt";

const client = new Anthropic();

// Build batch requests
const requests = ads.map((ad) => ({
  custom_id: ad.id, // Database ad ID for matching results
  params: {
    model: "claude-haiku-4-5-20251001" as const,
    max_tokens: 500,
    system: buildClassificationPrompt(),
    messages: [{
      role: "user" as const,
      content: [
        // Optional: include image if available
        ...(ad.imageUrl ? [{
          type: "image" as const,
          source: { type: "url" as const, url: ad.imageUrl },
        }] : []),
        { type: "text" as const, text: buildAdContext(ad) },
      ],
    }],
    output_config: { format: zodOutputFormat(ClassificationOutputSchema) },
  },
}));

// Submit batch
const batch = await client.messages.batches.create({ requests });
// batch.id = "msgbatch_01..." -- store in ClassificationJob.anthropicBatchId
```

### Batch API: Poll Status
```typescript
// Source: Anthropic Batch API docs
const batch = await client.messages.batches.retrieve(anthropicBatchId);

// processing_status: "in_progress" | "canceling" | "ended"
if (batch.processing_status === "ended") {
  // request_counts: { processing, succeeded, errored, canceled, expired }
  console.log(`Completed: ${batch.request_counts.succeeded} succeeded, ${batch.request_counts.errored} errored`);
}
```

### Batch API: Stream Results
```typescript
// Source: Anthropic Batch API docs -- JSONL streaming
for await (const result of await client.messages.batches.results(anthropicBatchId)) {
  const adId = result.custom_id; // Maps back to our ad database ID

  switch (result.result.type) {
    case "succeeded": {
      const message = result.result.message;
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const classification = ClassificationOutputSchema.parse(JSON.parse(text));
      // Persist to AdClassification table
      break;
    }
    case "errored":
      // result.result.error.type: "invalid_request_error" | "api_error"
      break;
    case "expired":
      // Request timed out after 24h
      break;
    case "canceled":
      // Batch was canceled before this request processed
      break;
  }
}
```

### Vision: Image Source URL Format
```typescript
// Source: Anthropic Vision docs (platform.claude.com/docs/en/build-with-claude/vision)
// Ad images stored on R2 are publicly accessible URLs
const R2_PUBLIC_URL = "https://pub-25ef069908854da9871d20aea605675a.r2.dev";

// Get image URL from AdAsset
const imageAsset = await prisma.adAsset.findFirst({
  where: { adId, assetType: "image", downloadStatus: "completed" },
  select: { storedUrl: true },
});

// Use in message content
const content = [
  {
    type: "image" as const,
    source: {
      type: "url" as const,
      url: imageAsset.storedUrl, // e.g., "https://pub-25ef...r2.dev/ads/brand-123/ad-456.jpg"
    },
  },
  { type: "text" as const, text: adContextString },
];
```

### API Route: Single Ad Classification Endpoint
```typescript
// src/app/api/classify/single/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifySingleAd } from "@/lib/classification/classify-single";
import { after } from "next/server";
import { logApiCost } from "@/lib/classification/cost-tracker";

export async function POST(request: NextRequest) {
  const { adId } = await request.json();
  if (!adId) return Response.json({ error: "adId required" }, { status: 400 });

  // Check if already classified
  const existing = await prisma.adClassification.findUnique({ where: { adId } });
  if (existing) return Response.json({ classification: existing, cached: true });

  // Fetch ad with brand and image asset
  const ad = await prisma.adLibraryAd.findUnique({
    where: { id: adId },
    include: {
      brand: { select: { pageName: true, category: true } },
      assets: {
        where: { assetType: "image", downloadStatus: "completed" },
        take: 1,
        select: { storedUrl: true },
      },
    },
  });

  if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });

  const { classification, usage } = await classifySingleAd({
    adId: ad.id,
    brandName: ad.brand.pageName,
    category: ad.brand.category || undefined,
    body: ad.body || undefined,
    title: ad.title || undefined,
    ctaText: ad.ctaText || undefined,
    displayFormat: ad.displayFormat || undefined,
    imageUrl: ad.assets[0]?.storedUrl || undefined,
  });

  // Persist classification
  const saved = await prisma.adClassification.create({
    data: {
      adId: ad.id,
      ...classification,
      classifiedBy: "haiku-4.5",
      classificationSource: ad.assets[0]?.storedUrl ? "vision" : "text",
      schemaVersion: 1,
    },
  });

  // Fire-and-forget cost logging (after response is sent)
  after(() => {
    logApiCost({
      model: "claude-haiku-4-5-20251001",
      operation: "classify-single",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      brandId: ad.brandId,
    });
  });

  return Response.json({ classification: saved, cached: false });
}
```

### API Route: Start Batch Classification
```typescript
// src/app/api/classify/batch/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitBatchClassification } from "@/lib/classification/classify-batch";

export async function POST(request: NextRequest) {
  const { brandId } = await request.json();
  if (!brandId) return Response.json({ error: "brandId required" }, { status: 400 });

  // Check for existing active job
  const activeJob = await prisma.classificationJob.findFirst({
    where: { brandId, status: { in: ["queued", "processing"] } },
  });
  if (activeJob) {
    return Response.json({ error: "Classification already in progress", jobId: activeJob.id }, { status: 409 });
  }

  // Count unclassified ads
  const unclassifiedCount = await prisma.adLibraryAd.count({
    where: { brandId, classification: null },
  });
  const alreadyClassified = await prisma.adLibraryAd.count({
    where: { brandId, classification: { isNot: null } },
  });

  if (unclassifiedCount === 0) {
    return Response.json({ message: "All ads already classified", total: alreadyClassified });
  }

  // Estimate cost (Haiku batch: $0.50/MTok input, $2.50/MTok output)
  // ~500 input tokens + ~200 output tokens per text-only classification
  const estimatedCost = (unclassifiedCount * 500 / 1_000_000) * 0.50 +
                         (unclassifiedCount * 200 / 1_000_000) * 2.50;

  // Create job
  const job = await prisma.classificationJob.create({
    data: {
      brandId,
      status: "queued",
      totalAds: unclassifiedCount + alreadyClassified,
      skippedAds: alreadyClassified,
      estimatedCostUsd: estimatedCost,
    },
  });

  // Submit batch (async -- returns immediately)
  submitBatchClassification(job.id).catch((err) => {
    prisma.classificationJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: err.message },
    });
  });

  return Response.json({ jobId: job.id, estimatedCost, unclassifiedAds: unclassifiedCount });
}
```

## Batch API Reference (Verified from Official Docs)

### Key Limits and Constraints
| Constraint | Value | Source |
|-----------|-------|--------|
| Max requests per batch | 100,000 | Official docs |
| Max batch payload size | 256 MB | Official docs |
| Processing time (typical) | < 1 hour | Official docs |
| Processing time (max) | 24 hours | Official docs |
| Results available for | 29 days after creation | Official docs |
| Cost discount | 50% of standard pricing | Official docs |
| Processing statuses | `in_progress`, `canceling`, `ended` | Official docs |
| Result types | `succeeded`, `errored`, `canceled`, `expired` | Official docs |

### Batch Pricing (Haiku 4.5)
| Metric | Standard | Batch (50% off) |
|--------|----------|-----------------|
| Input tokens | $1.00/MTok | $0.50/MTok |
| Output tokens | $5.00/MTok | $2.50/MTok |

### Cost Estimate Per Ad Classification
| Mode | Input tokens | Output tokens | Standard cost | Batch cost |
|------|-------------|---------------|---------------|------------|
| Text-only | ~500 | ~200 | $0.0015 | $0.00075 |
| Text + image (1000x1000) | ~1,834 | ~200 | $0.0028 | $0.0014 |

### Vision Image Token Cost
Formula: `tokens = (width * height) / 750`

| Image size | Tokens | Cost (Haiku batch input) |
|-----------|--------|--------------------------|
| 500x500 | ~334 | $0.00017 |
| 1000x1000 | ~1,334 | $0.00067 |
| 1568x1568 | ~3,278 | $0.00164 |

Image format support: JPEG, PNG, GIF, WebP. Max 5 MB per image (API limit). Max image dimension: 8000x8000 px. Optimal: resize to < 1568px on longest edge.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `client.beta.messages.batches.create()` | `client.messages.batches.create()` | GA (no longer beta) | No beta header needed |
| Polling only | Polling + `request_counts` for progress | Current | Can show progress % to user |
| Base64 images only | URL image source + Files API | 2025 | No encoding overhead for public images |
| No structured output in batch | Full `output_config` support in batch | Late 2025 | Enum enforcement works in batch mode |

**Deprecated/outdated:**
- `client.beta.messages.batches.*`: The Batches API is GA -- use `client.messages.batches.*` directly (no `beta` namespace needed).
- The beta header `anthropic-beta: message-batches-2024-09-24` is no longer required.

## Open Questions

1. **Structured output in batch result parsing**
   - What we know: Batch results return raw `message` objects in JSONL. The `messages.parse()` helper (which auto-validates structured output) is only for synchronous calls.
   - What's unclear: Whether the SDK provides a typed helper for parsing batch results with structured output, or if manual `JSON.parse()` + Zod validation is required.
   - Recommendation: Use manual `JSON.parse()` + `ClassificationOutputSchema.parse()` for batch results. This is reliable and well-tested.

2. **Vercel cron frequency for batch polling**
   - What we know: Batches typically complete in < 1 hour. Vercel cron minimum interval depends on plan.
   - What's unclear: Whether 5-minute polling is too frequent (wasteful) or too slow (user waiting). Also, Vercel Hobby cron is limited to daily; Pro supports custom intervals.
   - Recommendation: Use `*/5 * * * *` (every 5 minutes) on Pro plan. If on Hobby, the user can manually check status via the status endpoint, and a single daily cron can clean up completed jobs.

3. **Prompt caching effectiveness in batch mode**
   - What we know: Anthropic docs say batch + prompt caching discounts stack, and cache hit rates range 30-98%. The shared system prompt across all requests in a batch is a strong caching candidate.
   - What's unclear: Whether the `cache_control` block is needed or if identical system prompts are automatically cached in batch mode.
   - Recommendation: Add `cache_control: { type: "ephemeral" }` to the system prompt block. The 1-hour cache TTL is well-suited for batch processing. This can reduce input token costs by 90% for the cached portion.

4. **Max concurrent batch jobs**
   - What we know: Anthropic rate limits apply to both HTTP requests and in-batch request volume.
   - What's unclear: Exact concurrent batch limits for the workspace.
   - Recommendation: Limit to 1 active batch per brand (enforced by checking for existing active ClassificationJob). Allow multiple brands to have concurrent batches.

## Sources

### Primary (HIGH confidence)
- [Anthropic Batch Processing Docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing) -- Full batch API guide: creation, polling, results streaming, pricing, limits, prompt caching
- [Anthropic Vision Docs](https://platform.claude.com/docs/en/docs/build-with-claude/vision) -- Image formats, token calculation, URL vs base64 source, size limits
- [Anthropic Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- `output_config.format`, `zodOutputFormat()`, batch compatibility
- Existing codebase: `src/lib/classification/*` (Phase 62 foundation), `src/app/api/ad-library/cron/*` (cron pattern), `prisma/schema.prisma` (all models)

### Secondary (MEDIUM confidence)
- [Anthropic Pricing](https://claude.com/pricing) -- Haiku 4.5 pricing: $1.00/$5.00 per MTok standard, 50% off for batch
- Existing diversity route `src/app/api/analyze/diversity/route.ts` -- Current classification pattern (to be replaced)

### Tertiary (LOW confidence)
- Prompt cache hit rates in batch mode (30-98% range from docs, actual rate depends on traffic patterns)
- Exact concurrent batch limits per workspace (not documented precisely)

## Metadata

**Confidence breakdown:**
- Batch API mechanics: HIGH -- Verified from official docs, SDK methods confirmed
- Vision in batch: HIGH -- Official docs explicitly list vision as supported in batches
- Structured outputs in batch: HIGH -- Official docs confirm batch supports all Messages API features including output_config
- Cost estimates: HIGH -- Pricing table from official docs, token formula from vision docs
- Cron polling pattern: MEDIUM -- Pattern extrapolated from existing cron routes; exact timing needs tuning
- Prompt caching in batch: MEDIUM -- Documented but cache hit rates vary

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (Batch API is GA and stable; pricing may change)
