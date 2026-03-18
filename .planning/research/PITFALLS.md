# Pitfalls Research

**Domain:** Ad intelligence platform -- visual consistency retrofit (v5.1)
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct codebase analysis)

## Critical Pitfalls

### Pitfall 1: Two Incompatible Dark Mode Systems

**What goes wrong:** V2 uses a React context boolean (`darkMode` from `useV2()`) with inline ternaries (`darkMode ? 'bg-[#101322]' : 'bg-[#f6f6f8]'`). The globals.css has a `.dark` CSS class selector for shadcn/ui variables. V1 uses neither -- it only reads `:root` CSS custom properties. Adding dark mode to V1 requires choosing ONE system, and the wrong choice creates a maintenance nightmare where some pages use context ternaries and others use CSS classes.

**Why it happens:** V2 was built independently with its own `V2Provider` context. The `.dark` class in globals.css exists for shadcn/ui components but V2 never actually toggles it -- V2 uses inline ternaries instead. There are 308 occurrences of `darkMode ?` ternaries across V2 files.

**How to avoid:** Do NOT introduce a third dark mode approach. The choice is:
- **Option A (recommended):** Use CSS custom properties + `.dark` class for V1. This is already partially set up in globals.css. V1 components already use `var(--text-primary)`, `var(--bg-secondary)` etc. Just add dark-mode overrides for these variables under `.dark`. This is the path of least resistance for V1.
- **Option B:** Wrap V1 in a provider and use ternaries like V2. This would require touching every V1 component. Not worth it.

**Warning signs:** If you find yourself creating a new context provider for V1 dark mode, or if dark mode works on V2 but not V1 (or vice versa), the systems are diverging.

**Phase to address:** First phase -- decide the dark mode strategy before touching any components. Document the decision. For v5.1 specifically: use CSS variable overrides in `.dark` for V1, and ensure the `.dark` class gets toggled on `<html>` or `<body>` when V2's `darkMode` state changes.

---

### Pitfall 2: Recharts Hardcoded Colors Invisible in Dark Mode

**What goes wrong:** V1 analytics components pass hardcoded hex colors to Recharts: `#3b82f6` (blue), `#f43f5e` (rose), `#f59e0b` (amber), `#a3e635` (lime), plus `MEDIA_COLORS` and `COUNTRY_COLORS` constants. These are chosen for light backgrounds. On a dark background like `#101322`, some will lose contrast badly -- particularly the amber and lime on dark surfaces. Axis labels, grid lines, and tooltip backgrounds are also typically Recharts defaults (black text, white backgrounds) which break in dark mode.

**Why it happens:** Recharts does not natively support CSS custom properties in its `fill`/`stroke` props. You pass literal color strings. Teams forget about: (1) axis tick labels, (2) tooltip container backgrounds, (3) legend text, (4) cartesian grid lines -- all of which default to light-mode-friendly colors.

**How to avoid:**
1. Create a `useChartTheme()` hook or similar that returns color sets based on current theme
2. Audit every Recharts component in `src/components/analytics/` and `src/components/demographics/` for hardcoded colors
3. Recharts `XAxis`, `YAxis` accept `tick={{ fill: 'color' }}` and `Tooltip` accepts `contentStyle` -- these MUST be set
4. Test every chart in both modes. Do not assume "it renders" means "it's readable"

**Warning signs:** Charts render but text is invisible, tooltips have white-on-white text, grid lines disappear against dark background.

**Phase to address:** Should be its own focused sub-task AFTER the base dark mode toggle works. Chart theming is tedious but not complex -- it just requires touching many files.

---

### Pitfall 3: CSS Variable Collision Between V1 and V2 Color Systems

**What goes wrong:** V1's globals.css defines `--accent-primary: #1a3933` (dark green), `--accent-green: #1a3933`, `--accent-yellow: #f59e0b`. V2 uses `#1235e2` (blue) as its primary. The landing page has yet another visual language. When retrofitting V1 to match V2's design system, changing the CSS variables in `:root` will affect ALL pages that use them -- including the landing page components that may rely on the green/amber palette.

**Why it happens:** CSS custom properties in `:root` are global. V1 and the landing page both consume the same variables. Changing `--accent-primary` from green to blue to match V2 will cascade everywhere.

**How to avoid:**
1. **Scope the variable changes.** Do NOT change `:root` variables to V2's blue. Instead, scope V2-themed variables to a class or layout boundary: `.v2-theme { --accent-primary: #1235e2; }`
2. OR: Introduce a new namespace for V2 colors (`--v2-primary`, `--v2-accent`) and migrate V1 to use them, leaving the old variables for landing page
3. **Best approach for v5.1:** Since the goal is making V1 visually consistent with V2, add the V2 color palette as new variables and update V1 components to reference them. Leave `:root` defaults untouched so landing page is unaffected.

**Warning signs:** Landing page colors change unexpectedly. Green elements suddenly turn blue. Buttons on landing page look different after "V1 only" changes.

**Phase to address:** First phase -- establish color variable strategy before any component migration.

---

### Pitfall 4: Navigation Header Breaks V1 Layout Height Calculation

**What goes wrong:** V1 (`/analyser`) is currently a full-page component with its own header/search area. Adding a shared navigation header on top pushes content down, potentially breaking: (1) sticky positioned elements, (2) `h-screen` / `100vh` calculations, (3) scroll containers that assumed they started at viewport top, (4) the gradient-mesh fixed background positioning.

**Why it happens:** V1's `page.tsx` is a large monolithic component (~700+ lines) that manages its own layout including a header area with search, auth controls, and navigation. Inserting a site-wide nav above it creates a double-header or pushes the search area down awkwardly.

**How to avoid:**
1. Audit V1's page.tsx for any `h-screen`, `100vh`, `min-h-screen`, `sticky top-0` usage
2. The shared nav should be in a layout file (`/analyser/layout.tsx`) NOT injected into page.tsx
3. Use `h-[calc(100vh-NAV_HEIGHT)]` or `h-dvh` patterns for content areas below the nav
4. Remove V1's existing header/nav elements that will be replaced, don't layer on top

**Warning signs:** Double headers, content pushed below fold, sticky elements overlap with new nav, mobile layout breaks.

**Phase to address:** Navigation header integration phase. Do this BEFORE detailed component styling -- layout structure first, then colors/theme.

## Technical Debt Patterns

### Debt 1: 308 Inline Dark Mode Ternaries in V2

**What it is:** Every V2 component uses `darkMode ? 'dark-class' : 'light-class'` instead of CSS-driven theming. This is existing debt, not new -- but v5.1 must decide whether to perpetuate this pattern in V1 or use the cleaner CSS variable approach.

**Risk for v5.1:** If V1 adopts CSS variables for dark mode (recommended) while V2 keeps ternaries, there are now two working-but-different dark mode systems. This is acceptable for v5.1 scope but should be flagged for future unification.

**Recommendation:** For v5.1, use CSS variables for V1 dark mode. Do NOT refactor V2's ternaries in this milestone -- that is a separate task. Accept the divergence as temporary.

### Debt 2: V1 Component Monolith

**What it is:** `analyser/page.tsx` exceeds 25,000 tokens. It contains inline components (`LoadingSpinner`, `ActiveChartFilter`), state management, layout, and UI all in one file. Adding theme awareness to this file will make it even larger.

**Risk for v5.1:** Every theme-related change in V1 touches this enormous file. Merge conflicts are likely if other work happens in parallel.

**Recommendation:** If extracting layout/header into a separate layout.tsx, that naturally shrinks page.tsx. Do not attempt a full refactor of page.tsx in v5.1 -- just extract what is needed for the nav header.

## Performance Traps

### Trap 1: Re-renders from Dark Mode Context

**What goes wrong:** V2's `useV2()` context triggers re-renders of the entire V2 subtree when `darkMode` changes. If V1 also subscribes to this context (to sync dark mode state), every V1 component that calls `useV2()` will re-render on toggle. Recharts components are expensive to re-render.

**How to avoid:**
- V1 should read dark mode from CSS (the `.dark` class approach) not from React context
- If you must sync: toggle the `.dark` class on `document.documentElement` as a side effect of V2's `setDarkMode`, then V1 reads from CSS -- no React re-renders needed for theme
- Memoize chart components if they receive theme colors as props

### Trap 2: Font Loading Flash

**What goes wrong:** globals.css imports `DM Sans` and `Instrument Serif` via Google Fonts URL, while layout.tsx loads `Geist` and `Geist_Mono` via `next/font`. V1 uses `var(--font-sans)` which maps to DM Sans. V2 pages may use different fonts. Adding a shared nav that uses one font system to a page using another causes FOUT (Flash of Unstyled Text) or mismatched typography.

**How to avoid:** Decide on ONE font stack for the shared navigation. Since the nav appears on both V1 and V2 pages, use the system that is loaded in `layout.tsx` (Geist) or ensure DM Sans is also available via `next/font` for better loading performance. Do not mix Google Fonts `@import` with `next/font` for the same components.

## UX Pitfalls

### UX 1: Dark Mode State Not Persisted

**What goes wrong:** V2's `darkMode` state lives in React `useState(false)` -- it resets to light mode on every page load. Users toggle dark mode, navigate away, come back, and it is light again. This is already a V2 bug but becomes more visible when V1 also supports dark mode.

**How to avoid:** Persist dark mode preference to `localStorage`. Read it on mount. Better yet, use `prefers-color-scheme` media query as default and localStorage as override.

**Phase to address:** Dark mode infrastructure phase, before per-component theming.

### UX 2: Partial Dark Mode is Worse Than No Dark Mode

**What goes wrong:** If the nav header is dark-mode-aware but the V1 content below it is not (or vice versa), the page looks broken -- a dark header on a light body, or dark body with light charts. Users perceive this as a bug, not a work-in-progress.

**How to avoid:** Ship dark mode for V1 as an atomic unit: nav + page content + charts all themed together, or none of them. Do not ship partial dark mode to production.

**Phase to address:** This means dark mode should be a single phase that covers all V1 elements, not spread across multiple phases.

### UX 3: Landing Page Inconsistency After V1 Retrofit

**What goes wrong:** After making V1 match V2's blue design system, the landing page (/) still uses the old green/amber palette. The user flow is: Landing (green) -> Analyser V1 (now blue) -> Dashboard V2 (blue). The landing page becomes the odd one out. Users notice the jarring transition.

**How to avoid:** v5.1 scope includes "minor landing page tweaks" -- use this to at least align the primary accent color and navigation style with the new V1/V2 look. Full landing page redesign is not needed, but the nav bar and CTA buttons should use the blue system.

**Phase to address:** Landing page tweaks should come AFTER V1 retrofit, so you know exactly what the target look is.

## "Looks Done But Isn't" Checklist

These are things that appear correct during development but break in production or edge cases:

- [ ] **Focus ring colors** -- Tailwind's default focus rings may not match either theme. Check `outline-ring/50` in the base layer.
- [ ] **Selection highlight color** -- Text selection (`::selection`) background defaults to browser blue, which may clash with dark mode backgrounds.
- [ ] **Scrollbar theming** -- globals.css has custom scrollbar styles using V1's variables. These will look wrong if the page background changes to V2's palette.
- [ ] **Sonner toast theming** -- The `<Toaster>` in layout.tsx uses `richColors`. Toasts may not respect dark mode.
- [ ] **Skeleton loading states** -- V1 uses `ResultsSkeleton` component. Its shimmer colors are likely hardcoded for light backgrounds.
- [ ] **Error states** -- `ApiErrorAlert` may have colors that work on light but not dark.
- [ ] **Modal/popup overlays** -- `KiriMediaPopup`, `FeedbackPopup`, `SubmitModal` all have their own background/border colors that may not adapt.
- [ ] **Print styles** -- If anyone prints the analyser page, dark mode backgrounds will waste ink. Add `@media print` reset.
- [ ] **Mobile sidebar/menu** -- V1 has a hamburger menu (`Menu` icon imported). Its flyout colors need to match the new theme.
- [ ] **Chart export/screenshot** -- If users can export charts (PDF export exists in V1), the exported colors should match what they see on screen, not the opposite theme.

## Recovery Strategies

If something goes wrong during the retrofit:

### Strategy 1: Feature Flag the Theme

Wrap the new V1 theme in a feature flag (URL param or localStorage key). If visual regressions are found in production, disable the flag to revert to old styles without a code deploy.

```typescript
// Simple approach
const useNewTheme = typeof window !== 'undefined' &&
  localStorage.getItem('v1-new-theme') !== 'false';
```

### Strategy 2: Snapshot Visual Tests

Before starting, screenshot every V1 page state (empty, loading, results, error) in both light and dark mode. Compare after changes. Tools: Playwright `page.screenshot()` is already available in the project (Puppeteer is used for asset extraction, similar API).

### Strategy 3: CSS Layer Isolation

Use Tailwind v4's `@layer` support to isolate V1 retrofit styles. If they cause problems, comment out the layer.

```css
@layer v1-retrofit {
  .analyser-page { /* new theme styles */ }
}
```

## Pitfall-to-Phase Mapping

| Phase | Pitfall to Watch | Severity |
|-------|-----------------|----------|
| Dark mode infrastructure | Two incompatible systems (#1), State not persisted (UX1) | CRITICAL |
| Color variable strategy | CSS variable collision (#3), Landing inconsistency (UX3) | CRITICAL |
| Navigation header | Layout height breaks (#4), Font loading flash (Perf2) | HIGH |
| V1 component theming | Partial dark mode (UX2), Scrollbar/toast/modal misses | HIGH |
| Recharts dark mode | Hardcoded colors (#2), Re-render perf (Perf1) | HIGH |
| Landing page tweaks | Landing inconsistency (UX3), Variable collision (#3) | MEDIUM |

**Recommended phase order based on pitfall dependencies:**

1. **Dark mode infrastructure** -- Decide system, persist state, wire up `.dark` class toggle
2. **Color variable strategy** -- Define V2-aligned variables scoped to V1, protect landing page
3. **Navigation header** -- Layout structure change, must precede component theming
4. **V1 component theming** -- Apply new variables, ship as atomic unit
5. **Recharts dark mode** -- Tedious but isolated; can be parallelized with #4
6. **Landing page alignment** -- Last, since it depends on knowing the final V1/V2 look

## Sources

- Direct codebase analysis: `src/app/globals.css` (lines 1-529), `src/app/dashboard/v2/v2-context.tsx`, `src/app/dashboard/v2/v2-shell.tsx`, `src/app/analyser/page.tsx`, `src/components/analytics/trend-analysis.tsx`, `src/components/demographics/demographics-summary.tsx`
- Tailwind CSS v4 `@custom-variant dark` usage confirmed in globals.css line 5
- Recharts color handling confirmed via grep of `fill=`/`stroke=` props across analytics components
- V2 dark mode ternary count (308 occurrences across 17 files) verified via codebase grep
