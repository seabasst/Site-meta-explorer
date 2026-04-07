# Ad Library Intelligence Platform

## What This Is

A competitive ad intelligence tool for brands and agencies. Users browse a database of Facebook ads, save ads for reference, track brands, and analyze creative strategies. Features a brand-aware AI assistant (Hikaru) with embedded charts, creative analysis lab with strategy engine, configurable analytics dashboard, and a landing page with 3-tier pricing. Users onboard their brand via wizard or AI interview, and every AI response is contextualized with their brand voice, audience, competitors, and strategy. V1 at `/analyser` serves as freemium entry point; V2 dashboard is the core product.

## Core Value

Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## Requirements

### Validated

- ✓ Ad Library URL input and validation — v1.0
- ✓ Ad discovery from Ad Library pages — v1.0
- ✓ Extract age, gender, country, reach data per ad — v1.0
- ✓ Weight demographics by reach, aggregate into summary — v1.0
- ✓ Visual charts for demographics — v1.0
- ✓ Configurable analysis depth (100/250/500/1000 ads) — v1.0
- ✓ Loading states, error messages, retry mechanism — v1.1
- ✓ Google OAuth + email/password login — v2.0
- ✓ Stripe subscription (Free + Pro tiers) — v2.0
- ✓ Ad previews with media type badges — v2.0 + v2.1
- ✓ Interactive charts with click-to-filter — v2.1
- ✓ PDF export with cover page — v2.0 + v2.1
- ✓ Mobile responsive (375px+) — v2.1
- ✓ Brand tracking (save, re-analyze, delete) — v3.0
- ✓ Hook extraction and exploration — v3.1
- ✓ Pattern observations (rule-based) — v3.1
- ✓ V2 dashboard with ad library browser, filters, pagination — v4.0
- ✓ Creative Lab with Andromeda metrics — v4.0
- ✓ Share of Voice tracking — v4.0
- ✓ Hikaru AI chat assistant — v4.0
- ✓ Category browsing — v4.0
- ✓ Brand monitoring — v4.0
- ✓ Sidebar restructure with Inspiration section — v5.0
- ✓ Hide Competitors/Benchmarking/Compare from sidebar — v5.0
- ✓ Gray out Downloads in sidebar — v5.0
- ✓ Saved Ads auth integration — v5.0
- ✓ Brand detail pages (no more 404) — v5.0
- ✓ Category detail pages (no more 404) — v5.0
- ✓ Dashboard rework as configurable analytics view — v5.0
- ✓ Hikaru AI with embedded charts — v5.0
- ✓ Rename Ad Library → Inspiration in navigation — v5.0
- ✓ Landing page with 3-tier pricing — v5.0
- ✓ V1 moved to /analyser as freemium entry point — v5.0
- ✓ V1 Theme Update — green-to-blue palette, typography, spacing, transitions — v5.1
- ✓ V1 Navigation Header — branded header with BarChart3 lockup and Get Pro CTA — v5.1
- ✓ Contextual upgrade card below V1 analysis results — v5.1
- ✓ Component extraction — ad library monolith decomposed into 6 composable components — v6.0
- ✓ Filter/sort overhaul — 5 sort options, partnership filter, density toggle, sticky bar — v6.0
- ✓ Load-more pagination — accumulation pattern (48+24 batches) replacing numbered pages — v6.0
- ✓ Inline analytics strip — live filtered stats (reach, active count, formats, categories) — v6.0
- ✓ Ad detail lightbox — responsive modal with media preview, stats, targeting, save/view actions — v6.0
- ✓ Demographic peek — per-brand mini Recharts charts (age, gender, region) with collapse persistence — v6.0
- ✓ Brand monitoring fix — "Monitor brand" button persists saved state across navigation — v6.1
- ✓ Per-brand mini dashboard — top ads by reach + demographic charts (age, gender, region) — v6.1
- ✓ Dead code cleanup — removed orphaned stats-bar.tsx, pagination.tsx, AdLibraryStats interface — v6.1
- ✓ Build fix — useSearchParams Suspense boundary resolved — v6.1
- ✓ Facebook token verification — all 3 tokens valid, demographics API working — v6.1
- ✓ Creative Lab with analysis view (Andromeda metrics, diversity scoring) — v7.0
- ✓ AI image generation (Flux Schnell) with brand-aware config — v7.0
- ✓ UGC Creator Briefs with shot list and talking points — v7.0
- ✓ Brand Guidelines system (voice, audience, visual identity) — v7.0
- ✓ Brand search with category in Creative Lab — v7.0
- ✓ Dead code cleanup and gap closure — v7.0+

### Validated (v9.0 Brand Profile & AI Context System)

- ✓ BrandProfile multi-table data model with full CRUD, tab-based settings, and brand selector — v9.0
- ✓ Onboarding wizard (5-step form + AI conversational interview) with soft prompts — v9.0
- ✓ Manus API integration for async deep research with dual-response routing — v9.0
- ✓ Brand context injection into all AI routes via compileBrandContext() — v9.0
- ✓ Keyword-based message routing (Claude streaming + Manus async with polling UI) — v9.0
- ✓ Auto-enrichment from ad data (Haiku 4.5, hash-based change detection) and website URLs — v9.0
- ✓ Brand management page (view, edit, delete brand profiles) — v9.0
- ✓ Brand selector in Hikaru chat header with URL param persistence — v9.0
- ✓ Brand health competitor comparison with pillar-by-pillar indexing — v9.0
- ✓ Profile-aware personalized strategy recommendations with AI insights — v9.0

### Validated (v8.0 Creative Strategy Engine)

- ✓ Motion-based Ad Classification — Claude Vision classifies ads across 46 visual formats, 8 creative mechanics, 35 hook tactics, 5 awareness stages, 8 psychological triggers
- ✓ Brand Strategy Intake — auto-generate brand context from existing DB ads/metadata, extract pain points, personas, positioning
- ✓ Strategy Matrix & Gap Analysis — map brand's ads across full Motion matrix, identify gaps
- ✓ Hook Generation Pipeline — generate hooks using 35 tactics + 8 triggers, tailored to gaps and brand voice
- ✓ Creative Concept Generation — full concepts with AI image generation and production briefs
- ✓ Category Benchmarking (Motion dimensions) — brand vs category comparison across Motion dimensions

### Planned (v4.5 Industry Benchmarks — Admin Only)

- [ ] Industry entity with manual brand curation
- [ ] Benchmark generation — weighted aggregate demographics
- [ ] Admin UI — industry list, brand management, benchmark display
- [ ] Comparison view — brand vs industry average with indexing

### Active

(No active milestone — planning next)

### Out of Scope

- Five Pillars diversity scoring — replaced by Motion-dimension classification in v8.0
- Full canvas editor — template-based only, keep complexity manageable
- Competitors monitoring page — hidden, may delete later
- Benchmarking pages — hidden, may delete later
- Compare tool — hidden, may delete later
- Per-ad demographic breakdown — aggregated summary only
- Scheduled re-analysis — requires background jobs
- Own ad account integration — deferred (requires Meta Ads API + OAuth)
- Enterprise tier — keep Free + Pro for now
- Team/organization accounts — single user only
- Mobile app — web responsive only

## Architecture

- `/api/facebook-ads` — Graph API integration with tier enforcement
- `/api/ad-library/*` — Ads, brands, categories, cron ingestion endpoints
- `/api/ad-library/stats` — Aggregated analytics with filter support
- `facebook-api.ts` — API client with demographic aggregation
- `batch-fetch.ts` — Rate-limited multi-page fetching
- Auth.js (NextAuth v5) for authentication
- Stripe for subscription payments
- Prisma + Neon PostgreSQL for all data
- Cloudflare R2 for media assets

## Constraints

- **API Rate Limits:** Facebook Graph API has rate limits — 3 token rotation in place
- **EU Data Only:** Demographics only available for EU-targeted ads via DSA
- **Tech stack:** Next.js 16, maintain existing architecture
- **DB:** Shared Neon PostgreSQL (same DB for local + production)
- **Vision API Cost:** Claude Vision classification adds per-ad cost — needs batching/caching strategy
- **Data Source:** Brand strategy intake uses DB ads/metadata + Manus website crawl for enrichment
- **Motion Framework:** Reference/inspiration only — own implementation, not their npm package

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Facebook Graph API over browser scraping | More reliable, faster, official data source | ✓ Good |
| Weight demographics by reach | High-reach ads represent more audience | ✓ Good |
| Recharts for visualization | Lightweight, good React integration | ✓ Good |
| Google OAuth + email/password | Covers all users simply | ✓ Good |
| Two tiers (Free + Pro) | Simple pricing, clear value proposition | ✓ Good |
| JWT session strategy | No database needed for auth sessions | ✓ Good |
| Neon PostgreSQL | Serverless, shared local+prod | ✓ Good |
| V1 as freemium at /analyser, V2 as core product | Preserves SEO/traffic, focuses dev on V2 | ✓ Good |
| Hide features vs delete | Faster cleanup, reversible if product direction changes | ✓ Good |
| Rename Ad Library → Inspiration | Better framing for creative professionals | ✓ Good |
| Configurable dashboard over personal dashboard | Users want analytics over full dataset, not just their own data | ✓ Good |
| 3-tier pricing (Free/$49/$149) | Clear value ladder from free to pro | — Pending |
| :::chart fenced block protocol for AI | Self-contained chart emission in chat | ✓ Good |
| localStorage config persistence | No backend needed for dashboard presets | ✓ Good |
| URL param hydration for drill-downs | Deep-linkable filtered views across pages | ✓ Good |
| BrandProfile as multi-table Prisma model | Structured fields vs JSON blob — better querying, migration path | ✓ Good |
| compileBrandContext() shared utility | Single source for XML-tagged brand context injection across all AI routes | ✓ Good |
| Manus API for async deep research | Complex brand analysis offloaded to async agent; Claude stays fast for chat | ✓ Good |
| Keyword-based message routing | Simpler than LLM classification; UI toggle for user control | ✓ Good |
| Soft onboarding (never blocking) | All features work without brand profile; gentle nudge to create one | ✓ Good |
| Haiku 4.5 for enrichment/strategy | Cost-efficient for structured extraction and non-critical AI tasks | ✓ Good |
| Hash-based change detection (SHA-256) | More reliable than timestamps for skip-redundant enrichment runs | ✓ Good |
| Fill-empty + append-deduplicate merge | User edits preserved during auto-enrichment | ✓ Good |

## Context

**Current State:**
- Shipped v9.0 Brand Profile & AI Context System
- Tech stack: Next.js 16, React 19, Recharts, Tailwind CSS v4, Auth.js, Stripe, Prisma + Neon PostgreSQL
- Deployed to Vercel at facebookadexplorer.kirimedia.co
- Cloudflare R2 for ad asset storage
- 514+ brands in database, ingestion pipeline with 3 token rotation
- Hikaru AI chat at `/dashboard/v2/hikaru` — brand-aware with context injection
- Creative Lab with analysis view, strategy view, concept generation — all brand-context-aware
- Classification infrastructure: AdClassification model, batch/single classify, cron polling
- Manus API integrated for async deep research and website enrichment
- BrandProfile system with onboarding wizard, AI interview, auto-enrichment
- Brand health competitor comparison and personalized strategy recommendations

**Known Issues:**
- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25 — schedule refresh mid-April
- Creative Lab generate routes use inline brand context instead of shared compileBrandContext() (minor tech debt)
- Manus API endpoints lack auth() checks (low risk)
- BrandGuidelines model kept as dead code (superseded by BrandProfile)

---
*Last updated: 2026-04-07 after v9.0 Brand Profile & AI Context System milestone completed*
