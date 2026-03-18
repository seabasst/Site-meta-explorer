# Architecture Research

**Domain:** Ad intelligence platform -- visual consistency / design system unification
**Researched:** 2026-03-18
**Confidence:** HIGH (based on direct codebase analysis + established Tailwind v4 patterns)

## Current State Analysis

The app has **three distinct styling regimes** that need unification:

| Surface | Route | Theme Mechanism | Color Palette | Dark Mode |
|---------|-------|-----------------|---------------|-----------|
| V1 Analyser | `/analyser` | CSS custom properties (`var(--bg-primary)`, `var(--accent-green)`, etc.) | Green/amber Kiri Media brand (`#1a3933`, `#f59e0b`) | None |
| V2 Dashboard | `/dashboard/v2/*` | Hardcoded Tailwind classes with ternary (`darkMode ? 'bg-[#101322]' : 'bg-[#f6f6f8]'`) | Blue Ad Library Pro (`#1235e2`, `#101322`, `#f6f6f8`) | Yes, via React context (`useV2().darkMode`) |
| Landing Page | `/` | Hardcoded Tailwind classes | Blue (`#1235e2`, dark bg `#101322`) | Forced dark |

**Key problems:**
1. V1 uses CSS custom properties defined in `globals.css` -- a green/amber palette completely different from V2's blue palette
2. V2 has 385 occurrences of hardcoded hex values (`#1235e2`, `#101322`, `#f6f6f8`) across 31 files
3. V1 analyser has 163 occurrences of `var(--` referencing the old Kiri Media green tokens
4. Dark mode is V2-only, managed by React state (`V2Context`) not CSS class -- incompatible with the `.dark` variant already configured in `globals.css`
5. Landing page and V2 already share the blue palette visually, but with no shared token layer

## System Overview

```
                    PROPOSED ARCHITECTURE
  +----------------------------------------------------------+
  |  globals.css                                              |
  |  :root { --brand: #1235e2; --bg-dark: #101322; ... }     |
  |  .dark { --brand: #1235e2; --bg-dark: ...; ... }          |
  +----------------------------------------------------------+
         |                    |                    |
  +------v------+    +-------v-------+    +-------v-------+
  | Landing (/) |    | Analyser (/a) |    | Dashboard (/d)|
  | forced dark |    | uses tokens   |    | uses tokens   |
  | no shell    |    | + top nav     |    | + sidebar     |
  +-------------+    +-------+-------+    +-------+-------+
                             |                    |
                     +-------v--------------------v-------+
                     |  Shared Components                  |
                     |  - AppHeader (top nav bar)          |
                     |  - ThemeToggle                      |
                     |  - V2Card, V2SectionTitle           |
                     |  - Chart wrappers                   |
                     +-------------------------------------+
```

## Component Responsibilities

| Component | Responsibility | Current Location | Action |
|-----------|---------------|------------------|--------|
| `globals.css` tokens | Single source of truth for all colors, spacing, radii | `src/app/globals.css` | **Rewrite** -- replace green Kiri tokens with blue Ad Library Pro tokens |
| `ThemeProvider` | Manages dark/light mode via CSS class on `<html>` | Does not exist (V2 uses React state) | **Create** -- replace `V2Context.darkMode` with class-based toggle |
| `AppHeader` | Shared top navigation bar across analyser + landing | Does not exist (each page has its own nav) | **Create** -- extract from landing-nav + analyser nav |
| `V2Shell` | Dashboard sidebar + header layout | `src/app/dashboard/v2/v2-shell.tsx` | **Refactor** -- consume tokens instead of hardcoded hex |
| `V2Card` | Reusable card with theme-aware styling | `src/app/dashboard/v2/v2-shell.tsx` | **Migrate** to `src/components/ui/card.tsx`, consume tokens |
| `LandingNav` | Landing page top nav | `src/components/landing/landing-nav.tsx` | **Replace** with `AppHeader` or thin wrapper around it |
| Analyser nav | Inline nav in analyser page | `src/app/analyser/page.tsx` (lines 435-525) | **Replace** with `AppHeader` |

## Recommended Structure for Shared Design System

### Layer 1: Design Tokens in CSS Custom Properties

This is the foundation. All colors, surfaces, borders referenced via tokens -- never hardcoded hex in component classNames.

```css
/* globals.css -- REPLACE existing :root block */
:root {
  /* Brand */
  --brand: #1235e2;
  --brand-hover: #0f2bc0;
  --brand-subtle: rgba(18, 53, 226, 0.1);
  --brand-muted: rgba(18, 53, 226, 0.05);

  /* Surfaces -- light mode */
  --surface-page: #f6f6f8;
  --surface-card: #ffffff;
  --surface-elevated: #ffffff;
  --surface-overlay: rgba(255, 255, 255, 0.9);

  /* Text */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --text-inverse: #ffffff;

  /* Borders */
  --border-default: #e2e8f0;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-brand: rgba(18, 53, 226, 0.2);

  /* Semantic */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

.dark {
  --surface-page: #101322;
  --surface-card: rgba(18, 53, 226, 0.05);
  --surface-elevated: #1a1d35;
  --surface-overlay: rgba(16, 19, 34, 0.9);

  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  --border-default: rgba(18, 53, 226, 0.2);
  --border-subtle: rgba(255, 255, 255, 0.06);
}
```

**Why CSS custom properties, not Tailwind config:** The project already uses Tailwind v4 with `@theme inline` in globals.css. Tailwind v4's `@theme` directive reads CSS custom properties directly -- no `tailwind.config.js` needed. The project already has this pattern on line 79 of globals.css. Extending it is the natural path.

### Layer 2: Tailwind v4 Theme Mapping

Wire tokens into Tailwind utility classes via the existing `@theme inline` block:

```css
@theme inline {
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-subtle: var(--brand-subtle);
  --color-surface-page: var(--surface-page);
  --color-surface-card: var(--surface-card);
  --color-surface-elevated: var(--surface-elevated);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-border-default: var(--border-default);
  --color-border-subtle: var(--border-subtle);
  --color-border-brand: var(--border-brand);
}
```

This enables classes like `bg-surface-page`, `text-brand`, `border-border-default` -- semantic, theme-aware, no ternaries needed.

### Layer 3: Theme Provider (Class-Based Dark Mode)

Replace the React-state-based `V2Context.darkMode` with a proper CSS-class-based system:

```typescript
// src/components/providers/theme-provider.tsx
'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setThemeState(stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

**Why class-based:** The project already has `@custom-variant dark (&:is(.dark *));` on line 5 of globals.css and a `.dark { }` block with shadcn/ui tokens. The infrastructure is there but unused. Class-based toggling means Tailwind's `dark:` variant works automatically, CSS custom properties swap automatically, and zero JavaScript ternaries needed in templates.

### Layer 4: Shared Layout Components

**AppHeader** -- shared top navigation for non-dashboard pages:

```
+--[Logo]--[Analyser]--[About]--[Contact]--[Feedback]--spacer--[ThemeToggle]--[Get Pro]--+
```

This replaces:
- The inline nav in `analyser/page.tsx` (lines 435-525)
- `LandingNav` component (which is close but landing-specific)

**Implementation location:** `src/components/layout/app-header.tsx`

The V2 dashboard keeps its sidebar shell (`V2Shell`) but refactored to consume tokens instead of hardcoded hex. The header inside V2Shell already has the right structure.

## Data Flow (Theme State)

```
User clicks toggle
        |
        v
ThemeProvider.toggleTheme()
        |
        +---> localStorage.setItem('theme', 'dark')
        +---> document.documentElement.classList.add('dark')
        |
        v
CSS custom properties swap (:root -> .dark)
        |
        v
All Tailwind utilities auto-update
(bg-surface-page, text-text-primary, border-border-default, dark:... variants)
        |
        v
No component re-renders needed for styling
(only ThemeProvider children re-render for toggle icon state)
```

**Migration path for V2Shell:** Replace `const { darkMode } = useV2()` + ternary pattern with token-based classes. The ternary `darkMode ? 'bg-[#101322]' : 'bg-[#f6f6f8]'` becomes simply `bg-surface-page`. The 385 hardcoded hex occurrences across 31 V2 files get replaced with semantic token classes.

**V2Context removal:** Once all V2 components consume theme via CSS tokens (not React state), `V2Context` can be removed entirely. The `useTheme()` hook remains available for the toggle button icon, but styling itself needs no JavaScript.

## Build Order (Suggested)

Order matters because each step creates the foundation for the next:

### Step 1: Design Tokens + Theme Provider (foundation)
- Rewrite `:root` and `.dark` blocks in `globals.css` with unified blue palette tokens
- Extend `@theme inline` block with semantic Tailwind mappings
- Create `ThemeProvider` component with class-based toggle
- Wire `ThemeProvider` into root `layout.tsx`
- **No visual changes yet** -- old CSS variables still exist alongside new ones

### Step 2: AppHeader Component (shared navigation)
- Create `src/components/layout/app-header.tsx` using new tokens
- Integrate into `/analyser` route, replacing inline nav
- Integrate into landing page, replacing `LandingNav`
- V2 dashboard keeps its own header (inside V2Shell) -- this is intentional, sidebar layouts need different headers

### Step 3: V2 Dashboard Token Migration (biggest task)
- Refactor `V2Shell` to use token classes instead of hardcoded hex
- Replace `useV2().darkMode` ternary pattern across all 31 dashboard files
- Pattern: `darkMode ? 'bg-[#101322]' : 'bg-[#f6f6f8]'` becomes `bg-surface-page`
- Pattern: `darkMode ? 'border-[#1235e2]/20' : 'border-slate-200'` becomes `border-border-default`
- Remove `V2Context` and `V2Provider` after migration

### Step 4: Analyser Page Token Migration
- Replace 163 `var(--bg-primary)`, `var(--accent-green)` etc. with new unified tokens
- This changes the analyser's visual identity from green/amber to blue -- intentional for brand unification
- Largest single file change but mechanically straightforward (find-replace CSS variable names)

### Step 5: Landing Page Polish
- Already uses the blue palette -- minor tweaks to use token classes instead of hardcoded hex
- Ensure forced-dark behavior works with new ThemeProvider (add `dark` class to landing layout)

### Step 6: Cleanup
- Remove old Kiri Media green token definitions from `globals.css`
- Remove unused CSS classes (`.gradient-mesh`, `.noise-overlay` if no longer needed)
- Remove `v2-context.tsx`

## Architectural Patterns

### Pattern 1: Semantic Token Naming

**Use semantic names, not color names.** `--surface-page` not `--bg-dark-blue`. This decouples the token from the specific color, making future palette changes trivial.

Naming convention:
```
--surface-*    : background surfaces (page, card, elevated, overlay)
--text-*       : text colors (primary, secondary, muted, inverse)
--border-*     : border colors (default, subtle, brand)
--brand*       : brand accent colors
```

### Pattern 2: Zero-Ternary Dark Mode

Instead of:
```tsx
// BAD: 385 occurrences of this pattern in V2
className={`${darkMode ? 'bg-[#101322] text-slate-100' : 'bg-[#f6f6f8] text-slate-900'}`}
```

Use:
```tsx
// GOOD: CSS handles the theme swap
className="bg-surface-page text-text-primary"
```

The CSS custom properties swap values when `.dark` is on `<html>`. Components never need to know what theme is active.

### Pattern 3: Layout Boundary Separation

Three layout zones, each with its own shell but sharing tokens:

```
/ (landing)           -> No shell, AppHeader + full-width sections
/analyser             -> No shell, AppHeader + centered content (max-w-7xl)
/dashboard/v2/*       -> V2Shell (sidebar + internal header) + content area
```

The AppHeader is shared between landing and analyser. The dashboard has its own header inside V2Shell. This is correct -- do not try to force one header component across both layouts. Sidebar-based dashboards need a different header (page title, notifications, avatar).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Dark Mode Toggle Affecting Landing Page
**What:** Making the landing page respect user's dark/light preference.
**Why bad:** The landing page is marketing material. It should always be dark (current behavior). Forced dark is intentional -- it looks more premium and matches the product screenshots.
**Instead:** Add `dark` class to the landing layout specifically, independent of user preference.

### Anti-Pattern 2: Migrating Everything to shadcn/ui Tokens
**What:** Using the existing shadcn/ui oklch tokens (`--background`, `--foreground`, `--card`, etc.) as the unified system.
**Why bad:** The shadcn tokens are generic and the oklch values in the codebase are defaults, not customized. The product has a specific blue brand identity that should be first-class, not mapped through an abstraction layer designed for generic component libraries.
**Instead:** Define project-specific semantic tokens that directly express the Ad Library Pro design language. The shadcn `--background`/`--foreground` tokens can be aliased to the new tokens for compatibility with any shadcn/ui components used.

### Anti-Pattern 3: Partial Migration (Token + Hardcoded Mix)
**What:** Adding tokens but leaving some hardcoded hex values "for later."
**Why bad:** Creates confusion about which is the source of truth. New developers (or AI agents) will copy whichever pattern they find first. Theme toggle will produce inconsistent results where some elements respond and others do not.
**Instead:** Complete the migration per-file. If touching a file, convert ALL hardcoded values in that file to tokens.

### Anti-Pattern 4: Trying to Share V2Shell With Analyser
**What:** Wrapping the analyser page in V2Shell to get the sidebar.
**Why bad:** The analyser is a standalone tool with a different UX paradigm (single-page form -> results). A sidebar with "Dashboard", "Ad Library", "Saved Ads" navigation is irrelevant and confusing in that context.
**Instead:** Analyser gets AppHeader (top nav) only. It links to the dashboard but does not live inside it.

## File Structure (Proposed)

```
src/
  app/
    globals.css              # Unified tokens (:root + .dark)
    layout.tsx               # Wraps with ThemeProvider
    page.tsx                 # Landing (forced dark)
    analyser/
      page.tsx               # Uses AppHeader + tokens
    dashboard/v2/
      layout.tsx             # No more V2Provider needed
      v2-shell.tsx           # Refactored to use tokens
  components/
    layout/
      app-header.tsx         # Shared top nav (landing + analyser)
    providers/
      theme-provider.tsx     # Class-based dark/light toggle
      session-provider.tsx   # Existing
    ui/                      # Existing shadcn components
    ...                      # Existing feature components
```

## Confidence Assessment

| Aspect | Confidence | Reason |
|--------|------------|--------|
| Token architecture (CSS custom properties + Tailwind v4 @theme) | HIGH | Directly observed in codebase; Tailwind v4 is designed for this pattern |
| Class-based dark mode replacing React-state dark mode | HIGH | Infrastructure already exists in globals.css (`.dark` block, `@custom-variant`) |
| Build order | HIGH | Clear dependency chain observed from codebase analysis |
| Migration scope (385 hex occurrences in V2, 163 var references in V1) | HIGH | Directly measured via grep |
| AppHeader extraction feasibility | MEDIUM | Landing nav and analyser nav have different link sets; may need conditional rendering or composition pattern |

## Sources

- Direct codebase analysis of `globals.css`, `v2-shell.tsx`, `v2-context.tsx`, `landing-nav.tsx`, `analyser/page.tsx`, `layout.tsx`
- Tailwind CSS v4 `@theme` directive usage already present in the project at `globals.css:79`
- Existing `.dark` variant configuration at `globals.css:5`
