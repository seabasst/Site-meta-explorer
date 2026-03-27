// =============================================================================
// Single Ad Classification
// =============================================================================
// Calls Claude Haiku 4.5 with structured output (zodOutputFormat) to classify
// one ad across 8 taxonomy categories. Returns parsed classification + usage.
//
// NOTE: Does NOT log cost — the caller (API route) handles cost logging
// via after() for fire-and-forget behavior.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificationOutputSchema } from "./schemas";
import type { ClassificationOutput } from "./schemas";
import { buildClassificationPrompt, buildAdContext } from "./prompt";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------
export interface AdInput {
  adId: string;
  brandName?: string;
  category?: string;
  body?: string;
  title?: string;
  ctaText?: string;
  displayFormat?: string;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------
export interface ClassificationResult {
  classification: ClassificationOutput;
  usage: Anthropic.Usage;
}

// ---------------------------------------------------------------------------
// Classify a single ad
// ---------------------------------------------------------------------------
export async function classifySingleAd(
  ad: AdInput
): Promise<ClassificationResult> {
  const client = new Anthropic();

  const systemPrompt = buildClassificationPrompt();

  // Build user content array with optional image
  const userContent: Anthropic.MessageCreateParamsNonStreaming["messages"][0]["content"] =
    [];

  if (ad.imageUrl) {
    userContent.push({
      type: "image",
      source: { type: "url", url: ad.imageUrl },
    });
  }

  userContent.push({
    type: "text",
    text: buildAdContext(ad),
  });

  const response = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(ClassificationOutputSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Classification returned no parsed output");
  }

  return {
    classification: response.parsed_output,
    usage: response.usage,
  };
}
