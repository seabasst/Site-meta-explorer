/**
 * Rate-limit primitives for API routes.
 *
 * Backed by Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are configured. Falls back to a NO-OP that always allows when unconfigured
 * (dev / ephemeral preview deploys) — this is deliberate: we'd rather ship
 * without rate limiting than refuse all requests because Redis is down.
 *
 * Usage from a route handler:
 *
 *   import { rateLimitUser, rateLimitIp } from '@/lib/rate-limit';
 *
 *   // per-user (after auth() check):
 *   const rl = await rateLimitUser('hikaru-chat', session.user.id, { limit: 30, windowSec: 3600 });
 *   if (!rl.success) return Response.json({ error: 'Too many requests' }, { status: 429 });
 *
 *   // per-IP (before auth, for public endpoints):
 *   const rl = await rateLimitIp('signup', req, { limit: 5, windowSec: 60 });
 *
 * Keyspace convention: `rl:<bucket>:<identifier>` to avoid colliding with
 * other Redis uses.
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 1.3)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Redis client (lazy)
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedis(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    console.error('[rate-limit] Failed to init Upstash client:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Limiter cache — one Ratelimit instance per (bucket, window, limit) tuple.
// Ratelimit instances are lightweight but we cache to avoid allocating per request.
// ---------------------------------------------------------------------------

const limiters = new Map<string, Ratelimit>();

function getLimiter(bucket: string, limit: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${bucket}|${limit}|${windowSec}`;
  let existing = limiters.get(key);
  if (existing) return existing;

  existing = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: false,
    prefix: `rl:${bucket}`,
  });
  limiters.set(key, existing);
  return existing;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** true if the request is allowed */
  success: boolean;
  /** remaining tokens in the current window (undefined if unconfigured) */
  remaining?: number;
  /** epoch ms when the window resets (undefined if unconfigured) */
  reset?: number;
  /** true when no limiter is wired (dev) — request allowed by default */
  unconfigured?: boolean;
}

export interface RateLimitOptions {
  /** Max requests per window. Default: 30. */
  limit?: number;
  /** Window size in seconds. Default: 60. */
  windowSec?: number;
}

/**
 * Per-user rate limit. Call AFTER auth() — pass session.user.id.
 */
export async function rateLimitUser(
  bucket: string,
  userId: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const { limit = 30, windowSec = 60 } = options;
  const limiter = getLimiter(bucket, limit, windowSec);
  if (!limiter) return { success: true, unconfigured: true };

  const res = await limiter.limit(`u:${userId}`);
  return { success: res.success, remaining: res.remaining, reset: res.reset };
}

/**
 * Per-IP rate limit. Safe to call before auth() for public endpoints.
 * Extracts the IP from standard proxy headers; falls back to a static key
 * if nothing is available (which lumps all unknown requests together — this
 * is the safer-than-nothing default for rare edge cases).
 */
export async function rateLimitIp(
  bucket: string,
  req: NextRequest | Request,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const { limit = 30, windowSec = 60 } = options;
  const limiter = getLimiter(bucket, limit, windowSec);
  if (!limiter) return { success: true, unconfigured: true };

  const ip = getClientIp(req);
  const res = await limiter.limit(`ip:${ip}`);
  return { success: res.success, remaining: res.remaining, reset: res.reset };
}

/**
 * Extract client IP from proxy headers. Order matches what Vercel + common
 * proxies set.
 */
function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

/**
 * Convenience: standard 429 Response with Retry-After header.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (result.reset !== undefined) {
    const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    headers.set('retry-after', String(retryAfterSec));
  }
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.' }),
    { status: 429, headers },
  );
}
