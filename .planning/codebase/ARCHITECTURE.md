# Architecture

**Analysis Date:** 2025-01-18

## Pattern Overview

**Overall:** Next.js App Router with Server Actions

**Key Characteristics:**
- Single-page application with client-side interactivity
- Server Actions for sitemap analysis (runs server-side, called from client)
- API Routes for long-running operations (ad library scraping with Puppeteer)
- Clear separation: lib modules for core logic, components for UI, actions for server mutations

## Layers

**Presentation Layer:**
- Purpose: React components handling UI rendering and user interaction
- Location: `src/app/page.tsx`, `src/components/`
- Contains: Client components with 'use client' directive, form handling, state management
- Depends on: Actions, Lib types
- Used by: End users via browser

**Server Actions Layer:**
- Purpose: Server-side functions callable from client components
- Location: `src/actions/`
- Contains: Functions marked with 'use server' for secure server execution
- Depends on: Lib modules (sitemap-parser, url-classifier)
- Used by: Presentation layer via direct function calls

**API Routes Layer:**
- Purpose: HTTP endpoints for operations requiring extended timeouts or special handling
- Location: `src/app/api/`
- Contains: Next.js route handlers (POST endpoints)
- Depends on: Lib modules (ad-library-scraper)
- Used by: Presentation layer via fetch()

**Business Logic Layer (Lib):**
- Purpose: Core domain logic, external service integrations
- Location: `src/lib/`
- Contains: Pure functions, Puppeteer browser automation, XML parsing
- Depends on: External packages (puppeteer-core, @sparticuz/chromium-min)
- Used by: Actions, API Routes

## Data Flow

**Sitemap Analysis Flow:**

1. User enters URL in `src/app/page.tsx` form
2. Form submission calls `analyzeSitemap()` Server Action in `src/actions/analyze-sitemap.ts`
3. Action calls `fetchAllSitemapURLs()` from `src/lib/sitemap-parser.ts`
4. sitemap-parser fetches XML from target site, parses URLs
5. Action calls `classifyURLs()` from `src/lib/url-classifier.ts`
6. url-classifier categorizes each URL by pattern matching
7. Classified results returned to client, rendered in `ResultsTable` component

**Ad Library Scraping Flow:**

1. User enters Facebook Ad Library URL
2. Form submission POSTs to `/api/scrape-ads` route
3. Route handler calls `scrapeAdLibrary()` from `src/lib/ad-library-scraper.ts`
4. ad-library-scraper launches headless Chrome via Puppeteer
5. Scraper navigates, scrolls, intercepts network responses to extract ad data
6. Results returned to client, merged with sitemap data for cross-reference display

**State Management:**
- React useState hooks in `src/app/page.tsx` for all application state
- No external state library (Redux, Zustand, etc.)
- State includes: loading flags, results, errors, form inputs, ad data

## Key Abstractions

**SitemapURL:**
- Purpose: Represents a single URL entry from an XML sitemap
- Examples: `src/lib/sitemap-parser.ts`
- Pattern: Interface with loc (required), lastmod/changefreq/priority (optional)

**ClassifiedURL:**
- Purpose: SitemapURL extended with category classification
- Examples: `src/lib/url-classifier.ts`
- Pattern: Extends SitemapURL, adds category and normalized path

**URLCategory:**
- Purpose: Enumeration of URL types for classification
- Examples: `src/lib/url-classifier.ts`
- Pattern: Union type: 'landing' | 'product' | 'collection' | 'blog' | 'account' | 'cart' | 'other'

**AdData:**
- Purpose: Represents scraped advertisement data with destination URL
- Examples: `src/lib/ad-library-scraper.ts`
- Pattern: Interface with adId, destinationUrl, adCount, adLibraryLinks

**Result Pattern (Success/Error Union):**
- Purpose: Type-safe success/failure responses from async operations
- Examples: `AnalysisResult | AnalysisError` in `src/actions/analyze-sitemap.ts`, `AdLibraryResult | AdLibraryError` in `src/lib/ad-library-scraper.ts`
- Pattern: Discriminated union with `success: true/false` discriminator

## Entry Points

**Main Page:**
- Location: `src/app/page.tsx`
- Triggers: User navigation to root URL
- Responsibilities: Render UI, manage state, orchestrate user flows

**Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: HTML structure, font loading, global CSS import

**API Endpoint:**
- Location: `src/app/api/scrape-ads/route.ts`
- Triggers: POST request from client
- Responsibilities: Validate input, invoke scraper, return JSON response

**Server Action:**
- Location: `src/actions/analyze-sitemap.ts`
- Triggers: Client component invocation
- Responsibilities: URL validation, sitemap fetching, URL classification

## Error Handling

**Strategy:** Result types with explicit success/error discrimination

**Patterns:**
- All async operations return `{ success: true, data } | { success: false, error: string }`
- Try-catch blocks in Server Actions and API routes
- Error messages propagated to UI for user display
- Network errors caught at fetch boundaries
- XML parsing failures handled gracefully (continue to next sitemap path)

## Cross-Cutting Concerns

**Logging:** Console-only, conditional debug output (debug flag in ad-library-scraper)

**Validation:** URL validation in Server Action (`isValidUrl`), Ad Library URL validation in API route

**Authentication:** None - public tool with no user accounts

**Styling:** Tailwind CSS v4 with custom CSS variables in `src/app/globals.css`, glass morphism effects

---

*Architecture analysis: 2025-01-18*
