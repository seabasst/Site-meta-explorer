# Phase 31: Pattern Observations - Research

**Researched:** 2026-02-03
**Domain:** Rule-based pattern detection from demographic/hook snapshot data
**Confidence:** HIGH

## Summary

This phase adds auto-generated factual observation cards to the brand detail page. The observations are computed from data already stored in the `BrandSnapshot` model (demographics, country distribution) and the `HookGroup` model (hook frequency/reach). No external dependencies are needed -- this is pure TypeScript rule evaluation against existing data.

The brand detail page (`src/app/dashboard/[brandId]/page.tsx`) is a client component that already fetches snapshot data via `useTrackedBrands` and hook data via the `/api/dashboard/hooks` endpoint. All data fields needed for the four observation types (OBSV-01 through OBSV-04) are already available on the client side. The observation engine can be implemented as a pure function that takes snapshot + hook data and returns observation objects, computed client-side with no new API endpoint required.

**Primary recommendation:** Build a pure TypeScript `generateObservations()` function in `src/lib/observation-engine.ts` that accepts a `TrackedBrandSnapshot` and `HookGroupDisplay[]`, applies threshold rules, and returns ranked observation cards. Render these in the brand detail page between the header and the metrics grid.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (existing) | Rule engine logic | Already in project |
| React | 19 (existing) | Observation card UI | Already in project |
| Tailwind CSS | (existing) | Card styling | Already in project |

### Supporting
No additional libraries needed. This is entirely built on existing project infrastructure.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side computation | Server-side API endpoint | Unnecessary complexity; all data is already fetched client-side. An API would add latency and a network round-trip for no benefit. |
| Inline logic in page component | Separate observation-engine module | Separate module is testable, reusable for future comparison observations |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    observation-engine.ts       # Pure function: snapshot + hooks -> observations[]
    observation-engine.test.ts  # Unit tests for threshold logic
  components/
    dashboard/
      observation-card.tsx      # Single observation card component
      observation-list.tsx      # Container: renders up to 5 cards, hides when empty
  app/
    dashboard/
      [brandId]/
        page.tsx                # Integrate observation list between header and metrics
```

### Pattern 1: Pure Function Observation Engine
**What:** A stateless function that takes data in, applies rules, returns observations sorted by signal magnitude. No side effects, no state, no API calls.
**When to use:** Always -- this is the core of the feature.
**Example:**
```typescript
// src/lib/observation-engine.ts

export type ObservationType = 'demographic-skew' | 'gender-imbalance' | 'geo-concentration' | 'hook-pattern';

export interface Observation {
  type: ObservationType;
  title: string;        // Short label, e.g. "Demographic Skew"
  description: string;  // Human-readable sentence, e.g. "Skews 25-34 male, 42% of reach"
  magnitude: number;    // 0-100 signal strength for ranking
  icon?: string;        // Optional icon identifier
}

export function generateObservations(
  snapshot: TrackedBrandSnapshot,
  hookGroups: HookGroupDisplay[]
): Observation[] {
  const observations: Observation[] = [];

  // OBSV-01: Dominant demographic skew
  // OBSV-02: Gender imbalance
  // OBSV-03: Geographic concentration
  // OBSV-04: Hook pattern

  // Sort by magnitude descending, cap at 5
  return observations
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 5);
}
```

### Pattern 2: Conditional Rendering with Empty State
**What:** The observation list component renders nothing (returns `null`) when no observations are generated, satisfying OBSV-06.
**When to use:** In the brand detail page.
**Example:**
```typescript
// src/components/dashboard/observation-list.tsx
export function ObservationList({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {observations.map((obs, i) => (
        <ObservationCard key={`${obs.type}-${i}`} observation={obs} />
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Over-engineering with a class hierarchy:** Do not create abstract base classes for observation types. Simple if/else or individual detector functions are sufficient for 4 observation types.
- **Storing observations in the database:** Observations are derived data. They should be computed on the fly from snapshot data, not stored. This keeps them always current and avoids migration complexity.
- **Creating a new API endpoint:** The brand detail page already has all the data needed. Adding a `/api/dashboard/observations` endpoint would add unnecessary complexity and latency.

## Data Available for Observation Rules

### From BrandSnapshot (already on client via `TrackedBrandSnapshot`)

| Field | Type | Use for |
|-------|------|---------|
| `dominantGender` | `string \| null` | OBSV-01 (skew), OBSV-02 (imbalance) |
| `dominantGenderPct` | `number \| null` | OBSV-01 (skew), OBSV-02 (threshold: >60%) |
| `dominantAgeRange` | `string \| null` | OBSV-01 (skew description) |
| `dominantAgePct` | `number \| null` | OBSV-01 (skew magnitude) |
| `topCountry1Code` | `string \| null` | OBSV-03 (geo concentration) |
| `topCountry1Pct` | `number \| null` | OBSV-03 (threshold check) |
| `topCountry2Code` | `string \| null` | OBSV-03 (combined threshold) |
| `topCountry2Pct` | `number \| null` | OBSV-03 (combined with top1 > 50%) |
| `topCountry3Code` | `string \| null` | Available but not needed for rule |
| `demographicsJson` | `unknown` | Full breakdown if finer analysis needed |
| `totalReach` | `number` | Context for observation descriptions |
| `activeAdsCount` | `number` | Context for observation descriptions |

### From HookGroup (already on client via `HookGroupDisplay[]`)

| Field | Type | Use for |
|-------|------|---------|
| `hookText` | `string` | OBSV-04 (display the most common hook) |
| `frequency` | `number` | OBSV-04 (how many ads use this hook) |
| `totalReach` | `number` | OBSV-04 (reach context) |
| `avgReachPerAd` | `number` | Could enhance observation |

**Key insight:** The `demographicsJson` field contains the full `AggregatedDemographics` object (with `ageBreakdown`, `genderBreakdown`, `ageGenderBreakdown`, `regionBreakdown`). For OBSV-01 (demographic skew), the scalar fields `dominantAgeRange`/`dominantAgePct` and `dominantGender`/`dominantGenderPct` are sufficient. The JSON field could provide richer combined age+gender skew data if desired.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Country code to name mapping | Custom lookup table | `Intl.DisplayNames` API | Built into all modern browsers, handles all ISO 3166-1 codes |
| Complex statistical analysis | Custom stats library | Simple percentage thresholds | The requirements specify straightforward threshold rules, not statistical significance |
| Observation persistence | Database table for observations | Compute on the fly | Observations are derived data; storing them creates stale data problems |

## Common Pitfalls

### Pitfall 1: Null Data Handling
**What goes wrong:** The observation engine crashes when snapshot fields are null (e.g., no gender data available for a brand).
**Why it happens:** Not all snapshots have complete demographic data. Some brands may have zero reach, no country data, or no hook groups.
**How to avoid:** Every observation detector must guard against null/undefined fields. Return no observation (skip) rather than crash.
**Warning signs:** TypeScript strict null checks should catch most issues at compile time.

### Pitfall 2: Overlapping Observations
**What goes wrong:** OBSV-01 (demographic skew) and OBSV-02 (gender imbalance) both fire and say similar things about gender.
**Why it happens:** A 70% male audience triggers both "Skews male" and "Gender imbalance: male >60%".
**How to avoid:** Make OBSV-01 focus on the combined age+gender skew (e.g., "Skews 25-34 male"), while OBSV-02 focuses purely on gender imbalance as a separate signal. Alternatively, if gender imbalance fires, exclude gender from the skew description and focus on age.
**Warning signs:** During testing, check brands with strong gender skews to ensure cards are not redundant.

### Pitfall 3: Magnitude Ranking Inconsistency
**What goes wrong:** Observations from different types use incompatible magnitude scales, making ranking meaningless.
**Why it happens:** Comparing a 70% gender imbalance to a hook used 8 times is not an apples-to-apples comparison.
**How to avoid:** Normalize magnitude to a 0-100 scale for each observation type. Use the distance from the threshold as the signal strength. For example: gender at 75% with threshold 60% = magnitude of (75-60)/(100-60) * 100 = 37.5.
**Warning signs:** Test with brands that trigger multiple observation types simultaneously.

### Pitfall 4: Hook Pattern with Insufficient Data
**What goes wrong:** OBSV-04 fires for a hook that appeared only twice, which is not a meaningful "pattern."
**Why it happens:** No minimum frequency threshold.
**How to avoid:** Require a minimum frequency (e.g., >= 3 ads) before considering it a pattern observation. Also consider minimum total ads analyzed (e.g., brand must have >= 5 ads).
**Warning signs:** Brands with very few ads generating weak hook observations.

## Observation Rules - Detailed Specifications

### OBSV-01: Dominant Demographic Skew
**Input:** `dominantAgeRange`, `dominantAgePct`, `dominantGender`, `dominantGenderPct`
**Trigger:** Both dominant age and gender exist and dominant age pct >= 25% (notable concentration)
**Description format:** `"Skews {ageRange} {gender}, {pct}% of reach"`
**Magnitude:** `dominantAgePct` value (higher concentration = stronger signal)
**Example:** "Skews 25-34 male, 42% of reach"

### OBSV-02: Gender Imbalance
**Input:** `dominantGender`, `dominantGenderPct`
**Trigger:** `dominantGenderPct > 60`
**Description format:** `"{Gender} audience dominates at {pct}% of reach"`
**Magnitude:** `(dominantGenderPct - 60) / 40 * 100` (distance from threshold, normalized)
**Example:** "Male audience dominates at 72% of reach"

### OBSV-03: Geographic Concentration
**Input:** `topCountry1Code`, `topCountry1Pct`, `topCountry2Code`, `topCountry2Pct`
**Trigger:** `topCountry1Pct + topCountry2Pct > 50`
**Description format:** `"Concentrated in {country1} and {country2}, {combinedPct}% of reach"`
**Magnitude:** `combinedPct` value (higher = more concentrated)
**Special case:** If top country alone > 50%, description could be just that one country.
**Example:** "Concentrated in DE and FR, 68% of reach"

### OBSV-04: Hook Pattern
**Input:** `hookGroups[0]` (sorted by totalReach descending from API)
**Trigger:** Top hook exists AND `frequency >= 3`
**Description format:** `'"{hookText}" appears in {frequency} ads'`
**Magnitude:** `frequency / totalAdsAnalyzed * 100` (what fraction of ads use this hook)
**Example:** '"Free shipping on orders..." appears in 8 ads'

## Code Examples

### Observation Engine Structure
```typescript
// src/lib/observation-engine.ts
import type { TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';
import type { HookGroupDisplay } from '@/components/dashboard/hook-explorer';

export type ObservationType = 'demographic-skew' | 'gender-imbalance' | 'geo-concentration' | 'hook-pattern';

export interface Observation {
  type: ObservationType;
  title: string;
  description: string;
  magnitude: number;  // 0-100, used for ranking
}

function detectDemographicSkew(snapshot: TrackedBrandSnapshot): Observation | null {
  const { dominantAgeRange, dominantAgePct, dominantGender, dominantGenderPct } = snapshot;
  if (!dominantAgeRange || !dominantAgePct || dominantAgePct < 25) return null;
  if (!dominantGender || !dominantGenderPct) return null;

  return {
    type: 'demographic-skew',
    title: 'Demographic Skew',
    description: `Skews ${dominantAgeRange} ${dominantGender}, ${Math.round(dominantAgePct)}% of reach`,
    magnitude: dominantAgePct,
  };
}

function detectGenderImbalance(snapshot: TrackedBrandSnapshot): Observation | null {
  const { dominantGender, dominantGenderPct } = snapshot;
  if (!dominantGender || !dominantGenderPct || dominantGenderPct <= 60) return null;

  return {
    type: 'gender-imbalance',
    title: 'Gender Imbalance',
    description: `${capitalize(dominantGender)} audience dominates at ${Math.round(dominantGenderPct)}% of reach`,
    magnitude: ((dominantGenderPct - 60) / 40) * 100,
  };
}

function detectGeoConcentration(snapshot: TrackedBrandSnapshot): Observation | null {
  const { topCountry1Code, topCountry1Pct, topCountry2Code, topCountry2Pct } = snapshot;
  if (!topCountry1Code || !topCountry1Pct) return null;

  const combinedPct = (topCountry1Pct ?? 0) + (topCountry2Pct ?? 0);
  if (combinedPct <= 50) return null;

  const countries = topCountry2Code
    ? `${topCountry1Code} and ${topCountry2Code}`
    : topCountry1Code;

  return {
    type: 'geo-concentration',
    title: 'Geographic Concentration',
    description: `Concentrated in ${countries}, ${Math.round(combinedPct)}% of reach`,
    magnitude: combinedPct,
  };
}

function detectHookPattern(
  hookGroups: HookGroupDisplay[],
  totalAds: number
): Observation | null {
  if (hookGroups.length === 0 || totalAds < 5) return null;

  const topHook = hookGroups[0]; // Already sorted by totalReach desc
  if (topHook.frequency < 3) return null;

  const truncatedText = topHook.hookText.length > 50
    ? topHook.hookText.slice(0, 47) + '...'
    : topHook.hookText;

  return {
    type: 'hook-pattern',
    title: 'Recurring Hook',
    description: `"${truncatedText}" appears in ${topHook.frequency} ads`,
    magnitude: (topHook.frequency / totalAds) * 100,
  };
}

export function generateObservations(
  snapshot: TrackedBrandSnapshot,
  hookGroups: HookGroupDisplay[]
): Observation[] {
  const observations: Observation[] = [];

  const skew = detectDemographicSkew(snapshot);
  if (skew) observations.push(skew);

  const gender = detectGenderImbalance(snapshot);
  if (gender) observations.push(gender);

  const geo = detectGeoConcentration(snapshot);
  if (geo) observations.push(geo);

  const hook = detectHookPattern(hookGroups, snapshot.totalAdsFound);
  if (hook) observations.push(hook);

  return observations
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 5);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

### Observation Card Component
```typescript
// src/components/dashboard/observation-card.tsx
import type { Observation } from '@/lib/observation-engine';

const iconMap: Record<string, string> = {
  'demographic-skew': 'Users',
  'gender-imbalance': 'Scale',
  'geo-concentration': 'Globe',
  'hook-pattern': 'MessageSquare',
};

export function ObservationCard({ observation }: { observation: Observation }) {
  return (
    <div className="flex items-start gap-3 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-4 py-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent-green)]/10 flex items-center justify-center">
        {/* Icon based on type */}
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {observation.title}
        </p>
        <p className="text-sm text-[var(--text-primary)]">
          {observation.description}
        </p>
      </div>
    </div>
  );
}
```

### Integration in Brand Detail Page
```typescript
// In src/app/dashboard/[brandId]/page.tsx, after the brand header and before metrics grid:

const observations = useMemo(() => {
  if (!snapshot) return [];
  return generateObservations(snapshot, hookGroups);
}, [snapshot, hookGroups]);

// In JSX, inside the snapshot-exists branch, before metrics grid:
{observations.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
      Key Observations
    </h3>
    {observations.map((obs, i) => (
      <ObservationCard key={`${obs.type}-${i}`} observation={obs} />
    ))}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI/LLM-generated insights | Rule-based pattern detection | Project decision | Simpler, deterministic, no API costs, instant |

**Deprecated/outdated:**
- N/A -- this is a new feature with no prior implementation.

## Open Questions

1. **Country code display format**
   - What we know: Snapshot stores ISO country codes (e.g., "DE", "FR")
   - What's unclear: Should observation cards show full country names ("Germany") or codes ("DE")?
   - Recommendation: Use `Intl.DisplayNames` to show full names in observations for readability, while the rest of the page can continue using codes.

2. **demographicsJson structure on the client**
   - What we know: The brand detail page parses `demographicsJson` into `{ gender?: Record<string, number>; age?: Record<string, number>; country?: Record<string, number> }` (line 113 of page.tsx). This differs from the `AggregatedDemographics` interface used server-side (arrays of objects).
   - What's unclear: Whether the JSON was transformed during storage or if it's an older format.
   - Recommendation: Use the scalar fields (`dominantGender`, `dominantGenderPct`, etc.) for observations since they are reliable and typed. Only fall back to `demographicsJson` if richer data is needed.

3. **Observation card visual design**
   - What we know: The page uses `glass rounded-2xl` cards with the project's CSS variable system.
   - What's unclear: Exact visual treatment for observation cards (icons, colors per type, etc.)
   - Recommendation: Use a compact card design that is visually distinct from the existing metric boxes and section cards. Slightly different background or a left border accent color per observation type.

## Sources

### Primary (HIGH confidence)
- Prisma schema: `/Users/sebastian/Codingprojects/Sitemap-experiment/prisma/schema.prisma` -- BrandSnapshot and HookGroup models
- Brand detail page: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/dashboard/[brandId]/page.tsx` -- current page structure
- Snapshot builder: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/lib/snapshot-builder.ts` -- what fields are stored
- Demographic types: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/lib/demographic-types.ts` -- AggregatedDemographics shape
- Hook explorer: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/components/dashboard/hook-explorer.tsx` -- HookGroupDisplay type
- TrackedBrand types: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/hooks/use-tracked-brands.ts` -- client-side snapshot type
- Dashboard hooks API: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/api/dashboard/hooks/route.ts` -- hook data endpoint

### Secondary (MEDIUM confidence)
- None needed -- all research was from codebase inspection.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external dependencies, pure TypeScript
- Architecture: HIGH -- data structures fully inspected, integration point clear
- Pitfalls: HIGH -- derived from actual data shape analysis (null fields, overlapping rules)
- Observation rules: MEDIUM -- thresholds (25%, 60%, 50%, freq>=3) are reasonable defaults but may need tuning based on real data

**Research date:** 2026-02-03
**Valid until:** No expiry -- this is internal codebase analysis, not library research
