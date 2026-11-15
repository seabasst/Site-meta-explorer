// Free MCP server (Streamable HTTP, stateless, JSON responses) serving industry benchmarks for Meta
// ad lifespans. Benchmarks are precomputed rows in "VerticalBenchmark" (see the Prisma model).
//
// Keys: give one only to someone who accepted /mcp/terms. Issue with
//   node -e "const k='kiri_'+require('crypto').randomBytes(24).toString('hex');console.log(k, require('crypto').createHash('sha256').update(k).digest('hex'))"
// then append the hash (second value) to MCP_API_KEY_HASHES (comma-separated) in Vercel and redeploy.
// Connect: claude mcp add --transport http kiri-benchmarks https://genome.kirimedia.co/api/mcp --header "Authorization: Bearer <key>"
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TIERS = ['small', 'medium', 'large'] as const;

type Benchmark = {
  vertical: string;
  built_at: string;
  pulled: { from: string; to: string };
  panel: { brands_with_enough_ads: number };
  tiers: Record<(typeof TIERS)[number], unknown>;
  all: unknown;
};

// A few rows of ~6 KB that change when a benchmark is rebuilt; cache per instance to spare Neon.
let cache: { at: number; rows: Map<string, Benchmark> } | null = null;
async function benchmarks(): Promise<Map<string, Benchmark>> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.rows;
  // Raw query so the route does not depend on a regenerated client for one small table.
  const rows = await prisma.$queryRaw<{ vertical: string; data: Benchmark }[]>`SELECT "vertical", "data" FROM "VerticalBenchmark"`;
  cache = { at: Date.now(), rows: new Map(rows.map(r => [r.vertical, r.data])) };
  return cache.rows;
}

const TOOLS = [
  {
    name: 'list_verticals',
    description: 'List the industries that have a Meta ad lifespan benchmark, with panel size and data dates.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_vertical_benchmark',
    description:
      'Benchmark for one industry: per-brand distributions (p10 to p90) of how fast advertisers stop Meta ads, ' +
      'how many run past 60 days, median ad lifespan and launch volume, with definitions and caveats. ' +
      'Pass tier to compare against brands of similar launch volume.',
    inputSchema: {
      type: 'object',
      properties: {
        vertical: { type: 'string', description: 'Industry key from list_verticals, e.g. "supplements".' },
        tier: { type: 'string', enum: TIERS, description: 'Optional size tier by launches per week.' },
      },
      required: ['vertical'],
    },
  },
];

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

function authorized(req: Request): boolean {
  const key = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const hashes = (process.env.MCP_API_KEY_HASHES ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return !!key && hashes.includes(createHash('sha256').update(key).digest('hex'));
}

async function callTool(name: string, args: Record<string, unknown>) {
  const all = await benchmarks();
  if (name === 'list_verticals') {
    return [...all.values()].map(b => ({
      vertical: b.vertical, brands: b.panel.brands_with_enough_ads, pulled: b.pulled, built_at: b.built_at,
    }));
  }
  if (name === 'get_vertical_benchmark') {
    const b = all.get(String(args.vertical));
    if (!b) throw new Error(`Unknown vertical "${args.vertical}". Call list_verticals.`);
    const tier = args.tier as (typeof TIERS)[number] | undefined;
    if (tier && !TIERS.includes(tier)) throw new Error(`tier must be one of ${TIERS.join(', ')}`);
    const { tiers, all: everyone, ...meta } = b;
    return tier ? { ...meta, tier, tier_bounds_and_distribution: tiers[tier] } : { ...meta, tiers, all: everyone };
  }
  throw new Error(`Unknown tool "${name}"`);
}

async function handle(msg: Rpc) {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'kirimedia-benchmarks', version: '1.0.0' },
        instructions:
          'Meta ad lifespan benchmarks per industry from the Meta Ad Library. Lifespan is a delivery proxy, not profit. ' +
          'Use under https://genome.kirimedia.co/mcp/terms.',
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const p = msg.params ?? {};
      try {
        const data = await callTool(String(p.name), (p.arguments as Record<string, unknown>) ?? {});
        return reply({ content: [{ type: 'text', text: JSON.stringify(data) }] });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: (e as Error).message }], isError: true });
      }
    }
    default:
      return { jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: `Method not found: ${msg.method}` } };
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid API key. Terms and key requests: https://genome.kirimedia.co/mcp/terms' } },
      { status: 401 },
    );
  }
  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  // Notifications (no id) get no response body.
  const out = await Promise.all(msgs.filter(m => m.id !== undefined && m.id !== null).map(handle));
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0]);
}

// Stateless server: no server-initiated SSE stream and no sessions to delete.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
