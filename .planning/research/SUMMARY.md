# Project Research Summary

**Project:** Ad Library Pro — v5.1 Visual Consistency
**Domain:** Ad intelligence platform — visual consistency retrofit
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

The v5.1 milestone is a consolidation effort, not a technology adoption. The project already has all the right pieces — Tailwind CSS v4 with `@theme inline`, `@custom-variant dark`, and `next-themes` installed — but they are not connected. Three separate theming systems coexist: V1 uses CSS custom properties with a green palette, V2 uses 308+ inline `darkMode ?` ternaries with hardcoded hex, and shadcn/ui uses oklch variables with `.dark` class. The fix is wiring these into a single token-based system.

The biggest risk is not technical complexity but scope discipline. The temptation to refactor V2's 308 ternaries, rebuild V1's monolithic page, or extract a full design system will derail the milestone. V5.1 should focus narrowly: define unified tokens, add a shared header to V1, swap V1's green palette to blue, and add V1 dark mode support. V2 ternary cleanup can come later.

The critical ordering constraint: design tokens and dark mode infrastructure must be established before any component-level theming. Shipping partial dark mode (themed nav + unthemed content) is worse than no dark mode.

## Key Findings

### Recommended Stack

No new dependencies needed. The project already has `next-themes` (^0.4.6, only used by sonner.tsx), Tailwind v4 with `@theme inline` and `@custom-variant dark (&:is(.dark *))`, and CSS custom properties throughout. The work is consolidation:

- **CSS custom properties in `:root`/`.dark`**: Define unified `--ds-*` (or `--surface-*`, `--text-*`, `--brand-*`) tokens
- **`@theme inline`**: Register tokens as Tailwind utilities (`bg-surface-page`, `text-text-primary`)
- **`next-themes`**: Wire into root layout to manage `.dark` class on `<html>`, replacing V2's React state approach
- **Avoid**: New config files, CSS-in-JS, oklch conversion, or custom context providers for dark mode

### Expected Features

**Must have (table stakes):**
- Unified blue color palette on V1 (eliminates "two different products" feeling)
- Consistent brand identity — BarChart3 icon + "Ad Library Pro" everywhere (not "Ad Analyser")
- V1 navigation header with logo + upgrade CTA (replace 5-link nav)
- V1 dark mode support (reads same preference as V2)
- CTA fix — V1 points to `/#pricing` not `/coming-soon`

**Should have (differentiators):**
- Contextual upgrade prompt after free analysis results
- Smooth theme transition animations (`transition-colors`)
- Shared dark mode persistence via localStorage

**Defer:**
- V2 ternary cleanup (308 occurrences, separate milestone)
- V1 page refactoring (monolith is fine for now)
- Design system extraction / Storybook
- V1 sidebar navigation (V1 is single-purpose, not a dashboard)

### Architecture Approach

Three layout zones sharing one token layer, each with its own shell:

```
globals.css (unified tokens: :root + .dark)
    |
    +-- Landing (/) — forced dark, AppHeader, full-width
    +-- Analyser (/analyser) — AppHeader + centered content
    +-- Dashboard (/dashboard/v2) — V2Shell (sidebar) + tokens
```

**Major components:**
1. **Design tokens** in `globals.css` `:root`/`.dark` — single source of truth
2. **`@theme inline`** mappings — tokens → Tailwind utilities
3. **ThemeProvider** (via `next-themes`) — manages `.dark` class on `<html>`
4. **AppHeader** — shared top nav for landing + analyser (V2 keeps its sidebar header)

### Critical Pitfalls

1. **Two incompatible dark mode systems** — V2 uses React context ternaries, globals.css has unused `.dark` class. Must choose ONE approach for V1 (CSS class-based recommended) and sync via side effect.
2. **CSS variable collision** — Changing `:root` variables affects ALL pages including landing. Must namespace new tokens (`--ds-*`) or scope carefully.
3. **Recharts hardcoded colors** — Charts use literal hex for fills/strokes/ticks. Will be invisible or unreadable in dark mode. Every chart needs an audit.
4. **Navigation header breaks V1 layout** — V1 is a monolithic page with its own header. Inserting a shared nav creates double-header. Extract to `analyser/layout.tsx`.
5. **Partial dark mode is worse than none** — Dark header + light content looks broken. Ship V1 dark mode as atomic unit.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Design Tokens + Theme Infrastructure
**Rationale:** Everything depends on this — tokens are the foundation, theme provider is the mechanism.
**Delivers:** Unified CSS custom properties in `:root`/`.dark`, `@theme inline` mappings, `next-themes` wired into root layout.
**Addresses:** Token strategy (ARCHITECTURE), variable collision prevention (PITFALLS #3), dark mode persistence (PITFALLS UX1)
**Avoids:** Two incompatible dark mode systems (PITFALLS #1)
**No visual changes** — old variables coexist with new ones.

### Phase 2: V1 Navigation Header + Brand Identity
**Rationale:** Layout structure must be settled before component theming. Header is the most visible brand consistency element.
**Delivers:** `AppHeader` component, V1 layout.tsx extraction, brand lockup (BarChart3 + "Ad Library Pro"), CTA fix to `/#pricing`.
**Addresses:** Brand fragmentation (FEATURES table stakes), navigation declutter (FEATURES)
**Avoids:** Layout height breaks (PITFALLS #4), double-header (PITFALLS #4)

### Phase 3: V1 Theme Migration
**Rationale:** With tokens defined and layout settled, swap V1's green palette to blue and add dark mode support.
**Delivers:** V1 uses unified tokens, dark mode works on V1, Recharts themed for both modes.
**Addresses:** Color palette unification (FEATURES P0), dark mode (FEATURES P1), chart theming (PITFALLS #2)
**Avoids:** Partial dark mode (PITFALLS UX2) — ships as atomic unit

### Phase 4: Landing Page Polish + Cleanup
**Rationale:** Landing page comes last because it depends on knowing the final V1/V2 look. Cleanup removes old tokens.
**Delivers:** Landing page CTA/copy alignment, removal of old green Kiri Media tokens, minor polish.
**Addresses:** Landing page tweaks (PROJECT.md requirement), landing inconsistency (PITFALLS UX3)

### Phase Ordering Rationale

- **Tokens before components:** Every component change depends on tokens existing. Doing tokens first means zero wasted work.
- **Header before theme:** Layout structure changes (adding nav, extracting layout.tsx) should happen before color/theme work to avoid merge conflicts and double-work.
- **V1 dark mode as atomic unit:** Per PITFALLS UX2, partial dark mode looks broken. V1 theme + dark mode must ship together.
- **Landing last:** It already uses the blue palette. Minor alignment after V1 is settled.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (V1 Theme):** Recharts dark mode theming is tedious — needs file-by-file audit of chart components. 163 CSS variable references to update.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Tokens):** Well-documented Tailwind v4 patterns, infrastructure already exists
- **Phase 2 (Header):** Standard Next.js layout extraction, existing nav components to reference
- **Phase 4 (Polish):** Copy/CSS changes only

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new deps needed. All tools already installed and partially configured. |
| Features | HIGH | Based on direct codebase analysis — every inconsistency is observable in source. |
| Architecture | HIGH | Tailwind v4 `@theme inline` already in use; dependency chain clear from grep counts. |
| Pitfalls | HIGH | Specific to this codebase — 308 ternaries, 163 var references, 385 hardcoded hex measured directly. |

**Overall confidence:** HIGH

### Gaps to Address

- **Should V1 support dark mode toggle, or only read preference?** Research recommends: read from localStorage/system preference, no toggle UI on V1 itself.
- **Should landing page stay forced-dark or respect user preference?** Research recommends: keep forced dark (marketing material).
- **Font stack alignment:** V1 uses DM Sans via Google Fonts import, layout.tsx loads Geist via `next/font`. Shared nav needs one consistent font.
- **V2 ternary cleanup scope:** Not in v5.1, but the 308 ternaries create a visible inconsistency in code quality. Flag for v5.2.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `globals.css`, `v2-shell.tsx`, `v2-context.tsx`, `landing-nav.tsx`, `analyser/page.tsx`
- Tailwind CSS v4 official docs (dark mode, @theme directive)
- next-themes GitHub docs (v0.4.6)

### Secondary (MEDIUM confidence)
- SaaS UI design patterns (The Alien Design, Pencil & Paper, Appcues)
- Competitor analysis (AdSpy, BigSpy, Foreplay patterns)
- Community Tailwind v4 + next-themes integration guides

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
