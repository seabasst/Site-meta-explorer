# Phase 50: Ad Detail Lightbox - Research

**Researched:** 2026-03-20
**Domain:** React modal/lightbox UI, existing ad data pipeline
**Confidence:** HIGH

## Summary

This phase adds a detail lightbox that opens when clicking an ad card. The codebase is well-positioned for this: the ads API already returns all needed detail fields (spend, impressions, targeting, dates, link URL, CTA) but the frontend `Ad` type only consumes a subset. No new API endpoint is needed.

The existing login modal in `page.tsx` establishes the modal pattern (fixed overlay, backdrop blur, click-outside-to-close, stopPropagation). The lightbox will follow the same approach but display richer ad data. Video and image rendering logic already exists in `AdCard` and can be reused at larger scale.

**Primary recommendation:** Expand the frontend `Ad` type to include all fields the API already returns, build a single `AdDetailLightbox` component, and wire it via `selectedAd` state in the page component. No new API calls needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | current | Component rendering, state management | Already in stack |
| Tailwind CSS v4 | current | Styling, responsive layout, animations | Already in stack |
| lucide-react | current | Icons (X, ExternalLink, Heart, Calendar, etc.) | Already in stack |
| next-auth | current | Session check for save functionality | Already in stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | - | Animate lightbox entrance/exit | NOT NEEDED - CSS transitions sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom modal | Radix Dialog | Would add a11y for free but adds dependency; existing login modal is custom and works fine |
| CSS transitions | framer-motion | FM gives nicer exit animations but is overkill for one modal |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Data Flow: No New API Needed

**Critical finding:** The `/api/ad-library/ads` endpoint already returns ALL detail fields in `AdLibraryAdResponse`:

| Field | In API Response | In Frontend `Ad` Type | Action |
|-------|----------------|----------------------|--------|
| `endDate` | YES | NO | Add to `Ad` type |
| `adDurationDays` | YES | NO | Add to `Ad` type |
| `impressionsLower` | YES | NO | Add to `Ad` type |
| `impressionsUpper` | YES | NO | Add to `Ad` type |
| `spendLower` | YES | NO | Add to `Ad` type |
| `spendUpper` | YES | NO | Add to `Ad` type |
| `currency` | YES | NO | Add to `Ad` type |
| `targetingJson` | YES | NO | Add to `Ad` type |
| `linkUrl` | YES | NO | Add to `Ad` type |
| `linkDescription` | YES | NO | Add to `Ad` type |
| `ctaText` | YES | NO | Add to `Ad` type |
| `ctaType` | YES | NO | Add to `Ad` type |
| `updatedAt` | YES | NO | Add to `Ad` type |
| `body` | YES | YES | Already available |
| `caption` | YES | YES | Already available |
| `title` | YES | YES | Already available |
| `snapshotUrl` | YES | YES | Already available |
| `bylines` | YES | YES | Already available |
| `startDate` | YES | YES | Already available |
| `reachEstimate` | YES | YES | Already available |
| `publisherPlatforms` | YES | YES | Already available |
| `displayFormat` | YES | YES | Already available |
| `assets` (all) | YES | YES | Already available |

**The API returns all of this on every list call.** The only work is expanding the TypeScript `Ad` interface and consuming the data in the lightbox.

### Recommended Component Structure

```
src/app/dashboard/v2/ad-library/
├── components/
│   ├── ad-card.tsx           # ADD: onClick prop, cursor-pointer
│   ├── ad-detail-lightbox.tsx # NEW: the lightbox modal component
│   ├── filter-bar.tsx        # unchanged
│   ├── load-more-button.tsx  # unchanged
│   ├── stats-strip.tsx       # unchanged
│   └── ...
├── types.ts                  # MODIFY: expand Ad interface
└── page.tsx                  # MODIFY: add selectedAd state + render lightbox
```

### Pattern: Modal State in Page Component

```typescript
// In page.tsx
const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

// Pass to grid
<AdCard ad={ad} onSelect={() => setSelectedAd(ad)} ... />

// Render lightbox when selected
{selectedAd && (
  <AdDetailLightbox
    ad={selectedAd}
    darkMode={darkMode}
    isSaved={savedAdIds.has(selectedAd.id)}
    onToggleSave={toggleSaveAd}
    onClose={() => setSelectedAd(null)}
  />
)}
```

### Pattern: Lightbox Component Structure

```typescript
// ad-detail-lightbox.tsx
export function AdDetailLightbox({ ad, darkMode, isSaved, onToggleSave, onClose }: Props) {
  // 1. Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 2. Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 overflow-y-auto rounded-2xl ..."
           onClick={e => e.stopPropagation()}>
        {/* X close button */}
        {/* Two-column: media left, details right */}
        {/* Or single column on mobile */}
      </div>
    </div>
  );
}
```

### Lightbox Layout (Desktop)

```
┌──────────────────────────────────────────────────┐
│  [X]                                              │
│ ┌─────────────────────┬────────────────────────┐  │
│ │                     │ Brand Logo + Name       │  │
│ │                     │ Category badge          │  │
│ │   Large Media       │─────────────────────────│  │
│ │   Preview           │ Full Ad Copy (body)     │  │
│ │   (image or video)  │ Caption / Title         │  │
│ │                     │─────────────────────────│  │
│ │                     │ Stats: Reach | Spend    │  │
│ │                     │ Impressions | Duration  │  │
│ │                     │─────────────────────────│  │
│ │                     │ Dates: Start → End      │  │
│ │                     │ Platforms: FB, IG, ...   │  │
│ │                     │ CTA: Shop Now → URL     │  │
│ │                     │─────────────────────────│  │
│ │                     │ Targeting (if available) │  │
│ │                     │─────────────────────────│  │
│ │                     │ [Save Ad] [View on Meta] │  │
│ └─────────────────────┴────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Anti-Patterns to Avoid
- **Fetching ad detail on open:** All data is already loaded in the list response. Do NOT make a separate API call.
- **Putting modal state in AdCard:** The modal must be rendered at page level (outside the scroll container) to avoid z-index / overflow issues.
- **Forgetting body scroll lock:** Without `overflow: hidden` on body, the background page scrolls behind the modal.
- **Video autoplay in lightbox:** Do NOT autoplay videos -- the card already has controls. In the lightbox, just show a larger video player with controls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay | Custom portal system | Simple fixed div (matches login modal) | Already working pattern in codebase |
| Scroll lock | Complex scroll position saving | `document.body.style.overflow = 'hidden'` | Simple, sufficient for this case |
| Keyboard handling | Full keyboard trap | `useEffect` with keydown listener for Escape | Only one focusable concern (close button) |
| Number formatting | Custom formatter | `formatNumber` from `v2-shell.tsx` | Already exists and used everywhere |
| Date formatting | Custom date logic | Standard `toLocaleDateString` (see brand detail page) | Already used in `[pageId]/page.tsx` |

## Common Pitfalls

### Pitfall 1: Video Click Propagation
**What goes wrong:** Clicking the video play button in the card triggers the lightbox open handler
**Why it happens:** Click event bubbles from `<video>` controls to the card's onClick
**How to avoid:** On AdCard, attach onClick to a wrapper div around the card (not the video area), or use `e.stopPropagation()` on the video container
**Warning signs:** Lightbox opens when user tries to play/pause video in card view

### Pitfall 2: Z-Index Conflicts
**What goes wrong:** Lightbox appears behind other elements
**Why it happens:** Filter dropdowns, badges, or other positioned elements have high z-index
**How to avoid:** Use `z-50` consistently (login modal already uses z-50 successfully)
**Warning signs:** Modal backdrop visible but content hidden

### Pitfall 3: Stale Saved State
**What goes wrong:** User saves ad in lightbox but card still shows unsaved
**Why it happens:** Lightbox and card reference different state copies
**How to avoid:** Both read from the same `savedAdIds` Set in the page component. The `toggleSaveAd` callback already does optimistic updates on this shared Set.
**Warning signs:** None expected if using shared state (already the pattern)

### Pitfall 4: Missing Data Graceful Degradation
**What goes wrong:** Lightbox crashes or looks broken when optional fields are null
**Why it happens:** Many fields are nullable (spend, impressions, targeting, endDate)
**How to avoid:** Every detail section must check for null/undefined and show "N/A" or hide entirely
**Warning signs:** TypeScript errors about possibly null values

### Pitfall 5: targetingJson Structure Unknown
**What goes wrong:** Rendering targeting data fails because structure varies
**Why it happens:** `targetingJson` is typed as `Json?` in Prisma (arbitrary JSON)
**How to avoid:** Inspect actual data in DB first. Render as key-value pairs or just show raw JSON formatted nicely. Add a type guard.
**Warning signs:** `[object Object]` rendered on screen

## Code Examples

### Expanding the Ad Type (types.ts)

```typescript
export interface Ad {
  id: string;
  adId: string;
  displayFormat: string | null;
  publisherPlatforms: string[];
  body: string | null;
  caption: string | null;
  title: string | null;
  linkDescription: string | null;   // NEW
  linkUrl: string | null;           // NEW
  ctaText: string | null;           // NEW
  ctaType: string | null;           // NEW
  snapshotUrl: string | null;
  bylines: string | null;
  startDate: string | null;
  endDate: string | null;           // NEW
  adDurationDays: number | null;    // NEW
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;  // NEW
  impressionsUpper: number | null;  // NEW
  spendLower: number | null;        // NEW
  spendUpper: number | null;        // NEW
  currency: string | null;          // NEW
  targetingJson: unknown;           // NEW
  brand: {
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    category: string | null;
  };
  assets: {
    id: string;
    assetType: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    originalUrl: string;
    downloadStatus: string;
    position: number;
  }[];
}
```

### AdCard onClick (minimal change)

```typescript
// Add onSelect prop
export function AdCard({ ad, darkMode, isSaved, onToggleSave, onSelect, compact }: {
  ad: Ad;
  darkMode: boolean;
  isSaved?: boolean;
  onToggleSave?: (adId: string) => void;
  onSelect?: () => void;  // NEW
  compact?: boolean;
}) {
  return (
    <div
      className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
        onSelect ? 'cursor-pointer' : ''
      } ...`}
      onClick={onSelect}  // clickable wrapper
    >
      {/* Preview area - stop propagation on interactive elements */}
      <div className="relative ..." onClick={e => {
        // Don't open lightbox when clicking video controls
        if ((e.target as HTMLElement).closest('video')) e.stopPropagation();
      }}>
        ...
      </div>

      {/* Buttons also stop propagation */}
      {onToggleSave && (
        <button onClick={e => { e.stopPropagation(); onToggleSave(ad.id); }} ...>
          ...
        </button>
      )}
      {ad.snapshotUrl && (
        <a onClick={e => e.stopPropagation()} href={ad.snapshotUrl} ...>
          View on Meta
        </a>
      )}
    </div>
  );
}
```

### Escape Key + Scroll Lock Hook

```typescript
function useModalBehavior(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);
}
```

### Formatting Spend Range

```typescript
function formatSpendRange(lower: number | null, upper: number | null, currency: string | null): string {
  if (!lower && !upper) return 'N/A';
  const curr = currency || 'EUR';
  const fmt = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(n);
  if (lower && upper) return `${fmt(lower)} - ${fmt(upper)}`;
  if (lower) return `${fmt(lower)}+`;
  return `Up to ${fmt(upper!)}`;
}
```

### Formatting Impressions Range

```typescript
function formatImpressionsRange(lower: number | null, upper: number | null): string {
  if (!lower && !upper) return 'N/A';
  if (lower && upper) return `${formatNumber(lower)} - ${formatNumber(upper)}`;
  if (lower) return `${formatNumber(lower)}+`;
  return `Up to ${formatNumber(upper!)}`;
}
```

## Existing Patterns to Reuse

| Pattern | Where It Exists | How to Reuse |
|---------|----------------|--------------|
| Modal overlay + backdrop | `page.tsx` login modal (line 427) | Same `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` |
| Click outside to close | `page.tsx` login modal | Same `onClick={onClose}` on overlay + `stopPropagation` on content |
| X close button | `page.tsx` login modal (line 434-440) | Same pattern with lucide `X` icon |
| Media rendering (image/video) | `ad-card.tsx` lines 27-63 | Reuse same logic at larger dimensions |
| Save toggle (optimistic) | `page.tsx` `toggleSaveAd` (line 261-289) | Pass same callback to lightbox |
| Format number | `v2-shell.tsx` `formatNumber` | Already imported in page |
| View on Meta link | `ad-card.tsx` line 152-159 | Same `<a>` with `snapshotUrl` |
| Date formatting | `[pageId]/page.tsx` `formatDate` function | Copy or extract to shared util |
| Dark mode conditional classes | Everywhere | Same `darkMode ? 'dark-class' : 'light-class'` pattern |

## Data Availability Assessment

### Available in Current API Response (HIGH confidence)
- Full ad copy (body, title, caption, linkDescription)
- Media assets (images, videos, thumbnails via R2)
- Reach estimate
- Spend range (spendLower, spendUpper, currency)
- Impressions range (impressionsLower, impressionsUpper)
- Dates (startDate, endDate, adDurationDays)
- Active status
- Platform distribution (publisherPlatforms array)
- CTA (ctaText, ctaType)
- Link URL (linkUrl)
- Partnership info (bylines)
- Snapshot URL (for View on Meta)
- Brand info (name, logo, category)

### Available but Quality Unknown (MEDIUM confidence)
- **targetingJson**: Field exists in DB schema and API response. Actual data population depends on Meta API response during ingestion. May be null for many ads. Need to check actual DB data.

### Not Available
- Demographic breakdown per ad (exists at brand level in `AdLibraryBrand.demographicsJson`, not per-ad)
- Ad performance over time (no time-series per ad)
- Competitor comparison data per ad

## Carousel Ad Handling

For carousel/DPA ads (multiple assets), the lightbox could show all carousel frames. The `assets` array is already ordered by `position`. Current ad card only shows the first asset. The lightbox is an opportunity to show all carousel frames with navigation dots/arrows. However, carousel ads are hidden by default, so this is a secondary concern.

## Open Questions

1. **targetingJson structure:** What does the actual data look like in the database? Need to query a few records to understand the shape before building the targeting display section.
   - What we know: Schema has `targetingJson Json?` on AdLibraryAd
   - What's unclear: Actual populated data shape, how many ads have it populated
   - Recommendation: Query DB for a sample during implementation, render defensively

2. **Carousel navigation in lightbox:** Should the lightbox support browsing multiple carousel frames?
   - Recommendation: Yes, if assets.length > 1, show navigation. Low effort since data is already there.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - Full AdLibraryAd model with all fields (lines 228-282)
- `src/app/api/ad-library/ads/route.ts` - API response type `AdLibraryAdResponse` (lines 36-81) showing all returned fields
- `src/app/dashboard/v2/ad-library/types.ts` - Current frontend `Ad` type (lines 24-52) showing the gap
- `src/app/dashboard/v2/ad-library/components/ad-card.tsx` - Current card component, no onClick handler
- `src/app/dashboard/v2/ad-library/page.tsx` - Login modal pattern (lines 427-504), save toggle logic (lines 261-289)
- `src/app/api/ad-library/saved/route.ts` - Save/unsave API (POST/DELETE)

### Secondary (MEDIUM confidence)
- `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` - Brand detail page with date formatting helper and alternative card layout

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all tools already in codebase
- Architecture: HIGH - All data flows verified by reading actual API and component code
- Data availability: HIGH for most fields, MEDIUM for targetingJson population
- Pitfalls: HIGH - Based on direct code analysis of existing patterns

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no external dependencies changing)
