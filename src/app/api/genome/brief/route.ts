import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// GET /api/genome/brief?industry=<label>
//
// The Ad Brief Generator. For a chosen industry it reads every classified ad in
// that industry, weights each creative "gene" by longevity + reach, and returns
// prescriptive recommendations (best hook tactic, messaging angle, mechanic,
// format, offer) plus assembled briefs:
//   • Proven Playbook — the highest-performing gene in every dimension
//   • Edge Play — rare-but-long-running "hidden edge" genes to stand out
// Falls back to the global best-performers when an industry is thin, and reports
// a confidence level. Always returns the list of industries that have data.
// =============================================================================

export const dynamic = 'force-dynamic';

const DIMS = ['hookTactic', 'messagingAngle', 'creativeMechanic', 'visualFormat', 'offerType', 'awarenessStage'] as const;
type Dim = (typeof DIMS)[number];
const DUR = `EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400`;

interface GeneRow { dim: Dim; gene: string; n: number; med: number; reach: bigint; hook: number }
interface Gene { gene: string; ads: number; medianDays: number; reachM: number; hookScore: number; prevalence: number; provenScore: number; quadrant: 'edge' | 'standard' | 'fading' | 'low' }

const minMax = (vals: number[]) => { const mn = Math.min(...vals), mx = Math.max(...vals); return (v: number) => (mx === mn ? 0.5 : (v - mn) / (mx - mn)); };

export async function GET(request: NextRequest) {
  const industry = request.nextUrl.searchParams.get('industry')?.trim() || null;

  // Industries with enough classified depth to offer a brief.
  const industriesRaw = await prisma.$queryRawUnsafe<Array<{ category: string; n: number }>>(
    `SELECT b.category, COUNT(*)::int AS n
     FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId" JOIN "AdLibraryBrand" b ON b.id = a."brandId"
     WHERE b.category IS NOT NULL AND a."startDate" IS NOT NULL
     GROUP BY b.category HAVING COUNT(*) >= 40 ORDER BY n DESC`
  );
  const industries = industriesRaw.map((r) => ({ label: r.category, classifiedAds: r.n }));

  // Scope filter: match the industry loosely; empty → global (all classified).
  const useIndustry = industry && industry.toLowerCase() !== 'all';
  const where = useIndustry ? `b.category ILIKE $1 AND a."startDate" IS NOT NULL` : `a."startDate" IS NOT NULL`;
  const params = useIndustry ? [`%${industry}%`] : [];

  const rows = await prisma.$queryRawUnsafe<GeneRow[]>(
    DIMS.map((d) => `
      SELECT '${d}' AS dim, c."${d}" AS gene, COUNT(*)::int AS n,
        ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DUR}))::numeric)::int AS med,
        COALESCE(SUM(a."reachEstimate"),0)::bigint AS reach,
        ROUND(AVG(c."hookScore")::numeric,1) AS hook
      FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId" JOIN "AdLibraryBrand" b ON b.id = a."brandId"
      WHERE ${where}
      GROUP BY c."${d}"`).join(' UNION ALL '),
    ...params
  );

  const kept = rows.filter((r) => r.n >= 3);
  const totalClassified = kept.filter((r) => r.dim === 'hookTactic').reduce((a, r) => a + r.n, 0);
  const durN = minMax(kept.map((r) => r.med));
  const reachN = minMax(kept.map((r) => Math.log10(Number(r.reach) + 1)));

  const byDim: Record<string, Gene[]> = {};
  for (const r of kept) {
    const reach = Number(r.reach);
    const provenScore = Math.round(100 * (0.6 * durN(r.med) + 0.4 * reachN(Math.log10(reach + 1))));
    (byDim[r.dim] ||= []).push({ gene: r.gene, ads: r.n, medianDays: r.med, reachM: +(reach / 1e6).toFixed(1), hookScore: Number(r.hook), prevalence: 0, provenScore, quadrant: 'low' });
  }
  for (const d of DIMS) {
    const g = byDim[d]; if (!g) continue;
    const tot = g.reduce((a, x) => a + x.ads, 0);
    const prevs = g.map((x) => x.ads / tot).sort((a, b) => a - b);
    const days = g.map((x) => x.medianDays).sort((a, b) => a - b);
    const mp = prevs[Math.floor(prevs.length / 2)], md = days[Math.floor(days.length / 2)];
    for (const x of g) {
      x.prevalence = +(x.ads / tot).toFixed(3);
      const rare = x.prevalence < mp, long = x.medianDays > md;
      x.quadrant = long ? (rare ? 'edge' : 'standard') : rare ? 'low' : 'fading';
    }
    g.sort((a, b) => b.provenScore - a.provenScore);
  }

  // Recommendations per dimension: the proven pick, alternatives, and a DISTINCT
  // edge. The edge is deliberately a different gene from the pick — the best
  // rare-but-long-running option, so "Edge Play" never collapses into
  // "Proven Playbook". Falls back to the pick only when a dimension has one gene.
  const rec: Record<string, { pick: Gene; alts: Gene[]; edge: Gene | null; edgeDistinct: boolean }> = {};
  for (const d of DIMS) {
    const g = byDim[d]; if (!g?.length) continue;
    const pick = g[0];
    const others = g.filter((x) => x.gene !== pick.gene);
    // Prefer a true "edge" gene (long-running + rare); then any distinct gene
    // that still runs long; then the next-strongest distinct gene by proven score.
    const edge =
      others.find((x) => x.quadrant === 'edge')
      ?? [...others].sort((a, b) => b.medianDays - a.medianDays).find((x) => x.medianDays >= pick.medianDays * 0.85)
      ?? others[0]
      ?? null;
    rec[d] = { pick, alts: others.slice(0, 2), edge, edgeDistinct: Boolean(edge && edge.gene !== pick.gene) };
  }

  // Example proven ad for a brief: longest-running classified ad matching its hook.
  async function exampleFor(hook: string) {
    const rowsEx = await prisma.$queryRawUnsafe<Array<{ brand: string; headline: string | null; days: number; reach: number | null }>>(
      `SELECT b."pageName" AS brand, a.title AS headline, ROUND((${DUR})::numeric)::int AS days, a."reachEstimate" AS reach
       FROM "AdClassification" c JOIN "AdLibraryAd" a ON a.id = c."adId" JOIN "AdLibraryBrand" b ON b.id = a."brandId"
       WHERE c."hookTactic" = $1 AND a."startDate" IS NOT NULL ${useIndustry ? 'AND b.category ILIKE $2' : ''}
       ORDER BY days DESC LIMIT 1`,
      ...(useIndustry ? [hook, `%${industry}%`] : [hook])
    );
    return rowsEx[0] ?? null;
  }

  const g = (d: Dim, edge = false) => (edge ? rec[d]?.edge ?? rec[d]?.pick : rec[d]?.pick);
  const gene = (x?: Gene) => (x ? x.gene : null);

  const playbookExample = rec.hookTactic ? await exampleFor(rec.hookTactic.pick.gene) : null;
  const edgeHook = g('hookTactic', true);
  const edgeExample = edgeHook ? await exampleFor(edgeHook.gene) : null;

  const briefs = [
    {
      id: 'proven',
      name: 'Proven Playbook',
      tagline: 'The safest bet — every choice is the longest-running, widest-reaching in this scope.',
      genes: { hookTactic: gene(g('hookTactic')), messagingAngle: gene(g('messagingAngle')), creativeMechanic: gene(g('creativeMechanic')), visualFormat: gene(g('visualFormat')), offerType: gene(g('offerType')) },
      evidence: rec.hookTactic ? { medianDays: rec.hookTactic.pick.medianDays, reachM: rec.hookTactic.pick.reachM } : null,
      example: playbookExample,
    },
    {
      id: 'edge',
      name: 'Edge Play',
      tagline: 'Differentiate — genes that run long but almost nobody in this scope uses yet.',
      genes: { hookTactic: gene(g('hookTactic', true)), messagingAngle: gene(g('messagingAngle', true)), creativeMechanic: gene(g('creativeMechanic', true)), visualFormat: gene(g('visualFormat', true)), offerType: gene(g('offerType', true)) },
      evidence: edgeHook ? { medianDays: edgeHook.medianDays, prevalence: edgeHook.prevalence } : null,
      example: edgeExample,
    },
  ];

  const confidence = totalClassified >= 300 ? 'high' : totalClassified >= 80 ? 'medium' : 'low';

  return NextResponse.json({
    scope: { industry: useIndustry ? industry : 'All industries', classifiedAds: totalClassified, confidence, fellBackToGlobal: false },
    industries,
    recommendations: rec,
    briefs,
  });
}
