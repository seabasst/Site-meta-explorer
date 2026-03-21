# Phase 56: Image Generation - Research

**Researched:** 2026-03-21
**Domain:** AI image generation with Flux Schnell via Replicate, format selection, analysis-driven prompts
**Confidence:** HIGH

## Summary

This phase enhances the existing Creative Lab image generation flow to support multiple ad format/size selection before generating, multi-format variant generation from a single prompt, and proper download handling. The foundation is already well-built: the `/api/analyze/generate-image` route calls Flux Schnell via Replicate, the Creative Lab page already has a `generateImage()` function that takes a `Recommendation` (which includes an `imagePrompt` field), and recommendations are surfaced in the results dashboard with "Generate" buttons.

The main work is: (1) adding a format/size selector between clicking "Generate" and the API call, (2) mapping ad format sizes to Flux Schnell aspect ratios, (3) enabling batch generation of multiple formats from one prompt, and (4) improving the download flow (currently uses a simple `<a download>` link to a Replicate URL).

**Primary recommendation:** Add a format selection step (modal or inline panel) that maps standard ad sizes to Flux Schnell aspect ratios, then generate images sequentially or in parallel for each selected format.

## Standard Stack

### Core (Already in Place)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Replicate API | v1 REST | Flux Schnell image generation | Already integrated, works via direct fetch |
| Flux Schnell | latest | Fast image generation model | Already chosen, ~1-4s generation time |
| Next.js API Routes | 16 | Backend for generation proxy | Already in place |

### Supporting (May Need)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native fetch + Blob | built-in | Image download to device | For proper cross-browser download of generated images |

### No New Dependencies Needed
The existing stack handles everything. No new npm packages are required. The Replicate API is called via plain `fetch` in the API route, and the frontend is standard React state management.

## Architecture Patterns

### Current Flow (What Exists)
```
User clicks "Generate" on Recommendation
  -> generateImage(rec) called
  -> POST /api/analyze/generate-image { prompt: rec.imagePrompt, aspectRatio: '1:1' }
  -> Replicate API creates prediction, polls for completion
  -> Returns { imageUrl: string } (Replicate CDN URL)
  -> Displayed in 'image-result' step
  -> Download via <a href={url} download="ad-creative.webp">
```

### Enhanced Flow (What to Build)
```
User clicks "Generate" on Recommendation
  -> Format selection panel appears (inline or modal)
  -> User picks one or more ad formats (1080x1080, 1080x1920, 1200x628, etc.)
  -> For each selected format:
     -> Map pixel size to Flux Schnell aspect ratio
     -> POST /api/analyze/generate-image { prompt, aspectRatio }
     -> Collect results
  -> Display all generated variants in a grid
  -> Download individual images or all as zip (stretch goal)
```

### Recommended Project Structure (Changes Only)
```
src/app/dashboard/v2/creative-lab/
  page.tsx                    # Modify: add format selection step, multi-image result view
  benchmark-comparison.tsx    # No changes needed
  format-selector.tsx         # NEW: format picker component
  generation-results.tsx      # NEW: multi-image result grid with download

src/app/api/analyze/
  generate-image/route.ts     # Minor: add width/height params or keep aspect ratio mapping
```

### Pattern 1: Format Selection Before Generation
**What:** Instead of immediately calling the API when "Generate" is clicked, show a format selector first
**When to use:** Every time the user triggers generation from a recommendation
**Implementation approach:**
- Add a new step `'format-select'` to the existing `Step` type union
- Or use a modal overlay on the results page to avoid adding another full-page step
- Store selected formats in state, then loop through them for generation

### Pattern 2: Aspect Ratio Mapping
**What:** Map standard ad pixel sizes to Flux Schnell's supported aspect ratios
**When to use:** When translating user-facing format names to API parameters

### Anti-Patterns to Avoid
- **Sequential blocking generation:** Do not generate formats one at a time with the user waiting for each. Use `Promise.allSettled()` to fire multiple generations in parallel.
- **Storing images in R2 at this stage:** The Replicate CDN URLs are temporary (hours), but for MVP the download-on-demand approach is simpler. R2 storage can come later if persistence is needed.
- **Overcomplicating the step machine:** The page already has 6 steps. Adding too many more will make the code harder to maintain. Prefer a modal for format selection over a new full-page step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image download | Custom download service | `fetch(url).then(r => r.blob()).then(blob => URL.createObjectURL(blob))` pattern | Cross-origin download attributes are unreliable; fetch-then-blob is the standard pattern |
| Aspect ratio math | Custom ratio calculator | Static lookup table | Only 11 valid ratios, just map them |
| Parallel generation | Custom queue system | `Promise.allSettled()` | Built-in, handles partial failures gracefully |

## Common Pitfalls

### Pitfall 1: Cross-Origin Download Failure
**What goes wrong:** The `<a href={replicateUrl} download="file.webp">` pattern currently in the code may not trigger a download because the Replicate CDN URL is cross-origin. The `download` attribute is ignored for cross-origin URLs in most browsers.
**Why it happens:** Browser security policy ignores the `download` attribute when `href` points to a different origin.
**How to avoid:** Fetch the image as a blob first, create an object URL, then trigger download from that.
**Warning signs:** Clicking "Download" opens the image in a new tab instead of downloading.

### Pitfall 2: Replicate URL Expiry
**What goes wrong:** Generated image URLs from Replicate expire after some hours. If the user leaves and comes back, images are gone.
**Why it happens:** Replicate uses temporary CDN URLs for generated outputs.
**How to avoid:** For MVP, this is acceptable -- users generate and download immediately. For persistence, upload to R2 after generation.
**Warning signs:** Broken image URLs when returning to the page.

### Pitfall 3: Timeout on Multiple Generations
**What goes wrong:** If generating 3-4 format variants in parallel, the API route has `maxDuration: 60` which should be sufficient for Flux Schnell (~1-4s per image), but network variability could cause issues.
**Why it happens:** Flux Schnell is fast but the poll loop adds latency. Multiple parallel requests amplify variance.
**How to avoid:** Fire parallel requests from the client side (not a single API call that does all formats). Each `/api/analyze/generate-image` call handles one format. Client manages the orchestration.
**Warning signs:** 504 timeout errors when generating multiple formats.

### Pitfall 4: Hardcoded 1:1 Aspect Ratio
**What goes wrong:** The current `generateImage()` function hardcodes `aspectRatio: '1:1'`.
**Why it happens:** Original implementation only supported square output.
**How to avoid:** Pass the aspect ratio from the format selector through to the API call.

## Code Examples

### Ad Format to Aspect Ratio Mapping
```typescript
// Standard social media ad sizes mapped to Flux Schnell aspect ratios
const AD_FORMATS = [
  { id: 'square',    label: 'Square',           size: '1080x1080', aspectRatio: '1:1',  description: 'Feed post, Instagram' },
  { id: 'story',     label: 'Story / Reel',     size: '1080x1920', aspectRatio: '9:16', description: 'Stories, Reels, TikTok' },
  { id: 'landscape', label: 'Landscape',        size: '1200x628',  aspectRatio: '16:9', description: 'Facebook feed link ad' },
  { id: 'portrait',  label: 'Portrait',         size: '1080x1350', aspectRatio: '4:5',  description: 'Instagram feed, Facebook' },
  { id: 'wide',      label: 'Wide Banner',      size: '1200x628',  aspectRatio: '21:9', description: 'Display banner' },
  { id: 'pin',       label: 'Pinterest Pin',    size: '1000x1500', aspectRatio: '2:3',  description: 'Pinterest' },
] as const;
```

### Parallel Multi-Format Generation
```typescript
const generateMultipleFormats = async (
  prompt: string,
  formats: typeof AD_FORMATS[number][]
) => {
  const results = await Promise.allSettled(
    formats.map(async (format) => {
      const res = await fetch('/api/analyze/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: format.aspectRatio }),
      });
      if (!res.ok) throw new Error(`Failed for ${format.label}`);
      const data = await res.json();
      return { format, imageUrl: data.imageUrl };
    })
  );
  return results;
};
```

### Proper Image Download (Cross-Origin Safe)
```typescript
const downloadImage = async (url: string, filename: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
};
```

## Flux Schnell Supported Aspect Ratios

Verified from the [Replicate cog-flux-schnell source code](https://github.com/replicate/cog-flux-schnell/blob/main/predict.py):

| Aspect Ratio | Use Case |
|---|---|
| `1:1` | Square feed posts |
| `16:9` | Landscape video, Facebook link ads |
| `21:9` | Ultra-wide banners |
| `3:2` | Standard landscape photo |
| `2:3` | Portrait / Pinterest pin |
| `4:5` | Instagram/Facebook portrait feed |
| `5:4` | Slight landscape |
| `3:4` | Portrait photo |
| `4:3` | Standard landscape |
| `9:16` | Stories, Reels, TikTok |
| `9:21` | Ultra-tall |

**Output format:** webp (already configured in the API route at quality 90)

## Existing Code Inventory

### What Already Works (No Changes Needed)
- `/api/analyze/generate-image/route.ts` -- accepts `{ prompt, aspectRatio }`, returns `{ imageUrl }`. Already supports any aspect ratio Flux Schnell accepts.
- `/api/analyze/diversity/route.ts` -- generates 7 recommendations with `imagePrompt` field. This is the GENR-05 flow already working.
- `Recommendation` type with `imagePrompt`, `briefTitle`, `briefDescription`, `gap`, `suggestion`, `pillar`, `priority` fields.
- "Generate" button on each recommendation card (lines ~1046-1051 in page.tsx).
- "Brief" view showing the full creative brief with "Generate AI Image" CTA.

### What Needs Enhancement
1. **`generateImage()` function** (line 361-380): Currently hardcodes `aspectRatio: '1:1'`. Needs to accept format selection.
2. **`Step` type** (line 189): Currently `'setup' | 'analyzing' | 'results' | 'brief' | 'generating-image' | 'image-result'`. May need `'format-select'` or can use a modal.
3. **Image result view** (lines 606-640): Currently shows a single image. Needs to display multiple format variants in a grid.
4. **Download button** (line 627-629): Currently `<a href={url} download>` which may fail cross-origin. Needs blob download pattern.

### BenchmarkComparison Component
The `BenchmarkComparison` component (lines 226-279 of `benchmark-comparison.tsx`) shows "Areas to Improve" (gaps) and "Competitive Advantages" (strengths) with `BenchmarkRecommendation` items. These contain a `message` string but do NOT contain `imagePrompt` fields. They are category-level insights (e.g., "Your Visual Style score is 15 points below category average"), not actionable creative briefs.

**Decision:** Generation CTAs should only appear on the `Recommendation` cards from the diversity analysis (which have `imagePrompt`), NOT on the benchmark gap items. The benchmark gaps are informational context, not generation triggers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Single format generation | Multi-format with selection | This phase | Users can generate for specific placements |
| Hardcoded 1:1 | User-selected aspect ratio | This phase | Proper ad format targeting |
| Direct URL download | Blob download | This phase | Reliable cross-browser downloads |

## Open Questions

1. **R2 Storage for Generated Images**
   - What we know: Replicate URLs are temporary. R2 infrastructure exists for ad assets.
   - What's unclear: Whether generated images should be persisted to R2 in this phase or deferred.
   - Recommendation: Defer R2 storage to a future phase. MVP uses direct download from Replicate URLs. Users generate, review, download immediately.

2. **Generation History**
   - What we know: No database model exists for storing generated images or their metadata.
   - What's unclear: Whether users expect to see previously generated images.
   - Recommendation: Out of scope for this phase. Each generation session is ephemeral.

3. **Prompt Editing**
   - What we know: The `imagePrompt` comes from the AI analysis and is shown in the "Visual Direction" section of the brief view.
   - What's unclear: Whether users should be able to edit the prompt before generating.
   - Recommendation: Allow prompt editing as a text input on the format selection panel. Pre-filled from `rec.imagePrompt` but editable.

## Sources

### Primary (HIGH confidence)
- Codebase: `/src/app/api/analyze/generate-image/route.ts` -- verified API contract
- Codebase: `/src/app/dashboard/v2/creative-lab/page.tsx` -- verified current UI flow and types
- Codebase: `/src/app/api/analyze/diversity/route.ts` -- verified recommendation generation prompt and schema
- [Replicate cog-flux-schnell predict.py](https://github.com/replicate/cog-flux-schnell/blob/main/predict.py) -- verified aspect ratio enum values

### Secondary (MEDIUM confidence)
- [Replicate Flux models collection](https://replicate.com/collections/flux) -- model capabilities
- [Replicate blog on Flux 2](https://replicate.com/blog/run-flux-2-on-replicate) -- generation speeds and features

### Tertiary (LOW confidence)
- Standard social media ad sizes -- based on common industry knowledge, not verified against current Meta/Instagram specs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in codebase, just need enhancement
- Architecture: HIGH -- the flow is straightforward extension of existing patterns
- Pitfalls: HIGH -- cross-origin download is a well-known browser behavior, Replicate URL expiry is documented
- Aspect ratios: HIGH -- verified from Replicate source code on GitHub

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- Replicate API and Flux Schnell are mature)
