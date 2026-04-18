/**
 * Thin wrapper around Anthropic SDK that:
 *   1. Logs cost to ApiCostLog automatically (closes the scope-5 finding
 *      that only 5 of 21 call sites were cost-tracked).
 *   2. Makes model / max_tokens / temperature explicit via the DEFAULTS table.
 *   3. Plumbs AbortSignal through so SSE disconnects stop billing.
 *   4. Returns the raw SDK Message so callers can destructure `content` / `usage`
 *      the way they already do.
 *
 * This is additive — existing call sites keep working with `client.messages.create`
 * directly. New code should use `callClaude`. Phase 4 migrates the remaining
 * 16 sites.
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 1.6)
 *      .planning/review-2026-04-18/05-ai-llm-features.md (cost-tracker wiring)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { prisma } from '@/lib/prisma';
import { estimateCost } from '@/lib/llm/models';

// ---------------------------------------------------------------------------
// Lazy client (one per process)
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  client = new Anthropic();
  return client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CallClaudeParams {
  /** Required. Must be pinned — use CLAUDE_MODELS from `./models`. */
  model: string;
  /** Required. Hard cap on output tokens. */
  maxTokens: number;
  /** Chat messages (user/assistant). System prompt goes in `system`, not here. */
  messages: MessageParam[];
  /** System prompt. Optional but usually present. */
  system?: string;
  /** Sampling temperature. See DEFAULTS in `./models`. */
  temperature?: number;
  /** Tools for tool-use. */
  tools?: MessageCreateParamsNonStreaming['tools'];
  /** Tool choice config. */
  toolChoice?: MessageCreateParamsNonStreaming['tool_choice'];
  /** AbortSignal — plumb this from SSE handlers so client disconnects stop billing. */
  signal?: AbortSignal;

  // Cost-tracking fields — populated into ApiCostLog. Pick an `operation` label
  // that uniquely identifies the call site (e.g. "hikaru-chat", "classify-single",
  // "creative-lab-brief") so you can grep the cost log later.
  operation: string;
  /** If the call is brand-scoped, pass the AdLibraryBrand.id so spend is attributable. */
  brandId?: string;
}

export interface CallClaudeResult {
  /** Raw SDK response — callers can destructure `content` as before. */
  message: Message;
  /** Estimated USD cost for this call. Already logged to ApiCostLog server-side. */
  cost: number;
}

/**
 * Non-streaming Claude call with automatic cost logging.
 *
 * Example:
 *
 *   import { callClaude } from '@/lib/llm/call-claude';
 *   import { DEFAULTS } from '@/lib/llm/models';
 *
 *   const { message, cost } = await callClaude({
 *     ...DEFAULTS.extraction,
 *     system: 'You are a taxonomist. Reply with JSON only.',
 *     messages: [{ role: 'user', content: adBody }],
 *     operation: 'classify-single',
 *     brandId: ad.brandId,
 *     signal: req.signal,
 *   });
 */
export async function callClaude(params: CallClaudeParams): Promise<CallClaudeResult> {
  const {
    model,
    maxTokens,
    messages,
    system,
    temperature,
    tools,
    toolChoice,
    signal,
    operation,
    brandId,
  } = params;

  const anthropic = getClient();

  const createParams: MessageCreateParamsNonStreaming = {
    model,
    max_tokens: maxTokens,
    messages,
    ...(system !== undefined ? { system } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(tools !== undefined ? { tools } : {}),
    ...(toolChoice !== undefined ? { tool_choice: toolChoice } : {}),
  };

  const requestOpts = signal ? { signal } : undefined;
  const message = await anthropic.messages.create(createParams, requestOpts);

  // Fire-and-forget cost logging. A logging failure must never break the call.
  const cost = estimateCost(model, {
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
  });
  void logCost({
    model,
    operation,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    estimatedCost: cost,
    brandId,
  });

  return { message, cost };
}

// ---------------------------------------------------------------------------
// Cost logging (mirrors the existing cost-tracker schema)
// ---------------------------------------------------------------------------

interface CostLogEntry {
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  brandId?: string;
}

async function logCost(entry: CostLogEntry): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.apiCostLog.create({
      data: {
        date: today,
        model: entry.model,
        operation: entry.operation,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        estimatedCost: entry.estimatedCost,
        brandId: entry.brandId,
      },
    });
  } catch (err) {
    console.error('[call-claude] Failed to log cost:', err);
  }
}

/**
 * Convenience: total spend so far today, across ALL call sites.
 * Use for global spend caps. Per-user caps need a separate tally keyed by userId
 * (ApiCostLog has no userId column yet — Phase 4).
 */
export async function getDailySpend(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await prisma.apiCostLog.aggregate({
    where: { date: { gte: today } },
    _sum: { estimatedCost: true },
  });
  return result._sum.estimatedCost ?? 0;
}
