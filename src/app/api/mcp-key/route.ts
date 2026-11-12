// Issues a benchmark MCP key to a signed-in user who ticked "I accept" on /mcp/terms. The key is
// returned once; only its sha256 is stored. A new key revokes the user's earlier ones, so each
// person holds one live key and cannot multiply the daily cap in /api/mcp.
import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MCP_TERMS_VERSION, hashMcpKey } from '@/lib/mcp-keys';

export async function POST(req: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  // The shared demo login is not a person who can be bound by the terms.
  if (process.env.NODE_ENV === 'production' && user.email === 'demo@example.com') {
    return Response.json({ error: 'Sign in with Google to get a key.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // termsVersion is the version the page showed; a stale page must reload the current terms.
  if (body.acceptTerms !== true || body.termsVersion !== MCP_TERMS_VERSION) {
    return Response.json({ error: 'Accept the current terms first. Reload the page if it has been open a while.' }, { status: 400 });
  }

  const key = 'kiri_' + randomBytes(24).toString('hex');
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "McpApiKey" SET "revoked" = true WHERE "userId" = ${user.id} AND NOT "revoked"`,
    prisma.$executeRaw`INSERT INTO "McpApiKey" ("keyHash", "userId", "termsVersion") VALUES (${hashMcpKey(key)}, ${user.id}, ${MCP_TERMS_VERSION})`,
  ]);
  return Response.json({ key });
}
