import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Genome API — the Creative DNA of what actually works
//
// Aggregates AdClassification (the 8-category taxonomy) joined to AdLibraryAd,
// weighting every "gene" (a taxonomy value like hookTactic='social-proof') by:
//   - LONGEVITY: median run-days, computed live from startDate -> COALESCE(endDate, now())
//     NOTE: AdLibraryAd.adDurationDays is NOT populated for classified ads, so we
//     never rely on it — longevity is derived from startDate on the fly.
//   - REACH: summed reachEstimate (EU total reach from the DSA feed)
//
// Proven Score blends normalized longevity + reach into a 0..100 signal.
// Longevity is the strongest public proxy for performance: winners run for
// months, losers get killed in days.
// =============================================================================

const DIMENSIONS = [
  'hookTactic',
  'messagingAngle',
  'creativeMechanic',
  'offerType',
  'visualFormat',
  'awarenessStage',
] as const;
type Dimension = (typeof DIMENSIONS)[number];

// Live longevity in days. Safe: no user input, fixed column names.
const DURATION_DAYS = `EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400`;

interface GeneRow {
  dim: Dimension;
  gene: string;
  n: number;
  median_days: number;
  reach: bigint;
  avg_hook: number;
}

export interface Gene {
  dimension: Dimension;
  gene: string;
  ads: number;
  prevalence: number; // share of ads within its dimension (0..1)
  medianDays: number; // median run-days (longevity signal)
  reach: number; // total EU reach
  reachM: number; // reach in millions, 1dp
  avgHookScore: number;
  provenScore: number; // 0..100 blend of longevity + reach
  quadrant: 'edge' | 'standard' | 'fading' | 'low'; // vs dimension medians
}

function minMax(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandId = sp.get('brandId') || undefined;
  const category = sp.get('category') || undefined;
  const dimensionParam = sp.get('dimension') as Dimension | null;
  const minAds = Number(sp.get('minAds') ?? 3); // hide ultra-thin genes by default

  const dims = dimensionParam && DIMENSIONS.includes(dimensionParam)
    ? [dimensionParam]
    : [...DIMENSIONS];

  // --- Build a parameterized WHERE. Values are bound via $1/$2; column names are
  //     from a fixed allowlist so interpolating them is injection-safe. ---
  const filters: string[] = ['a."startDate" IS NOT NULL'];
  const params: unknown[] = [];
  if (brandId) {
    params.push(brandId);
    filters.push(`a."brandId" = $${params.length}`);
  }
  if (category) {
    params.push(category);
    filters.push(`b."category" = $${params.length}`);
  }
  const whereSql = filters.join(' AND ');
  const brandJoin = category
    ? 'JOIN "AdLibraryBrand" b ON b.id = a."brandId"'
    : '';

  const unions = dims.map(
    (d) => `
      SELECT '${d}' AS dim, c."${d}" AS gene, COUNT(*)::int AS n,
        ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${DURATION_DAYS}))::numeric)::int AS median_days,
        COALESCE(SUM(a."reachEstimate"), 0)::bigint AS reach,
        ROUND(AVG(c."hookScore")::numeric, 1) AS avg_hook
      FROM "AdClassification" c
      JOIN "AdLibraryAd" a ON a.id = c."adId"
      ${brandJoin}
      WHERE ${whereSql}
      GROUP BY c."${d}"`
  );
  const sql = unions.join('\n    UNION ALL\n');

  let rows: GeneRow[];
  try {
    rows = await prisma.$queryRawUnsafe<GeneRow[]>(sql, ...params);
  } catch (err) {
    console.error('[genome] query failed', err);
    return NextResponse.json({ error: 'Genome aggregation failed' }, { status: 500 });
  }

  // --- Normalize proven score across the whole result set (log-scale reach) ---
  const kept = rows.filter((r) => r.n >= minAds);
  const durNorm = minMax(kept.map((r) => Number(r.median_days)));
  const reachNorm = minMax(kept.map((r) => Math.log10(Number(r.reach) + 1)));

  const byDim: Record<string, Gene[]> = {};
  for (const r of kept) {
    const reach = Number(r.reach);
    const proven = Math.round(
      100 * (0.6 * durNorm(Number(r.median_days)) + 0.4 * reachNorm(Math.log10(reach + 1)))
    );
    (byDim[r.dim] ||= []).push({
      dimension: r.dim,
      gene: r.gene,
      ads: r.n,
      prevalence: 0, // filled below (needs dimension totals)
      medianDays: Number(r.median_days),
      reach,
      reachM: +(reach / 1e6).toFixed(1),
      avgHookScore: Number(r.avg_hook),
      provenScore: proven,
      quadrant: 'low',
    });
  }

  // --- Prevalence + quadrant, computed per dimension ---
  const hiddenEdges: Gene[] = [];
  for (const dim of Object.keys(byDim)) {
    const genes = byDim[dim];
    const totalAds = genes.reduce((s, g) => s + g.ads, 0);
    const prevalences = genes.map((g) => g.ads / totalAds).sort((a, b) => a - b);
    const days = genes.map((g) => g.medianDays).sort((a, b) => a - b);
    const medPrev = prevalences[Math.floor(prevalences.length / 2)];
    const medDays = days[Math.floor(days.length / 2)];
    for (const g of genes) {
      g.prevalence = +(g.ads / totalAds).toFixed(3);
      const rare = g.prevalence < medPrev;
      const longRun = g.medianDays > medDays;
      g.quadrant = longRun ? (rare ? 'edge' : 'standard') : rare ? 'low' : 'fading';
      if (g.quadrant === 'edge') hiddenEdges.push(g);
    }
    genes.sort((a, b) => b.provenScore - a.provenScore);
  }

  const topGenes = Object.values(byDim)
    .flat()
    .sort((a, b) => b.provenScore - a.provenScore)
    .slice(0, 12);

  hiddenEdges.sort((a, b) => b.medianDays - a.medianDays);

  // --- Coverage transparency: the genome is only as complete as classification ---
  const [totalAds, classifiedAds] = await Promise.all([
    prisma.adLibraryAd.count(),
    prisma.adClassification.count(),
  ]);

  return NextResponse.json({
    meta: {
      totalAds,
      classifiedAds,
      coveragePct: +((classifiedAds / totalAds) * 100).toFixed(2),
      analyzedGenes: kept.length,
      filter: { brandId: brandId ?? null, category: category ?? null, dimension: dimensionParam ?? null },
      generatedAt: new Date().toISOString(),
      note: 'Longevity computed live from startDate; adDurationDays is not populated for classified ads.',
    },
    dimensions: byDim,
    topGenes,
    hiddenEdges: hiddenEdges.slice(0, 6),
  });
}
