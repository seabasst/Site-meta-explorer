# External Integrations

**Analysis Date:** 2026-01-18

## APIs & External Services

**Facebook Ad Library (Scraped):**
- Purpose: Extract active ad data and destination URLs for competitive analysis
- Implementation: Headless browser scraping via Puppeteer
- Client: `puppeteer-core` with `@sparticuz/chromium-min`
- Files:
  - `src/lib/ad-library-scraper.ts` - Core scraping logic
  - `src/app/api/scrape-ads/route.ts` - API endpoint
  - `src/actions/scrape-ad-library.ts` - Server action wrapper
- Chromium Source: `https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar`
- Scraped Endpoints:
  - `/api/graphql` - Facebook GraphQL API responses
  - `/ads/library/async` - Ad Library async data
  - `ads_archive` - Ad archive data

**External Website Sitemaps (Fetched):**
- Purpose: Discover and parse XML sitemaps from target websites
- Implementation: Native `fetch()` API
- Files:
  - `src/lib/sitemap-parser.ts` - Sitemap fetching and XML parsing
  - `src/actions/analyze-sitemap.ts` - Server action for analysis
- User-Agent: `SitemapAnalyzer/1.0`
- Paths Checked: `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/sitemap/sitemap.xml`, `/sitemaps/sitemap.xml`

## Data Storage

**Databases:**
- None - Application is stateless

**File Storage:**
- Local filesystem only (debug screenshots to `/tmp` in development)
- No persistent storage

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None - Public application with no user authentication

## Monitoring & Observability

**Error Tracking:**
- None configured

**Logs:**
- Console logging only
- Debug mode writes screenshots to `/tmp/ad-library-debug.png`

## CI/CD & Deployment

**Hosting:**
- Vercel
- Project Name: `sitemap-analyzer`
- Configuration: `.vercel/project.json`

**CI Pipeline:**
- None detected (no `.github/workflows` or similar)

## Environment Configuration

**Required env vars:**
- `NODE_ENV` - Used to toggle debug mode in scraper

**Optional env vars:**
- None

**Secrets location:**
- No secrets required (no API keys, no database credentials)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## API Routes

**`POST /api/scrape-ads`:**
- Location: `src/app/api/scrape-ads/route.ts`
- Purpose: Scrape Facebook Ad Library page
- Request Body: `{ adLibraryUrl: string }`
- Response: `AdLibraryResult | AdLibraryError`
- Timeout: 60 seconds (configured via `maxDuration`)

## Server Actions

**`analyzeSitemap(url: string)`:**
- Location: `src/actions/analyze-sitemap.ts`
- Purpose: Fetch and classify URLs from a website's sitemap
- Returns: `AnalysisResult | AnalysisError`

**`scrapeAdLibraryAction(adLibraryUrl: string)`:**
- Location: `src/actions/scrape-ad-library.ts`
- Purpose: Wrapper for ad library scraping (alternative to API route)
- Returns: `AdLibraryResponse`

## External URL Patterns

**Facebook Ad Library URLs:**
- Format: `https://www.facebook.com/ads/library/?...&view_all_page_id=XXXXXXXX`
- Required parameter: `view_all_page_id` (numeric page ID)

**Internal Facebook Domains (Filtered Out):**
- `facebook.com`, `fb.com`, `instagram.com`, `meta.com`, `fbcdn.net`, `fbsbx.com`

---

*Integration audit: 2026-01-18*
