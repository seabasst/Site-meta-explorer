# Phase 28: Hook Extraction Engine - Research

**Researched:** 2026-02-02
**Domain:** Text extraction, normalization, database persistence (Prisma/PostgreSQL)
**Confidence:** HIGH

## Summary

Phase 28 builds the data layer for hook extraction: extracting the first sentence from each ad's creative body, normalizing and grouping identical hooks, computing reach-weighted metrics, and persisting hooks to the database for saved brands.

The codebase already has a basic hook-counting mechanism in `src/lib/brand-analyzer.ts` (lines 162-176) that extracts first sentences and counts unique hooks. However, it only uses `ad.creativeBody` which maps to `ad_creative_bodies?.[0]` -- the Facebook API returns an **array** of creative bodies per ad (line 55 of `facebook-api.ts`: `ad_creative_bodies?: string[]`), but only the first element is currently used (line 741). This phase must expand to process all creative bodies.

The persistence model follows the established pattern: a new Prisma model linked to `TrackedBrand` (similar to `BrandSnapshot`), populated during the save-brand flow and during re-analysis via the snapshots POST endpoint.

**Primary recommendation:** Create a `src/lib/hook-extractor.ts` module with pure extraction/normalization/grouping logic, add a `HookGroup` Prisma model linked to `BrandSnapshot`, and wire extraction into both the save-brand and re-analysis flows.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (already in project) | Database schema, migrations, queries | Already used for all persistence |
| PostgreSQL | (already configured) | Data storage | Already the project database |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No additional libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Storing hooks as separate rows | JSON column on BrandSnapshot | JSON loses queryability; separate rows enable future cross-brand hook comparison and OBSV-04 |
| Regex-based sentence splitting | NLP library (compromise, nlp.js) | Over-engineering per REQUIREMENTS.md out-of-scope: "Fuzzy/semantic hook clustering" is explicitly excluded |

**Installation:**
```bash
# No new packages needed - uses existing Prisma + PostgreSQL
npx prisma migrate dev --name add-hook-groups
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    hook-extractor.ts     # Pure functions: extractHook(), normalizeHook(), groupHooks()
  app/
    api/
      brands/save/route.ts   # Modified: also persist hooks during save
      dashboard/snapshots/route.ts  # Modified: also persist hooks during re-analysis
prisma/
  schema.prisma              # Modified: add HookGroup model
```

### Pattern 1: Pure Extraction Module
**What:** All hook logic lives in a single `src/lib/hook-extractor.ts` module with zero side effects
**When to use:** Always -- this matches the project convention (see `snapshot-builder.ts`, `brand-analyzer.ts`)
**Example:**
```typescript
// src/lib/hook-extractor.ts

export interface HookGroupData {
  hookText: string;           // Original first-sentence text (first occurrence)
  normalizedText: string;     // Normalized version for grouping
  frequency: number;          // Number of ads using this hook
  totalReach: number;         // Sum of euTotalReach across all ads
  avgReachPerAd: number;      // totalReach / frequency
  adIds: string[];            // Ad IDs in this group
}

/**
 * Extract the opening hook (first sentence) from a creative body.
 * Splits on sentence-ending punctuation (.!?) or takes first ~100 chars.
 */
export function extractHook(text: string): string {
  const trimmed = text.trim();
  // Match first sentence ending with . ! or ?
  const match = trimmed.match(/^(.+?[.!?])\s/);
  if (match) return match[1].trim();
  // Fallback: if no sentence-ending punctuation, take first line or first 100 chars
  const firstLine = trimmed.split('\n')[0];
  return firstLine.length <= 100 ? firstLine : firstLine.slice(0, 100).trim();
}

/**
 * Normalize a hook for grouping: lowercase, strip emojis, strip punctuation, collapse whitespace, trim
 */
export function normalizeHook(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Pattern 2: Expand ad_creative_bodies Array
**What:** The Facebook API returns `ad_creative_bodies` as a string array. Currently only `[0]` is used. For hook extraction, process ALL elements.
**When to use:** During the hook extraction step only -- the existing `creativeBody` field on `FacebookAdResult` should remain as `[0]` for backward compatibility.
**Example:**
```typescript
// In the ad conversion step (facebook-api.ts line ~725), expose full array:
// Option A: Add a new field to FacebookAdResult
allCreativeBodies: ad.ad_creative_bodies || [],

// Option B: Process hooks from raw FacebookAdData before conversion
// (preferred -- avoids changing the widely-used FacebookAdResult interface)
```

### Pattern 3: Hook Persistence with BrandSnapshot
**What:** Hooks are stored per-snapshot (each re-analysis creates a new set of hooks alongside the snapshot)
**When to use:** When saving or re-analyzing a brand
**Example flow:**
```
1. fetchFacebookAds() returns result with ads[]
2. Extract hooks from all ad_creative_bodies across all ads
3. Group by normalizedText, compute metrics
4. In the same transaction as BrandSnapshot creation:
   - Create BrandSnapshot row
   - Create HookGroup rows linked to that snapshot
```

### Anti-Patterns to Avoid
- **Modifying the existing `FacebookAdResult.creativeBody` field:** This is used throughout the codebase (ad-preview-card, export-utils, brand-analyzer, spend-estimator). Changing it would break many consumers. Instead, add a separate extraction step.
- **Extracting hooks client-side:** Hooks should be computed server-side and persisted. The brand detail page (Phase 29) needs them without re-analysis.
- **Storing raw ad text in hook groups:** Only store the hook text itself and the ad IDs. The full ad data already exists in the API response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Emoji stripping | Character-by-character removal | Unicode regex range `[\u{1F300}-\u{1FAFF}]` etc. | Comprehensive coverage of all emoji ranges |
| Sentence splitting for multilingual text | Complex NLP sentence boundary detection | Simple regex `(.+?[.!?])\s` with newline fallback | Requirements explicitly exclude fuzzy/semantic clustering; simple approach covers 90%+ of ad copy which tends to be short, punchy sentences |
| Database migrations | Manual SQL | `npx prisma migrate dev` | Already the project standard |

**Key insight:** Ad copy is typically marketing text in simple sentence structures. A regex-based first-sentence extractor handles the vast majority of cases. The requirements explicitly exclude fuzzy/semantic clustering, so there is no need for NLP libraries.

## Common Pitfalls

### Pitfall 1: Only Processing ad_creative_bodies[0]
**What goes wrong:** Missing hooks from ads with multiple creative variants. The Facebook API can return 2-5 creative bodies per ad representing different A/B test variants.
**Why it happens:** The current code (line 741) only takes `[0]` for the `creativeBody` field on `FacebookAdResult`.
**How to avoid:** During hook extraction, access the raw `ad_creative_bodies` array. This means either: (a) passing the raw `FacebookAdData[]` to the hook extractor before it's converted to `FacebookAdResult[]`, or (b) adding an `allCreativeBodies` field to `FacebookAdResult`.
**Warning signs:** Hook count is suspiciously low compared to total ads.

### Pitfall 2: Empty or Very Short Hooks
**What goes wrong:** Hooks like "", ".", "a" polluting the results.
**Why it happens:** Some ads have very short or empty creative bodies. Sentence splitting on edge cases.
**How to avoid:** Set a minimum hook length threshold (e.g., 10 characters after normalization). Skip hooks that normalize to empty strings.
**Warning signs:** Hook groups with meaningless normalized text.

### Pitfall 3: Normalization Losing Too Much Information
**What goes wrong:** Over-aggressive normalization groups unrelated hooks together.
**Why it happens:** Stripping ALL punctuation, numbers, and special characters.
**How to avoid:** Keep numbers (they matter in marketing: "50% off" vs "20% off" are different hooks). Only strip emojis, punctuation at start/end, and collapse whitespace. Preserve interior punctuation selectively.
**Warning signs:** Very large hook groups with diverse original texts.

### Pitfall 4: BigInt Serialization in Hook Data
**What goes wrong:** JSON.stringify fails when hook data includes BigInt reach values.
**Why it happens:** PostgreSQL BigInt fields are not JSON-serializable (already seen in the codebase -- `serializeSnapshot` in snapshots/route.ts handles this).
**How to avoid:** Use the same serialization pattern already in the codebase: convert BigInt to Number before JSON serialization. Or use Int/Float for hook reach since individual hook reach values will not exceed Number.MAX_SAFE_INTEGER.
**Warning signs:** Runtime errors during API response serialization.

### Pitfall 5: Hook Count Explosion from Creative Body Variants
**What goes wrong:** If each ad has 3-5 creative bodies, total hooks processed could be 3-5x the ad count, leading to many near-duplicate hook groups.
**Why it happens:** A/B test variants of the same ad often have slightly different text.
**How to avoid:** Normalization handles many cases. Additionally, consider deduplicating hooks within a single ad's creative bodies before grouping across ads.
**Warning signs:** Total hook count >> total ad count with many frequency-1 groups.

### Pitfall 6: Forgetting to Persist Hooks in Both Save and Re-analysis Flows
**What goes wrong:** Hooks are available after initial analysis but missing after re-analysis, or vice versa.
**Why it happens:** Two separate code paths create brand data: `/api/brands/save` (initial save) and `/api/dashboard/snapshots` POST (re-analysis). Both need hook persistence.
**How to avoid:** Extract hook persistence into a shared function called from both routes.
**Warning signs:** Hooks appear on some brands but not others despite all having ad data.

## Code Examples

### First Sentence Extraction
```typescript
/**
 * Extract the first sentence from ad creative text.
 * Handles common ad copy patterns:
 * - Standard sentences ending with . ! ?
 * - Emoji-prefixed sentences
 * - Short punchy lines separated by newlines
 */
export function extractHook(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Try to find first sentence (ending with . ! ?)
  // The \s after punctuation ensures we don't split on "3.5" or "U.S."
  const sentenceMatch = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  if (sentenceMatch && sentenceMatch[1].length >= 10) {
    return sentenceMatch[1].trim();
  }

  // Fallback: first line (ads often use line breaks as separators)
  const firstLine = trimmed.split(/\n/)[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 150) {
    return firstLine;
  }

  // Last resort: truncate
  return trimmed.slice(0, 100).trim();
}
```

### Normalization Function
```typescript
// Emoji regex covers most common ranges
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2700}-\u{27BF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/gu;

export function normalizeHook(text: string): string {
  return text
    .toLowerCase()
    .replace(EMOJI_REGEX, '')        // Strip emojis
    .replace(/[^\w\s\d]/g, '')       // Strip punctuation (keep letters, numbers, spaces)
    .replace(/\s+/g, ' ')            // Collapse whitespace
    .trim();
}
```

### Grouping Function
```typescript
export interface RawAdHook {
  adId: string;
  hookText: string;         // Original extracted text
  euTotalReach: number;
}

export function groupHooks(hooks: RawAdHook[]): HookGroupData[] {
  const groups = new Map<string, {
    hookText: string;        // Keep first occurrence as display text
    adIds: string[];
    totalReach: number;
  }>();

  for (const hook of hooks) {
    const normalized = normalizeHook(hook.hookText);
    if (normalized.length < 5) continue; // Skip very short/empty

    const existing = groups.get(normalized);
    if (existing) {
      existing.adIds.push(hook.adId);
      existing.totalReach += hook.euTotalReach;
    } else {
      groups.set(normalized, {
        hookText: hook.hookText,
        adIds: [hook.adId],
        totalReach: hook.euTotalReach,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([normalizedText, data]) => ({
      hookText: data.hookText,
      normalizedText,
      frequency: data.adIds.length,
      totalReach: data.totalReach,
      avgReachPerAd: data.adIds.length > 0 ? data.totalReach / data.adIds.length : 0,
      adIds: data.adIds,
    }))
    .sort((a, b) => b.totalReach - a.totalReach); // Sort by total reach descending
}
```

### Prisma Schema Addition
```prisma
model HookGroup {
  id             String   @id @default(cuid())
  hookText       String   // Original text of the hook (first occurrence)
  normalizedText String   // Normalized version used for grouping
  frequency      Int      // Number of ads with this hook
  totalReach     BigInt   // Sum of euTotalReach across all ads
  avgReachPerAd  Float    // totalReach / frequency
  adIds          Json     // Array of ad IDs in this group (string[])
  createdAt      DateTime @default(now())

  // Relations
  snapshotId     String
  snapshot       BrandSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@index([snapshotId])
  @@index([snapshotId, totalReach])  // For sorted queries
}
```

### Integration Point: Snapshot Creation
```typescript
// Shared function used by both brands/save and dashboard/snapshots
async function persistHooksForSnapshot(
  tx: PrismaTransactionClient,
  snapshotId: string,
  ads: FacebookAdData[]   // Raw API data with full ad_creative_bodies[]
): Promise<void> {
  // 1. Extract hooks from ALL creative bodies of ALL ads
  const rawHooks: RawAdHook[] = [];
  for (const ad of ads) {
    const bodies = ad.ad_creative_bodies || [];
    const seenNormalized = new Set<string>(); // Dedupe within single ad
    for (const body of bodies) {
      const hookText = extractHook(body);
      const normalized = normalizeHook(hookText);
      if (normalized.length >= 5 && !seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        rawHooks.push({
          adId: ad.id,
          hookText,
          euTotalReach: ad.eu_total_reach || 0,
        });
      }
    }
  }

  // 2. Group hooks
  const groups = groupHooks(rawHooks);

  // 3. Persist (batch create)
  if (groups.length > 0) {
    await tx.hookGroup.createMany({
      data: groups.map(g => ({
        hookText: g.hookText,
        normalizedText: g.normalizedText,
        frequency: g.frequency,
        totalReach: BigInt(g.totalReach),
        avgReachPerAd: g.avgReachPerAd,
        adIds: g.adIds,
        snapshotId,
      })),
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Only use ad_creative_bodies[0] | Process all creative bodies per ad | This phase | 3-5x more hooks extracted per analysis |
| Hooks computed client-side only (brand-analyzer.ts) | Hooks persisted server-side in database | This phase | Available on brand detail page without re-analysis |
| Simple uniqueHooksCount KPI | Full hook group data with reach metrics | This phase | Enables Phase 29 UI and Phase 31 OBSV-04 |

**Deprecated/outdated:**
- The existing `analyzeMessaging()` hook counting in `brand-analyzer.ts` (lines 162-176) becomes partially redundant. It should continue to work for the `uniqueHooksCount` KPI but the richer hook data will come from the new extractor.

## Open Questions

1. **Should raw FacebookAdData be passed to the hook extractor?**
   - What we know: The hook extractor needs `ad_creative_bodies` (full array), `id`, and `eu_total_reach` from each ad. These exist on `FacebookAdData` but `FacebookAdResult` only has `creativeBody` (first element).
   - What's unclear: Whether it's cleaner to add `allCreativeBodies: string[]` to `FacebookAdResult` or to run extraction on raw `FacebookAdData[]` before the conversion step.
   - Recommendation: Pass raw `FacebookAdData[]` to the hook extractor. This avoids modifying the widely-used `FacebookAdResult` interface. The raw data is available in both the facebook-ads route (before returning to client) and the snapshots route (in the `fetchFacebookAds` return).

2. **Hook persistence granularity: per-snapshot or per-brand?**
   - What we know: Requirements say hooks are "available on brand detail page without re-analysis" (HOOK-07). BrandSnapshots are per-analysis, meaning each re-analysis creates a new snapshot.
   - What's unclear: Should hooks be linked to the latest snapshot (and thus replaced on re-analysis) or accumulated across snapshots?
   - Recommendation: Link hooks to `BrandSnapshot`. The UI (Phase 29) always shows the latest snapshot's hooks. This matches how other snapshot data works. Historical hook comparison could be added later by querying older snapshots.

3. **Should the save-brand flow also have access to raw ad data for hook extraction?**
   - What we know: Currently, `handleSaveBrand` in `page.tsx` sends a snapshot object to `/api/brands/save`, but the raw ad data only exists in the client's `apiResult.ads[]`. The save route does NOT re-fetch from Facebook.
   - What's unclear: How to get full `ad_creative_bodies[]` to the save route since `FacebookAdResult.creativeBody` only contains `[0]`.
   - Recommendation: Two options: (a) Send extracted hook data from the client alongside the snapshot, or (b) have the save route do a lightweight re-fetch. Option (a) is simpler and faster. The client already has `apiResult` which contains the full API response. Add hook extraction on the server before save, passing the raw ads in the request body, OR compute hooks client-side and send them. Given the data size, sending hook group summaries (not raw ads) is best.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - `src/lib/facebook-api.ts` (line 55: `ad_creative_bodies?: string[]`, line 741: `ad_creative_bodies?.[0]`)
- **Codebase inspection** - `src/lib/brand-analyzer.ts` (lines 162-176: existing hook counting)
- **Codebase inspection** - `prisma/schema.prisma` (TrackedBrand, BrandSnapshot models)
- **Codebase inspection** - `src/app/api/brands/save/route.ts` (save flow with transaction)
- **Codebase inspection** - `src/app/api/dashboard/snapshots/route.ts` (re-analysis flow)
- **Codebase inspection** - `src/lib/snapshot-builder.ts` (snapshot data extraction pattern)

### Secondary (MEDIUM confidence)
- **Facebook Ad Library API documentation** - `ad_creative_bodies` is documented as `list<string>`, confirming it is an array of text variants per ad

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, pure codebase extension
- Architecture: HIGH - Follows established patterns (snapshot-builder.ts, brand-analyzer.ts)
- Pitfalls: HIGH - Identified from direct codebase analysis and data flow tracing
- Hook extraction logic: HIGH - Simple regex-based text processing, explicitly scoped by requirements (no fuzzy/semantic clustering)
- Persistence model: HIGH - Follows existing Prisma patterns exactly

**Research date:** 2026-02-02
**Valid until:** No expiry (internal codebase patterns, no external dependency concerns)
