// =============================================================================
// Classification Zod Schemas
// =============================================================================
// Validates classification output from the LLM. Used with zodOutputFormat()
// in the classification pipeline (Phase 63) to enforce enum constraints.
//
// NOTE: Do NOT import @anthropic-ai/sdk/helpers/zod here.
// That import belongs in the caller/prompt code (Phase 63).
// This file is pure Zod validation.

import { z } from "zod";
import { TAXONOMY } from "./taxonomy";

// ---------------------------------------------------------------------------
// Classification output schema — 8 categories + 3 quality fields
// ---------------------------------------------------------------------------
export const ClassificationOutputSchema = z.object({
  // 8 classification categories (enums derived from taxonomy)
  assetType: z.enum(TAXONOMY.assetType.values),
  visualFormat: z.enum(TAXONOMY.visualFormat.values),
  hookTactic: z.enum(TAXONOMY.hookTactic.values),
  messagingAngle: z.enum(TAXONOMY.messagingAngle.values),
  awarenessStage: z.enum(TAXONOMY.awarenessStage.values),
  creativeMechanic: z.enum(TAXONOMY.creativeMechanic.values),
  offerType: z.enum(TAXONOMY.offerType.values),
  intendedAudience: z.enum(TAXONOMY.intendedAudience.values),

  // Quality metrics
  hookScore: z
    .number()
    .min(1)
    .max(10)
    .describe("1-10 scroll-stopping power of the hook"),
  conceptCluster: z
    .string()
    .describe("2-3 word hyphenated concept label, lowercase"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0.0-1.0 classification confidence"),
});

// Inferred type for use in application code
export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;
