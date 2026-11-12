import { createHash } from 'node:crypto';

// Version of the text on /mcp/terms. Bump it whenever that text changes: every key records the
// version its holder accepted, which is what binds them to Meta's Platform Terms (3.c.ii.4.a).
export const MCP_TERMS_VERSION = '2026-11-12';

// Requests per key per UTC day, counting every MCP call (initialize and tools/list included).
export const MCP_DAILY_REQUEST_CAP = 500;

export const hashMcpKey = (key: string) => createHash('sha256').update(key).digest('hex');
