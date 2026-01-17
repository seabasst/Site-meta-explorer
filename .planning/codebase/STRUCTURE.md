# Codebase Structure

**Analysis Date:** 2025-01-18

## Directory Layout

```
sitemap-analyzer/
├── src/
│   ├── app/                    # Next.js App Router pages and routes
│   │   ├── api/                # API route handlers
│   │   │   └── scrape-ads/     # Ad Library scraping endpoint
│   │   ├── globals.css         # Global styles and CSS variables
│   │   ├── layout.tsx          # Root layout with fonts
│   │   └── page.tsx            # Main application page
│   ├── actions/                # Server Actions
│   │   └── analyze-sitemap.ts  # Sitemap analysis action
│   ├── components/             # React components
│   │   ├── results-table.tsx   # URL results display
│   │   └── url-form.tsx        # URL input form (unused)
│   └── lib/                    # Core business logic
│       ├── ad-library-scraper.ts   # Puppeteer-based Facebook scraper
│       ├── sitemap-parser.ts       # XML sitemap fetching/parsing
│       └── url-classifier.ts       # URL categorization logic
├── public/                     # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis docs
├── .vercel/                    # Vercel deployment config
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.mjs          # PostCSS for Tailwind
├── tailwind.config.ts          # Tailwind configuration (if exists)
└── tsconfig.json               # TypeScript configuration
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router structure
- Contains: Pages, layouts, API routes, global CSS
- Key files: `page.tsx` (main UI), `layout.tsx` (HTML wrapper), `globals.css` (all styling)

**src/app/api/:**
- Purpose: HTTP API endpoints
- Contains: Route handlers for operations needing custom timeout/response handling
- Key files: `scrape-ads/route.ts` (60s timeout for Puppeteer scraping)

**src/actions/:**
- Purpose: Server Actions for client-to-server communication
- Contains: 'use server' marked async functions
- Key files: `analyze-sitemap.ts` (main sitemap analysis entry point)

**src/components/:**
- Purpose: Reusable React UI components
- Contains: Client components with 'use client' directive
- Key files: `results-table.tsx` (main results display with filtering/sorting)

**src/lib/:**
- Purpose: Business logic modules, external integrations
- Contains: Pure functions, types, Puppeteer automation
- Key files: `sitemap-parser.ts`, `url-classifier.ts`, `ad-library-scraper.ts`

**public/:**
- Purpose: Static assets served at root URL
- Contains: SVG icons (default Next.js assets, mostly unused)
- Key files: None actively used in current implementation

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Main application page, all UI and state
- `src/app/layout.tsx`: Root HTML layout, font loading
- `src/app/api/scrape-ads/route.ts`: Ad Library API endpoint

**Configuration:**
- `package.json`: Dependencies, npm scripts (dev, build, start, lint)
- `tsconfig.json`: TypeScript config with `@/*` path alias to `./src/*`
- `next.config.ts`: Next.js config (currently empty/default)
- `eslint.config.mjs`: ESLint setup
- `postcss.config.mjs`: PostCSS for Tailwind processing

**Core Logic:**
- `src/lib/sitemap-parser.ts`: XML fetching, parsing, child sitemap discovery
- `src/lib/url-classifier.ts`: Regex-based URL categorization
- `src/lib/ad-library-scraper.ts`: Puppeteer browser automation for Facebook

**Styling:**
- `src/app/globals.css`: All CSS - variables, Tailwind import, custom classes

**Testing:**
- None present - no test files or testing framework configured

## Naming Conventions

**Files:**
- kebab-case for all files: `analyze-sitemap.ts`, `url-classifier.ts`, `results-table.tsx`
- `.tsx` for React components, `.ts` for non-React TypeScript
- `route.ts` for Next.js API route handlers

**Directories:**
- kebab-case: `scrape-ads/`
- Singular nouns for feature groupings: `lib/`, `actions/`, `components/`
- Plural for Next.js conventions: `app/`

**Exports:**
- Named exports for functions and types
- Default export only for React page/layout components
- PascalCase for React components: `ResultsTable`, `URLForm`
- camelCase for functions: `analyzeSitemap`, `classifyURLs`
- PascalCase for types/interfaces: `SitemapURL`, `ClassifiedURL`, `AdLibraryResult`

## Where to Add New Code

**New Feature (full-stack):**
- UI: Add component in `src/components/` or inline in `src/app/page.tsx`
- Server logic: Add Server Action in `src/actions/`
- Business logic: Add module in `src/lib/`

**New API Endpoint:**
- Create directory in `src/app/api/{endpoint-name}/`
- Add `route.ts` with HTTP method handlers (GET, POST, etc.)

**New Component:**
- Add to `src/components/{component-name}.tsx`
- Use 'use client' directive if needs interactivity
- Import into page or parent component

**New Utility/Helper:**
- Add to `src/lib/` as new file or extend existing module
- Export types alongside functions in same file

**New Styling:**
- Add CSS custom properties in `:root` in `src/app/globals.css`
- Add utility classes in same file after Tailwind import
- Use inline Tailwind classes for one-off styling

## Special Directories

**.vercel/:**
- Purpose: Vercel deployment configuration
- Generated: Yes (by Vercel CLI)
- Committed: Typically yes for project settings

**.next/:**
- Purpose: Next.js build output
- Generated: Yes (by next build/dev)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)

**.planning/:**
- Purpose: GSD planning and codebase analysis documents
- Generated: No (manually created)
- Committed: Yes (project documentation)

**public/:**
- Purpose: Static files served at root URL path
- Generated: No
- Committed: Yes
- Note: Files accessible as `/{filename}` (e.g., `/next.svg`)

---

*Structure analysis: 2025-01-18*
