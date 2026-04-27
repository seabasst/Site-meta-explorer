import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARILY DISABLED.
// The HikaruChat / HikaruMessage Prisma models referenced by this route do not
// exist in prisma/schema.prisma, so the previous implementation threw at runtime
// on every call. This route is stubbed out until the schema ships.
//
// See: .planning/review-2026-04-18/04-data-model-and-auth.md (scope 4 P0)
//      .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 2.3)
//
// When re-enabling: add HikaruChat / HikaruMessage models with userId FK + cascade,
// require auth(), and filter every query by session.user.id.

export async function GET() {
  return Response.json({ error: 'Chat history is temporarily unavailable' }, { status: 503 });
}

export async function POST(_request: NextRequest) {
  return Response.json({ error: 'Chat history is temporarily unavailable' }, { status: 503 });
}
