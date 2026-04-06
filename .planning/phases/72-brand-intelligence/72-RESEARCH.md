# Phase 72: Brand Intelligence & Polish - Research

**Researched:** 2026-04-06
**Domain:** Brand comparison analytics, profile-aware strategy recommendations
**Confidence:** HIGH

## Summary

This phase extends existing strategy and benchmark infrastructure to add two features: (1) a brand health overview comparing the user's brand to their linked competitors, and (2) personalized strategy recommendations that incorporate the full BrandProfile data (voice, positioning, audience, competitors).

The existing codebase already has all the building blocks. The benchmark API (`/api/analyze/benchmark`) already compares a brand against category averages. The strategy API (`/api/strategy/[pageId]`) already assembles taxonomy breakdowns and gap matrices. The `compileBrandContext()` utility already serializes brand profiles into AI-consumable context. The BrandCompetitor model already links profiles to ad library brands. This phase is pure composition -- no new libraries, no new AI capabilities, just wiring existing pieces together in new ways.

**Primary recommendation:** Build a competitor comparison endpoint that fetches BrandAnalysisCache for each linked competitor and assembles side-by-side scores, then enhance the strategy view to inject BrandProfile data into recommendations.

## Standard Stack

No new libraries needed. This phase uses only what already exists in the codebase.

### Core (Already Installed)
| Library | Purpose | How Used in This Phase |
|---------|---------|----------------------|
| Prisma | Database queries | Fetch BrandAnalysisCache for competitors, BrandProfile data |
| React 19 | UI components | New BrandHealthOverview component, enhanced StrategyView |
| Anthropic SDK | AI recommendations | Profile-aware concept generation (optional enhancement) |
| Zod | Validation | Request/response schemas for new endpoint |
| Lucide React | Icons | UI elements in health overview cards |

### Alternatives Considered
None needed -- this phase is entirely about composing existing infrastructure.

## Architecture Patterns

### Pattern 1: Competitor Comparison Data Assembly

**What:** New API endpoint that fetches BrandAnalysisCache for each linked competitor and returns side-by-side comparison data.

**The data flow:**
```
BrandProfile.competitors[]
  -> BrandCompetitor.adLibraryBrandId
    -> AdLibraryBrand.id
      -> BrandAnalysisCache.brandId
```

**Key query pattern (already used in benchmark API):**
```typescript
// Fetch competitor analysis caches in parallel
const profile = await prisma.brandProfile.findFirst({
  where: { userId, isActive: true },
  include: {
    competitors: {
      include: {
        adLibraryBrand: {
          select: { id: true, pageId: true, pageName: true, profilePicUrl: true, category: true }
        }
      }
    }
  }
});

// Get analysis caches for all competitor brands
const competitorBrandIds = profile.competitors.map(c => c.adLibraryBrand.id);
const competitorCaches = await prisma.brandAnalysisCache.findMany({
  where: { brandId: { in: competitorBrandIds } },
  include: { brand: { select: { pageName: true, pageId: true } } }
});
```

**Return shape:**
```typescript
interface BrandHealthResponse {
  userBrand: {
    name: string;
    scores: Record<CategoryKey | 'overall', number>;
    andromedaScore: number;
    metrics: { avgRefreshRate, stalePercentage, hookQualityAvg, uniqueConcepts, ... };
  };
  competitors: Array<{
    name: string;
    pageId: string;
    iconUrl: string | null;
    notes: string | null;
    scores: Record<CategoryKey | 'overall', number>;
    andromedaScore: number;
    metrics: { ... };
    hasAnalysis: boolean; // false if competitor not yet analyzed
  }>;
  comparison: {
    // Per-pillar: user vs avg of competitors
    indexing: Record<CategoryKey | 'overall', {
      user: number;
      competitorAvg: number;
      diff: number;
      status: 'ahead' | 'behind' | 'even';
    }>;
    // Key insights
    strengths: string[]; // pillars where user outperforms competitors
    gaps: string[]; // pillars where user underperforms
  };
}
```

### Pattern 2: Profile-Aware Strategy Recommendations

**What:** Inject BrandProfile data into the strategy view's recommendation generation.

**Current state:** `generateRecommendations()` in strategy-view.tsx is a pure client-side function that looks at diversity scores and taxonomy breakdown. It knows nothing about the brand's voice, positioning, audience, or competitors.

**Enhancement approach:**
1. The strategy API (`/api/strategy/[pageId]`) already fetches brand data. Extend it to also fetch the active BrandProfile for the brand's user (if one exists).
2. Pass profile data to the frontend alongside strategy data.
3. Enhance `generateRecommendations()` to incorporate profile data into recommendation text.
4. Optionally: Add an AI-powered "personalized insights" section that uses `compileBrandContext()` to generate brand-specific strategy advice via Claude Haiku.

**Key decision: Client-side vs server-side recommendations**

Current recommendations are client-side computed (no AI call). Two options:
- **Option A (simpler):** Keep client-side, just template brand profile data into recommendation messages. E.g., "Your hookTactic score is low. Given your audience of {demographics}, try {specific suggestion}."
- **Option B (richer):** Add an AI endpoint that takes strategy data + brand context and returns personalized recommendations. Uses ~500 tokens of Haiku per request.

**Recommendation:** Start with Option A for the health overview (data-driven comparisons). Add Option B as a "Generate AI Insights" button on the strategy view for personalized recommendations. This keeps the default experience fast (no AI latency) while offering depth when wanted.

### Pattern 3: Linking User's Brand to Their AdLibraryBrand

**Critical data mapping issue:** The user has a BrandProfile (their own brand identity). Separately, their brand may exist in the AdLibraryBrand table (from ad library scraping). To show the user's scores in the health overview, we need to know WHICH AdLibraryBrand is "theirs."

**Current state:** BrandProfile has `name` (string) and `competitors` (BrandCompetitor[]). There is NO direct link from BrandProfile to the user's own AdLibraryBrand record.

**Solution options:**
1. **Add `adLibraryBrandId` field to BrandProfile** -- Explicit link. Clean but requires schema migration.
2. **Fuzzy match by name** -- Match BrandProfile.name to AdLibraryBrand.pageName. Fragile.
3. **Use the pageId from the strategy view context** -- The user is already viewing their brand's strategy page, so we know the pageId. Pass it as a parameter.

**Recommendation:** Option 3 for the health overview (the user navigates to their brand in the creative lab, so we have the pageId). Option 1 as a future enhancement for scenarios where we need to identify the user's brand without navigation context.

### Recommended Project Structure
```
src/
├── app/api/
│   ├── brand-health/
│   │   └── route.ts                    # NEW: Competitor comparison endpoint
│   └── strategy/
│       └── personalized/
│           └── route.ts                # NEW: AI-powered personalized insights
├── app/dashboard/v2/creative-lab/
│   ├── brand-health-overview.tsx       # NEW: Health comparison UI component
│   └── strategy-view.tsx              # ENHANCED: Profile-aware recommendations
└── lib/
    └── brand-context.ts               # EXISTING: compileBrandContext (may extend)
```

### Anti-Patterns to Avoid
- **Fetching competitor data one-by-one:** Use `findMany` with `{ in: [...ids] }` to batch competitor cache lookups.
- **AI calls for basic comparisons:** The health overview scores are pure math (subtraction/comparison). Only use AI for the "personalized insights" generation.
- **Blocking on unanalyzed competitors:** Some competitors may not have BrandAnalysisCache yet. Show them as "Not yet analyzed" with a CTA to run analysis, don't fail the whole view.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score comparison math | Custom scoring algorithm | Existing `computeIndex()` from benchmark API | Already handles diff calculation and status classification |
| Category averages | Custom aggregation | Existing `computeCategoryAvgDistribution()` | Already handles multi-brand averaging |
| Brand context for AI | Custom prompt building | Existing `compileBrandContext()` | Already handles character budgeting and priority ordering |
| Score visualization | Custom chart components | Existing score pills and color helpers from StrategyView | `scoreColor()`, `scoreBg()` already exist |

## Common Pitfalls

### Pitfall 1: Competitors Without Analysis Data
**What goes wrong:** User links competitors that haven't been analyzed yet. The health overview fails or shows incomplete data.
**Why it happens:** BrandAnalysisCache only exists after running the Andromeda analysis on a brand. Competitors may be in AdLibraryBrand but not analyzed.
**How to avoid:** Check `hasAnalysis` for each competitor. Show partial view with "Run analysis" CTA for unanalyzed competitors. Never fail the whole endpoint.
**Warning signs:** Empty competitor section, cryptic errors about missing cache.

### Pitfall 2: No Competitors Linked
**What goes wrong:** User opens health overview but hasn't linked any competitors to their BrandProfile.
**Why it happens:** BrandProfile setup may be incomplete.
**How to avoid:** Show an empty state with CTA to "Add competitors" that links to the brand profile editor. Don't show the health overview tab/button until at least 1 competitor is linked.
**Warning signs:** Health overview always shows "no data available."

### Pitfall 3: User's Own Brand Not in AdLibraryBrand
**What goes wrong:** User has a BrandProfile but their brand isn't in the ad library database, so there's no analysis to compare against.
**Why it happens:** The user may not have ads in the Meta ad library, or their brand hasn't been ingested yet.
**How to avoid:** Check if the user's brand has a BrandAnalysisCache before showing the health overview. Show appropriate empty state if not.

### Pitfall 4: Stale Recommendation Text
**What goes wrong:** Recommendations reference brand profile fields that are null/empty, producing awkward messages like "Given your audience of , try..."
**Why it happens:** BrandProfile fields are optional. Template strings break with null values.
**How to avoid:** Guard every profile field before including in recommendation text. Fall back to generic recommendations when profile data is sparse.

### Pitfall 5: N+1 Queries in Competitor Comparison
**What goes wrong:** Fetching competitor data creates cascading queries per competitor.
**Why it happens:** Fetching BrandAnalysisCache per competitor sequentially.
**How to avoid:** Single `findMany` with `{ in: competitorBrandIds }`, then map results by brandId.

## Code Examples

### Competitor Cache Batch Fetch
```typescript
// From existing pattern in benchmark API
const competitorBrandIds = profile.competitors.map(c => c.adLibraryBrand.id);

const [userCache, competitorCaches] = await Promise.all([
  prisma.brandAnalysisCache.findUnique({
    where: { brandId: userBrandId },
  }),
  prisma.brandAnalysisCache.findMany({
    where: { brandId: { in: competitorBrandIds } },
    include: { brand: { select: { pageName: true, pageId: true, profilePicUrl: true } } },
  }),
]);

// Map by brandId for O(1) lookups
const cacheMap = new Map(competitorCaches.map(c => [c.brandId, c]));
```

### Profile-Aware Recommendation Enhancement
```typescript
// Extend existing generateRecommendations to accept optional profile
function generateRecommendations(
  diversityScores: Record<string, number>,
  taxonomyBreakdown: Record<string, Record<string, number>>,
  gapMatrix: Record<string, Record<string, number>>,
  profile?: { demographics: string[]; painPoints: string[]; positioning: string | null } | null,
): Array<{ priority: 'high' | 'medium' | 'low'; title: string; detail: string }> {
  // ... existing logic ...

  // Enhance recommendation detail with profile context
  if (profile?.demographics?.length > 0) {
    rec.detail += ` Your target audience (${profile.demographics.slice(0, 2).join(', ')}) may respond especially well to this.`;
  }
}
```

### Health Score Comparison UI Pattern
```typescript
// Side-by-side pill comparison (reusing existing scoreColor/scoreBg)
function ScoreComparison({ label, userScore, competitorAvg }: {
  label: string; userScore: number; competitorAvg: number;
}) {
  const diff = userScore - competitorAvg;
  const status = diff > 5 ? 'ahead' : diff < -5 ? 'behind' : 'even';

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-slate-400">{label}</span>
      <span style={{ color: scoreColor(userScore) }} className="font-black text-sm w-8">{userScore}</span>
      <span className="text-xs text-slate-500">vs</span>
      <span className="text-xs text-slate-400 w-8">{Math.round(competitorAvg)}</span>
      <span className={`text-xs font-semibold ${
        status === 'ahead' ? 'text-green-500' : status === 'behind' ? 'text-red-400' : 'text-slate-400'
      }`}>
        {diff > 0 ? '+' : ''}{Math.round(diff)}
      </span>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Category-wide benchmarking | Competitor-specific comparison | This phase | More actionable -- "you vs your competitors" instead of "you vs all brands in category" |
| Generic strategy recommendations | Profile-aware recommendations | This phase | Recommendations reference brand's actual audience, voice, positioning |
| Separate analysis/strategy/benchmark views | Unified health overview | This phase | Single view for competitive intelligence |

## Open Questions

1. **Should health overview replace or complement the existing benchmark comparison?**
   - What we know: BenchmarkComparison in analysis-view.tsx compares against category averages. Health overview compares against specific competitors.
   - What's unclear: Whether users want both, or if competitor comparison supersedes category comparison.
   - Recommendation: Keep both. Category benchmark is useful even without competitors linked. Health overview is an additional view.

2. **How to handle the "user's brand" identification?**
   - What we know: The user navigates to a brand in the Creative Lab, giving us a pageId. BrandProfile has no direct link to AdLibraryBrand.
   - What's unclear: Whether we need a direct BrandProfile -> AdLibraryBrand link for this phase.
   - Recommendation: Use the pageId from navigation context for now. The strategy view already receives `brand.pageId`. Pass that to the health endpoint.

3. **AI-powered insights: Haiku or skip?**
   - What we know: generate-concept uses Haiku 4. compileBrandContext works well for AI context injection.
   - What's unclear: Whether AI-generated competitive insights add enough value over templated comparisons to justify the latency and cost.
   - Recommendation: Implement as optional "Generate AI Insights" button, not auto-triggered. This keeps the default experience fast.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/src/app/api/strategy/[pageId]/route.ts` - Strategy data assembly pattern
- Codebase analysis: `/src/app/api/analyze/benchmark/route.ts` - Benchmark comparison with category averages
- Codebase analysis: `/src/lib/brand-context.ts` - Brand context compilation for AI
- Codebase analysis: `/prisma/schema.prisma` lines 722-778 - BrandProfile + BrandCompetitor models
- Codebase analysis: `/src/app/dashboard/v2/creative-lab/strategy-view.tsx` - Current strategy UI + recommendations
- Codebase analysis: `/src/lib/classification/benchmark-utils.ts` - Distribution comparison utilities

### Secondary (MEDIUM confidence)
- Codebase analysis: `/src/lib/creative-lab/creative-director.ts` - Pattern for brand-aware AI prompts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, entirely existing codebase
- Architecture: HIGH - Clear data flow from existing models (BrandProfile -> BrandCompetitor -> AdLibraryBrand -> BrandAnalysisCache)
- Pitfalls: HIGH - Based on direct analysis of data model gaps and nullable fields
- Code examples: HIGH - Derived from existing patterns in the codebase

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days - stable, internal feature)
