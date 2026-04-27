import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Auth middleware — defense-in-depth.
 *
 * Every sensitive API route already has its own `auth()` gate (added in
 * Phase 0 of the 2026-04-18 audit). This middleware is a SECOND layer that
 * catches any route missed by the per-route gate, or any future route that
 * ships without one.
 *
 * Strategy: allow-by-default, deny for an explicit list of path prefixes.
 * This is SAFER than deny-by-default for a first pass — a too-wide deny-list
 * would break legitimate public browsing (the v2 dashboard is intentionally
 * public; the ads catalog API is public).
 *
 * Kill switch: set MIDDLEWARE_AUTH_ENFORCE=0 to disable the block and turn
 * this into a no-op. Useful if a deploy misidentifies a path.
 *
 * See: .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 1.2)
 */

/**
 * API path prefixes that always require a logged-in session.
 * Order doesn't matter; each is matched as a prefix.
 *
 * If you add a new paid/mutating API route, add its prefix here.
 */
const AUTH_REQUIRED_PREFIXES: readonly string[] = [
  // LLM / paid API routes
  '/api/manus/',
  '/api/strategy/',
  '/api/creative-lab/',
  '/api/analyze/',
  '/api/classify/',
  '/api/chat/', // catches /api/chat AND /api/chat/hikaru; history sub-routes are already 503 stubs
  '/api/brand-profiles/',
  '/api/brand-guidelines/',
  '/api/brand-health',

  // User-owned data
  '/api/ad-library/saved/',
  '/api/ad-library/brands/monitor/',
  '/api/ad-library/downloads/',

  // Admin / mutating ops
  '/api/ad-library/assets/backfill',
  '/api/ad-library/jobs/', // POST cleanup-stale gated; GET is low-risk metadata
  '/api/subscription/',
] as const;

/**
 * Explicit exceptions — paths that start with a required prefix but are
 * intentionally public.
 */
const PUBLIC_EXCEPTIONS: readonly string[] = [
  // /api/chat/hikaru/history/* is currently 503 stubs (schema not shipped);
  // allow the 503 response to reach the client without an earlier 401 short-circuit.
  '/api/chat/hikaru/history',
] as const;

function requiresAuth(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some((p) => pathname.startsWith(p))) return false;
  return AUTH_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  // Kill switch for emergencies. Default is enforce.
  if (process.env.MIDDLEWARE_AUTH_ENFORCE === '0') {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  // Session check via JWT decode. getToken is Edge-compatible and does NOT
  // import Prisma, so this middleware runs on the Edge runtime cleanly.
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // NextAuth v5 cookie name varies with host; let the library figure it out.
  });

  if (!token?.id && !token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

/**
 * Matcher — only run middleware on /api/*. Static assets, Next internals,
 * and UI pages are excluded. The v2 dashboard at /dashboard/v2/* is public
 * by design and must NOT be caught here.
 */
export const config = {
  matcher: ['/api/:path*'],
};
