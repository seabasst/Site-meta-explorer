/**
 * Central LLM model config.
 *
 * Before this file existed, model IDs were hardcoded inline across 20+ files.
 * The 2026-04-18 audit found 4 Sonnet-4 variants and 3 Haiku-4.5 variants
 * referenced — including two IDs (`claude-haiku-4-5-20250415`,
 * `claude-haiku-4-20250514`) that don't correspond to any Anthropic release.
 * Those routes either silently failed or got routed to fallback models while
 * being charged at fallback pricing.
 *
 * Adopt these constants when calling Claude. Do not hardcode model strings.
 *
 * See: .planning/review-2026-04-18/05-ai-llm-features.md
 *      .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 1.5)
 */

/**
 * Pinned Claude model IDs. Keep these in sync with the Anthropic dashboard.
 * When bumping a model, also update the pricing table in `PRICING` below.
 */
export const CLAUDE_MODELS = {
  /** Cheap + fast. Classification, extraction, short structured output. */
  haiku: 'claude-haiku-4-5-20251001',
  /** Quality + cost balance. Creative generation, analysis, tool-use agents. */
  sonnet: 'claude-sonnet-4-20250514',
} as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];

/**
 * Pricing per 1M tokens (USD), as of 2026-04. Update when Anthropic changes
 * rates or when pinning a new model.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
};

/** Fallback when a caller uses a model not in PRICING. Err on the expensive side. */
export const DEFAULT_PRICING = { input: 3.0, output: 15.0 } as const;

/**
 * Default call parameters per model family. Callers can override.
 *
 * Temperature rationale:
 * - 0 for extraction / classification / structured output (deterministic)
 * - 0.7 for creative / brief / strategy generation (variety)
 *
 * max_tokens is a ceiling; set narrowly per call site to avoid paying for
 * runaway output.
 */
export const DEFAULTS = {
  /** Extraction / classification — deterministic, short. */
  extraction: {
    model: CLAUDE_MODELS.haiku,
    maxTokens: 1024,
    temperature: 0,
  },
  /** Creative generation — variety, longer outputs. */
  creative: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 4096,
    temperature: 0.7,
  },
  /** Analysis / tool-use agents. */
  agent: {
    model: CLAUDE_MODELS.sonnet,
    maxTokens: 4096,
    temperature: 0.2,
  },
  /** Vision (image + text) — usually extraction. */
  vision: {
    model: CLAUDE_MODELS.haiku,
    maxTokens: 1024,
    temperature: 0,
  },
} as const;

/**
 * Compute estimated USD cost for an Anthropic usage object.
 * Takes { input_tokens, output_tokens } as returned by Anthropic SDK.
 */
export function estimateCost(
  model: string,
  usage: { input_tokens: number; output_tokens: number },
): number {
  const pricing = PRICING[model] ?? DEFAULT_PRICING;
  return (
    (usage.input_tokens / 1_000_000) * pricing.input +
    (usage.output_tokens / 1_000_000) * pricing.output
  );
}
