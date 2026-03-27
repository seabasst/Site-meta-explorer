# Phase 62: Classification Foundation - Research

**Researched:** 2026-03-27
**Domain:** Ad classification data model, taxonomy design, cost tracking, structured LLM output
**Confidence:** HIGH

## Summary

Phase 62 establishes the data model, taxonomy, and cost tracking that every downstream feature depends on. The three deliverables are: (1) Prisma models for AdClassification, ClassificationJob, and ApiCostLog with indexed columns, (2) a fixed classification taxonomy of 8 categories with ~8-12 tags each, and (3) a classification prompt using Anthropic structured outputs with few-shot examples.

The existing codebase already classifies ads ephemerally in `/api/analyze/diversity/route.ts` using 5 "pillars" (format, tone, journeyPhase, visualStyle, messenger) with ~6-8 values each. Phase 62 replaces this with a persistent, Motion-inspired taxonomy that uses 8 categories. The key architectural shift is from ephemeral classify-and-discard to persistent classify-once-read-everywhere.

**Primary recommendation:** Define 8 classification categories with fixed enum values, store them as indexed Prisma columns (not JSON), and use Anthropic structured outputs (`output_config.format` with `json_schema` type and `enum` constraints) to guarantee valid classification values from the LLM.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.78.0` (existing) | Claude API calls for classification | Already integrated, supports structured outputs with `output_config` |
| `prisma` | `^7.4.2` (existing) | ORM for new models | Already used for all data models |
| `zod` | `^4.3.6` (existing) | Schema validation + `zodOutputFormat` helper | Already used; SDK has built-in Zod helper for structured outputs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk/helpers/zod` | (included in SDK) | Convert Zod schemas to JSON Schema for `output_config` | Every classification call |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Structured outputs (`output_config`) | Free-text JSON + manual parsing | Structured outputs guarantee schema compliance with enum enforcement; free-text can hallucinate invalid values |
| Indexed columns per category | JSON blob with all classifications | Columns enable SQL WHERE/GROUP BY for filtering and benchmarking; JSON requires application-level aggregation |
| `@db.Date` on ApiCostLog | `DateTime` default | Date type enables efficient daily aggregation without time component |

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
      taxonomy.ts          # Category enums, tag definitions, display labels
      schemas.ts           # Zod schemas for classification input/output
      prompt.ts            # System prompt with few-shot examples
      cost-tracker.ts      # API cost logging utility
prisma/
  schema.prisma            # AdClassification, ClassificationJob, ApiCostLog models
```

### Pattern 1: Structured Outputs with Enum Constraints
**What:** Use Anthropic's `output_config.format` with `json_schema` type and `enum` fields to constrain classification values at the inference level.
**When to use:** Every classification call (both on-demand and batch).
**Why:** The current diversity route uses free-text classification where Claude invents labels like "discount-offer" vs "sale-promo" vs "price-deal" -- causing inconsistency. Structured outputs with enums make invalid values literally impossible.

```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ClassificationSchema = z.object({
  assetType: z.enum(["ugc", "studio", "graphic-design", "stock", "screen-capture", "ai-generated", "editorial", "mixed"]),
  visualFormat: z.enum(["talking-head", "product-demo", "testimonial", "lifestyle", "before-after", "unboxing", "tutorial", "skit", "slideshow", "text-overlay", "split-screen", "other"]),
  hookTactic: z.enum(["question", "bold-claim", "statistic", "pain-point", "curiosity-gap", "social-proof", "controversy", "how-to", "direct-address", "storytelling", "other"]),
  messagingAngle: z.enum(["price-value", "problem-solution", "aspirational", "educational", "social-proof", "urgency-scarcity", "emotional", "comparison", "authority", "community", "other"]),
  awarenessStage: z.enum(["unaware", "problem-aware", "solution-aware", "product-aware", "most-aware"]),
  creativeMechanic: z.enum(["before-after", "listicle", "reaction", "day-in-life", "challenge", "transformation", "process-reveal", "review", "other"]),
  offerType: z.enum(["discount", "free-trial", "bundle", "limited-time", "evergreen", "seasonal", "giveaway", "no-offer"]),
  intendedAudience: z.enum(["broad", "niche-interest", "demographic-specific", "retargeting", "lookalike", "competitor-audience", "other"]),
  confidence: z.number().describe("0.0-1.0 confidence in classification accuracy"),
});

const response = await client.messages.parse({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 500,
  system: CLASSIFICATION_SYSTEM_PROMPT, // taxonomy + few-shot examples
  messages: [{ role: "user", content: adContext }],
  output_config: { format: zodOutputFormat(ClassificationSchema) },
});

// Automatically parsed and validated - no JSON.parse needed
const classification = response.parsed_output;
```

**Confidence: HIGH** -- Structured outputs with enum support are GA for Haiku 4.5. Works with Batch API. Zod helper is included in SDK.

### Pattern 2: Cost Tracker as Utility Function
**What:** A simple async function that logs every API call to the ApiCostLog table.
**When to use:** Wrap every Anthropic API call.

```typescript
// src/lib/classification/cost-tracker.ts
import { prisma } from "@/lib/prisma";

interface CostEntry {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  brandId?: string;
}

// Pricing per million tokens (as of 2026-03)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
  "claude-sonnet-4-6-20260327": { input: 3.00, output: 15.00 },
};

export async function logApiCost(entry: CostEntry): Promise<void> {
  const pricing = PRICING[entry.model] || { input: 3.0, output: 15.0 };
  const estimatedCost =
    (entry.inputTokens / 1_000_000) * pricing.input +
    (entry.outputTokens / 1_000_000) * pricing.output;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.apiCostLog.create({
    data: {
      date: today,
      model: entry.model,
      operation: entry.operation,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      estimatedCost,
      brandId: entry.brandId,
    },
  });
}

export async function getDailySpend(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await prisma.apiCostLog.aggregate({
    where: { date: { gte: today } },
    _sum: { estimatedCost: true },
  });
  return result._sum.estimatedCost || 0;
}
```

### Pattern 3: Taxonomy as TypeScript Enums + Display Labels
**What:** Define the taxonomy in a single TypeScript file as const arrays, derive Zod schemas from them, and include display labels for UI.
**When to use:** Everywhere -- models, prompts, UI, validation.

```typescript
// src/lib/classification/taxonomy.ts

export const TAXONOMY = {
  assetType: {
    values: ["ugc", "studio", "graphic-design", "stock", "screen-capture", "ai-generated", "editorial", "mixed"] as const,
    labels: {
      "ugc": "UGC / User-Generated",
      "studio": "Studio / High Production",
      "graphic-design": "Graphic Design",
      "stock": "Stock Footage/Photography",
      "screen-capture": "Screen Capture / Recording",
      "ai-generated": "AI-Generated",
      "editorial": "Editorial / Press Style",
      "mixed": "Mixed / Hybrid",
    },
    description: "The production method and visual quality tier of the creative asset",
  },
  // ... repeat for all 8 categories
} as const;

// Derive types from taxonomy
export type AssetType = typeof TAXONOMY.assetType.values[number];
```

### Anti-Patterns to Avoid
- **JSON blob for classifications:** The existing `AdAnalysis.fullAnalysis Json?` pattern prevents SQL filtering/aggregation. Use indexed columns.
- **Free-text classification values:** The current diversity route lets Claude invent labels. Use structured outputs with enums.
- **Recomputing classifications:** The current pattern discards classifications after scoring. Store persistently.
- **Oversized taxonomy:** The prior research mentioned 46 visual formats -- this makes Claude less accurate and UX incomprehensible. Cap at ~8-12 values per category.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation for LLM output | Manual JSON.parse + try/catch + field checks | `client.messages.parse()` with `zodOutputFormat()` | Structured outputs guarantee schema compliance at inference time; zero parsing errors |
| Enum enforcement in classification | Post-hoc validation that remaps invalid values | `z.enum()` in structured output schema | Invalid values are impossible with structured outputs |
| Cost estimation from token counts | Custom token counting logic | Read `response.usage.input_tokens` + `response.usage.output_tokens` from API response | Anthropic returns exact token counts on every response |
| Date-based cost aggregation | Custom date bucketing logic | Prisma `@db.Date` type + `aggregate` with `gte` filter | PostgreSQL Date type handles daily aggregation natively |

**Key insight:** Anthropic's structured outputs (GA since late 2025) eliminate the entire class of "Claude returned invalid JSON" bugs that plague the current diversity route. The `zodOutputFormat` helper in the SDK converts a Zod schema to JSON Schema automatically, and the model cannot produce output that violates it.

## Common Pitfalls

### Pitfall 1: Taxonomy Too Large for Accurate Classification
**What goes wrong:** With too many values per category (e.g., 46 visual formats), Claude's accuracy drops because the distinctions become too subtle. "talking-head" vs "selfie-testimonial" vs "creator-review" -- these overlap in meaning and Claude will be inconsistent.
**Why it happens:** Over-specification from competitive analysis (Motion uses dynamic tags that adapt per brand; we need fixed enums).
**How to avoid:** Cap each category at 8-12 values. Include an "other" escape hatch. Test with 50 sample ads before finalizing.
**Warning signs:** Classification accuracy below 70% on manual review; same ad classified differently on repeated runs.

### Pitfall 2: Structured Output Schema Invalidating Prompt Cache
**What goes wrong:** Anthropic docs state: "Changing the `output_config.format` parameter will invalidate any prompt cache for that conversation thread." If the schema changes between requests, prompt caching breaks.
**Why it happens:** Iterating on taxonomy during development without realizing cache impact.
**How to avoid:** Freeze the classification schema before bulk classification. Use a `schemaVersion` field on AdClassification so you know which schema produced each result.
**Warning signs:** Prompt cache hit rate dropping to 0%; classification costs higher than estimated.

### Pitfall 3: Missing `additionalProperties: false` in Schema
**What goes wrong:** Structured outputs require `additionalProperties: false` on all object types. Without it, the schema validation fails silently or produces unexpected results.
**Why it happens:** Easy to forget when hand-writing JSON schemas.
**How to avoid:** Always use `zodOutputFormat()` which sets this automatically. Never hand-write JSON schemas.
**Warning signs:** API errors mentioning schema validation; unexpected extra fields in output.

### Pitfall 4: No `schemaVersion` on Classifications
**What goes wrong:** When taxonomy evolves (add/remove/rename values), old classifications become incompatible. Without tracking which schema version produced a classification, you cannot distinguish stale data from current data.
**Why it happens:** Taxonomy seems stable at launch but will inevitably change.
**How to avoid:** Add `schemaVersion Int @default(1)` to AdClassification. When taxonomy changes, bump version and batch-reclassify ads with old versions.
**Warning signs:** Diversity scores suddenly changing after taxonomy update; "unknown" values appearing in aggregations.

### Pitfall 5: Cost Tracker Slowing Down Classification
**What goes wrong:** If cost logging is synchronous and in the critical path, a DB error in cost logging can fail the entire classification.
**Why it happens:** Wrapping classification in a transaction that includes cost logging.
**How to avoid:** Log costs with fire-and-forget (catch and log errors but don't throw). Or use `after()` from Next.js to log costs after the response is sent.
**Warning signs:** Classification latency increasing; intermittent failures traced to cost log inserts.

## Code Examples

### AdClassification Prisma Model (Verified Pattern)
```prisma
// Source: Extends existing AdAnalysis pattern in schema.prisma
model AdClassification {
  id    String @id @default(cuid())
  adId  String @unique
  ad    AdLibraryAd @relation(fields: [adId], references: [id], onDelete: Cascade)

  // 8 classification categories (indexed columns, not JSON)
  assetType         String   // "ugc", "studio", "graphic-design", etc.
  visualFormat      String   // "talking-head", "product-demo", "testimonial", etc.
  hookTactic        String   // "question", "bold-claim", "curiosity-gap", etc.
  messagingAngle    String   // "price-value", "problem-solution", "aspirational", etc.
  awarenessStage    String   // "unaware", "problem-aware", "solution-aware", etc.
  creativeMechanic  String   // "before-after", "listicle", "reaction", etc.
  offerType         String   // "discount", "free-trial", "evergreen", etc.
  intendedAudience  String   // "broad", "niche-interest", "demographic-specific", etc.

  // Quality metrics (carried over from existing diversity analysis)
  hookScore         Int      // 1-10, hook stopping power
  conceptCluster    String   // normalized concept label

  // Metadata
  confidence        Float    @default(0.8)
  classifiedBy      String   @default("haiku-4.5")
  classificationSource String @default("text") // "text" | "vision" | "batch"
  schemaVersion     Int      @default(1)
  classifiedAt      DateTime @default(now())

  @@index([assetType])
  @@index([visualFormat])
  @@index([hookTactic])
  @@index([messagingAngle])
  @@index([awarenessStage])
  @@index([creativeMechanic])
  @@index([offerType])
  @@index([adId])
}
```

### ClassificationJob Prisma Model
```prisma
model ClassificationJob {
  id        String   @id @default(cuid())
  brandId   String
  brand     AdLibraryBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Job state
  status         String   @default("queued") // queued, submitting, processing, completed, failed
  totalAds       Int      @default(0)
  classifiedAds  Int      @default(0)
  failedAds      Int      @default(0)
  skippedAds     Int      @default(0) // already classified

  // Anthropic Batch API reference
  anthropicBatchId String?
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
```

### ApiCostLog Prisma Model
```prisma
model ApiCostLog {
  id            String   @id @default(cuid())
  date          DateTime @db.Date
  model         String   // "claude-haiku-4-5-20251001", etc.
  operation     String   // "classify-single", "classify-batch", "strategy-gen"
  inputTokens   Int
  outputTokens  Int
  estimatedCost Float    // USD
  brandId       String?

  createdAt DateTime @default(now())

  @@index([date, operation])
  @@index([date])
}
```

### Structured Output Classification Call
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TAXONOMY } from "@/lib/classification/taxonomy";

// Build Zod schema from taxonomy definition
const ClassificationOutputSchema = z.object({
  assetType: z.enum(TAXONOMY.assetType.values),
  visualFormat: z.enum(TAXONOMY.visualFormat.values),
  hookTactic: z.enum(TAXONOMY.hookTactic.values),
  messagingAngle: z.enum(TAXONOMY.messagingAngle.values),
  awarenessStage: z.enum(TAXONOMY.awarenessStage.values),
  creativeMechanic: z.enum(TAXONOMY.creativeMechanic.values),
  offerType: z.enum(TAXONOMY.offerType.values),
  intendedAudience: z.enum(TAXONOMY.intendedAudience.values),
  hookScore: z.number().describe("1-10 score for scroll-stopping power of the hook"),
  conceptCluster: z.string().describe("2-3 word hyphenated concept label"),
  confidence: z.number().describe("0.0-1.0 overall classification confidence"),
});

const client = new Anthropic();

const response = await client.messages.parse({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 500,
  system: CLASSIFICATION_SYSTEM_PROMPT,
  messages: [{
    role: "user",
    content: `Classify this ad:\n\nBrand: ${brandName}\nCategory: ${category}\nBody: ${adBody}\nTitle: ${adTitle}\nCTA: ${ctaText}\nFormat: ${displayFormat}`,
  }],
  output_config: { format: zodOutputFormat(ClassificationOutputSchema) },
});

// response.parsed_output is fully typed and validated
const result = response.parsed_output;
```

### Few-Shot System Prompt Structure
```typescript
const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert ad creative analyst. Classify each ad across 8 dimensions.

## Categories and Values

### Asset Type
The production method of the creative:
- ugc: User-generated content, filmed by creator/customer
- studio: Professional studio production with lighting/set
- graphic-design: Designed graphics, illustrations, typography-focused
- stock: Stock photography or footage
- screen-capture: Screen recording, app demo
- ai-generated: Visibly AI-generated imagery
- editorial: Magazine/blog style, press-quality
- mixed: Combines multiple production methods

[... repeat for all 8 categories with descriptions ...]

## Few-Shot Examples

### Example 1: Nike Running Ad
Body: "Your next PR starts with the right shoe. The new Pegasus 42 -- lighter, faster, yours."
Title: "Nike Pegasus 42"
CTA: "Shop Now"
Format: video

Classification:
- assetType: "studio"
- visualFormat: "product-demo"
- hookTactic: "bold-claim"
- messagingAngle: "aspirational"
- awarenessStage: "product-aware"
- creativeMechanic: "process-reveal"
- offerType: "evergreen"
- intendedAudience: "niche-interest"
- hookScore: 7
- conceptCluster: "performance-gear"
- confidence: 0.85

### Example 2: Skincare UGC Testimonial
Body: "I cannot believe this actually worked?? 3 weeks and my skin is completely clear"
Title: null
CTA: "Learn More"
Format: video

Classification:
- assetType: "ugc"
- visualFormat: "testimonial"
- hookTactic: "social-proof"
- messagingAngle: "social-proof"
- awarenessStage: "solution-aware"
- creativeMechanic: "before-after"
- offerType: "evergreen"
- intendedAudience: "niche-interest"
- hookScore: 8
- conceptCluster: "transformation-story"
- confidence: 0.9

[... 3-5 more examples covering different categories ...]

## Rules
1. Every field is required. Pick the BEST match from the allowed values.
2. Use "other" only when no value fits at all.
3. hookScore: 1-3 = weak/generic, 4-6 = decent, 7-10 = strong scroll-stopper.
4. conceptCluster: reuse the SAME label for ads with the same core concept. Keep labels lowercase, hyphenated, 2-3 words.
5. confidence: your honest estimate of classification accuracy (0.5 = guessing, 0.9+ = very confident).
`;
```

## Proposed Taxonomy (8 Categories)

Based on Motion's framework adapted for fixed enums:

### Category 1: Asset Type (8 values)
Production method and visual quality tier.
`ugc | studio | graphic-design | stock | screen-capture | ai-generated | editorial | mixed`

### Category 2: Visual Format (12 values)
The creative execution style.
`talking-head | product-demo | testimonial | lifestyle | before-after | unboxing | tutorial | skit | slideshow | text-overlay | split-screen | other`

### Category 3: Hook Tactic (11 values)
How the first line/second grabs attention.
`question | bold-claim | statistic | pain-point | curiosity-gap | social-proof | controversy | how-to | direct-address | storytelling | other`

### Category 4: Messaging Angle (11 values)
The persuasion strategy.
`price-value | problem-solution | aspirational | educational | social-proof | urgency-scarcity | emotional | comparison | authority | community | other`

### Category 5: Awareness Stage (5 values, Schwartz framework)
Where the audience sits in the awareness funnel.
`unaware | problem-aware | solution-aware | product-aware | most-aware`

### Category 6: Creative Mechanic (9 values)
The structural technique used.
`before-after | listicle | reaction | day-in-life | challenge | transformation | process-reveal | review | other`

### Category 7: Offer Type (8 values)
What commercial proposition is presented.
`discount | free-trial | bundle | limited-time | evergreen | seasonal | giveaway | no-offer`

### Category 8: Intended Audience (7 values)
The targeting intent.
`broad | niche-interest | demographic-specific | retargeting | lookalike | competitor-audience | other`

**Total values across all categories: 71**
**Total cross-product combinations: 8 x 12 x 11 x 11 x 5 x 9 x 8 x 7 = ~30.3M** (theoretical; in practice ads cluster into ~100-200 common patterns)

**Confidence: MEDIUM** -- Taxonomy values are designed to be comprehensive yet distinct. They need validation with 50 sample ads before finalizing. Motion uses dynamic tags (not fixed enums), so our fixed taxonomy is an approximation.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text JSON output | Structured outputs with `output_config.format` | GA late 2025 | Zero parsing errors, enum enforcement at inference time |
| `output_format` parameter (beta) | `output_config.format` parameter (GA) | 2026 transition | Same functionality, updated parameter name |
| Manual JSON Schema | `zodOutputFormat()` SDK helper | SDK 0.78+ | Auto-converts Zod schemas, handles `additionalProperties: false` |
| Classify-and-discard (ephemeral) | Persist per-ad classifications | Decision for v8.0 | Eliminates redundant API calls, enables filtering/benchmarking |
| 5 pillars (format/tone/journey/visual/messenger) | 8 Motion-inspired categories | v8.0 redesign | More granular, industry-aligned taxonomy |

**Deprecated/outdated:**
- `output_format` beta header: Still works but deprecated in favor of `output_config.format`. Migrate during this phase.
- Free-text JSON classification: The current diversity route pattern should not be replicated.

## Relationship to Existing Models

### AdAnalysis (existing) -- Keep Separate
The existing `AdAnalysis` model stores per-ad creative analysis (scores, messaging angle, visual style, full analysis JSON). It serves a different purpose (creative quality assessment) and should NOT be merged with `AdClassification`. The classification model is about categorical taxonomy; the analysis model is about qualitative assessment.

### BrandAnalysisCache (existing) -- Will Be Updated in Phase 64
Currently stores aggregated diversity scores computed from ephemeral classifications. Phase 64 will update this to aggregate from persisted AdClassification data. Phase 62 does not modify this model.

### AdLibraryAd (existing) -- Add Relation Only
Add a `classification AdClassification?` relation to AdLibraryAd. No other changes to the existing model.

### AdLibraryBrand (existing) -- Add Relation Only
Add a `classificationJobs ClassificationJob[]` relation. No other changes.

## Open Questions

1. **Exact hookScore distribution in real data**
   - What we know: Current diversity route produces hookScores 1-10. The distribution is unknown.
   - What's unclear: Whether 50 sample ads is enough to validate the scoring rubric.
   - Recommendation: Run the taxonomy validation spike with 50 ads from 5 different brand categories, manually verify 20 of them.

2. **"other" escape hatch frequency**
   - What we know: Fixed enums with "other" are better than open-ended for consistency.
   - What's unclear: If >20% of ads land in "other" for any category, that category needs more values.
   - Recommendation: Track "other" frequency during validation spike. If >15% for any category, add values.

3. **conceptCluster normalization**
   - What we know: This is a free-text field (not an enum) because the space of concepts is truly open.
   - What's unclear: Whether structured outputs can constrain this enough without an enum.
   - Recommendation: Keep as free-text string but add post-processing normalization (lowercase, trim, map synonyms). Accept some inconsistency here -- it is less critical than the 8 main categories.

4. **Prisma `@db.Date` support with Neon adapter**
   - What we know: Standard Prisma supports `@db.Date` for PostgreSQL DATE type.
   - What's unclear: Whether the `@prisma/adapter-pg` Neon adapter handles this correctly.
   - Recommendation: Test during model creation. Fallback: use `DateTime` and truncate to midnight in application code (as shown in cost-tracker example).

## Sources

### Primary (HIGH confidence)
- [Anthropic Structured Outputs Documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- `output_config.format`, `json_schema` type, enum support, Zod helper, batch compatibility
- Existing codebase: `prisma/schema.prisma` (model patterns), `src/app/api/analyze/diversity/route.ts` (current classification approach), `@anthropic-ai/sdk ^0.78.0` (installed version)
- `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` -- Prior v8.0 research

### Secondary (MEDIUM confidence)
- [Motion AI Tagging](https://motionapp.com/releases/introducing-ai-tagging) -- 8 category framework (asset type, visual format, hook tactic, messaging angle, seasonality, offer type, intended audience)
- [Motion Help Center - AI Tagging](https://help.motionapp.com/en/articles/12461770-getting-started-with-ai-tagging-in-motion) -- Category examples (ugc, skit, listicle, etc.)
- [Foxwell Digital - Motion Benchmarks](https://www.foxwelldigital.com/blog/motion-creative-benchmarks-2026-8-key-takeaways) -- Creative performance patterns

### Tertiary (LOW confidence)
- Specific tag values within each category are our own design (Motion's are dynamic/proprietary). Need validation with sample ads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools are already installed and proven in codebase
- Architecture: HIGH -- Structured outputs API is GA, Prisma patterns are established
- Taxonomy design: MEDIUM -- Based on Motion's framework but adapted to fixed enums; needs validation spike
- Pitfalls: HIGH -- Grounded in existing codebase analysis and official docs
- Cost tracker: HIGH -- Simple CRUD pattern with existing Prisma

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain; taxonomy may evolve after validation)
