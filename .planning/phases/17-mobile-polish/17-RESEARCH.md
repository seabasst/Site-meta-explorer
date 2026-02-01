# Phase 17: Mobile Polish - Research

**Researched:** 2026-02-01
**Domain:** Responsive CSS / Mobile UX / Touch Interaction
**Confidence:** HIGH

## Summary

This research investigates what is needed to make the Ad Library Demographics Analyzer fully responsive and touch-friendly on mobile devices. The app is built with Next.js 16 + React 19 + Tailwind v4 + Recharts 3.6 + shadcn/ui components.

The current codebase has **partial responsive support**. The navigation already has a mobile hamburger menu (md breakpoint), the ad preview grid uses responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, and some grids use `grid-cols-2 sm:grid-cols-4`. However, many critical areas are NOT responsive: the options bar (Ads/Region/Depth/Date filters) overflows on mobile, tables use fixed-width columns with no horizontal scroll wrapper, several grids assume desktop widths (e.g., `grid-cols-5` for hook patterns, `grid-cols-3` for stats, `grid-cols-4` for landing page stats), and the media type section uses a horizontal `flex items-center gap-8` that breaks on narrow screens. Charts with hover-only tooltips have no touch equivalents.

**Primary recommendation:** Fix layout overflow issues first (options bar, stats grids, tables), then add touch support to charts, and finally ensure all interactive elements meet the 48x48px touch target minimum.

## Standard Stack

No new libraries needed. The existing stack handles mobile well when used correctly.

### Core (already installed)
| Library | Version | Purpose | Mobile Relevance |
|---------|---------|---------|-----------------|
| Tailwind CSS | v4 | Responsive utilities | `sm:`, `md:`, `lg:` prefixes are mobile-first by default |
| Recharts | v3.6 | Charts | `ResponsiveContainer` already used; supports touch events natively |
| shadcn/ui | latest | UI components | Components are responsive by default |
| Next.js | 16.1.2 | Framework | `viewport` meta tag should be verified in layout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom horizontal scroll | `react-horizontal-scrolling-menu` | Overkill; CSS `overflow-x-auto` is sufficient |
| Touch gesture library | `@use-gesture/react` | Not needed; click/tap handlers work fine for this app |

## Architecture Patterns

### Pattern 1: Mobile-First Responsive Grid Overrides

**What:** Change grid column counts at breakpoints using Tailwind responsive prefixes.
**When to use:** Whenever a grid has more than 2 columns.
**Example:**
```tsx
// BEFORE (breaks on mobile)
<div className="grid grid-cols-5 gap-2">

// AFTER (stacks on mobile, wraps on tablet)
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
```

### Pattern 2: Horizontal Scroll for Tables

**What:** Wrap tables in a horizontal scroll container for mobile.
**When to use:** All data tables with more than 2-3 columns.
**Example:**
```tsx
<div className="overflow-x-auto -mx-5 px-5">
  <table className="min-w-[600px] w-full text-sm">
    {/* table content */}
  </table>
</div>
```

### Pattern 3: Flex Wrap for Filter/Options Bars

**What:** Allow filter controls to wrap onto multiple rows on narrow screens.
**When to use:** Horizontal bars with multiple controls (the options row is the main offender).
**Example:**
```tsx
// Already uses flex-wrap but needs the dividers (w-px h-6) to be hidden on mobile
<div className="mt-4 flex items-center gap-4 flex-wrap">
  {/* Hide dividers on mobile */}
  <div className="w-px h-6 bg-[var(--border-subtle)] hidden sm:block" />
```

### Pattern 4: Touch-Friendly Chart Interaction

**What:** Replace hover-only interactions with tap/click equivalents on touch devices.
**When to use:** All charts with `onMouseEnter`/`onMouseLeave` hover handlers.
**Example:**
```tsx
// age-gender-chart.tsx and country-chart.tsx currently rely on hover for tooltips.
// Solution: Use click/tap to toggle tooltip visibility instead of hover.
// The charts already have onClick handlers for filtering; the hover tooltip
// content should be made always-visible or tap-toggleable on mobile.

// Alternative: Show the breakdown values below the bar at all times on small screens
// rather than requiring hover.
```

### Pattern 5: Stacked Layout for Side-by-Side Elements

**What:** Convert horizontal layouts to vertical stacks on mobile.
**When to use:** Media type breakdown (video|divider|image), stats rows.
**Example:**
```tsx
// BEFORE
<div className="flex items-center gap-8">
  {/* Video stats */}
  <div className="h-12 w-px bg-[var(--border-subtle)]" />
  {/* Image stats */}
</div>

// AFTER
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8">
  {/* Video stats */}
  <div className="h-px w-full sm:h-12 sm:w-px bg-[var(--border-subtle)]" />
  {/* Image stats */}
</div>
```

### Anti-Patterns to Avoid
- **Fixed pixel widths on containers:** Use `max-w-*` with percentage fallbacks, not fixed `w-[300px]`.
- **Hover-only interactions:** Always provide a tap/click alternative.
- **Hiding content on mobile:** Prefer reformatting (stack, scroll) over hiding. Users on mobile want the same data.
- **Tiny close buttons / interactive targets:** The `w-3.5 h-3.5` close button on ActiveChartFilter is too small (14px) for touch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive containers | Custom resize observers | Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`) | Built-in, zero JS overhead |
| Chart responsiveness | Custom SVG viewBox scaling | Recharts `ResponsiveContainer` (already used) | Already handles resize events |
| Touch target sizing | Complex hit-area extensions | `min-h-[48px] min-w-[48px]` + padding | CSS-only, WCAG compliant |
| Table scrolling | Custom scroll implementations | `overflow-x-auto` wrapper | Browser-native, performant |
| Viewport configuration | Manual meta tags | Next.js `viewport` export in layout.tsx | Framework handles it |

## Common Pitfalls

### Pitfall 1: Options Bar Overflow
**What goes wrong:** The filter options bar (Ads, Region, Depth, Date range) is a single flex row with `flex-wrap` but includes thin divider elements (`w-px h-6`) that look awkward when wrapped. The date inputs also take significant width.
**Why it happens:** Desktop layout assumed; dividers are visual separators that don't work in a wrapped layout.
**How to avoid:** Hide dividers below `sm:` breakpoint. Group related controls (e.g., Ads toggle + Region toggle on one row, Depth + Date on another). Consider a collapsible "Filters" section on mobile.
**Warning signs:** Horizontal scrollbar on the page, content cut off.

### Pitfall 2: Hover-Only Tooltips on Touch Devices
**What goes wrong:** Age/gender chart and country chart show breakdown data only on `onMouseEnter`. On touch devices, there's no hover state.
**Why it happens:** Desktop-first design using mouse events.
**How to avoid:** Show summary data inline (always visible), or use tap-to-toggle. The charts already have `onClick` for filtering; tooltips could show on the same tap.
**Warning signs:** Users can't see percentage breakdowns on mobile.

### Pitfall 3: Table Columns Squished on Mobile
**What goes wrong:** The "all ads" table and results table have 4-5 columns that become unreadable at 375px width.
**Why it happens:** Tables don't wrap; columns compress to minimum content width.
**How to avoid:** Wrap in `overflow-x-auto` container. Set `min-w-[600px]` on the table. Alternatively, convert to a card layout on mobile.
**Warning signs:** Text wrapping inside table cells making them very tall, or horizontal overflow.

### Pitfall 4: Touch Targets Too Small
**What goes wrong:** Many interactive elements are smaller than 48x48px.
**Why it happens:** Designed for mouse precision.
**Specific offenders found in codebase:**
- ActiveChartFilter close button: `w-3.5 h-3.5` (14px) with `p-0.5` padding = ~18px
- Example brand pills: `px-3 py-1.5 text-xs` = roughly 30px height
- Tab pills for sort/filter: similar size
- Copy URL buttons in tables: `p-2` with `w-4 h-4` icon = 32px
- Date inputs: small native inputs
**How to avoid:** Ensure minimum 44-48px touch target size (use padding to expand hit area without changing visual size).

### Pitfall 5: Fixed-Width Grids
**What goes wrong:** `grid-cols-5` (hook patterns), `grid-cols-3` (time trends stats, ad longevity stats), `grid-cols-4` (landing page stats) don't adapt to mobile.
**Why it happens:** Missing responsive breakpoint variants.
**How to avoid:** Add mobile breakpoints: `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` etc.

### Pitfall 6: Country Chart Label Truncation
**What goes wrong:** Country chart has `w-36 flex-shrink-0` (144px) for the label column. On a 375px screen this takes 40% of width.
**Why it happens:** Fixed width assumed desktop space.
**How to avoid:** Reduce label width on mobile: `w-20 sm:w-36`. Use 2-letter country codes on mobile instead of full names.

## Code Examples

### Responsive Grid Pattern
```tsx
// For hook patterns (currently grid-cols-5)
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">

// For stats cards (currently grid-cols-3)
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

// For account summary (already has grid-cols-2 lg:grid-cols-4 - GOOD)
```

### Touch Target Minimum Size
```tsx
// Expand hit area without changing visual size
<button className="p-3 -m-1 min-h-[48px] min-w-[48px] flex items-center justify-center">
  <X className="w-3.5 h-3.5" />
</button>
```

### Table Mobile Wrapper
```tsx
<div className="overflow-x-auto">
  <table className="min-w-[640px] w-full text-sm">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

### Collapsible Options for Mobile
```tsx
// Wrap the dense options bar in a collapsible on mobile
<div className="mt-4">
  {/* Always visible on desktop */}
  <div className="hidden sm:flex items-center gap-4 flex-wrap">
    {/* current options content */}
  </div>
  {/* Collapsible on mobile */}
  <details className="sm:hidden">
    <summary className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
      <svg className="w-4 h-4" ... />
      Filters & Options
    </summary>
    <div className="mt-3 space-y-3">
      {/* Same controls, stacked vertically */}
    </div>
  </details>
</div>
```

### Responsive Media Type Section
```tsx
// Currently uses flex with gap-8 horizontally
// Change to stack on mobile
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-8">
  <button className="flex items-center gap-3 ... min-h-[48px]">
    {/* Video */}
  </button>
  <div className="h-px sm:h-12 w-full sm:w-px bg-[var(--border-subtle)]" />
  <button className="flex items-center gap-3 ... min-h-[48px]">
    {/* Image */}
  </button>
</div>
```

## Inventory of Components Needing Mobile Work

### HIGH Priority (layout breaks on mobile)
| Component | File | Issue |
|-----------|------|-------|
| Options bar (Ads/Region/Depth/Date) | `page.tsx` ~L606-705 | Overflows; dividers break on wrap; date inputs too wide |
| Media type breakdown | `page.tsx` ~L1303-1401 | `flex gap-8` doesn't stack on mobile |
| Hook patterns grid | `ad-copy-analysis.tsx` L163 | `grid-cols-5` - needs `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` |
| Landing page stats grid | `landing-page-analysis.tsx` L147 | `grid-cols-4` - needs responsive |
| Ad longevity stats | `ad-longevity.tsx` L88 | `grid-cols-3` - needs responsive |
| Time trends stats | `time-trends.tsx` L159 | `grid-cols-3` - needs responsive |
| All ads table | `page.tsx` ~L1487-1553 | No horizontal scroll wrapper; 5 columns |
| Product market table grid | `product-market-table.tsx` L166, L272 | `grid-cols-4`, `grid-cols-3` |
| Results table | `results-table.tsx` | Needs overflow-x-auto wrapper |

### MEDIUM Priority (touch/interaction issues)
| Component | File | Issue |
|-----------|------|-------|
| Age/gender chart tooltips | `age-gender-chart.tsx` | Hover-only breakdown display |
| Country chart tooltips | `country-chart.tsx` | Hover-only tooltip (`isHovered` state) |
| Country chart label width | `country-chart.tsx` L119 | Fixed `w-36` too wide on mobile |
| ActiveChartFilter close button | `page.tsx` ~L58 | 14px icon with 2px padding; needs 48px touch target |
| Tab navigation | `page.tsx` ~L1067-1107 | Tab buttons may overflow on small screens |
| Export dropdown | `page.tsx` ~L932-997 | Group hover dropdown; needs tap support on mobile |

### LOW Priority (minor polish)
| Component | File | Issue |
|-----------|------|-------|
| Example brand pills | `page.tsx` ~L712-731 | Small touch targets (~30px height) |
| Copy URL buttons | `results-table.tsx` | 32px touch target |
| Header title size | `page.tsx` ~L460 | `text-5xl md:text-6xl` already responsive - OK |
| Nav mobile menu | `page.tsx` ~L440-451 | Already implemented - OK |

## Tailwind v4 Responsive Notes

Tailwind v4 uses the same mobile-first responsive design approach:
- Default styles apply to all screen sizes (mobile first)
- `sm:` = 640px and up
- `md:` = 768px and up
- `lg:` = 1024px and up
- `xl:` = 1280px and up
- These are unchanged from Tailwind v3

**Tailwind v4 specific:** Uses `@import "tailwindcss"` instead of directives. The `@theme inline` block in globals.css is the v4 way to define custom theme values. No `tailwind.config.js` needed (confirmed: none exists in project).

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@media` queries in CSS | Tailwind responsive prefixes | Already using Tailwind; no CSS media queries needed |
| Separate mobile layouts | Responsive single layout with breakpoints | One codebase, no duplication |
| `hover:` for tooltips | Click/tap + `@media (hover: hover)` | CSS can detect hover capability |

**Useful CSS media query for hover detection:**
```css
/* Only apply hover effects on devices that support hover */
@media (hover: hover) {
  .hover-tooltip { /* show on hover */ }
}
@media (hover: none) {
  .hover-tooltip { /* show on tap or always visible */ }
}
```

However, in this codebase, hover is handled via React state (`onMouseEnter`/`onMouseLeave`), not CSS `:hover`. So the fix should be done at the React level (tap-to-toggle or always-visible on mobile).

## Open Questions

1. **Breakpoint for "mobile":** Should we target 375px (iPhone SE) or 390px (modern iPhone)? Recommendation: Test at 375px as the minimum, which is the smallest common viewport.

2. **Table card layout vs horizontal scroll:** For the ads table on mobile, should we convert rows to cards (more work, better UX) or just add horizontal scroll (less work, adequate UX)? Recommendation: Horizontal scroll for phase 17 (quick win), card layout can be a future enhancement.

3. **Options bar approach:** Collapsible details element vs stacked vertical layout? Recommendation: Stacked vertical on mobile (cleaner, no hidden state).

## Sources

### Primary (HIGH confidence)
- Codebase audit: All 50+ TSX component files reviewed for responsive patterns
- Tailwind v4 documentation: Responsive design uses same mobile-first breakpoints as v3
- WCAG 2.1 SC 2.5.5: Touch target minimum 44x44px (AAA), 48x48px (Material Design recommendation)

### Secondary (MEDIUM confidence)
- Recharts `ResponsiveContainer`: Already in use in `media-type-chart.tsx` and `time-trends.tsx`; handles resize automatically
- shadcn/ui components: Built on Radix primitives which handle touch events natively

## Metadata

**Confidence breakdown:**
- Component inventory: HIGH - direct codebase audit of all files
- Responsive patterns: HIGH - standard Tailwind patterns, well-documented
- Touch target requirements: HIGH - WCAG standard, industry consensus
- Recharts mobile: HIGH - `ResponsiveContainer` is the documented approach
- Hover-to-touch migration: MEDIUM - approach is sound but needs testing

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable domain, patterns unlikely to change)
