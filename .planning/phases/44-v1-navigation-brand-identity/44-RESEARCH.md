# Phase 44: V1 Navigation & Brand Identity - Research

**Researched:** 2026-03-18
**Domain:** UI refactoring - navigation, branding, CTAs
**Confidence:** HIGH

## Summary

This phase is a straightforward UI refactoring of the V1 analyser page (`/analyser`). The page is a single 1639-line component at `src/app/analyser/page.tsx` with an inline navigation bar, old nav links, and a stale CTA. The work involves replacing the V1 header to match the landing page/V2 brand identity, removing dead nav links, updating one CTA, and adding a contextual upgrade card.

All code lives in one file. There is no `layout.tsx` for the analyser route -- everything is inline in the page component. The brand lockup pattern already exists in two places (landing nav and V2 shell sidebar) and just needs to be replicated.

**Primary recommendation:** Extract a reusable V1 header component matching the landing page `LandingNav` pattern, replace the inline nav, and add an upgrade card component after the results section.

## Standard Stack

No new libraries needed. This is pure refactoring of existing components.

### Core (already in project)
| Library | Purpose | Relevant Usage |
|---------|---------|----------------|
| `lucide-react` | Icons | `BarChart3` icon for brand lockup |
| `next/link` | Navigation | Logo link to `/`, CTA link to `/#pricing` |

### No New Dependencies Required

This phase only modifies existing code and creates new components from existing patterns.

## Architecture Patterns

### Current V1 Page Structure (analyser/page.tsx)
```
<> (Fragment)
  <div class="gradient-mesh" />           -- background
  <div class="noise-overlay" />           -- background
  <KiriMediaPopup />                      -- popup (keep)
  <FeedbackPopup />                       -- popup (keep)
  <main>
    <nav>                                 -- REPLACE THIS (lines 435-524)
      Logo: "Ad Analyser"                 -- plain text, no icon
      Desktop nav links                   -- How it works, About, Contact, Feedback, Roadmap
      CTA: "Pro - Coming Soon" -> /coming-soon
      Mobile menu button
      Mobile nav menu (same links)
    </nav>
    <div class="max-w-7xl mx-auto px-6 py-16">
      <header>                            -- hero section with title
      ... search/input section ...
      ... results section (lines ~1163-1597) ...
        <AccountSummary />
        Tab navigation (audience/ads/expert)
        Tab content panels
      </div>                              -- results wrapper closes at line 1598
    </div>                                -- UPGRADE CARD goes here, before footer
    <footer>                              -- existing simple footer (line 1601-1606)
  </main>
  <SubmitModal />                         -- roadmap modal (remove or keep?)
</>
```

### Brand Lockup Pattern (from LandingNav - lines 9-16)
```tsx
// Source: src/components/landing/landing-nav.tsx
<Link href="/" className="flex items-center gap-2.5 group">
  <div className="bg-[#1235e2] p-1.5 rounded-lg text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
    <BarChart3 className="w-4 h-4" strokeWidth={2} />
  </div>
  <span className="text-[15px] font-semibold text-white tracking-tight">
    Ad Library Pro
  </span>
</Link>
```

### V2 Shell Brand Lockup (from v2-shell.tsx - lines 110-118)
```tsx
// Source: src/app/dashboard/v2/v2-shell.tsx
<div className="bg-[#1235e2] p-1.5 rounded-lg text-white">
  <BarChart3 className="w-5 h-5" />
</div>
<div>
  <h1 className="text-base font-bold leading-none">Ad Library Pro</h1>
  <p className="text-xs text-slate-400">Analysis Tool</p>
</div>
```

### Landing Page CTA Pill Pattern (from LandingNav - lines 26-30)
```tsx
// Source: src/components/landing/landing-nav.tsx
<Link
  href="#pricing"
  className="inline-flex items-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
>
  Get Pro
</Link>
```

### Recommended New Header Pattern
The V1 header should closely match `LandingNav` but be simpler (no "Try Free" link since user is already on the free tool). Structure:

```tsx
<nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
  <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
    {/* Left - Brand lockup (matching landing-nav.tsx) */}
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="bg-[#1235e2] p-1.5 rounded-lg text-white">
        <BarChart3 className="w-4 h-4" strokeWidth={2} />
      </div>
      <span className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
        Ad Library Pro
      </span>
    </Link>

    {/* Right - Upgrade CTA pill */}
    <Link
      href="/#pricing"
      className="inline-flex items-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300"
    >
      Get Pro
    </Link>
  </div>
</nav>
```

### Upgrade Card Pattern (new component)
Place after the results section (after line ~1597), before the footer (line 1601). Should only render when `apiResult` exists (user has analysis results):

```tsx
{apiResult && (
  <div className="mt-12 p-6 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-center">
    <BarChart3 className="w-8 h-8 text-[#1235e2] mx-auto mb-3" />
    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
      Want deeper insights?
    </h3>
    <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
      Explore the full Ad Library Pro dashboard with saved brands,
      category browsing, and AI-powered creative analysis.
    </p>
    <Link
      href="/#pricing"
      className="inline-flex items-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-all duration-300"
    >
      Explore Pro Dashboard
    </Link>
  </div>
)}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand lockup | Custom icon+text combo | Copy pattern from `landing-nav.tsx` exactly | Visual consistency across pages |
| CTA button style | New button styles | Copy pill pattern from `landing-nav.tsx` | Design system consistency |
| Sticky header | Custom scroll behavior | Keep existing `sticky top-0 z-50` pattern | Already works |

## Common Pitfalls

### Pitfall 1: CSS Variable Mismatch
**What goes wrong:** V1 uses CSS custom properties (`var(--text-primary)`, `var(--bg-primary)`) while landing page and V2 use hardcoded Tailwind colors (`text-white`, `bg-[#101322]`).
**Why it happens:** V1 has its own theme system with CSS variables, landing page uses dark-mode-only hardcoded colors.
**How to avoid:** Keep using `var(--*)` tokens for the V1 header since the page uses them throughout. Only use hardcoded `#1235e2` for the brand accent (which is the same in both systems).
**Warning signs:** Brand lockup text invisible or wrong color.

### Pitfall 2: Missing Import Cleanup
**What goes wrong:** After removing nav links and mobile menu, unused imports remain (e.g., `Menu`, `X` from lucide-react).
**Why it happens:** The `Menu` and `X` icons are imported for the mobile hamburger menu. After removing nav links, the mobile menu toggle becomes unnecessary.
**How to avoid:** Check if `Menu` and `X` icons are used elsewhere in the component. Remove from imports if not needed. Note: `X` may still be used in `ActiveChartFilter` (line 62).
**Warning signs:** Linting warnings about unused imports.

### Pitfall 3: Forgetting the Mobile Menu
**What goes wrong:** Desktop nav links removed but mobile nav menu (lines 509-523) is left behind.
**Why it happens:** Mobile menu is in a separate `div` further down in the JSX.
**How to avoid:** Remove both the desktop nav links (lines 443-484), the mobile menu button (lines 496-505), AND the mobile menu div (lines 509-523).

### Pitfall 4: Roadmap Modal Becomes Orphaned
**What goes wrong:** The `SubmitModal` component (lines 1610-1636) and its state (`roadmapModalOpen`, `roadmapInitialQuery`) are no longer reachable after nav links are removed.
**Why it happens:** The roadmap link was the trigger path for this modal.
**How to avoid:** Check if the modal is triggered from anywhere else in the page (search the component for `setRoadmapModalOpen`). If only from nav, clean up the modal and its state.
**Warning signs:** Dead code warnings, unused state variables.

### Pitfall 5: Link vs Anchor Tag
**What goes wrong:** Using `<a href="/#pricing">` won't work correctly in Next.js for hash navigation to another page.
**Why it happens:** Need `<Link href="/#pricing">` for proper client-side navigation.
**How to avoid:** Use Next.js `Link` component. The landing nav already uses `href="#pricing"` (same-page), but V1 needs `href="/#pricing"` (cross-page to landing).

## Code Examples

### Exact Code to Remove (V1 header, lines 435-524)
The entire `<nav>` block from line 435 to line 524 should be replaced. Key sections:
- Lines 435-524: Full nav element (desktop links, CTA, mobile menu button, mobile menu)

### Exact CTA to Update (line 488-493)
```tsx
// CURRENT (line 488-493):
<a
  href="/coming-soon"
  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] transition-colors"
>
  Pro — Coming Soon
</a>

// REPLACE WITH (matching landing-nav pill style):
<Link
  href="/#pricing"
  className="inline-flex items-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-300"
>
  Get Pro
</Link>
```

### Upgrade Card Insertion Point
```
Line 1597: </div>   ← results wrapper closes
Line 1598: </div>   ← conditional results block closes
Line 1599: )}       ← closes the apiResult conditional
Line 1600: (empty)
Line 1601: {/* Footer */}  ← insert upgrade card BEFORE this
```

### Imports to Add
```tsx
import { BarChart3 } from 'lucide-react';  // for brand lockup
import Link from 'next/link';               // for proper Next.js links (currently uses <a> tags)
```

### Imports to Potentially Remove
```tsx
// Menu icon - only used for mobile hamburger (check if used elsewhere)
// X icon - used in ActiveChartFilter (line 62), so KEEP
import { Menu } from 'lucide-react';  // REMOVE if mobile menu is removed
```

### State to Potentially Remove
```tsx
// If roadmap modal is orphaned after nav removal:
const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
const [roadmapInitialQuery, setRoadmapInitialQuery] = useState('');
// AND the <SubmitModal> JSX (lines 1610-1636)
// AND the SubmitModal import (line 27)
```

## Specific File Changes Map

| File | Change | Lines |
|------|--------|-------|
| `src/app/analyser/page.tsx` | Replace nav block with branded header | 435-524 |
| `src/app/analyser/page.tsx` | Add `BarChart3` to imports, add `Link` import | 28, top |
| `src/app/analyser/page.tsx` | Insert upgrade card before footer | ~1600 |
| `src/app/analyser/page.tsx` | Remove `Menu` from imports (if unused) | 28 |
| `src/app/analyser/page.tsx` | Remove roadmap modal + state (if orphaned) | 152-154, 1610-1636 |

## Open Questions

1. **Should the SubmitModal (roadmap request) be kept?**
   - What we know: It's triggered from a "not found" state in the search bar (line 561: `setRoadmapModalOpen(true)`) -- NOT just from the nav.
   - What's unclear: Whether this is still a desired feature.
   - Recommendation: KEEP the modal since it has a non-nav trigger. Only remove the nav links.

2. **Should KiriMediaPopup and FeedbackPopup stay?**
   - What we know: These are promotional/feedback popups unrelated to navigation.
   - Recommendation: Leave them. Out of scope for this phase.

3. **V1 uses CSS custom properties (var(--*)) while landing page uses hardcoded colors**
   - What we know: V1 has a different theming approach.
   - Recommendation: Use `var(--text-primary)` for text that should respect the V1 theme, but use hardcoded `#1235e2` for brand accent and `text-white` inside the brand icon box (same as landing nav).

## Sources

### Primary (HIGH confidence)
- `src/app/analyser/page.tsx` - Full V1 page component (1639 lines), navigation lines 435-524
- `src/components/landing/landing-nav.tsx` - Landing page brand lockup + CTA pill pattern (36 lines)
- `src/app/dashboard/v2/v2-shell.tsx` - V2 brand lockup pattern (lines 110-118)

### Verification
- Grep confirmed only ONE `/coming-soon` reference in entire `src/` directory (analyser page line 489)
- No `layout.tsx` exists for the analyser route -- all UI is in `page.tsx`
- `BarChart3` is already used in 21 files across the project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure refactoring
- Architecture: HIGH - all source files read and line numbers verified
- Pitfalls: HIGH - identified from direct code inspection
- Code examples: HIGH - copied directly from existing codebase

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable - internal refactoring only)
