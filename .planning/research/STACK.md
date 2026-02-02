# Technology Stack: v3.1 Competitive Intelligence

**Project:** Ad Library Demographics Analyzer
**Researched:** 2026-02-02
**Scope:** New libraries/approaches needed for v3.1 features only (existing stack is settled)

## Existing Stack (No Changes Needed)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 16.1.2 | Keep |
| React | 19.2.3 | Keep |
| Recharts | ^3.6.0 | Keep (consider bumping to 3.7.0) |
| Tailwind CSS | 4 | Keep |
| shadcn/ui + Radix | current | Keep |
| Prisma + PostgreSQL | 7.3.0 | Keep |
| Zod | ^4.3.6 | Keep |
| TypeScript | ^5 | Keep |

---

## New Stack Additions for v3.1

### Feature 1: Ad Creative Hooks Extraction + Similarity Grouping

**What the feature needs:** Extract the first sentence/hook from `creativeBody` text already fetched from the Facebook API, then group similar hooks by string similarity, and display frequency weighted by reach.

#### Recommended: No New Dependencies

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sentence extraction | Custom regex/heuristic | Ad copy is short (1-3 sentences). A regex splitting on `.!?\n` handles 95%+ of cases. No NLP library needed for extracting the first sentence from a Facebook ad body. |
| String similarity | Custom Dice coefficient (~30 LOC) | The Dice/Sorensen coefficient on bigrams is the standard algorithm for short-string similarity. It is trivially implementable in ~30 lines of TypeScript. Adding a dependency for this is unnecessary. |
| Grouping/clustering | Custom greedy clustering | For grouping similar hooks: iterate sorted-by-frequency, assign each to the first existing cluster where similarity > threshold (e.g., 0.6), or create a new cluster. This is a simple greedy pass, not k-means. Ad datasets are small (50-500 ads per brand), so O(n^2) comparison is fine. |

**Confidence:** HIGH

**Why NOT use NLP libraries:**

| Library | Version | Why Not |
|---------|---------|---------|
| compromise | 14.14.5 | Overkill. Adds ~200KB+ for POS tagging, grammar parsing we do not need. Ad copy is short text, not prose. Sentence extraction from 1-3 sentence ad bodies is a simple split. |
| wink-nlp | 2.4.0 | Requires a ~1MB language model download (wink-eng-lite-web-model). Powerful but unnecessary for splitting short ad text into sentences. |
| natural | 8.1.0 | Node.js only (no tree-shaking), large package with tokenizers/stemmers/classifiers we do not need. Its TF-IDF and Dice coefficient are useful algorithms but trivially reimplementable for this narrow use case. |
| cmpstr | 3.2.1 | Clean API with many algorithms, but adding a dependency for a single 30-line function (Dice bigram similarity) is not justified. |
| string-comparison | 1.3.0 | Last published 2 years ago. Same reasoning as cmpstr. |

**Implementation approach:**

```typescript
// Hook extraction: first sentence from ad creative body
function extractHook(creativeBody: string): string | null {
  if (!creativeBody?.trim()) return null;
  // Split on sentence boundaries, take first non-empty
  const sentences = creativeBody.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  return sentences[0]?.trim() || null;
}

// Dice coefficient for bigram similarity
function diceSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const lower = s.toLowerCase();
    const set = new Set<string>();
    for (let i = 0; i < lower.length - 1; i++) set.add(lower.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(a), setB = bigrams(b);
  let intersection = 0;
  for (const bg of setA) if (setB.has(bg)) intersection++;
  return (2 * intersection) / (setA.size + setB.size) || 0;
}

// Greedy clustering
function clusterHooks(hooks: { text: string; reach: number }[], threshold = 0.6) {
  const clusters: { representative: string; items: typeof hooks; totalReach: number }[] = [];
  for (const hook of hooks.sort((a, b) => b.reach - a.reach)) {
    const match = clusters.find(c => diceSimilarity(c.representative, hook.text) >= threshold);
    if (match) {
      match.items.push(hook);
      match.totalReach += hook.reach;
    } else {
      clusters.push({ representative: hook.text, items: [hook], totalReach: hook.reach });
    }
  }
  return clusters.sort((a, b) => b.totalReach - a.totalReach);
}
```

This is approximately 40 lines of TypeScript with zero dependencies. The ad creative text is already available in `FacebookAdResult.creativeBody` and reach in `FacebookAdResult.euTotalReach`.

---

### Feature 2: Trend Charts (Demographic Shifts Over Time)

**What the feature needs:** Visualize how age distribution, gender split, and top countries change across historical snapshots for a brand.

#### Recommended: Use Existing Recharts (Already Installed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Charting library | Recharts ^3.6.0 (already installed) | The app already uses Recharts with LineChart, AreaChart patterns. The existing `TrendChart` component already shows reach/ads/spend over time using LineChart. Demographic trends are the same pattern with different data keys. |
| Data transformation | Custom utility function | Transform `BrandSnapshot.demographicsJson` time series into the flat `{ date, "18-24": X, "25-34": Y, ... }` format Recharts expects. |
| Chart types | LineChart for age/gender trends, AreaChart (stacked) for composition view | LineChart shows absolute changes. AreaChart with `stackOffset="expand"` normalizes to 100% for composition view (how the mix shifts). |

**Confidence:** HIGH

**No new dependencies needed.** The existing codebase already has the exact pattern in `src/components/dashboard/trend-chart.tsx` -- multi-line Recharts LineChart with metric toggles. Demographic trends are the same pattern with different data series.

**Key Recharts patterns to use (already in codebase):**

- `ResponsiveContainer` + `LineChart` with multiple `Line` components (see existing `trend-chart.tsx`)
- `XAxis` with date formatting, `YAxis` with percentage formatter
- Custom `Tooltip` with `contentStyle` matching the existing dark theme
- `AreaChart` with `stackOffset="expand"` for normalized composition view (this is built into Recharts, no additional code needed)

**Consider bumping Recharts to 3.7.0** for latest fixes, but not required.

---

### Feature 3: Side-by-Side Brand Comparison

**What the feature needs:** Mirrored demographic charts showing two brands next to each other for visual comparison.

#### Recommended: No New Dependencies

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | CSS Grid (2-column) via Tailwind | Two-column grid with matching chart heights. Tailwind `grid grid-cols-2 gap-6` is all that is needed. |
| Charts | Reuse existing `AgeGenderChart` and `CountryChart` | The existing chart components accept data props. Render two instances side by side with different brand data. |
| Brand selector | shadcn/ui Select or Combobox | Already in the project's UI kit. User picks two brands from their tracked list. |
| Synchronized interactions | Shared state via React 19 `useState` | When hovering an age group on the left chart, highlight the same group on the right. Pass `hoveredAge` state up to parent. |

**Confidence:** HIGH

**Existing `DemographicsComparison` component** at `src/components/dashboard/demographics-comparison.tsx` already compares multiple brands in a list layout. The v3.1 feature enhances this to a focused two-brand mirrored view with synchronized hover states.

**Architecture pattern:** Lift hover state to the parent comparison container, pass down to both chart instances as props. This is standard React composition, no library needed.

```tsx
// Parent manages synchronized state
const [hoveredAge, setHoveredAge] = useState<string | null>(null);

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <BrandDemoPanel brand={brandA} hoveredAge={hoveredAge} onHover={setHoveredAge} />
  <BrandDemoPanel brand={brandB} hoveredAge={hoveredAge} onHover={setHoveredAge} />
</div>
```

---

### Feature 4: Rule-Based Pattern Observations

**What the feature needs:** Auto-generate factual text summaries from demographic snapshot data. Examples: "Skews 25-34 male", "Top country shifted DE to FR", "Gender split shifted 5pp toward female since last snapshot."

#### Recommended: No New Dependencies (Pure TypeScript Rules)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Text generation | Custom rule engine (~100-150 LOC) | Template strings with conditional logic. This is pattern matching on structured data, not NLP. Each rule checks a condition and emits a sentence. |
| Rule structure | Array of `{ check, generate }` functions | Each rule receives current + previous snapshot data, returns an observation string or null. |
| Prioritization | Score-based sorting | Each observation gets a significance score (e.g., magnitude of shift). Show top N most notable observations. |

**Confidence:** HIGH

**Why this does NOT need an NLP/NLG library:** The input is fully structured numeric data (percentages, country codes, gender splits). The output is templated English sentences. There are no open-ended generation needs. A rule engine with template literals is the correct tool.

**Example rule architecture:**

```typescript
interface Observation {
  text: string;
  category: 'demographic' | 'geographic' | 'creative' | 'spend';
  significance: number; // 0-1, used for sorting
}

type ObservationRule = (
  current: SnapshotData,
  previous: SnapshotData | null
) => Observation | null;

const rules: ObservationRule[] = [
  // Dominant segment rule
  (current) => {
    if (!current.dominantGender || !current.dominantAgeRange) return null;
    const pct = current.dominantGenderPct ?? 0;
    if (pct < 30) return null; // Not significant enough
    return {
      text: `Skews ${current.dominantAgeRange} ${current.dominantGender} (${pct.toFixed(0)}%)`,
      category: 'demographic',
      significance: pct / 100,
    };
  },
  // Country shift rule
  (current, previous) => {
    if (!previous || !current.topCountry1Code || !previous.topCountry1Code) return null;
    if (current.topCountry1Code !== previous.topCountry1Code) {
      return {
        text: `Top country shifted from ${previous.topCountry1Code} to ${current.topCountry1Code}`,
        category: 'geographic',
        significance: 0.8,
      };
    }
    return null;
  },
  // Gender shift rule
  (current, previous) => {
    if (!previous?.dominantGenderPct || !current.dominantGenderPct) return null;
    const shift = current.dominantGenderPct - previous.dominantGenderPct;
    if (Math.abs(shift) < 3) return null; // Ignore small shifts
    const direction = shift > 0 ? 'toward' : 'away from';
    return {
      text: `Gender split shifted ${Math.abs(shift).toFixed(0)}pp ${direction} ${current.dominantGender}`,
      category: 'demographic',
      significance: Math.min(Math.abs(shift) / 20, 1),
    };
  },
];
```

This pattern is easily extensible. New rules are added by pushing to the array. No DSL, no template language, no library.

---

## Summary: What to Install

**Nothing.**

All four v3.1 features can be implemented with zero new npm dependencies. Here is the rationale:

| Feature | New Dependencies | Approach |
|---------|-----------------|----------|
| Hook extraction + grouping | None | Custom regex + Dice coefficient (~40 LOC) |
| Trend charts | None | Recharts already installed + data transformation utility |
| Side-by-side comparison | None | CSS Grid + reuse existing chart components |
| Pattern observations | None | Custom rule engine with template literals (~150 LOC) |

**Total new library code: 0 bytes. Total new application code: ~200-300 lines of TypeScript.**

The existing stack (Next.js 16, React 19, Recharts 3.6, Tailwind 4, shadcn/ui, Prisma 7) already has everything needed.

### Optional Upgrade

| Package | Current | Latest | Recommendation |
|---------|---------|--------|---------------|
| Recharts | ^3.6.0 | 3.7.0 | Optional bump for bug fixes. Not required for v3.1 features. |

---

## Schema Additions Needed

The current `BrandSnapshot` model stores `demographicsJson` as a `Json?` field, which already contains the full `AggregatedDemographics` object. For v3.1, the schema likely needs:

| Addition | Purpose | Location |
|----------|---------|----------|
| Ad creative hooks storage | Store extracted hooks per snapshot to avoid re-extraction | New field on `BrandSnapshot` or new `AdHook` model |
| Observations cache | Store generated observations per snapshot | New `Json?` field on `BrandSnapshot` or computed on read |

**Recommendation:** Store hooks as `hooksJson: Json?` on `BrandSnapshot` (an array of `{ text, reach, frequency }` objects). Observations should be computed on read (they are cheap to generate and should reflect the latest rules).

---

## Alternatives Considered and Rejected

### For Hook Extraction

| Alternative | Why Rejected |
|-------------|-------------|
| OpenAI / LLM API call | Adds cost per request, latency, external dependency. Ad copy is structured short text. Regex handles it. |
| compromise (14.14.5) | 200KB+ bundle for sentence splitting we can do in one line of regex. Ad bodies are 1-3 sentences, not complex prose. |
| wink-nlp (2.4.0) | Requires 1MB language model. Excellent for real NLP tasks, unnecessary here. |

### For Similarity

| Alternative | Why Rejected |
|-------------|-------------|
| TF-IDF + cosine similarity | Overkill for short strings (5-15 words). TF-IDF shines on documents, not sentences. Dice on bigrams is simpler and effective for short text matching. |
| Embedding-based similarity (OpenAI embeddings) | External API cost, latency. The hooks are short English phrases -- character-level similarity is sufficient for grouping "Get 50% off now" with "Get 50% off today". |
| ml-kmeans / figue | K-means requires knowing cluster count upfront. Greedy single-pass clustering with a similarity threshold is more appropriate when cluster count is unknown and data is small. |

### For Charts

| Alternative | Why Rejected |
|-------------|-------------|
| Victory / visx / Nivo | Already using Recharts extensively. Switching or adding a second charting library creates inconsistency and bundle bloat. Recharts handles all needed chart types. |
| D3 directly | Lower level, more work, no React integration. Recharts wraps D3 already. |

### For Observations

| Alternative | Why Rejected |
|-------------|-------------|
| LLM-generated insights | Adds cost, latency, non-determinism. Rule-based observations are deterministic, instant, and free. LLM insights could be a future v3.2+ enhancement for "deeper analysis." |
| Template engine (Handlebars, Mustache) | Overkill. JS template literals with conditional logic are more readable and type-safe than a template language for this use case. |

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| No new deps needed for hooks | HIGH | Ad creative text is already in `FacebookAdResult.creativeBody`. Regex sentence splitting + Dice similarity are well-understood algorithms. Verified the data shape in `facebook-api.ts`. |
| Recharts for trend charts | HIGH | Verified existing `TrendChart` component uses the exact same Recharts pattern needed. `demographicsJson` is already stored per snapshot. |
| Side-by-side comparison | HIGH | Verified existing `DemographicsComparison` component and chart components. This is a layout + composition change, not a technology change. |
| Rule-based observations | HIGH | Verified `BrandSnapshot` schema has all required fields (dominant gender/age, top countries, percentages). Rules operate on structured data that already exists. |

---

## Sources

- [winkNLP documentation](https://winkjs.org/wink-nlp/) - Evaluated for hook extraction, rejected as overkill
- [compromise GitHub](https://github.com/spencermountain/compromise) - Evaluated for sentence extraction, rejected as overkill
- [CmpStr GitHub](https://github.com/komed3/cmpstr) - Evaluated for string similarity, rejected (trivially implementable)
- [Recharts documentation](https://recharts.org/) - Already in use, confirmed AreaChart stackOffset support
- [string-comparison npm](https://www.npmjs.com/package/string-comparison) - Evaluated, rejected (unmaintained)
- npm registry (direct queries for version verification): compromise 14.14.5, string-comparison 1.3.0, natural 8.1.0, wink-nlp 2.4.0, cmpstr 3.2.1, recharts 3.7.0
