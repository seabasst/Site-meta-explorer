# Phase 55: Creative Analysis - Research

**Researched:** 2026-03-21
**Domain:** Brand vs. category benchmarking with Five Pillars + Andromeda scoring
**Confidence:** HIGH

## Summary

This phase adds category benchmarking to the existing Creative Lab page. The existing infrastructure is mature: the `/api/analyze/diversity` endpoint already runs full Five Pillars + Andromeda analysis per brand (via two Claude API calls), and the database already has `category` on `AdLibraryBrand` plus a working `/api/categories` endpoint that lists categories with brand counts.

The core challenge is **aggregating scores across all brands in a category** to create benchmark averages. The current diversity analysis runs per-brand on-the-fly with Claude classification (30-60 seconds per brand). Running this for every brand in a category on each request is infeasible. The solution is to either (a) pre-compute and cache category benchmarks, or (b) run individual brand analysis on-demand but aggregate from stored results.

**Primary recommendation:** Add a new API endpoint `/api/analyze/benchmark` that accepts a `pageId` (brand) and `category` string. It runs the existing diversity analysis for the selected brand if not cached, then aggregates pre-computed or on-demand-cached scores for all brands in that category to produce per-pillar comparison data. Store computed analysis results in a new `BrandAnalysisCache` table to avoid re-running Claude for every brand on every request.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App framework, API routes | Already in use |
| Prisma | Current | ORM, database queries | Already in use |
| Anthropic SDK | Current | Claude API for classification | Already used in diversity endpoint |
| Tailwind CSS | v4 | Styling | Already in use |
| Lucide React | Current | Icons | Already in use |

### No New Libraries Needed

This phase builds entirely on existing infrastructure. No new dependencies required.

The existing diversity analysis endpoint already handles:
- Brand lookup via `AdLibraryBrand`
- Ad fetching and classification via Claude
- Five Pillars scoring (Shannon entropy normalized 0-100)
- Andromeda metrics computation
- Recommendation generation

## Architecture Patterns

### Recommended Approach: Cached Analysis + On-Demand Aggregation

```
src/
  app/
    api/
      analyze/
        benchmark/
          route.ts           # NEW: Brand vs. category comparison endpoint
    dashboard/
      v2/
        creative-lab/
          page.tsx           # MODIFY: Add benchmark tab/mode
  prisma/
    schema.prisma            # MODIFY: Add BrandAnalysisCache model
```

### Pattern 1: Analysis Cache Model

**What:** Store computed Five Pillars + Andromeda scores per brand so category aggregation doesn't require re-running Claude for every brand.

**When to use:** Every time a brand analysis is run, persist the scores.

**Schema addition:**
```prisma
model BrandAnalysisCache {
  id        String   @id @default(cuid())
  brandId   String   @unique
  brand     AdLibraryBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Five Pillars diversity scores (0-100)
  formatScore       Int
  toneScore         Int
  journeyPhaseScore Int
  visualStyleScore  Int
  messengerScore    Int
  overallScore      Int

  // Andromeda metrics (key numbers for aggregation)
  andromedaScore    Int
  avgRefreshRate    Float
  stalePercentage   Int
  hookQualityAvg    Float
  uniqueConcepts    Int
  uniqueCtas        Int
  funnelAwareness   Int
  funnelConsideration Int
  funnelConversion  Int

  // Distribution JSON (full pillar distributions for deeper comparison)
  distributionJson  Json

  totalAdsAnalyzed  Int
  analyzedAt        DateTime @default(now())

  @@index([brandId])
}
```

### Pattern 2: Category Benchmark Aggregation

**What:** Query all `BrandAnalysisCache` entries where the brand belongs to a given category, then compute averages.

**Example flow:**
```typescript
// 1. Get all brands in category with cached analysis
const categoryBrands = await prisma.brandAnalysisCache.findMany({
  where: {
    brand: { category: categoryName }
  },
  include: { brand: { select: { pageName: true } } }
});

// 2. Compute category averages
const avgScores = {
  format: Math.round(categoryBrands.reduce((s, b) => s + b.formatScore, 0) / categoryBrands.length),
  tone: Math.round(categoryBrands.reduce((s, b) => s + b.toneScore, 0) / categoryBrands.length),
  // ... etc for all pillars and metrics
};

// 3. Compute indexing (brand vs. category)
const indexing = {
  format: { brand: brandScores.format, category: avgScores.format, diff: brandScores.format - avgScores.format },
  // ... etc
};
```

### Pattern 3: Two-Phase UI Flow

**What:** Extend the existing Creative Lab setup step to also select a category, then show comparison results alongside existing single-brand analysis.

**Flow:**
1. Setup: Select brand (existing) + Select category (new dropdown)
2. Analysis: Run brand analysis (existing) + fetch/compute category benchmark
3. Results: Show existing single-brand dashboard + NEW comparison section with per-pillar indexing

### Anti-Patterns to Avoid
- **Running Claude for all brands in real-time:** A category with 20 brands would mean 20 x 30-60sec API calls. Use cached analysis instead.
- **Building a separate analysis pipeline:** Reuse the existing diversity analysis logic. Extract the scoring into a shared function if needed.
- **Storing benchmark snapshots per category:** Categories change as brands are added. Aggregate from individual brand caches on each request instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category listing | Custom category query | Existing `/api/categories` endpoint | Already returns categories with brand counts and stats |
| Brand search | New search system | Existing `/api/search-pages` endpoint | Already works, used in Creative Lab |
| Five Pillars scoring | New scoring algorithm | Existing `calcDiversityScore` from diversity route | Shannon entropy normalized, already proven |
| Andromeda metrics | New metrics computation | Existing logic in diversity route | Complex local + AI computation already built |
| Category dropdown data | Manual category list | Existing `/api/ad-library/filters` endpoint | Returns categories with counts via `groupBy` |

## Common Pitfalls

### Pitfall 1: Cold Cache Problem
**What goes wrong:** If no brands in a category have been analyzed yet, there's nothing to aggregate.
**Why it happens:** Analysis is on-demand, not batch-processed.
**How to avoid:** Show a clear message like "X of Y brands in this category have been analyzed. Run more analyses to improve benchmark accuracy." Allow the user to trigger analysis for the selected brand even if the category benchmark is sparse.
**Warning signs:** Category benchmark returning zeros or only 1-2 data points.

### Pitfall 2: Stale Cache
**What goes wrong:** A brand's ad strategy changes but the cached analysis is from weeks ago.
**Why it happens:** Analysis is expensive (Claude API calls) so caching is necessary.
**How to avoid:** Show `analyzedAt` date per brand. Consider a TTL of 7-14 days. Allow manual re-analysis. For the selected brand, always run fresh analysis.
**Warning signs:** `analyzedAt` dates older than 2 weeks.

### Pitfall 3: Category Field Inconsistency
**What goes wrong:** Categories may be inconsistent strings (e.g., "fashion", "Fashion", "fashion_apparel").
**Why it happens:** Categories are set during brand ingestion via scripts with varying conventions.
**How to avoid:** Use case-insensitive matching (already done in `/api/categories/[slug]`). The existing `category` field on `AdLibraryBrand` uses lowercase snake_case convention based on script imports.
**Warning signs:** Same logical category appearing as multiple entries in dropdown.

### Pitfall 4: N+1 Query on Category Aggregation
**What goes wrong:** Querying each brand's analysis cache individually instead of batch.
**Why it happens:** Following the single-brand analysis pattern.
**How to avoid:** Use a single Prisma query with `where: { brand: { category } }` join. The `@@index([brandId])` on the cache table plus `@@index([category])` on `AdLibraryBrand` will make this fast.

### Pitfall 5: Overloading the Creative Lab Page
**What goes wrong:** The page is already 966 lines. Adding benchmark UI inline makes it unmaintainable.
**Why it happens:** Following the existing pattern of one big component.
**How to avoid:** Extract the benchmark comparison into a separate component file (e.g., `benchmark-comparison.tsx`). Consider extracting the existing results dashboard into its own component too.

## Code Examples

### Category Dropdown (Using Existing API)
```typescript
// Fetch categories for dropdown
const [categories, setCategories] = useState<{ slug: string; label: string; brandCount: number }[]>([]);

useEffect(() => {
  fetch('/api/categories').then(r => r.json()).then(setCategories);
}, []);

// Dropdown UI
<select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
  <option value="">Select a category to benchmark against</option>
  {categories.map(cat => (
    <option key={cat.slug} value={cat.slug}>
      {cat.label} ({cat.brandCount} brands)
    </option>
  ))}
</select>
```

### Benchmark API Response Shape
```typescript
interface BenchmarkResult {
  brand: {
    name: string;
    scores: DiversityScores;           // Existing type
    andromedaScore: number;
    andromedaMetrics: AndromedaMetrics; // Existing type
  };
  category: {
    name: string;
    brandCount: number;
    analyzedBrandCount: number;
    avgScores: DiversityScores;
    avgAndromedaScore: number;
    avgAndromedaMetrics: {
      avgRefreshRate: number;
      avgStalePercentage: number;
      avgHookQuality: number;
      avgUniqueConcepts: number;
      avgUniqueCtas: number;
    };
  };
  indexing: {
    format: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    tone: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    journeyPhase: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    visualStyle: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    messenger: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    overall: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
    andromeda: { brand: number; category: number; diff: number; status: 'strength' | 'gap' | 'neutral' };
  };
  recommendations: Recommendation[]; // Context-aware: knows about category gaps
}
```

### Per-Pillar Indexing UI Pattern
```typescript
// Visual comparison bar for a single pillar
function PillarComparison({ label, brandScore, categoryAvg, color }: {
  label: string; brandScore: number; categoryAvg: number; color: string;
}) {
  const diff = brandScore - categoryAvg;
  const status = diff > 5 ? 'strength' : diff < -5 ? 'gap' : 'neutral';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span>
          <span className="font-bold" style={{ color }}>{brandScore}</span>
          <span className="text-slate-500 mx-1">vs</span>
          <span className="text-slate-400">{categoryAvg}</span>
          <span className={`ml-2 text-xs font-medium ${
            status === 'strength' ? 'text-emerald-400' : status === 'gap' ? 'text-red-400' : 'text-slate-500'
          }`}>
            {diff > 0 ? '+' : ''}{diff}
          </span>
        </span>
      </div>
      {/* Dual progress bars */}
      <div className="relative h-3 rounded-full bg-slate-800/50">
        <div className="absolute h-full rounded-full bg-slate-600/50" style={{ width: `${categoryAvg}%` }} />
        <div className="absolute h-full rounded-full" style={{ width: `${brandScore}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No benchmarking | Single-brand Andromeda analysis | Current (existing) | Users see their own scores but no context |
| Manual competitor comparison | Category-level aggregated benchmark | This phase | Users understand if their scores are good or bad relative to peers |

## Open Questions

1. **How many brands per category have been ingested?**
   - What we know: Categories exist on `AdLibraryBrand`, `/api/categories` returns counts
   - What's unclear: How many brands per category have enough ads for meaningful analysis (need 10+ ads)
   - Recommendation: Check actual data. If categories are too sparse, consider allowing cross-category benchmarks or showing "insufficient data" warnings.

2. **Should benchmark analysis run for the selected brand fresh or use cache?**
   - What we know: Fresh analysis takes 30-60 seconds and costs Claude API tokens
   - What's unclear: Whether users expect fresh results every time
   - Recommendation: Run fresh for the selected brand (users expect current data for their brand), use cache for category aggregation.

3. **Should we pre-populate the cache via a background job?**
   - What we know: Running Claude classification for all brands in a category on-demand is too slow
   - What's unclear: Whether to add a cron job or only cache on user-triggered analysis
   - Recommendation: Start with caching on user-triggered analysis only. Add a batch job later if needed. The cache will naturally fill as users analyze brands.

4. **UI placement: new tab vs. extended results?**
   - What we know: Current flow is: setup -> analyzing -> results. The results page is already dense.
   - What's unclear: Whether benchmarking should be a separate tab/mode or shown alongside existing results
   - Recommendation: Add category selection to the setup step. Show benchmark comparison as a new section within the results dashboard (below the existing Five Pillars section). This keeps the flow simple and lets users who don't want benchmarking just skip the category selection.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct reading of all relevant source files
  - `/src/app/dashboard/v2/creative-lab/page.tsx` - 966 LOC, full Creative Lab UI
  - `/src/app/api/analyze/diversity/route.ts` - 491 LOC, complete diversity analysis pipeline
  - `/src/app/api/search-pages/route.ts` - Brand search (local DB + Facebook API fallback)
  - `/src/app/api/categories/route.ts` - Category listing with brand counts
  - `/src/app/api/categories/[slug]/route.ts` - Category detail with per-brand stats
  - `/src/app/api/ad-library/filters/route.ts` - Filter options including categories
  - `/prisma/schema.prisma` - Full database schema including `AdLibraryBrand.category`

### Key Findings from Codebase
- **Five Pillars** = Format, Tone, Journey Phase, Visual Style, Messenger (5 dimensions, each scored 0-100 via Shannon entropy)
- **Andromeda Score** = 0-100 composite from Claude's second API call evaluating creative health
- **Andromeda Metrics** = Creative Volume, Ad Fatigue, Funnel Balance, Hook Quality, CTA Diversity, Copy Length, Concept Diversity
- **Category field exists** on `AdLibraryBrand` with an `@@index([category])` - ready for aggregation queries
- **Categories API exists** at `/api/categories` returning slug, label, brandCount, totalActiveAds, totalReach
- **Analysis uses 2 Claude calls:** (1) Classify all ads across pillars + hook scoring + concept clustering, (2) Generate recommendations based on scores
- **No existing caching** of analysis results - every analysis is fresh from Claude

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - entirely existing infrastructure, no new libraries
- Architecture: HIGH - clear pattern from reading existing code, straightforward extension
- Pitfalls: HIGH - identified from direct codebase analysis (cold cache, page size, N+1 queries)
- Scoring algorithm: HIGH - read exact implementation (Shannon entropy in `calcDiversityScore`)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable - extends existing infrastructure with no external dependencies)
