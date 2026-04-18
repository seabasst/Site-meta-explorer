/**
 * Centralized API error helper.
 *
 * Replaces the `String(error)` / `error.message` leak pattern that was
 * flagged in 40+ routes during the 2026-04-18 audit. Those were returning
 * raw Prisma error shapes, Anthropic request internals, occasionally
 * token/URL fragments straight back to the client.
 *
 * Usage from a route handler:
 *
 *   import { apiError } from '@/lib/api-error';
 *
 *   try {
 *     // ...
 *   } catch (err) {
 *     return apiError(err, { fallback: 'Failed to load ads' });
 *   }
 *
 * The full error is always logged server-side. The client sees ONLY the
 * fallback string (or a generic one). Validation errors with a known shape
 * can opt into surfacing their `.message` by passing `expose: true`.
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 1.4)
 *      .planning/review-2026-04-18/01-api-routes.md ("Error leak" findings)
 */

import { NextResponse } from 'next/server';

export interface ApiErrorOptions {
  /** Message returned to the client. Default: "Internal server error". */
  fallback?: string;
  /** HTTP status. Default: 500. */
  status?: number;
  /** Tag for server logs to make origin obvious in log tailing. */
  tag?: string;
  /**
   * Set to true ONLY for errors you've already classified (e.g. zod validation
   * failures) where the message is safe to expose. Default false.
   */
  expose?: boolean;
}

/**
 * Return a safe JSON error response. Logs the full error server-side.
 */
export function apiError(err: unknown, options: ApiErrorOptions = {}): NextResponse {
  const {
    fallback = 'Internal server error',
    status = 500,
    tag,
    expose = false,
  } = options;

  // Always log server-side with full detail.
  const prefix = tag ? `[api:${tag}]` : '[api]';
  console.error(prefix, err);

  // If the caller said it's safe to expose and we can extract a message, use it.
  const message =
    expose && err instanceof Error && err.message ? err.message : fallback;

  return NextResponse.json({ error: message }, { status });
}

/**
 * Shorthand for 400 validation errors. Assumes the error message is safe to
 * surface — only use with zod/manual validation messages, never with raw
 * thrown errors.
 */
export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Shorthand for 401.
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Shorthand for 404. Use "not found" rather than "forbidden" for entities
 * the caller shouldn't know exist (this avoids leaking existence via 403).
 */
export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
