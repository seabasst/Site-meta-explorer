# Phase 70: Auto-Enrichment from Ad Data - Research

**Researched:** 2026-04-04
**Domain:** AI-powered brand profile enrichment from ad library data
**Confidence:** HIGH

## Summary

This phase builds an enrichment pipeline that reads existing ad classifications, analyses, and metadata from the database and uses an LLM to synthesize them into BrandProfile fields. The codebase already has all the raw data sources needed (AdClassification with 8-category taxonomy, AdAnalysis with tone/style/audience, AdLibraryAd with copy/CTA/targeting, BrandAnalysisCache with diversity scores), plus an established cost tracking system and brand profile update API.

The enrichment is fundamentally a "read DB data, synthesize with LLM, write to BrandProfile" pipeline. No new data sources are needed. The main engineering challenge is (a) gathering and formatting the right input data, (b) prompt engineering to extract profile-relevant fields, and (c) change detection to avoid redundant LLM calls.

**Primary recommendation:** Build a single API endpoint `POST /api/brand-profiles/[id]/enrich` that gathers ad data for the profile's linked competitors (or a specified AdLibraryBrand), synthesizes via Haiku, and patches the BrandProfile. Use a hash of input data stored on the profile for change detection.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing | Query ad classifications, analyses, and brand data | Already used everywhere |
| @anthropic-ai/sdk | existing | LLM call to synthesize ad data into profile fields | Already used in classify, diversity, interview routes |
| zod | existing | Validate enrichment request params | Already used in brand-profiles routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cost-tracker | existing (`src/lib/classification/cost-tracker.ts`) | Log enrichment API costs, check daily budget | Every LLM call |
| crypto (Node built-in) | N/A | SHA-256 hash for change detection | Computing input data fingerprint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Haiku 4.5 for synthesis | Sonnet 4 | Haiku is 3x cheaper ($1/$5 vs $3/$15 per M tokens) and sufficient for structured extraction from already-classified data |
| Hash-based change detection | Timestamp comparison | Hash is more reliable -- timestamps can miss cases where data was re-ingested at same time |

**Installation:**
No new packages needed. Everything is already in the project.

## Architecture Patterns

### Data Flow
```
User clicks "Auto-Enrich" on BrandProfile page
    |
    v
POST /api/brand-profiles/[id]/enrich
    |
    v
1. Load BrandProfile (get linked competitors / own brand pageId)
2. Query AdLibraryAd + AdClassification + AdAnalysis for that brand
3. Compute input hash (SHA-256 of classification summary)
4. Compare hash to stored enrichmentHash on profile
5. If unchanged: return early (skip LLM call)
6. If changed: format data, call Haiku, parse response
7. Merge extracted fields into BrandProfile (only fill empty fields by default, or force-overwrite option)
8. Store new enrichmentHash + enrichedAt timestamp
9. Log cost via cost-tracker
10. Return updated profile
```

### Recommended Project Structure
```
src/
  lib/
    enrichment/
      enrich-from-ads.ts        # Core pipeline: gather data, call LLM, return profile fields
      enrichment-hash.ts         # Input data hashing for change detection
  app/
    api/
      brand-profiles/
        [id]/
          enrich/
            route.ts             # API endpoint
```

### Pattern 1: Input Data Gathering
**What:** Aggregate ad data into a compact LLM-ready summary
**When to use:** Before the enrichment LLM call
**Key insight:** The DB already has rich structured data. We don't need the LLM to classify -- we need it to synthesize patterns into natural-language profile fields.

Data sources available per brand (via AdLibraryBrand.pageId):
1. **AdClassification** (8 categories per ad): messagingAngle distribution, intendedAudience distribution, hookTactic patterns, awarenessStage balance
2. **AdAnalysis** (per ad): emotionalTone, visualStyle, targetAudience, messagingAngle (natural language)
3. **AdLibraryAd** (raw): body text (ad copy samples), ctaType/ctaText, linkUrl (product pages), bylines (partnership info)
4. **AdLibraryBrand**: category, website
5. **BrandAnalysisCache**: pre-computed diversity scores, funnel balance, distribution data

### Pattern 2: Selective Merge (Don't Overwrite User Input)
**What:** Only populate empty/null fields unless user explicitly requests overwrite
**When to use:** When writing enrichment results back to BrandProfile
**Example:**
```typescript
interface EnrichmentOptions {
  profileId: string;
  brandPageId: string;      // Which AdLibraryBrand to source data from
  forceOverwrite?: boolean; // Default false: only fill empty fields
}

// After LLM extraction:
const updates: Partial<BrandProfileUpdate> = {};
if (!profile.brandVoice || options.forceOverwrite) {
  updates.brandVoice = extracted.brandVoice;
}
if (profile.demographics.length === 0 || options.forceOverwrite) {
  updates.demographics = extracted.demographics;
}
// ... etc for each field
```

### Pattern 3: Change Detection via Input Hash
**What:** Hash the input data to detect if re-enrichment would produce different results
**When to use:** Before making the LLM call
**Example:**
```typescript
import { createHash } from 'crypto';

function computeEnrichmentHash(data: {
  classificationSummary: Record<string, Record<string, number>>;
  adCount: number;
  topAdBodies: string[];
}): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
```

### Anti-Patterns to Avoid
- **Sending full ad bodies to LLM:** Too expensive. Send top 5-10 representative ad bodies + aggregate classification data instead.
- **Re-enriching on every page load:** Must be user-triggered with change detection guard.
- **Overwriting user-edited fields:** Default to fill-empty-only. User edits are sacred.
- **Enriching without linked brand:** Profile must be linked to an AdLibraryBrand (via competitors or explicit selection) to have data to enrich from.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cost tracking | Custom cost logger | `logApiCost()` from `src/lib/classification/cost-tracker.ts` | Already tracks per-model, per-operation costs with daily aggregation |
| Daily budget check | Custom budget logic | `getDailySpend()` from cost-tracker | Already exists, just compare against threshold |
| Profile update API | Raw Prisma calls in enrichment | Call existing `PUT /api/brand-profiles/[id]` logic or reuse its Prisma pattern | Validation already exists |
| LLM response parsing | Custom parser | Existing pattern: `response.content.filter(b => b.type === 'text')` + JSON.parse with cleanup | Used consistently across codebase |

## Common Pitfalls

### Pitfall 1: No Ad Data Available
**What goes wrong:** User's brand profile has no linked AdLibraryBrand, or the brand has zero classified ads
**Why it happens:** New profile with no competitors linked, or brand not yet ingested/classified
**How to avoid:** Check prerequisites before attempting enrichment: (1) profile must have at least one BrandCompetitor OR the enrichment request must specify a pageId, (2) brand must have >= 3 classified ads
**Warning signs:** Empty classification query results

### Pitfall 2: LLM Hallucinating Profile Fields
**What goes wrong:** LLM invents demographics or voice that don't match the actual ad data
**Why it happens:** With limited ad data, the model fills gaps with plausible-sounding but fabricated info
**How to avoid:** (1) Send structured classification distributions, not just raw text. (2) Include explicit instruction: "Only extract information supported by the data. Return null for fields without evidence." (3) Use Haiku which is less prone to elaborate hallucination than Sonnet.
**Warning signs:** Enrichment produces very specific demographics for brands with < 5 classified ads

### Pitfall 3: Cost Runaway
**What goes wrong:** Enrichment called many times, burning through API budget
**Why it happens:** No budget cap, or change detection not working
**How to avoid:** (1) Check `getDailySpend()` against a cap (e.g., $2/day for enrichment). (2) Hash-based change detection prevents duplicate calls. (3) Rate limit: max 1 enrichment per profile per hour.
**Warning signs:** Daily spend spikes

### Pitfall 4: Schema Migration for Hash Storage
**What goes wrong:** Forgetting to add enrichmentHash/enrichedAt columns to BrandProfile
**Why it happens:** Phase requires a schema addition
**How to avoid:** Add `enrichmentHash String?` and `enrichedAt DateTime?` to BrandProfile model in prisma/schema.prisma as the first task
**Warning signs:** Change detection not possible without stored hash

## Code Examples

### Enrichment Data Gathering
```typescript
// Source: Based on existing /api/analyze/diversity/route.ts pattern
async function gatherEnrichmentInput(brandId: string) {
  const [brand, classifications, analyses, ads] = await Promise.all([
    prisma.adLibraryBrand.findUnique({
      where: { id: brandId },
      select: { pageName: true, category: true, website: true },
    }),
    prisma.adClassification.findMany({
      where: { ad: { brandId, isActive: true } },
      take: 100,
    }),
    prisma.adAnalysis.findMany({
      where: { ad: { brandId, isActive: true } },
      select: { emotionalTone: true, visualStyle: true, targetAudience: true, messagingAngle: true },
      take: 50,
    }),
    prisma.adLibraryAd.findMany({
      where: { brandId, isActive: true },
      select: { body: true, ctaType: true, ctaText: true, title: true },
      orderBy: { startDate: 'desc' },
      take: 20,
    }),
  ]);

  // Build classification distribution (reuse pattern from diversity route)
  const distribution: Record<string, Record<string, number>> = {};
  for (const key of CATEGORY_KEYS) {
    distribution[key] = {};
    for (const c of classifications) {
      const val = c[key as keyof typeof c] as string;
      if (val) distribution[key][val] = (distribution[key][val] || 0) + 1;
    }
  }

  // Sample ad bodies (top 10 unique, deduplicated)
  const uniqueBodies = [...new Set(ads.map(a => a.body).filter(Boolean))].slice(0, 10);

  return { brand, distribution, analyses, uniqueBodies, adCount: classifications.length };
}
```

### Enrichment LLM Prompt
```typescript
const ENRICHMENT_SYSTEM = `You are a brand analyst. Given ad library data for a brand, extract brand profile information. Only extract what is clearly supported by the data. Return null for any field without strong evidence.`;

const prompt = `Analyze this brand's ad library data and extract profile fields.

**Brand:** ${brand.pageName}
**Category:** ${brand.category || 'Unknown'}
**Website:** ${brand.website || 'Unknown'}
**Active Ads Analyzed:** ${adCount}

**Ad Classification Distribution (what types of ads they run):**
${JSON.stringify(distribution, null, 2)}

**Sample Ad Copy (most recent 10):**
${uniqueBodies.map((b, i) => `${i + 1}. ${b?.slice(0, 200)}`).join('\n')}

**Ad Tone/Style Analysis:**
${analyses.slice(0, 10).map(a =>
  `- Tone: ${a.emotionalTone || '?'}, Style: ${a.visualStyle || '?'}, Audience: ${a.targetAudience || '?'}`
).join('\n')}

Extract these fields:
{
  "brandVoice": "2-3 sentence description of brand's communication tone based on ad copy patterns, or null",
  "positioning": "1-2 sentence market positioning based on messaging angles and offer types, or null",
  "demographics": ["array of target demographic segments based on intendedAudience distribution and ad targeting"],
  "interests": ["array of audience interests inferred from ad themes and messaging"],
  "painPoints": ["array of customer pain points addressed in ad copy"],
  "missionStatement": "1 sentence brand mission if clearly evident from ads, or null"
}

Return ONLY valid JSON. No markdown.`;
```

### Cost Budget Check
```typescript
// Source: Pattern from src/lib/classification/cost-tracker.ts
const ENRICHMENT_DAILY_BUDGET = 2.0; // $2/day cap for enrichment operations

async function checkEnrichmentBudget(): Promise<{ allowed: boolean; spent: number }> {
  const spent = await getDailySpend();
  // Filter to enrichment operations specifically would be better,
  // but total daily spend as a safety net works too
  return { allowed: spent < ENRICHMENT_DAILY_BUDGET, spent };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrandGuidelines (single table, user-only) | BrandProfile (multi-table, AI-enrichable) | Phase 68 (v9.0) | Profile can now be populated from multiple sources |
| Manual-only profile entry | Manual + AI interview (Phase 69) | Phase 69 | Interview extracts fields from conversation |
| No ad data -> profile connection | BrandCompetitor links profile to AdLibraryBrand | Phase 68 | Enables this phase -- profile knows which brands to source from |

## BrandProfile Field Mapping

What ad data can populate which profile fields:

| Profile Field | Data Source | Extraction Method | Confidence |
|---------------|-----------|-------------------|------------|
| brandVoice | Ad copy samples (body, title) + AdAnalysis.emotionalTone | LLM synthesis of tone patterns | HIGH |
| positioning | AdClassification.messagingAngle + .offerType distribution | LLM synthesis of market position from ad strategy | MEDIUM |
| demographics | AdClassification.intendedAudience distribution + AdAnalysis.targetAudience | LLM maps classification values to demographic labels | HIGH |
| interests | Ad copy themes + AdClassification.hookTactic patterns | LLM infers interests from messaging themes | MEDIUM |
| painPoints | Ad copy (body) - problem/solution language | LLM extracts pain points from ad copy | MEDIUM |
| missionStatement | Ad copy + brand category | LLM synthesizes (low confidence, often null) | LOW |
| primaryColor / secondaryColor | AdAnalysis.colorPalette | Direct extraction (no LLM needed) | HIGH |
| logoUrl | AdLibraryBrand.profilePicUrl | Direct mapping (no LLM needed) | HIGH |

## Schema Addition Required

```prisma
model BrandProfile {
  // ... existing fields ...

  // Enrichment tracking (new fields)
  enrichmentHash   String?    // SHA-256 prefix of input data for change detection
  enrichedAt       DateTime?  // When last enrichment ran
  enrichmentSource String?    // "ad-library" | "website" | "interview"
}
```

## Open Questions

1. **Which brand to enrich from?**
   - What we know: BrandProfile has `competitors` linking to AdLibraryBrand. The profile itself has no direct link to "own brand" in the ad library.
   - What's unclear: Should user pick which competitor to enrich from? Or should we infer "own brand" from profile name matching AdLibraryBrand.pageName?
   - Recommendation: Add a `sourcePageId` parameter to the enrich endpoint. UI should offer a dropdown of linked competitors + any brand matching profile name. This avoids schema changes beyond the hash/timestamp fields.

2. **Merge strategy for arrays (demographics, interests, painPoints)**
   - What we know: These are string arrays. User may have manually entered some values.
   - What's unclear: Should enrichment append new values or replace?
   - Recommendation: Append-and-deduplicate for arrays when `forceOverwrite=false`. Replace when `forceOverwrite=true`.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - Full data model reviewed (BrandProfile, AdClassification, AdAnalysis, AdLibraryAd, BrandAnalysisCache)
- `src/lib/brand-context.ts` - compileBrandContext utility, character-based budgeting pattern
- `src/lib/brand-profile-types.ts` - BrandProfileFull type definition
- `src/lib/classification/cost-tracker.ts` - Existing cost tracking with getDailySpend()
- `src/app/api/analyze/diversity/route.ts` - Classification aggregation pattern, LLM call pattern
- `src/app/api/brand-profiles/[id]/route.ts` - Profile update validation and Prisma pattern
- `src/app/api/brand-profiles/interview/route.ts` - AI-based field extraction pattern
- `src/app/api/creative-lab/scrape-brand/route.ts` - Website-based brand extraction (Haiku)

### Secondary (MEDIUM confidence)
- `src/lib/creative-lab/creative-director.ts` - Multi-source LLM synthesis pattern
- `src/app/dashboard/v2/creative-lab/strategy-view.tsx` - UI pattern for triggering analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Pattern directly follows existing diversity analysis + brand profile update flows
- Pitfalls: HIGH - Based on concrete codebase analysis, all data models verified
- Field mapping: MEDIUM - LLM extraction quality for positioning/interests is inherently variable

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- all patterns are internal to this codebase)
