# Coding Conventions

**Analysis Date:** 2025-01-18

## Naming Patterns

**Files:**
- React components: PascalCase for exports, kebab-case filenames (`url-form.tsx` exports `URLForm`)
- Lib/utils: kebab-case (`sitemap-parser.ts`, `url-classifier.ts`, `ad-library-scraper.ts`)
- Server actions: kebab-case with verb-noun pattern (`analyze-sitemap.ts`)
- API routes: Next.js App Router convention (`route.ts` in folder structure)

**Functions:**
- camelCase for all functions (`fetchSitemap`, `classifyURLs`, `handleSubmit`)
- React components: PascalCase (`HowItWorksSection`, `LoadingSpinner`, `ResultsTable`)
- Async functions: verb prefix (`fetchSitemap`, `scrapeAdLibrary`, `analyzeSitemap`)
- Event handlers: `handle` prefix (`handleSubmit`, `handleSort`, `handleQuickStart`)
- Boolean checks: `is` prefix (`isValidUrl`, `isExternalUrl`, `isLanding`)

**Variables:**
- camelCase for all variables (`inputUrl`, `adLibraryUrl`, `totalActiveAds`)
- Constants: UPPER_SNAKE_CASE (`SITEMAP_PATHS`, `LANDING_PATTERNS`, `EXAMPLE_BRANDS`)
- Component props interfaces: PascalCase with `Props` suffix (`URLFormProps`, `ResultsTableProps`)
- Type aliases: PascalCase (`URLCategory`, `SortField`, `SortDirection`)

**Types:**
- Interfaces for object shapes with named fields (`SitemapURL`, `AdData`, `ClassifiedURL`)
- Type aliases for unions and primitives (`URLCategory`, `AnalyzeResponse`)
- Result types pattern: `Success` and `Error` variants (`AnalysisResult | AnalysisError`)

## Code Style

**Formatting:**
- No Prettier config file detected - relies on IDE defaults
- Single quotes for strings in TypeScript/TSX
- 2-space indentation
- Semicolons used

**Linting:**
- ESLint v9 with flat config (`eslint.config.mjs`)
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Strict TypeScript mode enabled in `tsconfig.json`

## Import Organization

**Order:**
1. External packages (`react`, `next`, `puppeteer-core`)
2. Internal modules using path alias (`@/lib/...`, `@/actions/...`, `@/components/...`)
3. Types (often combined with module imports)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Use absolute imports with alias, not relative paths

**Example:**
```typescript
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ClassifiedURL, URLCategory } from '@/lib/url-classifier';
```

## Error Handling

**Patterns:**
- Result types for operations that can fail:
```typescript
export interface AnalysisResult {
  success: true;
  data: ClassificationResult;
  analyzedUrl: string;
  totalUrls: number;
}

export interface AnalysisError {
  success: false;
  error: string;
}

export type AnalyzeResponse = AnalysisResult | AnalysisError;
```

- Try-catch with `instanceof Error` check:
```typescript
try {
  // operation
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { success: false, error: message };
}
```

- Empty catch blocks used for non-critical failures (URL parsing, optional data extraction):
```typescript
try {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? 0 : date.getTime();
} catch {
  return 0;
}
```

- API route error handling returns appropriate status codes:
```typescript
return NextResponse.json(
  { success: false, error: message },
  { status: 500 }
);
```

## Logging

**Framework:** console (used sparingly)

**Patterns:**
- Debug logging behind conditional flag:
```typescript
if (debug) {
  console.log('Debug files saved to /tmp/ad-library-debug.png');
}
```
- No structured logging library in use
- No production logging setup detected

## Comments

**When to Comment:**
- Section headers for logical groupings in large files (e.g., `// Patterns that indicate landing pages`)
- Complex regex patterns
- Magic numbers and constants explanation

**JSDoc/TSDoc:**
- Not extensively used
- Interface properties generally self-documenting through naming

## Function Design

**Size:**
- Most functions under 50 lines
- Larger components (like `Home` in `page.tsx`) contain inline helper components
- Complex logic extracted to separate utility functions

**Parameters:**
- Destructured props for React components
- Object parameters for complex functions with optional fields
- Default parameter values used:
```typescript
export async function scrapeAdLibrary(adLibraryUrl: string, debug = false): Promise<AdLibraryResponse>
```

**Return Values:**
- Explicit return types for exported functions
- Discriminated unions for success/error states
- Null/undefined for optional data (not exceptions)

## Module Design

**Exports:**
- Named exports preferred over default exports for utilities
- Default exports for React page/layout components (Next.js convention)
- Types exported alongside functions

**Barrel Files:**
- Not used - direct imports from source files

## React Patterns

**Component Structure:**
- `'use client'` directive at top for client components
- Props interface defined above component
- Helper functions defined inside or above main component
- State grouped at top of component

**State Management:**
- React `useState` for local component state
- No global state library (Redux, Zustand) detected
- State lifted to parent when needed (e.g., `Home` manages form and result state)

**Event Handlers:**
- Defined inside component, before return statement
- Async handlers for API calls with loading state management

## CSS Patterns

**Styling Approach:**
- Tailwind CSS v4 with PostCSS
- CSS custom properties (CSS variables) for theming in `globals.css`
- Utility-first classes in JSX
- Component-specific CSS classes defined in `globals.css` (e.g., `.glass`, `.btn-primary`)

**Class Naming:**
- CSS variable naming: `--category-name` (e.g., `--cat-landing`, `--bg-primary`)
- Utility classes: kebab-case (e.g., `.animate-fade-in-up`, `.glow-gold`)

---

*Convention analysis: 2025-01-18*
