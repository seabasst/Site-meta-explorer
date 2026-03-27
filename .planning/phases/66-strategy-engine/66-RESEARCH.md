# Phase 66: Strategy Engine - Research

**Researched:** 2026-03-27
**Domain:** AI-powered creative strategy analysis with gap-matrix visualization
**Confidence:** HIGH

## Summary

The Strategy Engine builds on a substantial existing codebase. The current `strategy-view.tsx` (~1287 lines) and `/api/creative-lab/generate-strategy` route implement a 3-step flow (Brand Profile -> Messaging Strategy -> Ad Hooks) that uses the old "Five Pillars" scoring model. While the UI architecture and API patterns are solid, the strategy content model needs to be replaced with the 8-category taxonomy system from Phase 65 (classification). The gap matrix (awareness stages x visual formats) is entirely new and needs to be built from scratch.

The critical finding is that the `generate-strategy` route references a `BrandStrategy` Prisma model that **does not exist in schema.prisma**. This means either the strategy feature is currently broken in production or the model was added via raw SQL. This must be resolved as part of this phase.

The existing data infrastructure is strong: `BrandAnalysisCache` stores 8-category diversity scores, `distributionJson` stores full distribution data, `AdClassification` has indexed columns for all 8 categories, and the brand detail API already returns `classificationCoverage` and `classificationDistribution`. The gap matrix can be computed entirely from existing DB data without additional AI calls.

**Primary recommendation:** Rewrite strategy-view.tsx and its API to use taxonomy-based gap matrix as the core interaction, replacing the 3-step wizard with a single-load taxonomy breakdown + interactive gap matrix + on-demand concept generation per cell.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App router, API routes | Project framework |
| Prisma | current | ORM for all DB queries | Project standard |
| Anthropic SDK | current | Claude API for concept generation | Already integrated |
| Zod | current | Schema validation for API I/O | Already used in generate-strategy |
| Tailwind CSS | v4 | Styling | Project standard |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | current | Icons | All UI components |

### No New Libraries Needed

The gap matrix heatmap is a simple CSS grid with background colors derived from coverage percentages. No charting library is needed. The taxonomy data is small (5 awareness stages x 12 visual formats = 60 cells max), easily rendered with Tailwind utility classes.

## Architecture Patterns

### Data Flow: Gap Matrix

```
1. User selects brand (existing BrandSearch component)
2. Client fetches /api/strategy/[pageId] (new route)
   -> Reads BrandAnalysisCache + AdClassification data
   -> Returns: taxonomy breakdown, gap matrix data, brand profile
3. Client renders taxonomy breakdown + gap matrix
4. User clicks a gap cell
5. Client POSTs to /api/strategy/generate-concept (new route)
   -> Sends: gap coordinates (awarenessStage + visualFormat), brand context
   -> Claude generates creative concept
   -> Returns: concept with format, mechanic, hook, messaging angle, brief
```

### Recommended File Structure
```
src/
├── app/
│   ├── api/
│   │   └── strategy/
│   │       ├── [pageId]/
│   │       │   └── route.ts          # GET: full strategy data for a brand
│   │       └── generate-concept/
│   │           └── route.ts          # POST: generate concept for a gap cell
│   └── dashboard/v2/creative-lab/
│       ├── strategy-view.tsx         # REWRITE: new strategy view
│       └── gap-matrix.tsx            # NEW: interactive heatmap component
├── lib/
│   └── classification/
│       └── taxonomy.ts               # EXISTING: taxonomy source of truth
```

### Pattern 1: Gap Matrix Computation (Server-Side)
**What:** Cross awarenessStage x visualFormat from AdClassification records
**When to use:** When loading strategy view for a brand

The gap matrix is a 5x12 grid (awarenessStage values x visualFormat values). Each cell = count of ads classified with that (awarenessStage, visualFormat) pair.

```typescript
// Compute from AdClassification records
const matrix: Record<string, Record<string, number>> = {};

for (const stage of TAXONOMY.awarenessStage.values) {
  matrix[stage] = {};
  for (const format of TAXONOMY.visualFormat.values) {
    matrix[stage][format] = 0;
  }
}

// Count co-occurrences
const classifications = await prisma.adClassification.findMany({
  where: { ad: { brandId: brand.id, isActive: true } },
  select: { awarenessStage: true, visualFormat: true },
});

for (const c of classifications) {
  matrix[c.awarenessStage][c.visualFormat]++;
}
```

### Pattern 2: Brand Profile Auto-Population
**What:** Assemble brand context from existing DB data without manual input
**When to use:** When loading strategy view -- replaces Step 1 form fields

```typescript
// All data already exists in DB
const [brand, cache, adCount, demographics] = await Promise.all([
  prisma.adLibraryBrand.findUnique({ where: { pageId }, select: { pageName: true, category: true, website: true, demographicsJson: true } }),
  prisma.brandAnalysisCache.findUnique({ where: { brandId: brand.id } }),
  prisma.adLibraryAd.count({ where: { brandId: brand.id, isActive: true } }),
  // Demographics already stored as JSON on AdLibraryBrand
]);
```

BRND-01 is satisfied by reading: `pageName`, `category`, `activeAdCount`, `demographicsJson` from `AdLibraryBrand`, plus all 8 diversity scores + distribution from `BrandAnalysisCache`.

### Pattern 3: Concept Generation Prompt
**What:** Gap-targeted concept generation via Claude
**When to use:** When user clicks an empty/sparse cell in gap matrix

The prompt should include:
- Brand name, category, website
- Full taxonomy distribution (what they already do)
- The specific gap coordinates (e.g., "product-aware" + "tutorial")
- Instruction to generate concept that fills this gap

Output structure (enforced via Zod):
```typescript
const ConceptSchema = z.object({
  visualFormat: z.string(),        // e.g. "tutorial"
  creativeMechanic: z.string(),    // e.g. "process-reveal"
  hook: z.string(),                // Opening line
  messagingAngle: z.string(),      // e.g. "educational"
  productionBrief: z.string(),     // 3-5 sentence brief
});
```

### Anti-Patterns to Avoid
- **Multi-step wizard for strategy:** The old 3-step flow (Brand Profile -> Strategy -> Hooks) requires 3 separate AI calls and manual form filling. The new approach auto-populates everything and only calls AI when generating concepts for specific gaps.
- **Five Pillars references:** The old `fivePillars` scoring model (format, tone, journey, visual, messenger) is completely replaced by the 8-category taxonomy. Do not carry forward any Five Pillars code.
- **Storing strategy as unstructured JSON:** The old BrandStrategy model stored brandContext, strategyMatrix, hooks as opaque JSON blobs. The new approach should compute everything from structured classification data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Taxonomy values | Hardcoded strings in components | `TAXONOMY` from `taxonomy.ts` | Single source of truth, already established |
| Diversity scores | Custom scoring logic | `BrandAnalysisCache` | Already computed by diversity API |
| Brand search | New search component | Existing `BrandSearch` from `brand-search.tsx` | Already works, used by Creative Lab page |
| Classification distributions | Re-query individual ads | `BrandAnalysisCache.distributionJson` | Already cached as JSON |
| Color scales for heatmap | Custom color math | Tailwind opacity utilities | `bg-[#1235e2]/N` where N scales with count |

## Common Pitfalls

### Pitfall 1: BrandStrategy Model Missing
**What goes wrong:** The existing `generate-strategy` route references `prisma.brandStrategy` which does not exist in `schema.prisma`.
**Why it happens:** The model was likely planned but never migrated, or was removed during a cleanup.
**How to avoid:** Either add a `BrandStrategy` model or (recommended) don't persist strategy state at all -- compute gap matrix from classification data on each load, and concept generation is stateless.
**Warning signs:** Prisma client errors at runtime.

### Pitfall 2: Sparse Classification Data
**What goes wrong:** Gap matrix shows mostly empty cells because brand has few classified ads.
**Why it happens:** Not all brands have been through the classification pipeline.
**How to avoid:** Check classification coverage before rendering gap matrix. If coverage is below threshold (e.g., <10 classified ads), show a message directing user to classify first. The `classificationCoverage` data is already returned by the brand detail API.
**Warning signs:** Gap matrix with all cells at 0.

### Pitfall 3: Gap Matrix Size on Mobile
**What goes wrong:** 5x12 grid is too wide for mobile screens.
**Why it happens:** 12 visual formats + labels don't fit on 375px.
**How to avoid:** Use horizontal scroll for the matrix on mobile, or collapse to a list view showing only gap cells. Could also group visual formats into fewer buckets for mobile.
**Warning signs:** Horizontal overflow, unreadable labels.

### Pitfall 4: AI Cost Per Cell Click
**What goes wrong:** Users click many cells rapidly, generating expensive Claude API calls.
**Why it happens:** Each concept generation is a separate Claude Sonnet call.
**How to avoid:** Use Claude Haiku for concept generation (cheaper, faster). Add debounce/loading state. Consider generating concepts for top-N gaps in a single batch call rather than per-cell.
**Warning signs:** High API costs, slow response times.

### Pitfall 5: Old Strategy View Cruft
**What goes wrong:** Mixing old Five Pillars types/components with new taxonomy.
**Why it happens:** strategy-view.tsx is 1287 lines of tightly coupled code.
**How to avoid:** Full rewrite of strategy-view.tsx rather than incremental refactor. The old file references `fivePillars`, `Persona`, `MessagingAngle`, `Hook`, `StrategyMatrix` -- none of which align with the new taxonomy-based approach.
**Warning signs:** Type mismatches, stale interfaces.

## Code Examples

### Gap Matrix Cell Rendering
```typescript
// Source: derived from taxonomy.ts values
function cellColor(count: number, maxCount: number): string {
  if (count === 0) return 'bg-red-500/10 hover:bg-red-500/20';
  const ratio = count / maxCount;
  if (ratio < 0.2) return 'bg-amber-500/20 hover:bg-amber-500/30';
  if (ratio < 0.5) return 'bg-blue-500/20 hover:bg-blue-500/30';
  return 'bg-green-500/20 hover:bg-green-500/30';
}

// 5 rows (awareness stages) x 12 columns (visual formats)
<div className="grid overflow-x-auto" style={{ gridTemplateColumns: `120px repeat(${TAXONOMY.visualFormat.values.length}, minmax(80px, 1fr))` }}>
  {/* Header row */}
  <div /> {/* empty corner */}
  {TAXONOMY.visualFormat.values.map(format => (
    <div key={format} className="text-[10px] font-medium text-center p-1 -rotate-45 origin-bottom-left">
      {TAXONOMY.visualFormat.labels[format]}
    </div>
  ))}

  {/* Data rows */}
  {TAXONOMY.awarenessStage.values.map(stage => (
    <>
      <div className="text-xs font-medium p-2">{TAXONOMY.awarenessStage.labels[stage]}</div>
      {TAXONOMY.visualFormat.values.map(format => {
        const count = matrix[stage]?.[format] ?? 0;
        return (
          <button
            key={`${stage}-${format}`}
            onClick={() => handleCellClick(stage, format)}
            className={`p-2 text-center text-xs rounded ${cellColor(count, maxCount)} cursor-pointer transition-colors`}
          >
            {count}
          </button>
        );
      })}
    </>
  ))}
</div>
```

### Concept Generation API Shape
```typescript
// POST /api/strategy/generate-concept
// Request body:
{
  pageId: string;
  awarenessStage: string;  // e.g. "problem-aware"
  visualFormat: string;    // e.g. "tutorial"
}

// Response:
{
  concept: {
    visualFormat: "tutorial",
    creativeMechanic: "process-reveal",
    hook: "Stop guessing which ingredients actually work for your skin type",
    messagingAngle: "educational",
    productionBrief: "Create a 30-second tutorial-style video showing a step-by-step skin analysis process. Start with a relatable problem (confusion about ingredients), demonstrate the product's approach to solving it, and end with a clear CTA. Use clean, well-lit footage with text overlays for key points. Target: solution-aware audience who knows they need help but hasn't found the right product."
  }
}
```

### Strategy API Data Shape (GET)
```typescript
// GET /api/strategy/[pageId]
// Response:
{
  brand: {
    pageName: string;
    category: string | null;
    website: string | null;
    activeAdCount: number;
    demographics: { ... } | null;
  },
  classificationCoverage: { classified: number, total: number },
  taxonomyBreakdown: {
    // For each of 8 categories: value -> count
    assetType: { "ugc": 12, "studio": 8, ... },
    visualFormat: { "talking-head": 15, "product-demo": 7, ... },
    // ... all 8
  },
  diversityScores: {
    assetType: 72, visualFormat: 45, ..., overall: 58
  },
  gapMatrix: {
    // awarenessStage -> visualFormat -> count
    "unaware": { "talking-head": 0, "product-demo": 2, ... },
    "problem-aware": { "talking-head": 5, ... },
    // ... all 5 stages
  },
  maxCellCount: 5,  // for color scaling
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Five Pillars (format, tone, journey, visual, messenger) | 8-category taxonomy (assetType, visualFormat, hookTactic, messagingAngle, awarenessStage, creativeMechanic, offerType, intendedAudience) | Phase 62-65 | All scoring, prompts, and UI must use new taxonomy |
| 3-step wizard with manual form inputs | Auto-populated brand profile + interactive gap matrix | Phase 66 (this phase) | No more manual audience/differentiators/positioning fields |
| `fivePillars` scores in BrandContext | 8-category diversity scores from BrandAnalysisCache | Phase 64 | Data already migrated, just UI needs updating |
| Per-ad AI analysis (AdAnalysis model) | Batch classification (AdClassification model) | Phase 62-63 | Classification data is more structured, faster, cheaper |

**Deprecated/outdated:**
- `strategy-view.tsx` current implementation: Full Five Pillars 3-step wizard -- needs complete rewrite
- `/api/analyze/strategy/route.ts`: Old competitive strategy API using Five Pillars templates -- not needed for Phase 66
- `AdTemplate` model with `primaryPillar`/`pillarDetails`: Five Pillars concept -- not used by new strategy engine
- `BrandStrategy` model reference in generate-strategy route: Model doesn't exist in schema

## Existing Code Reuse Assessment

### Reuse As-Is
| File | What to Reuse |
|------|---------------|
| `brand-search.tsx` | Entire component, already works for brand selection |
| `taxonomy.ts` | All values, labels, types -- source of truth |
| `schemas.ts` | Zod schemas for classification validation |
| Creative Lab `page.tsx` | Flow state machine (search -> mode-select -> strategy), routing, brand header |

### Reuse Pattern, Rewrite Implementation
| File | Pattern to Keep | What Changes |
|------|----------------|--------------|
| `analysis-view.tsx` | Diversity score pills, loading/error states, score color functions | Replace as entry point -- gap matrix becomes main view |
| `diversity/route.ts` | Distribution computation, Shannon entropy scoring | Already works, strategy API reads from its cache |
| `benchmark/route.ts` | Category comparison pattern | Could be integrated as "vs category average" row in gap matrix |
| `generate-strategy/route.ts` | `callClaudeWithRetry` helper, Zod validation pattern | Prompts and schemas completely change |

### Full Rewrite
| File | Why |
|------|-----|
| `strategy-view.tsx` | Every type, every API call, every UI section references Five Pillars. No salvageable UI code beyond basic card/button patterns. |

### Not Needed
| File | Why Skip |
|------|----------|
| `/api/analyze/strategy/route.ts` | Old competitive strategy with Five Pillars templates. Unrelated to gap matrix. |
| `/api/analyze/generate/route.ts` | Old template-based generation. New concept generation uses gap coordinates, not templates. |

## Open Questions

1. **Should BrandStrategy model be added to schema?**
   - What we know: The generate-strategy route references it but it doesn't exist. The route is likely broken.
   - What's unclear: Whether we need persistence for strategy state at all.
   - Recommendation: Do NOT add BrandStrategy model. The gap matrix is computed from existing data (BrandAnalysisCache + AdClassification). Generated concepts can be ephemeral (shown in a modal, copyable). If persistence is needed later, add it then.

2. **Gap matrix: awareness stages x visual formats, or awareness stages x ALL categories?**
   - What we know: Requirements say "awareness stages x creative formats" (STRT-03).
   - What's unclear: Whether "creative formats" means just `visualFormat` or also `assetType`.
   - Recommendation: Start with awareness stages x visual formats (5x12 grid). This is the most actionable cross-section for creative strategy. Other category breakdowns are shown in the taxonomy breakdown section above the matrix.

3. **Concept generation: Haiku or Sonnet?**
   - What we know: Existing strategy uses Sonnet. Concepts are short (5 fields).
   - What's unclear: Whether Haiku quality is sufficient for creative strategy.
   - Recommendation: Use Haiku for speed and cost. Concept output is structured and constrained by Zod schema. If quality is insufficient, upgrade to Sonnet later.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- all data models, confirmed BrandStrategy missing
- `src/lib/classification/taxonomy.ts` -- 8 categories, 71 values
- `src/app/api/analyze/diversity/route.ts` -- distribution computation, cache writing
- `src/app/api/ad-library/brands/[pageId]/route.ts` -- classificationCoverage + classificationDistribution
- `src/app/api/creative-lab/generate-strategy/route.ts` -- existing 3-step flow, BrandStrategy reference
- `src/app/dashboard/v2/creative-lab/strategy-view.tsx` -- full existing UI (1287 lines, Five Pillars)
- `src/app/dashboard/v2/creative-lab/page.tsx` -- flow state machine, mode selection

### Secondary (MEDIUM confidence)
- `src/app/api/analyze/benchmark/route.ts` -- category comparison pattern
- `src/app/api/analyze/generate/route.ts` -- old template-based generation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new deps needed
- Architecture: HIGH -- data models and APIs thoroughly inspected, gap matrix approach verified against existing data structures
- Pitfalls: HIGH -- identified from actual code inspection (missing model, mobile sizing, sparse data)
- Code reuse assessment: HIGH -- every referenced file read and evaluated

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependencies)
