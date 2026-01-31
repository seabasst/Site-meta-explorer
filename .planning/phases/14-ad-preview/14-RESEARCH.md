# Phase 14: Ad Preview - Research

**Researched:** 2026-01-31
**Domain:** Ad creative display, Facebook Ad Library integration, media type detection
**Confidence:** HIGH

## Summary

Phase 14 aims to deliver a rich ad preview experience with click-to-view Facebook links, creative text display, and video/image distinction. Research reveals that **most of this is already implemented** from Phases 6 and 13. The AdPreviewCard component (`src/components/ads/ad-preview-card.tsx`) already provides Facebook link-out, creative text, media type badges, hover effects, and lazy-loaded media. It is already integrated into `page.tsx` within a FeatureGate wrapper showing the top 6 ads by reach.

However, there are **two critical gaps** preventing the success criteria from being fully met:

1. **Media type per ad is always 'unknown'**: The Facebook API client (`src/lib/facebook-api.ts`, line 747) hardcodes `mediaType: 'unknown'` for every ad. The overall media type breakdown (video count vs image count) is determined by separate filtered API calls, but this information is never applied back to individual ads. The AdPreviewCard has full badge logic for video/image, but it never shows because the data is always 'unknown'.

2. **Creative text is truncated**: The AdPreviewCard uses `line-clamp-2` on both `linkTitle` and `creativeBody`, contradicting the Phase 6 CONTEXT.md decision to "Show full ad creative text always (no truncation or expand)."

**Primary recommendation:** Fix media type assignment per ad (either via the separate media_type API filter or via Puppeteer extraction results) and remove text truncation to fully satisfy all three success criteria.

## Standard Stack

### Core (Already in Place)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React 19 | 19.x | UI framework | In use |
| Next.js | App Router | Server/client rendering | In use |
| Tailwind v4 | 4.x | Styling | In use |
| lucide-react | latest | Icons (Play, Image, ExternalLink) | In use |

### Supporting (Already in Place)
| Library | Purpose | Status |
|---------|---------|--------|
| Puppeteer | Media extraction from snapshot URLs (local dev only) | In use |
| next-auth | Session management for FeatureGate | In use |

### No New Dependencies Needed
This phase requires zero new library installations. All work is refinement of existing components and data flow.

## Architecture Patterns

### Current Component Architecture
```
src/
├── components/
│   └── ads/
│       └── ad-preview-card.tsx    # Already built - full featured
├── hooks/
│   └── use-ad-media.ts           # Already built - lazy media loading
├── lib/
│   ├── facebook-api.ts           # Ad data fetching (mediaType gap here)
│   ├── media-extractor.ts        # Puppeteer-based extraction
│   └── media-cache.ts            # Filesystem cache for extracted media
├── app/
│   ├── page.tsx                  # Main page with AdPreviewCard grid
│   └── api/media/
│       └── resolve/route.ts      # Media resolution API endpoint
└── components/tier/
    └── feature-gate.tsx          # Gates ad previews behind Pro tier
```

### Data Flow for Ad Preview
```
Facebook API → fetchFacebookAds() → FacebookAdResult[] (mediaType: 'unknown')
                                          ↓
                                    page.tsx renders
                                          ↓
                              AdPreviewCard receives ad prop
                                    ↓              ↓
                             Shows creative    useAdMedia hook
                             text + badges     calls /api/media/resolve
                                                    ↓
                                              Puppeteer extracts media
                                              (or iframe on Vercel)
                                                    ↓
                                              Returns mediaUrl + mediaType
                                              (image/video/snapshot)
```

### Pattern: Media Type Resolution
The `useAdMedia` hook resolves media type per-ad when the card renders, but this resolved type (`image`/`video`/`snapshot`) is only used for **rendering the media preview**. The badge in the card's top-left still reads `ad.mediaType` from the original API response, which is always `'unknown'`.

### Anti-Patterns to Avoid
- **Don't add a third API call per ad to determine media type**: The separate `countAdsByMediaType` calls already exist at the aggregate level. Instead, leverage the `resolvedMediaType` from `useAdMedia` to update the badge display.
- **Don't re-architect the data flow**: The existing architecture is sound. The fix is small -- either use the resolved media type for the badge, or determine media type during the initial API fetch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Media type detection | Custom content-type sniffing | Facebook `media_type` API filter or resolved type from useAdMedia | API already supports it |
| Text truncation UX | Custom expand/collapse | Remove `line-clamp-2` per Phase 6 decision | Decision was "no truncation" |
| Facebook ad linking | Custom URL builder | Existing pattern: `https://www.facebook.com/ads/library/?id=${adArchiveId}` | Already working |

## Common Pitfalls

### Pitfall 1: mediaType Always 'unknown'
**What goes wrong:** The media type badge never shows because `ad.mediaType` is hardcoded to `'unknown'` in facebook-api.ts line 747.
**Why it happens:** The Facebook Ad Library API does not return a `media_type` field per ad. The codebase works around this with separate `countAdsByMediaType` API calls (VIDEO/IMAGE filters), but only for aggregate counts -- not per-ad assignment.
**How to avoid:** Two options:
  - Option A (recommended): Use the `resolvedMediaType` from `useAdMedia` hook in AdPreviewCard for the badge. When media is resolved to 'video' or 'image', update the badge. This piggybacks on existing lazy loading.
  - Option B: Make two additional API calls with `media_type=VIDEO` and `media_type=IMAGE` filters during `fetchFacebookAds`, then cross-reference ad IDs to assign types. This is heavier but assigns types upfront.
**Warning signs:** Badge shows for 0 ads despite having video/image content.

### Pitfall 2: Creative Text Truncation
**What goes wrong:** Users cannot see full creative text (truncated to 2 lines).
**Why it happens:** `line-clamp-2` is applied to both `linkTitle` and `creativeBody` in AdPreviewCard.
**How to avoid:** Remove `line-clamp-2` from `creativeBody`. Keep `line-clamp-2` on `linkTitle` since titles are typically short and the clamp is reasonable there.
**Warning signs:** Long ad copy appears cut off with "..." ellipsis.

### Pitfall 3: Vercel Media Resolution Fallback
**What goes wrong:** On Vercel, Puppeteer is unavailable so media resolves as 'snapshot' (iframe) and the resolved media type is always 'snapshot', not 'image' or 'video'.
**Why it happens:** The `/api/media/resolve` endpoint returns `{ mediaType: 'snapshot', mediaUrl: snapshotUrl }` on Vercel.
**How to avoid:** For the badge, the Vercel fallback should still show 'unknown' rather than incorrectly labeling everything as an image. The badge logic should handle 'snapshot' gracefully.
**Warning signs:** All ads show as the same type on Vercel deployment.

### Pitfall 4: Performance with Many Cards
**What goes wrong:** Rendering many AdPreviewCards triggers many parallel `/api/media/resolve` calls.
**Why it happens:** Each card's `useAdMedia` hook fires on mount.
**How to avoid:** Already mitigated by the module-level `resolvedCache` Map in `use-ad-media.ts` and `inflightResolves` dedup in `media-cache.ts`. Current limit of 6 cards is fine. If expanding to show more, consider pagination.

## Code Examples

### Current AdPreviewCard Badge Logic (the gap)
```typescript
// src/components/ads/ad-preview-card.tsx, lines 128-136
// This badge reads ad.mediaType which is always 'unknown'
{ad.mediaType !== 'unknown' && (
  <span className={`px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm ${
    ad.mediaType === 'video'
      ? 'bg-purple-500/20 text-purple-400'
      : 'bg-blue-500/20 text-blue-400'
  }`}>
    {ad.mediaType === 'video' ? 'Video' : 'Image'}
  </span>
)}
```

### Fix: Use resolvedMediaType for Badge
```typescript
// The hook already returns resolvedMediaType:
const { mediaUrl, mediaType: resolvedMediaType, isLoading } = useAdMedia(
  ad.adArchiveId,
  ad.snapshotUrl,
);

// Determine badge type: prefer resolved type, fall back to ad.mediaType
const badgeType = resolvedMediaType === 'video' ? 'video'
  : resolvedMediaType === 'image' ? 'image'
  : ad.mediaType !== 'unknown' ? ad.mediaType
  : null;

// Then in JSX:
{badgeType && (
  <span className={`px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm ${
    badgeType === 'video'
      ? 'bg-purple-500/20 text-purple-400'
      : 'bg-blue-500/20 text-blue-400'
  }`}>
    {badgeType === 'video' ? 'Video' : 'Image'}
  </span>
)}
```

### Fix: Remove Text Truncation
```typescript
// Current (truncated):
<p className="text-xs text-[var(--text-secondary)] line-clamp-2">
  {ad.creativeBody}
</p>

// Fixed (full text):
<p className="text-xs text-[var(--text-secondary)]">
  {ad.creativeBody}
</p>
```

### Facebook Ad Library Link Pattern (already working)
```typescript
const adUrl = `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
// Opens in new tab via <a target="_blank" rel="noopener noreferrer">
```

## Current State Assessment

### Success Criteria vs Current Implementation

| Criterion | Status | Gap |
|-----------|--------|-----|
| PREV-01: Click to view ad on Facebook | DONE | None - AdPreviewCard wraps entire card in `<a>` to Facebook |
| PREV-02: See ad creative text in results | PARTIAL | `line-clamp-2` truncates body text; needs removal |
| PREV-03: Distinguish video from image ads | PARTIAL | Badge logic exists but `ad.mediaType` is always 'unknown'; need to use resolved type |

### Files That Need Changes
1. **`src/components/ads/ad-preview-card.tsx`** - Remove `line-clamp-2` from body, use `resolvedMediaType` for badge
2. Potentially **no other files** need changes

### What Does NOT Need Changes
- `src/lib/facebook-api.ts` - No need to modify API layer if using client-side resolved type
- `src/app/page.tsx` - Integration already complete
- `src/hooks/use-ad-media.ts` - Hook already returns resolved type
- `src/components/tier/feature-gate.tsx` - Gating already in place
- `src/lib/tiers.ts` - Tier config already includes `adPreviews`

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Inline ad links (pre Phase 6) | AdPreviewCard grid (Phase 6+) | Rich visual preview |
| No media type per ad | Aggregate media type counts only | Badges don't show on cards |
| FeatureGate with full tier logic | FeatureGate passthrough (free until March 1) | All users see ad previews currently |

## Open Questions

1. **Should the creative text truly never truncate?**
   - Phase 6 CONTEXT.md says "no truncation"
   - But very long ad copy (100+ words) may break card layout in a grid
   - Recommendation: Remove `line-clamp-2` but consider adding a reasonable max (e.g., `line-clamp-6` or no limit) -- defer to user preference
   - Confidence: MEDIUM (design decision)

2. **Should more than 6 ads be viewable?**
   - Currently shows top 6 by reach
   - Phase 14 success criteria don't mention "all ads" browsing
   - The old Phase 6 plan (06-02) had a "View all X ads" table with media type column, but that section may or may not still exist
   - Recommendation: Keep current 6-card limit for this phase, add "View all" in a later polish phase if needed

3. **Vercel deployment -- snapshot type handling?**
   - On Vercel, all media resolves as 'snapshot' type
   - Badge should handle this gracefully (show nothing, or show based on initial ad.mediaType)
   - Recommendation: Only show badge when resolvedMediaType is definitively 'video' or 'image', not 'snapshot'

## Sources

### Primary (HIGH confidence)
- `src/components/ads/ad-preview-card.tsx` - Direct code inspection
- `src/lib/facebook-api.ts` - Direct code inspection (mediaType hardcoded to 'unknown', line 747)
- `src/hooks/use-ad-media.ts` - Direct code inspection (returns resolvedMediaType)
- `src/app/page.tsx` - Direct code inspection (integration already complete)
- `.planning/phases/06-ad-preview/06-CONTEXT.md` - User decisions on UI behavior

### Secondary (MEDIUM confidence)
- `.planning/phases/13-pro-features/13-01-PLAN.md` - Phase 13 FeatureGate implementation
- `.planning/phases/06-ad-preview/06-01-SUMMARY.md` - Phase 6 completion status

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code directly inspected, no external dependencies needed
- Architecture: HIGH - existing architecture is well understood, changes are minimal
- Pitfalls: HIGH - gaps identified through direct code analysis
- Creative text decision: MEDIUM - user preference may override

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (until free access period ends and tier logic changes)
