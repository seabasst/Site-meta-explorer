# Stack Research: Visual Consistency Theming

**Domain:** Ad intelligence platform -- visual consistency across V1/V2
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

The project already has most of the right pieces in place. The gap is not missing technology -- it is fragmented usage of what exists. V2 uses a custom `darkMode` boolean via React context with hardcoded hex values (`#101322`, `#f6f6f8`, `#1235e2`), while V1/landing use CSS custom properties from `:root` with a completely different color palette (green-tinted Kiri Media branding). The `globals.css` already uses Tailwind v4 `@theme inline` and `@custom-variant dark`, but the V2 shell ignores both of these in favor of inline ternaries.

The fix is consolidation, not new libraries. Define the V2 design system colors as CSS custom properties, wire them through `@theme inline`, replace the V2 context-based `darkMode` with the standard `next-themes` + `.dark` class approach that the codebase already partially supports, then update V1 to consume the same tokens.

## Current State Analysis

### What exists today

| Mechanism | Where Used | How It Works |
|-----------|-----------|--------------|
| CSS custom properties in `:root` | V1/landing pages | Green Kiri Media palette (`--bg-primary`, `--text-primary`, `--accent-green`) |
| `.dark` class override in `globals.css` | shadcn/ui components (button, sonner) | oklch-based variables (`--background`, `--foreground`, etc.) |
| `@custom-variant dark (&:is(.dark *))` | `globals.css` line 5 | Already configured for class-based dark mode |
| `@theme inline` block | `globals.css` lines 79-120 | Maps CSS vars to Tailwind utilities, but only for shadcn tokens |
| `next-themes` package | Installed (`^0.4.6`), only used by `sonner.tsx` | Not wired into layout or V2 |
| Custom React context (`useV2`) | V2 shell and all V2 pages | `darkMode` boolean state, hardcoded hex ternaries everywhere |

### The problem

Three separate theming systems coexist:
1. **V1/landing:** `:root` CSS variables (green palette, no dark mode)
2. **V2 dashboard:** Hardcoded hex values via `darkMode ? '#101322' : '#f6f6f8'` ternaries
3. **shadcn/ui components:** oklch CSS variables with `.dark` class overrides

None of these talk to each other. The V2 approach is the most brittle -- every component has 15+ inline ternaries checking `darkMode`.

## Recommended Approach

### Step 1: Define unified design tokens as CSS custom properties

Add V2 design system colors to `:root` and `.dark` in `globals.css`:

```css
:root {
  /* V2 Design System */
  --ds-primary: #1235e2;
  --ds-bg: #f6f6f8;
  --ds-bg-card: #ffffff;
  --ds-bg-elevated: #ffffff;
  --ds-border: #e2e8f0;
  --ds-border-accent: rgba(18, 53, 226, 0.2);
  --ds-text: #0f172a;
  --ds-text-muted: #64748b;
  --ds-text-secondary: #475569;
  /* ... existing Kiri Media vars stay for V1 during migration ... */
}

.dark {
  --ds-bg: #101322;
  --ds-bg-card: rgba(18, 53, 226, 0.05);
  --ds-bg-elevated: rgba(18, 53, 226, 0.1);
  --ds-border: rgba(18, 53, 226, 0.2);
  --ds-border-accent: rgba(18, 53, 226, 0.3);
  --ds-text: #f1f5f9;
  --ds-text-muted: #94a3b8;
  --ds-text-secondary: #cbd5e1;
}
```

### Step 2: Register tokens in `@theme inline`

```css
@theme inline {
  --color-ds-primary: var(--ds-primary);
  --color-ds-bg: var(--ds-bg);
  --color-ds-bg-card: var(--ds-bg-card);
  --color-ds-border: var(--ds-border);
  --color-ds-text: var(--ds-text);
  --color-ds-text-muted: var(--ds-text-muted);
  /* ... */
}
```

This creates utility classes like `bg-ds-bg`, `text-ds-text`, `border-ds-border` that automatically switch between light and dark.

### Step 3: Wire `next-themes` into the root layout

```tsx
// layout.tsx
import { ThemeProvider } from 'next-themes';

<ThemeProvider attribute="class" defaultTheme="light">
  {children}
</ThemeProvider>
```

This applies `.dark` class to `<html>`, which the existing `@custom-variant dark (&:is(.dark *))` already supports.

### Step 4: Replace V2 context ternaries with semantic classes

Before:
```tsx
<div className={`${darkMode ? 'bg-[#101322] text-slate-100' : 'bg-[#f6f6f8] text-slate-900'}`}>
```

After:
```tsx
<div className="bg-ds-bg text-ds-text">
```

Dark mode happens automatically via CSS custom property overrides. No JS ternaries needed.

## Recommended Stack (for v5.1 theming)

### Core Technologies (already installed, just need proper wiring)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS v4 | ^4 | Utility-first CSS with `@theme` | Already in project. `@theme inline` is the correct v4 way to register design tokens as utility classes. |
| `next-themes` | ^0.4.6 | Theme switching (dark/light/system) | Already installed. Handles `.dark` class on `<html>`, persists preference in localStorage, prevents FOUC. |
| CSS custom properties | Native | Design token storage | Already used in project. Tokens in `:root`/`.dark` override automatically. No build step, works everywhere. |
| `@custom-variant dark` | Tailwind v4 | Class-based dark mode | Already configured in `globals.css` line 5. This is the official v4 replacement for `darkMode: 'class'`. |

### Supporting Libraries (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-merge` | ^3.4.0 | Merge conflicting Tailwind classes | Use in component APIs where users can override classes. Already used via `cn()` utility. |
| `class-variance-authority` | ^0.7.1 | Type-safe component variants | Use for components with multiple visual states (button sizes, card variants). Already installed. |
| `clsx` | ^2.1.1 | Conditional className joining | Use for simple conditional classes. Already installed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Browser DevTools | Inspect CSS custom property values | Toggle `.dark` class on `<html>` to test both modes instantly |
| `next-themes` `useTheme()` | Read/set theme in components | Replaces `useV2().darkMode` for theme-aware components |

## Tailwind CSS v4 Theming Approach

**Confidence: HIGH** -- Verified against official Tailwind CSS v4.2 docs.

### The `@theme` vs `@theme inline` distinction

- **`@theme`**: Defines new utility classes AND registers CSS variables at `:root`. Good for static tokens (brand colors that never change).
- **`@theme inline`**: Creates utilities that reference CSS variables by name (not by resolved value). Good for tokens that change per-context (dark/light mode). The `inline` keyword ensures the CSS variable reference is preserved, so `.dark` overrides work correctly.

**Use `@theme inline` for all tokens that change between light/dark mode.** This is what the project already does for shadcn tokens -- extend it to V2 design system tokens.

### What the project already has right

```css
/* globals.css line 5 -- correct v4 dark mode config */
@custom-variant dark (&:is(.dark *));

/* globals.css lines 79-120 -- correct @theme inline usage */
@theme inline {
  --color-background: var(--bg-primary);
  --color-foreground: var(--text-primary);
  /* ... shadcn tokens ... */
}
```

### What needs to be added

Register V2-specific design tokens in the same `@theme inline` block so that Tailwind generates utility classes for them. The V2 hex values (`#101322`, `#f6f6f8`, `#1235e2`) become CSS custom properties that flip between `:root` and `.dark`.

## Dark/Light Mode Implementation

**Confidence: HIGH** -- Verified against Tailwind v4 docs and next-themes README.

### Architecture

```
next-themes ThemeProvider
  |
  v
<html class="dark">   (or no class for light)
  |
  v
@custom-variant dark (&:is(.dark *))   <-- already in globals.css
  |
  v
CSS custom properties in .dark { }     <-- override :root values
  |
  v
@theme inline tokens resolve correctly  <-- bg-ds-bg uses var(--ds-bg)
```

### Migration path from V2 context

1. Keep `useV2()` context but make `darkMode` read from `next-themes` instead of local state
2. Or (better): Replace `useV2().darkMode` calls with `useTheme()` from `next-themes`
3. Replace ternary class strings with semantic token classes

The `@custom-variant dark (&:is(.dark *))` line already in `globals.css` means `dark:` prefix works with the `.dark` class on any ancestor. `next-themes` adds `.dark` to `<html>`. These are already compatible.

### Preventing Flash of Unstyled Content (FOUC)

`next-themes` handles this automatically with an inline `<script>` that runs before React hydration. It reads `localStorage` and applies the class immediately. No extra configuration needed since it is already installed.

## Design Token Management

**Confidence: HIGH** -- Based on codebase analysis.

### Token hierarchy

```
Level 1: Primitive tokens (raw values)
  --ds-blue-600: #1235e2;
  --ds-slate-900: #0f172a;
  --ds-slate-50: #f6f6f8;

Level 2: Semantic tokens (purpose-based, mode-aware)
  :root   { --ds-bg: var(--ds-slate-50); }
  .dark   { --ds-bg: #101322; }

Level 3: Tailwind utilities (auto-generated)
  @theme inline { --color-ds-bg: var(--ds-bg); }
  -> creates bg-ds-bg, text-ds-bg, etc.
```

### Naming convention

Use `ds-` prefix (design system) to avoid collision with existing variables:
- `--ds-primary` -- primary brand color
- `--ds-bg` -- page background
- `--ds-bg-card` -- card/panel background
- `--ds-bg-elevated` -- hover/elevated states
- `--ds-border` -- default borders
- `--ds-text` -- primary text
- `--ds-text-muted` -- secondary/muted text

### Coexistence with V1 tokens during migration

The existing `:root` variables (`--bg-primary`, `--text-primary`, `--accent-green`) should remain until V1 is fully migrated. They do not conflict with `--ds-*` tokens. After V1 adopts the new tokens, the old ones can be removed.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| CSS custom properties in `:root`/`.dark` | CSS `@property` with type-checked values | Only if you need animated color transitions (oklch interpolation). Overkill for this project. |
| `next-themes` for theme switching | Custom React context (current V2 approach) | Never. `next-themes` handles FOUC, localStorage persistence, system preference detection, and SSR. The custom context does none of these. |
| `@theme inline` for Tailwind token registration | Hardcoded values in `@theme` | Only for tokens that never change between modes. Use `inline` for anything mode-dependent. |
| Class-based dark mode (`@custom-variant dark`) | `prefers-color-scheme` media query (Tailwind v4 default) | Only if you want OS-only control with no manual toggle. V2 has a toggle button, so class-based is correct. |
| `ds-` prefixed semantic tokens | Extending shadcn oklch tokens | Possible but the shadcn tokens use oklch and are designed for shadcn components. V2 has its own design language (#1235e2 blue, specific grays). Keep them separate. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tailwind.config.js` / `tailwind.config.ts` | Tailwind v4 is CSS-first. Config files are legacy v3. The project correctly has no config file. | `@theme` / `@theme inline` in `globals.css` |
| Inline hex ternaries (`darkMode ? '#101322' : '#f6f6f8'`) | Brittle, repetitive, bypasses CSS cascade, causes massive diffs when colors change. V2 shell has 15+ of these. | Semantic CSS custom properties (`bg-ds-bg`) that auto-switch via `.dark` class |
| Custom React context for dark mode state | Does not handle FOUC, localStorage, SSR, or system preference. Reinvents what `next-themes` already does. | `next-themes` `useTheme()` hook |
| `darkMode: 'class'` in tailwind.config.js | v3 syntax. Does not exist in v4. | `@custom-variant dark (&:is(.dark *))` in CSS (already present) |
| oklch colors for V2 tokens | The V2 design system uses hex colors (#1235e2). Converting to oklch adds complexity with zero benefit for this milestone. The shadcn tokens can stay oklch. | Hex or rgb for V2 tokens, oklch only where shadcn requires it |
| CSS-in-JS (styled-components, Emotion) | Adds runtime overhead, breaks streaming SSR in Next.js App Router, unnecessary when Tailwind handles everything | Tailwind utility classes + CSS custom properties |
| A separate CSS file per theme | Adds HTTP requests, complicates caching, hard to maintain | Single `globals.css` with `:root` and `.dark` overrides |

## Key Implementation Notes

### The `@custom-variant` selector matters

The current `globals.css` has:
```css
@custom-variant dark (&:is(.dark *));
```

The official Tailwind v4 docs recommend:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

The `:where()` version has zero specificity, which prevents specificity conflicts. The `:is()` version inherits the specificity of `.dark`. **Consider updating to the `:where()` version** during this milestone for better CSS specificity behavior.

### Recharts theming

Recharts components use inline style props for colors. They cannot consume Tailwind classes directly. Use CSS custom properties via `var()` in Recharts config:

```tsx
<Bar fill="var(--ds-primary)" />
<CartesianGrid stroke="var(--ds-border)" />
```

This makes charts theme-aware without JS ternaries.

### The V1 analyser page

The V1 page currently uses the Kiri Media green palette via `var(--bg-primary)` etc. For visual consistency, the approach is:
1. Add V2 design system tokens to `:root` and `.dark`
2. Update V1 page to reference `--ds-*` tokens instead of `--bg-*` / `--accent-green` tokens
3. Add a navigation header to V1 that matches V2 header style
4. V1 does not need the full sidebar -- just consistent colors, typography, and a nav header

## Sources

- [Tailwind CSS v4 Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode) -- Official, verified HIGH confidence
- [Tailwind CSS v4 @theme Directive Documentation](https://tailwindcss.com/docs/theme) -- Official, verified HIGH confidence
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- Official, v0.4.6 compatible
- [Tailwind CSS v4 + next-themes integration guide](https://dev.to/khanrabiul/nextjs-tailwindcss-v4-how-to-add-darklight-theme-with-next-themes-3c6l) -- Community, MEDIUM confidence
- [Tailwind v4 dark mode custom variants](https://schoen.world/n/tailwind-dark-mode-custom-variant) -- Community, MEDIUM confidence
- Codebase analysis of `globals.css`, `v2-context.tsx`, `v2-shell.tsx`, `sonner.tsx`, `package.json` -- Direct inspection, HIGH confidence
