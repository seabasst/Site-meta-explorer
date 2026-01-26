# Phase 6: Ad Preview - Research

**Researched:** 2026-01-26
**Domain:** UI Components for Ad Preview Cards
**Confidence:** HIGH

## Summary

This phase implements ad preview functionality: clickable ad cards that link to Facebook, display ad creative text, and visually distinguish video vs image ads. The existing codebase already has all necessary data structures (`FacebookAdResult` with `creativeBody`, `linkTitle`, `mediaType`, `adArchiveId`) and established UI patterns for clickable link cards.

The implementation is straightforward because:
1. The Facebook API data already includes all required fields
2. The existing `ad-longevity.tsx` component demonstrates the exact pattern needed for clickable ad cards
3. lucide-react icons are already installed for media type badges
4. The project follows established Tailwind CSS patterns for hover effects

**Primary recommendation:** Create an `AdPreviewCard` component using the existing clickable card pattern from `ad-longevity.tsx`, with lucide-react icons (`Play`, `Image`, `ExternalLink`) for media type badges and external link indicators.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | ^0.563.0 | Icons for media type badges | Already installed, tree-shakable, React-native icons |
| tailwindcss | ^4 | Hover effects and styling | Already configured, project standard |
| class-variance-authority | ^0.7.1 | Component variants | Already installed, shadcn/ui pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | via cn() | Class name composition | All component styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lucide-react Play | Custom SVG | Custom adds maintenance burden, lucide is already installed |
| shadcn/ui Card | Custom component | shadcn Card would need installation; existing patterns work well |

**Installation:**
No new packages needed - all required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ads/
│   │   └── ad-preview-card.tsx    # New: Ad preview card component
│   └── ui/                         # Existing shadcn/ui components
├── lib/
│   └── facebook-api.ts            # Existing: FacebookAdResult type
```

### Pattern 1: Clickable Card with Pseudo-Element Stretch
**What:** Make entire card clickable while maintaining accessibility
**When to use:** When the whole card should be a link
**Example:**
```typescript
// Source: Existing pattern from ad-longevity.tsx (lines 146-172)
// The entire <a> tag wraps the card content
<a
  href={`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-colors group"
>
  {/* Card content */}
</a>
```

### Pattern 2: Media Type Badge with lucide-react Icons
**What:** Small icon badge to distinguish video vs image ads
**When to use:** Top-right corner of ad card
**Example:**
```typescript
// Source: lucide.dev/icons
import { Play, Image as ImageIcon, ExternalLink } from 'lucide-react';

// Badge component
<div className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
  {ad.mediaType === 'video' ? (
    <Play className="w-4 h-4 text-purple-500" />
  ) : ad.mediaType === 'image' ? (
    <ImageIcon className="w-4 h-4 text-blue-500" />
  ) : null}
</div>
```

### Pattern 3: Group Hover Effects
**What:** Coordinated hover state across card elements
**When to use:** When multiple elements should react to card hover
**Example:**
```typescript
// Source: Existing pattern from ad-longevity.tsx (line 151)
<a className="group hover:border-[var(--accent-green)] transition-colors">
  <div className="group-hover:text-[var(--accent-green-light)]">
    {/* Text that changes color on card hover */}
  </div>
</a>
```

### Anti-Patterns to Avoid
- **Wrapping block elements in `<a>` tags with nested interactive elements:** Creates accessibility issues and confuses screen readers. Keep the card simple with a single link target.
- **Truncating creative text:** User decision specifies "show full ad creative text always (no truncation)"
- **Using onClick handlers for external links:** Use `<a>` tags with `href` for better accessibility and right-click support.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon components | Custom SVGs | lucide-react (`Play`, `Image`, `ExternalLink`) | Already installed, consistent style, tree-shakable |
| Class name merging | String concatenation | `cn()` utility from `@/lib/utils` | Handles conflicts, existing pattern |
| Hover transitions | Custom CSS | Tailwind's `transition-colors`, `hover:` variants | Consistent with codebase |
| External link behavior | Custom window.open | `<a target="_blank" rel="noopener noreferrer">` | Better accessibility, right-click support |

**Key insight:** The existing codebase has all necessary patterns established. This phase is about composition, not invention.

## Common Pitfalls

### Pitfall 1: Media Type Data Not Available
**What goes wrong:** The `mediaType` field may be `'unknown'` for many ads because it's determined via separate API calls
**Why it happens:** The Facebook API doesn't return media type directly in the main ads query; it requires filtered separate queries
**How to avoid:** Handle `'unknown'` gracefully - either show no badge or show a generic badge
**Warning signs:** Seeing many ads without media type badges in testing

### Pitfall 2: Facebook Ad Library Link Expiration
**What goes wrong:** Ad preview links can become 404 after some time when ads are removed
**Why it happens:** Facebook removes ads from the Ad Library when they're no longer active
**How to avoid:** The link format `https://www.facebook.com/ads/library/?id=${adArchiveId}` is correct; just note that expired links are a Facebook limitation, not a bug
**Warning signs:** Users reporting "Ad not found" on Facebook

### Pitfall 3: Missing Creative Text
**What goes wrong:** Both `creativeBody` and `linkTitle` can be null
**Why it happens:** Some ads have minimal text content, or the API doesn't return it
**How to avoid:** Provide fallback display text like "View Ad" or "Ad #{adId}"
**Warning signs:** Empty cards with no visible text

### Pitfall 4: Long Creative Text Breaking Layout
**What goes wrong:** Full creative text can be very long (hundreds of characters)
**Why it happens:** User requested no truncation, but some ad copy is extensive
**How to avoid:** Allow text to wrap naturally; use appropriate container max-height with scroll if necessary, or accept that cards may have varying heights
**Warning signs:** Cards with extremely long text pushing other content

## Code Examples

Verified patterns from official sources and existing codebase:

### Facebook Ad Library URL Format
```typescript
// Source: Existing pattern in page.tsx (line 720, 792) and ad-longevity.tsx (line 148)
const adLibraryUrl = `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
```

### lucide-react Icon Import
```typescript
// Source: https://lucide.dev/guide/packages/lucide-react
import { Play, Image as ImageIcon, ExternalLink } from 'lucide-react';

// Usage with size and color
<Play className="w-4 h-4 text-purple-500" />
<ImageIcon className="w-4 h-4 text-blue-500" />
<ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
```

### Ad Card Hover Effects (from existing codebase)
```typescript
// Source: ad-longevity.tsx (lines 151-172)
<a
  href={adUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-colors group"
>
  <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent-green-light)]">
    {ad.linkTitle || ad.creativeBody?.slice(0, 50) || `Ad ${ad.adId}`}
  </div>
</a>
```

### Accessible External Link Pattern
```typescript
// Source: https://inclusive-components.design/cards/
// The <a> tag should include rel="noopener noreferrer" for security
// and visual indicator that it opens in new tab
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  className="group cursor-pointer"
>
  <span>Link Text</span>
  <ExternalLink className="w-3 h-3 inline-block ml-1 opacity-60 group-hover:opacity-100" />
</a>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wrapping entire card in `<a>` with nested links | Single `<a>` with no nested interactive elements | Always (a11y best practice) | Better screen reader support |
| Custom hover JS | Tailwind CSS `hover:` and `group-hover:` | Tailwind v3+ | Simpler, more performant |
| heroicons | lucide-react | Project decision | Larger icon set, better tree-shaking |

**Deprecated/outdated:**
- None relevant - existing patterns are current

## Open Questions

Things that couldn't be fully resolved:

1. **Handling very long creative text**
   - What we know: User requested no truncation
   - What's unclear: Maximum expected length; should there be a scroll container or just let cards grow tall?
   - Recommendation: Allow natural text wrapping; if text is extremely long, consider a max-height with fade/scroll indicator (discuss with user if needed)

2. **Media type badge for 'unknown' type**
   - What we know: Many ads may have `mediaType: 'unknown'`
   - What's unclear: Should these show no badge, or a generic badge?
   - Recommendation: Show no badge for unknown type to avoid visual confusion

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `/src/components/analytics/ad-longevity.tsx` - Clickable ad card pattern (lines 146-172)
  - `/src/lib/facebook-api.ts` - `FacebookAdResult` type definition (lines 79-101)
  - `/src/components/demographics/media-type-chart.tsx` - Media type colors (purple for video, blue for image)
  - `/src/app/page.tsx` - Ad Library URL format (lines 720, 792)
- lucide-react official documentation: https://lucide.dev/guide/packages/lucide-react

### Secondary (MEDIUM confidence)
- shadcn/ui Card component: https://ui.shadcn.com/docs/components/card
- Accessible card patterns: https://inclusive-components.design/cards/
- WCAG accessibility for clickable cards: https://dap.berkeley.edu/web-a11y-basics/accessible-card-ui-component-patterns

### Tertiary (LOW confidence)
- None - all findings verified against existing codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Direct reuse of existing patterns
- Pitfalls: HIGH - Based on existing codebase analysis and Facebook API behavior

**Research date:** 2026-01-26
**Valid until:** 60 days (stable patterns, no fast-moving dependencies)
