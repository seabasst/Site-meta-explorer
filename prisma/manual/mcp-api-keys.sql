-- Self-serve keys for the benchmark MCP (McpApiKey, McpKeyUsage in schema.prisma).
-- Additive and idempotent: safe to run more than once. Never use `prisma db push` here.
-- Run before deploying the route that reads these tables.

CREATE TABLE IF NOT EXISTS "McpApiKey" (
  "keyHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "McpApiKey_pkey" PRIMARY KEY ("keyHash"),
  CONSTRAINT "McpApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "McpApiKey_userId_idx" ON "McpApiKey"("userId");

CREATE TABLE IF NOT EXISTS "McpKeyUsage" (
  "keyHash" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "McpKeyUsage_pkey" PRIMARY KEY ("keyHash", "day")
);
