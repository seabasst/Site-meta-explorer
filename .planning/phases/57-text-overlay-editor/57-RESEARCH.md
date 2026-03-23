# Phase 57: AI Creative Generation - Research

**Researched:** 2026-03-23
**Domain:** AI-driven ad creative generation from analysis gaps, using existing Replicate/Claude infrastructure
**Confidence:** HIGH (building on existing, well-understood codebase)

## Summary

This phase transforms the Creative Lab from a manual "analyze then pick one recommendation" flow into an AI-driven generation pipeline where the system pre-fills an entire generation config screen from analysis gaps, brand guidelines, and competitor data. The user confirms and generates multiple ads at once.

The existing infrastructure is substantial: the diversity analysis API already produces structured recommendations with image prompts, the benchmark API identifies gaps vs. category averages, brand guidelines store colors/voice/audience, and the Replicate Flux Schnell integration handles image generation. The main work is (1) a new API endpoint that synthesizes all data sources into a pre-filled config, (2) a new orchestration API that generates multiple images in parallel, and (3) a complete redesign of the Creative Lab page from the current multi-step wizard into a single config screen with gallery output.

**Primary recommendation:** Build a new `/api/creative-lab/generate-config` endpoint that combines diversity analysis + benchmark gaps + brand guidelines into a structured generation plan, then a `/api/creative-lab/generate-batch` endpoint that orchestrates parallel Replicate calls. The frontend is a single config screen (not a wizard) with a gallery results view.

## Standard Stack

### Core (Already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.78.0 | Claude API for generating config suggestions and copy | Already used in diversity analysis |
| Replicate API (fetch) | REST | Flux Schnell image generation | Already integrated in generate-image route |
| Prisma | ^7.4.2 | ORM for brand guidelines, analysis cache, brand data | Already the project's ORM |
| React 19 | 19.2.3 | UI components | Project standard |
| Tailwind CSS v4 | ^4 | Styling | Project standard |
| lucide-react | ^0.563.0 | Icons | Project standard |
| zod | ^4.3.6 | Request validation | Already in project |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jszip | ^3.10.1 | Client-side zip creation for "Download All" | When user downloads multiple generated images as zip |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jszip | client-zip | client-zip is smaller (2.6KB) and faster but no compression; jszip is more mature and battle-tested |
| Client-side zip | Server-side zip via API route | Server-side adds complexity and bandwidth cost; client-side keeps it simple since images are already fetched |
| Flux Schnell | Flux Pro | Pro has better quality but is slower and more expensive; Schnell is ~1.5s per image which suits interactive UX |

**Installation:**
```bash
npm install jszip
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   └── creative-lab/
│   │       ├── generate-config/route.ts    # NEW: AI builds pre-filled config from gaps + guidelines
│   │       └── generate-batch/route.ts     # NEW: Orchestrates parallel image generation
│   └── dashboard/v2/creative-lab/
│       ├── page.tsx                        # REWRITE: Single config screen + gallery
│       ├── config-screen.tsx               # NEW: Pre-filled generation config (main UI)
│       ├── suggestion-card.tsx             # NEW: Individual suggestion with reasoning
│       ├── generation-gallery.tsx          # NEW: Gallery of generated results
│       ├── format-selector.tsx             # KEEP: Reusable format selection grid
│       ├── generation-results.tsx          # DEPRECATE: Replaced by generation-gallery
│       └── benchmark-comparison.tsx        # KEEP: Used in analysis display
```

### Pattern 1: AI Config Generation (Server-Side)
**What:** A single API call that combines 3 data sources (diversity analysis cache, benchmark gaps, brand guidelines) into a structured generation plan with reasoning.
**When to use:** When user navigates from analysis to generation, or enters Creative Lab for a brand that has cached analysis.
**Example:**
```typescript
// POST /api/creative-lab/generate-config
// Input: { pageId: string, category?: string }
// Output: GenerationConfig

interface GenerationSuggestion {
  id: string;                    // Unique ID for this suggestion
  pillar: string;                // Which gap this addresses
  reasoning: string;             // WHY this ad was suggested (user-facing)
  format: string;                // Suggested ad format (story, square, etc.)
  aspectRatio: string;           // e.g., "1:1", "9:16"
  tone: string;                  // Suggested tone/angle
  visualStyle: string;           // Suggested visual direction
  journeyPhase: string;          // awareness/consideration/conversion
  copyAngle: string;             // Headline/body direction
  imagePrompt: string;           // Pre-built prompt for Flux
  priority: 'high' | 'medium' | 'low';
}

interface GenerationConfig {
  brandName: string;
  suggestions: GenerationSuggestion[];  // 3-7 pre-filled suggestions
  brandContext: {                        // From brand guidelines
    colors: string[];
    voice: string | null;
    audience: string[];
  };
  gapSummary: string;                   // Brief explanation of what gaps exist
}
```

### Pattern 2: Parallel Image Generation with Progressive Loading
**What:** Generate multiple images simultaneously via Replicate, streaming results to the client as each completes.
**When to use:** When user clicks "Generate" on the config screen.
**Example:**
```typescript
// Client-side: fire all generation requests in parallel
const generateAll = async (suggestions: GenerationSuggestion[]) => {
  // Initialize all as loading
  setResults(suggestions.map(s => ({ ...s, status: 'loading', imageUrl: null })));

  // Fire all in parallel, update each individually as it resolves
  const promises = suggestions.map(async (suggestion, index) => {
    try {
      const res = await fetch('/api/creative-lab/generate-batch', {
        method: 'POST',
        body: JSON.stringify({
          prompt: suggestion.imagePrompt,
          aspectRatio: suggestion.aspectRatio,
          useBrandGuidelines: true,
        }),
      });
      const data = await res.json();
      setResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'success', imageUrl: data.imageUrl } : r
      ));
    } catch {
      setResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'error' } : r
      ));
    }
  });

  await Promise.allSettled(promises);
};
```

### Pattern 3: Single Config Screen Layout
**What:** All options visible on one page, not a wizard. AI pre-fills everything. Advanced settings behind a "Customize" disclosure.
**When to use:** The main generation interface.
**Layout guidance:**
```
+---------------------------------------------------+
| Gap Summary Banner (1-2 sentences)                |
+---------------------------------------------------+
| Suggestion Cards (3-7)                             |
| +------------------+ +------------------+          |
| | [x] Story Ad     | | [x] Square Ad   |          |
| | Gap: Visual div. | | Gap: Tone div.  |          |
| | Reasoning...     | | Reasoning...    |          |
| | [Edit prompt]    | | [Edit prompt]   |          |
| +------------------+ +------------------+          |
+---------------------------------------------------+
| [v Customize] (collapsed)                          |
| - Brand colors override                            |
| - Custom prompt additions                          |
+---------------------------------------------------+
| [Generate X Images]  button                        |
+---------------------------------------------------+
```

### Anti-Patterns to Avoid
- **Multi-step wizard:** Context says "single config screen, not wizard." Everything on one page.
- **Empty state requiring manual input:** AI should pre-fill everything. User should be able to hit Generate immediately without any manual configuration.
- **Sequential image generation:** Generate all images in parallel (Promise.allSettled), not one-by-one. Show progressive loading.
- **Blocking on benchmark data:** If benchmark data is not available, still generate based on diversity analysis alone. Benchmark enriches but should not block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP file creation | Custom server-side archive | jszip (client-side) | Battle-tested, works in all browsers, images already in memory |
| Image download | Custom binary stream handler | Blob + URL.createObjectURL (existing pattern) | Already working in generation-results.tsx |
| Form state management | Custom state with useState | Simple useState (sufficient for this UI) | Config screen is not complex enough to warrant react-hook-form |
| Prompt engineering | Hardcoded prompt templates | Claude API call to generate prompts from structured data | Claude can synthesize gaps + guidelines + competitor patterns into better prompts than templates |
| Polling for Replicate completion | Custom retry loop | Existing pattern from generate-image route | Already works, just replicate it for batch |

## Common Pitfalls

### Pitfall 1: Replicate Rate Limits with Parallel Calls
**What goes wrong:** Firing 7 parallel image generation requests might hit Replicate rate limits.
**Why it happens:** Free/basic Replicate plans have concurrency limits.
**How to avoid:** Use Promise.allSettled with a concurrency limiter (max 3 concurrent). Process in batches of 3.
**Warning signs:** 429 errors from Replicate API.

### Pitfall 2: CORS Issues with Image Downloads for ZIP
**What goes wrong:** Fetching generated images from Replicate URLs to create a ZIP may fail due to CORS.
**Why it happens:** Replicate output URLs are on a different domain.
**How to avoid:** Proxy images through the app's own API route, OR use the existing pattern in generation-results.tsx which already does cross-origin fetch for download.
**Warning signs:** CORS errors in console when trying to fetch image blobs.

### Pitfall 3: Lost Analysis Context Between Pages
**What goes wrong:** If user navigates away from analysis and comes back to generate, analysis data is lost.
**Why it happens:** Current page.tsx stores everything in component state.
**How to avoid:** The generate-config API should look up the cached BrandAnalysisCache data, not rely on client-side state. This is already available via the existing analysis caching in the diversity API.
**Warning signs:** User sees empty config screen after navigation.

### Pitfall 4: Overly Long Claude Prompts for Config Generation
**What goes wrong:** Feeding all analysis data + all recommendations + full brand guidelines into Claude makes slow, expensive calls.
**Why it happens:** Trying to be comprehensive.
**How to avoid:** Pre-filter to top 5-7 gaps, truncate brand voice to 200 chars, send structured data not raw JSON. Use claude-sonnet-4-20250514 (already used in diversity API) which is fast and cheap.
**Warning signs:** Config generation taking >10s, high token usage.

### Pitfall 5: Brand Guidelines Being Optional
**What goes wrong:** Generating creatives without brand guidelines produces generic, off-brand results.
**Why it happens:** Brand guidelines require auth + manual setup (many users won't have them).
**How to avoid:** Degrade gracefully: without guidelines, use the brand's existing ad patterns (from diversity analysis) as style reference. Show a subtle prompt to set up guidelines.
**Warning signs:** Generated images look generic/unbranded.

## Code Examples

### Generating Config from Analysis Cache + Guidelines
```typescript
// /api/creative-lab/generate-config/route.ts
// Uses BrandAnalysisCache (already populated by diversity API)
// + BrandGuidelines (optional, from brand-guidelines API)
// + BenchmarkResult gaps (optional, from benchmark API)

const cache = await prisma.brandAnalysisCache.findUnique({
  where: { brandId: brand.id },
  include: { brand: true },
});

const guidelines = userId
  ? await prisma.brandGuidelines.findUnique({ where: { userId } })
  : null;

// Feed structured data to Claude for suggestion generation
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  messages: [{
    role: 'user',
    content: `Generate 5-7 ad creative suggestions for "${brand.pageName}" based on these gaps...

    Diversity Scores: ${JSON.stringify(scores)}
    Distribution: ${JSON.stringify(cache.distributionJson)}
    Brand Colors: ${colors.join(', ')}
    Brand Voice: ${guidelines?.brandVoice || 'Not specified'}
    Target Audience: ${guidelines?.demographics?.join(', ') || 'Not specified'}

    For each suggestion, provide:
    - Which gap it fills and WHY (1 sentence, user-facing reasoning)
    - Recommended format + aspect ratio
    - Visual style direction
    - Tone/angle
    - Image prompt for Flux Schnell (no text, high quality)
    - Priority (high/medium/low)

    Return JSON array...`
  }],
});
```

### Client-Side ZIP Download with JSZip
```typescript
import JSZip from 'jszip';

async function downloadAllAsZip(results: GenerationResult[]) {
  const zip = new JSZip();
  const successful = results.filter(r => r.status === 'success' && r.imageUrl);

  for (const result of successful) {
    const response = await fetch(result.imageUrl!);
    const blob = await response.blob();
    zip.file(`ad-creative-${result.suggestion.format}-${result.suggestion.id}.webp`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ad-creatives.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Progressive Loading UI Pattern
```typescript
// Each card shows its own loading state independently
function SuggestionResultCard({ result }: { result: GenerationResult }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      {result.status === 'loading' && (
        <div className="animate-pulse bg-slate-800/50 flex items-center justify-center"
             style={{ aspectRatio: result.aspectRatio }}>
          <Loader2 className="w-8 h-8 animate-spin text-[#1235e2]" />
        </div>
      )}
      {result.status === 'success' && (
        <img src={result.imageUrl} alt={result.reasoning} className="w-full" />
      )}
      {/* Reasoning always visible below image */}
      <div className="p-4">
        <p className="text-sm font-medium">{result.suggestion.pillar}</p>
        <p className="text-xs text-slate-400 mt-1">{result.reasoning}</p>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 57) | Impact |
|------------------------|-------------------------|--------|
| User selects ONE recommendation manually | AI pre-selects 5-7 suggestions based on gaps | User does minimal work |
| Single image generated at a time | Batch parallel generation | Much faster workflow |
| Manual format selection per image | Format pre-assigned per suggestion | Less friction |
| No reasoning shown | Each suggestion explains WHY | User trusts AI decisions |
| Sequential download of individual images | ZIP download of all | Better UX for bulk output |
| Multi-step flow (search > analyze > pick > format > generate) | Single config screen (analysis pre-loaded, generate all) | Dramatically simplified |

**Current flow being replaced:**
The existing Creative Lab has 7 steps: setup > analyzing > results > brief > format-select > generating-image > image-result. The new flow has 3 states: config (pre-filled) > generating > gallery.

## Open Questions

1. **Replicate Concurrency Limits**
   - What we know: Flux Schnell is fast (~1.5s per image). Existing code generates one at a time.
   - What's unclear: The exact concurrency limit on the project's Replicate plan. Free tier may limit to 1-2 concurrent predictions.
   - Recommendation: Implement with concurrency limit of 3, make it configurable. If rate-limited, fall back to sequential.

2. **Image Storage**
   - What we know: Currently images are returned as Replicate CDN URLs (temporary, expire after a while).
   - What's unclear: Whether generated images should be stored to R2 for persistence.
   - Recommendation: For v1, use ephemeral Replicate URLs. User downloads what they want. Storage can come later with "saved generations" (deferred).

3. **Auth Requirement**
   - What we know: Brand guidelines require auth. Analysis APIs do not. Current Creative Lab does not require auth.
   - What's unclear: Whether generate-config should require auth (to fetch brand guidelines).
   - Recommendation: Make auth optional. If authenticated, fetch guidelines and enhance suggestions. If not, generate based on analysis data alone.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/api/analyze/diversity/route.ts` - Full diversity analysis + recommendation generation
- Existing codebase: `/api/analyze/generate-image/route.ts` - Replicate Flux Schnell integration
- Existing codebase: `/api/analyze/benchmark/route.ts` - Category benchmark + gap identification
- Existing codebase: `/api/brand-guidelines/route.ts` - Brand guidelines CRUD
- Existing codebase: `prisma/schema.prisma` - BrandAnalysisCache, BrandGuidelines, AdTemplate models
- Existing codebase: `creative-lab/page.tsx` - Current 7-step flow to understand and replace
- Existing codebase: `creative-lab/format-selector.tsx` - AdFormat types and format grid (reusable)
- Existing codebase: `creative-lab/generation-results.tsx` - Download patterns (reusable)

### Secondary (MEDIUM confidence)
- JSZip documentation: https://stuk.github.io/jszip/ - Client-side ZIP creation API
- Replicate Flux collection: https://replicate.com/collections/flux - Flux Schnell capabilities and pricing

### Tertiary (LOW confidence)
- Replicate concurrency limits: varies by plan, needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already in project, only jszip is new
- Architecture: HIGH - Building on existing, well-understood API patterns
- Pitfalls: HIGH - Based on direct codebase analysis of existing limitations
- UI patterns: MEDIUM - Config screen layout is at Claude's discretion per CONTEXT.md

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable - building on existing infrastructure)
