import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARILY DISABLED — see ../../route.ts for context.
// HikaruChat / HikaruMessage Prisma models do not exist.

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ chatId: string }> }
) {
  return Response.json({ error: 'Chat history is temporarily unavailable' }, { status: 503 });
}
