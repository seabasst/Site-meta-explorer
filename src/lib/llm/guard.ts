/**
 * LLM request guard — per-user rate limit + per-user daily cost cap.
 *
 * Replaces the current global cost cap (one heavy user could block everyone)
 * with a per-user sliding window and daily spend budget. Both keyed to the
 * authenticated user id. Unauthenticated callers must be blocked BEFORE
 * reaching this function — guard assumes `userId` is always present.
 *
 * Tier-based limits:
 *   - free: restrictive (anyone signed in with the default plan)
 *   - pro:  generous (paying subscriber)
 *   - past_due / cancelled: treat as free
 *
 * Cost accounting uses Redis (via Upstash) so it works across serverless
 * invocations. When Upstash is not configured the guard falls back to a
 * no-op — a caller-supplied per-request rate limit is still defined, but
 * spend accounting becomes advisory-only. This is deliberate: we'd rather
 * ship without accounting than reject all traffic because Redis is down.
 *
 * Usage from a route handler (POST body):
 *
 *   import { llmGuard, recordLlmSpend } from '@/lib/llm/guard';
 *
 *   const guard = await llmGuard({
 *     userId: session.user.id,
 *     userEmail: session.user.email,
 *     operation: 'hikaru-chat',
 *   });
 *   if (!guard.ok) return guard.response;
 *
 *   // ... make the LLM call ...
 *   await recordLlmSpend(session.user.id, costUsd);
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 4.1, 4.3)
 *      .planning/review-2026-04-18/05-ai-llm-features.md (cost exposure table)
 */

import { Redis } from '@upstash/redis';
import { rateLimitUser, rateLimitResponse } from '@/lib/rate-limit';
import { getSubscriptionStatus, type SubscriptionStatus } from '@/lib/subscription';

// ---------------------------------------------------------------------------
// Tier caps
// ---------------------------------------------------------------------------

export interface TierCaps {
  /** Daily USD spend cap across ALL LLM ops for this user. */
  dailySpendUsd: number;
  /** Rate limit per operation per user: requests per window. */
  requestsPerWindow: number;
  /** Window in seconds. */
  windowSec: number;
  /** Hard cap on agentic loop iterations (hikaru, chat). */
  maxAgentIterations: number;
}

/**
 * Defaults are conservative. Tune once you have real usage data.
 * Expensive operations override via the `options` arg to llmGuard().
 */
const TIER_CAPS: Record<SubscriptionStatus, TierCaps> = {
  free: {
    dailySpendUsd: 0.5,
    requestsPerWindow: 20,
    windowSec: 3600, // 1 hour
    maxAgentIterations: 3,
  },
  pro: {
    dailySpendUsd: 20.0,
    requestsPerWindow: 300,
    windowSec: 3600,
    maxAgentIterations: 15,
  },
  // past_due + cancelled are treated as free
  past_due: {
    dailySpendUsd: 0.1,
    requestsPerWindow: 5,
    windowSec: 3600,
    maxAgentIterations: 3,
  },
  cancelled: {
    dailySpendUsd: 0.1,
    requestsPerWindow: 5,
    windowSec: 3600,
    maxAgentIterations: 3,
  },
};

// ---------------------------------------------------------------------------
// Redis (lazy, same instance as rate-limit.ts)
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedis(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    console.error('[llm-guard] Failed to init Upstash client:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier lookup (cached per-process to avoid hammering Prisma)
// ---------------------------------------------------------------------------

const tierCache = new Map<string, { tier: SubscriptionStatus; expires: number }>();
const TIER_CACHE_TTL_MS = 60_000; // 1 min — balance freshness vs. DB load

async function getTierForUser(email: string | null | undefined): Promise<SubscriptionStatus> {
  if (!email) return 'free';
  const now = Date.now();
  const cached = tierCache.get(email);
  if (cached && cached.expires > now) return cached.tier;

  try {
    const tier = await getSubscriptionStatus(email);
    tierCache.set(email, { tier, expires: now + TIER_CACHE_TTL_MS });
    return tier;
  } catch (err) {
    console.error('[llm-guard] Failed to read subscription status; defaulting to free:', err);
    return 'free';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LlmGuardParams {
  userId: string;
  /** Email (for subscription lookup). Pass session.user.email. */
  userEmail: string | null | undefined;
  /**
   * A short label unique to this call site. Used as the rate-limit bucket,
   * so "hikaru-chat" and "creative-lab-brief" have independent windows.
   * Also used for logging.
   */
  operation: string;
  /** Per-op override of requests-per-window. */
  requestsPerWindowOverride?: number;
  /** Per-op override of window. */
  windowSecOverride?: number;
}

export type LlmGuardResult =
  | { ok: true; tier: SubscriptionStatus; caps: TierCaps }
  | { ok: false; response: Response; tier: SubscriptionStatus };

/**
 * Call at the top of every paid LLM route (after auth).
 * Returns ok=true with the tier caps, or ok=false with a Response to return.
 */
export async function llmGuard(params: LlmGuardParams): Promise<LlmGuardResult> {
  const tier = await getTierForUser(params.userEmail);
  const caps = TIER_CAPS[tier];

  // 1. Rate limit.
  const rl = await rateLimitUser(params.operation, params.userId, {
    limit: params.requestsPerWindowOverride ?? caps.requestsPerWindow,
    windowSec: params.windowSecOverride ?? caps.windowSec,
  });
  if (!rl.success) {
    return { ok: false, response: rateLimitResponse(rl), tier };
  }

  // 2. Daily cost cap (Redis-based).
  const redis = getRedis();
  if (redis) {
    try {
      const key = dailySpendKey(params.userId);
      const spend = ((await redis.get<number>(key)) ?? 0);
      if (spend >= caps.dailySpendUsd) {
        return {
          ok: false,
          tier,
          response: new Response(
            JSON.stringify({
              error: `Daily AI budget reached for your plan ($${caps.dailySpendUsd.toFixed(2)}). Upgrade or try tomorrow.`,
              dailyCapUsd: caps.dailySpendUsd,
              spentUsd: Number(spend.toFixed(4)),
              tier,
            }),
            { status: 429, headers: { 'content-type': 'application/json' } },
          ),
        };
      }
    } catch (err) {
      // Fail open on accounting errors — we don't want a Redis outage to 503 every LLM call.
      console.error('[llm-guard] Cost cap read failed (continuing):', err);
    }
  }

  return { ok: true, tier, caps };
}

/**
 * Record USD spend against the user's daily budget. Fire-and-forget —
 * logging failures must never break the route.
 *
 * Also inserts into ApiCostLog (same as call-claude.ts), so the aggregate
 * reporting stays consistent. The userId column is NOT yet in ApiCostLog
 * (Phase 2.4-adjacent), so the Redis key is the source of truth for per-user
 * accounting today.
 */
export async function recordLlmSpend(userId: string, usd: number): Promise<void> {
  if (usd <= 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = dailySpendKey(userId);
    // INCRBYFLOAT atomic; TTL set on first write of the day.
    await redis.incrbyfloat(key, usd);
    // Expire 26 hours from now (covers daily rollover with margin).
    await redis.expire(key, 60 * 60 * 26);
  } catch (err) {
    console.error('[llm-guard] recordLlmSpend failed (continuing):', err);
  }
}

/**
 * Current per-user daily spend (USD). Returns 0 if Redis is unconfigured.
 */
export async function getUserDailySpend(userId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const key = dailySpendKey(userId);
    return (await redis.get<number>(key)) ?? 0;
  } catch {
    return 0;
  }
}

function dailySpendKey(userId: string): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `llm:spend:${day}:${userId}`;
}

// ---------------------------------------------------------------------------
// Export tier caps for callers that want to scale behavior by tier
// ---------------------------------------------------------------------------

export { TIER_CAPS };
export type { SubscriptionStatus };
