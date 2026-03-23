# Phase 58: UGC Creator Briefs - Research

**Researched:** 2026-03-23
**Domain:** AI-generated UGC creator briefs from ad library analysis data
**Confidence:** HIGH

## Summary

This phase adds a UGC brief generator to the Creative Lab. The system takes a brand's existing ad data (analysis cache, brand guidelines, top-performing ads) and uses Claude to generate structured creator briefs with hooks, shot lists, talking points, and B-roll suggestions.

The codebase already has a strong pattern for this: the `generate-config` API route in Phase 57 follows the exact same flow (search brand -> fetch analysis cache + guidelines -> prompt Claude -> return structured JSON). UGC brief generation is essentially a variant of this pipeline with a different prompt and output structure.

For document download, the simplest approach is client-side: render the brief as styled HTML, offer clipboard copy (plain text/markdown), and use the browser's print-to-PDF for PDF export. This avoids adding server-side PDF dependencies (Puppeteer, @react-pdf/renderer) for what is essentially a text-heavy document.

**Primary recommendation:** Follow the generate-config API pattern exactly. New API route at `/api/creative-lab/generate-brief`, new UGC brief component in Creative Lab, Claude generates structured JSON, frontend renders it with copy/download actions.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Claude API for brief generation | Already used for generate-config, strategy analysis |
| `zod` | ^4.3.6 | Request validation | Already used in all API routes |
| `prisma` | ^7.4.2 | Database access for brand data | Already used everywhere |

### Supporting (no new dependencies needed)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `navigator.clipboard.writeText()` | Copy brief to clipboard | UGC-05: Copy action |
| `Blob` + `URL.createObjectURL()` | Download as markdown file | UGC-05: Download action |
| `window.print()` with print styles | PDF export via browser | UGC-05: PDF download option |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser print-to-PDF | `@react-pdf/renderer` | Adds ~860KB dependency, more control over PDF layout, but overkill for text-heavy briefs |
| Browser print-to-PDF | Puppeteer server-side | Requires headless Chrome, Vercel serverless can't run it easily, massive overhead |
| Markdown download | Google Docs export | Complex integration, not worth the effort for MVP |

**Installation:** No new packages needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/creative-lab/
      generate-brief/route.ts     # New API: Claude generates UGC brief JSON
    dashboard/v2/creative-lab/
      page.tsx                     # Add 'brief' flow state alongside existing config/gallery
      ugc-brief-view.tsx           # New: renders the brief with copy/download actions
      ugc-brief-shot-list.tsx      # New: shot list table/cards component
  lib/
    creative-lab-types.ts          # Add UGC brief types alongside existing types
```

### Pattern 1: Follow the generate-config API Pattern
**What:** The existing `generate-config` route is the template. It: (1) validates input with zod, (2) fetches brand + analysis cache from Prisma, (3) optionally loads brand guidelines, (4) constructs a detailed Claude prompt, (5) parses structured JSON response, (6) returns typed data.
**When to use:** For the new generate-brief route -- follow this pattern exactly.
**Key difference:** The UGC brief also needs to fetch top-performing ads (body text, hooks) from AdLibraryAd to feed real ad copy examples into the prompt.

### Pattern 2: Extend FlowState in Creative Lab Page
**What:** The existing Creative Lab page uses a `FlowState = 'search' | 'config' | 'gallery'` pattern. The UGC brief feature should either: (a) add a 'brief' flow state, or (b) integrate as a tab/option within the config state.
**When to use:** The cleanest approach is adding a mode selector after brand search -- "Generate Creatives" vs "Generate UGC Brief" -- then routing to the appropriate flow.
**Example:** After `handleSelectBrand`, show a choice screen before entering config or brief generation.

### Pattern 3: Claude Structured JSON Output
**What:** All existing Claude calls in the project parse raw JSON from Claude's text response (strip markdown fences, JSON.parse). The brief should follow the same pattern.
**When to use:** For the brief generation response. Define the exact JSON structure in the prompt, get Claude to return it.

### Anti-Patterns to Avoid
- **Don't stream the brief:** The brief is a single structured document, not a chat. Use a single Claude call that returns complete JSON, same as generate-config.
- **Don't store briefs in the database for MVP:** No new Prisma model needed. Generate on-demand, let users copy/download. Storage can come later if needed.
- **Don't use server-side PDF generation:** Vercel serverless functions can't run Puppeteer, and @react-pdf/renderer adds unnecessary complexity for text content. Browser print-to-PDF is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy | Custom selection + execCommand | `navigator.clipboard.writeText()` | Modern API, handles all browsers, simpler |
| File download | Custom Blob handling from scratch | `new Blob([content], {type})` + anchor click | Standard browser pattern, 5 lines of code |
| PDF generation | Server-side PDF rendering | `window.print()` with `@media print` CSS | Zero dependencies, browser handles layout |
| Brief structure/content | Hardcoded templates | Claude generation with structured prompts | AI adapts to brand data, more valuable output |
| Markdown formatting | Custom string concatenation | Template literal with sections | Clean, readable, easy to maintain |

**Key insight:** This feature is 90% AI prompt engineering and 10% UI. The brief content comes from Claude; the frontend just renders and exports it. Don't over-engineer the rendering -- focus on the prompt quality and data feeding.

## Common Pitfalls

### Pitfall 1: Insufficient Brand Context in Prompt
**What goes wrong:** Claude generates generic briefs that don't reflect the brand's actual ad style, audience, or category.
**Why it happens:** Only passing analysis scores without actual ad copy examples, brand voice, or category context.
**How to avoid:** Feed the prompt with: (1) top 5-10 ad bodies from the brand (highest reach), (2) brand guidelines (voice, audience, colors), (3) category context, (4) hook groups from BrandSnapshot if available, (5) analysis scores and distribution data.
**Warning signs:** Generated briefs that could apply to any brand.

### Pitfall 2: Claude Returns Invalid JSON
**What goes wrong:** JSON parsing fails, 500 error returned to user.
**Why it happens:** Claude sometimes wraps JSON in markdown fences or adds explanatory text.
**How to avoid:** The existing pattern handles this: strip ```json fences, trim whitespace. Also add try-catch around JSON.parse with a user-friendly error message. Consider retry logic (1 retry).

### Pitfall 3: Brief Too Long or Too Short
**What goes wrong:** Claude generates either a 50-word brief or a 5000-word essay.
**Why it happens:** No length guidance in the prompt.
**How to avoid:** Specify exact section lengths in the prompt: "Hook: 1-2 sentences. Shot list: 5-8 scenes, each 1-2 sentences. Talking points: 3-5 bullet points, each 1 sentence."

### Pitfall 4: Copy/Download Loses Formatting
**What goes wrong:** Clipboard copy produces ugly plain text, markdown download has no structure.
**Why it happens:** Not converting the structured JSON into well-formatted text before copy.
**How to avoid:** Build a `formatBriefAsText()` utility that converts the JSON brief into clean, readable plain text with headers, bullets, and proper spacing. Use this for both clipboard and markdown download.

### Pitfall 5: No Analysis Cache Available
**What goes wrong:** User selects a brand that hasn't been analyzed, gets an error.
**Why it happens:** Same issue as generate-config -- analysis cache is required.
**How to avoid:** Follow the same pattern as generate-config: check for cache, return 404 with helpful message if missing. The existing Creative Lab page already handles this error case.

## Code Examples

### UGC Brief Type Structure
```typescript
// Add to src/lib/creative-lab-types.ts

export interface UGCBriefScene {
  sceneNumber: number;
  duration: string;          // e.g. "2-3s", "5-8s"
  shotType: string;          // e.g. "Close-up", "Wide shot", "POV"
  description: string;       // What happens in this scene
  visualNotes: string;       // Lighting, setting, mood
  audioNotes: string;        // What to say or sound effects
}

export interface UGCBrief {
  // Metadata
  brandName: string;
  category: string;
  briefTitle: string;        // e.g. "Unboxing + First Impressions"
  contentType: string;       // e.g. "Review Video", "Testimonial", "How-To"
  platform: string;          // e.g. "TikTok/Reels", "Stories", "Feed"
  duration: string;          // e.g. "30-60 seconds"
  aspectRatio: string;       // e.g. "9:16"

  // Hook (first 2-3 seconds)
  hooks: string[];           // 3 hook options to test

  // Shot list
  scenes: UGCBriefScene[];   // 5-8 scenes

  // Talking points
  talkingPoints: string[];   // 3-5 key messages to hit

  // B-roll suggestions
  brollSuggestions: string[]; // 4-6 B-roll shot ideas

  // CTA
  callToAction: string;      // What the creator should say/show at the end

  // Style guidance
  tone: string;              // e.g. "Casual, authentic, excited but not over-the-top"
  dosAndDonts: {
    dos: string[];
    donts: string[];
  };

  // Brand context (for creator reference)
  keyProductInfo: string;    // 1-2 sentences about the product/brand
  targetAudience: string;    // Who this content should resonate with
}
```

### API Route Pattern (following generate-config)
```typescript
// src/app/api/creative-lab/generate-brief/route.ts
// Key data fetching pattern:

// 1. Brand + analysis cache (same as generate-config)
const brand = await prisma.adLibraryBrand.findUnique({
  where: { pageId },
  select: { id: true, pageName: true, category: true },
});
const cache = await prisma.brandAnalysisCache.findUnique({
  where: { brandId: brand.id },
});

// 2. Top-performing ads for real copy examples (NEW for briefs)
const topAds = await prisma.adLibraryAd.findMany({
  where: { brandId: brand.id, isActive: true, body: { not: null } },
  orderBy: { reachEstimate: 'desc' },
  take: 10,
  select: { body: true, title: true, ctaText: true, displayFormat: true },
});

// 3. Brand guidelines (same as generate-config)
const guidelines = await prisma.brandGuidelines.findUnique({
  where: { userId: session.user.id },
});
```

### Clipboard Copy Utility
```typescript
async function copyBriefToClipboard(brief: UGCBrief): Promise<boolean> {
  const text = formatBriefAsText(brief);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatBriefAsText(brief: UGCBrief): string {
  const lines: string[] = [
    `UGC CREATOR BRIEF: ${brief.briefTitle}`,
    `Brand: ${brief.brandName} | Category: ${brief.category}`,
    `Platform: ${brief.platform} | Duration: ${brief.duration} | Aspect: ${brief.aspectRatio}`,
    '',
    '--- HOOKS (test all 3) ---',
    ...brief.hooks.map((h, i) => `${i + 1}. ${h}`),
    '',
    '--- SHOT LIST ---',
    ...brief.scenes.map(s =>
      `Scene ${s.sceneNumber} (${s.duration}) - ${s.shotType}\n  ${s.description}\n  Visual: ${s.visualNotes}\n  Audio: ${s.audioNotes}`
    ),
    '',
    '--- TALKING POINTS ---',
    ...brief.talkingPoints.map(t => `- ${t}`),
    '',
    '--- B-ROLL SUGGESTIONS ---',
    ...brief.brollSuggestions.map(b => `- ${b}`),
    '',
    `--- CTA ---\n${brief.callToAction}`,
    '',
    `--- TONE ---\n${brief.tone}`,
    '',
    '--- DO\'S ---',
    ...brief.dosAndDonts.dos.map(d => `+ ${d}`),
    '',
    '--- DON\'TS ---',
    ...brief.dosAndDonts.donts.map(d => `- ${d}`),
  ];
  return lines.join('\n');
}
```

### Markdown Download
```typescript
function downloadBriefAsMarkdown(brief: UGCBrief) {
  const md = formatBriefAsMarkdown(brief);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ugc-brief-${brief.brandName.toLowerCase().replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
```

## UGC Brief Industry Standard Structure

Based on research from Influee, inBeat Agency, and NemoVideo, the industry-standard UGC brief follows this structure:

### Required Sections (maps to requirements)
| Section | Requirement | Description |
|---------|------------|-------------|
| Hooks (3 options) | UGC-03 | First 1-3 seconds, attention grabber. Provide 3 for A/B testing |
| Shot List / Storyboard | UGC-02 | 5-8 scenes with duration, shot type, description, visual/audio notes |
| Talking Points | UGC-03 | 3-5 key messages, NOT a full script (preserves creator authenticity) |
| B-Roll Suggestions | UGC-04 | 4-6 supplementary shots based on brand category |
| CTA | UGC-03 | Clear call-to-action for the end of the video |
| Do's and Don'ts | UGC-01 | Brand safety guidelines |
| Tone/Style Guidance | UGC-01 | Overall feel of the content |

### Standard Video Structure (from industry research)
1. **Cold Open / Hook** (0-3s): Visual or verbal hook to stop scrolling
2. **Problem / Setup** (3-7s): Establish the context or pain point
3. **Solution / Demo** (7-20s): Show the product solving the problem
4. **Proof / Results** (20-25s): Social proof, results, or testimonial
5. **CTA** (25-30s): Clear next step

### B-Roll Categories by Brand Type
| Brand Category | Typical B-Roll |
|---------------|---------------|
| Fashion/Apparel | Outfit transitions, mirror shots, detail close-ups, street style |
| Beauty/Skincare | Application process, before/after, texture shots, packaging |
| Food/Beverage | Preparation, pour shots, ingredients, eating/drinking |
| Tech/Electronics | Unboxing, screen demos, daily carry, setup process |
| Fitness/Health | Workout clips, progress shots, supplement routine, meal prep |
| Home/Lifestyle | Room styling, organization, product in use, ambiance shots |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full scripts for creators | Talking points + guidelines | 2024-2025 | Higher authenticity, better performance |
| Single hook per video | 3 hook variants for testing | 2024 | Enables A/B testing of openings |
| Generic briefs | Data-driven briefs from ad performance | 2025 | Briefs informed by what actually works for the brand |
| PDF briefs only | Digital/interactive + copy to clipboard | 2025 | Faster creator workflow |

## Open Questions

1. **Should briefs be saved to the database?**
   - What we know: MVP can generate on-demand without storage. The generate-config pattern doesn't store results either.
   - Recommendation: Skip DB storage for MVP. Add later if users want brief history.

2. **Should the brief integrate with the existing Creative Lab flow or be separate?**
   - What we know: Current flow is search -> config -> gallery (image generation). UGC briefs are text-based, not image-based.
   - Recommendation: Add a mode selector after brand search: "Generate Ad Creatives" vs "Generate UGC Brief". This keeps the search reusable while branching the output.

3. **Should we fetch competitor ads for the brief?**
   - What we know: The strategy API already does this for competitive analysis. Could enrich briefs.
   - Recommendation: Skip for MVP. Focus on the brand's own data. Competitor context can be a v2 enhancement.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/api/creative-lab/generate-config/route.ts` -- exact pattern to follow
- Codebase analysis: `src/app/dashboard/v2/creative-lab/page.tsx` -- FlowState pattern, search flow
- Codebase analysis: `prisma/schema.prisma` -- BrandAnalysisCache, AdLibraryAd, BrandGuidelines models
- Codebase analysis: `src/lib/creative-lab-types.ts` -- existing type patterns

### Secondary (MEDIUM confidence)
- [Influee UGC Brief Template](https://influee.co/blog/ugc-brief-template) -- Brief structure, script format
- [inBeat TikTok UGC Brief](https://inbeat.agency/blog/tiktok-ugc-brief-template) -- 8-section template structure
- [NemoVideo UGC Brief Template](https://www.nemovideo.com/blog/ugc-brief-template) -- Shot list and hook practices

### Tertiary (LOW confidence)
- PDF generation library comparisons -- verified that browser print-to-PDF is sufficient for text-heavy documents

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, follows existing patterns exactly
- Architecture: HIGH -- direct extension of existing Creative Lab patterns
- UGC brief structure: MEDIUM -- based on industry research, well-established practices
- Pitfalls: HIGH -- based on existing codebase patterns and known Claude API behavior

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, patterns unlikely to change)
