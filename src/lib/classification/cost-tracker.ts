// =============================================================================
// API Cost Tracker
// =============================================================================
// Logs API spend to ApiCostLog table for monitoring classification costs.
// All functions use fire-and-forget error handling — a cost logging failure
// must NEVER break the calling operation.

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Pricing per million tokens (as of 2026-03)
// ---------------------------------------------------------------------------
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6-20260327": { input: 3.0, output: 15.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CostEntry {
  model: string;
  operation: string; // "classify-single", "classify-batch", "strategy-gen", etc.
  inputTokens: number;
  outputTokens: number;
  brandId?: string;
}

// ---------------------------------------------------------------------------
// Log a single API cost entry (fire-and-forget)
// ---------------------------------------------------------------------------
export async function logApiCost(entry: CostEntry): Promise<void> {
  try {
    const pricing = PRICING[entry.model] || DEFAULT_PRICING;
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
  } catch (error) {
    console.error("Failed to log API cost:", error);
  }
}

// ---------------------------------------------------------------------------
// Get total estimated spend for today
// ---------------------------------------------------------------------------
export async function getDailySpend(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.apiCostLog.aggregate({
    where: { date: { gte: today } },
    _sum: { estimatedCost: true },
  });

  return result._sum.estimatedCost ?? 0;
}

// ---------------------------------------------------------------------------
// Get spend breakdown by operation over the last N days
// ---------------------------------------------------------------------------
export async function getSpendByOperation(
  days: number = 7
): Promise<Record<string, number>> {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days);

  const results = await prisma.apiCostLog.groupBy({
    by: ["operation"],
    where: { date: { gte: startDate } },
    _sum: { estimatedCost: true },
  });

  const breakdown: Record<string, number> = {};
  for (const row of results) {
    breakdown[row.operation] = row._sum.estimatedCost ?? 0;
  }
  return breakdown;
}
