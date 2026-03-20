# Ad Library Intelligence Platform

## What This Is

A competitive ad intelligence tool for brands and agencies. Users browse a database of Facebook ads, save ads for reference, track brands, and analyze creative strategies. Features an AI assistant (Hikaru) with embedded charts, creative analysis lab, configurable analytics dashboard, and a landing page with 3-tier pricing. V1 at `/analyser` serves as freemium entry point; V2 dashboard is the core product.

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

### Active

(No active requirements — define next milestone with `/gsd:define-requirements`)

### Planned (v4.5 Industry Benchmarks — Admin Only)

- [ ] Industry entity with manual brand curation
- [ ] Benchmark generation — weighted aggregate demographics
- [ ] Admin UI — industry list, brand management, benchmark display
- [ ] Comparison view — brand vs industry average with indexing

### Out of Scope

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

## Context

**Current State:**
- Shipped v6.0 Ad Library UX Overhaul with ~55,554 LOC TypeScript
- Tech stack: Next.js 16, React 19, Recharts, Tailwind CSS v4, Auth.js, Stripe, Prisma + Neon PostgreSQL
- Deployed to Vercel at facebookadexplorer.kirimedia.co
- Cloudflare R2 for ad asset storage
- 514 brands in database, ingestion pipeline with 3 token rotation
- Landing page at `/` with 3-tier pricing (Free/$49/$149)
- V1 public analyser at `/analyser` — branded header, blue design system, upgrade card
- V2 dashboard at `/dashboard/v2` with analytics, AI chat, and ad library
- Ad library now has composable components, filter/sort bar, load-more, analytics strip, lightbox, demographic peek
- Consistent brand identity (BarChart3 lockup, #1235e2 blue) across all surfaces

**Known Issues:**
- "More insights coming soon" placeholder widget in dashboard (cosmetic)
- Facebook access tokens may be expired on Vercel (demographics fallback handles gracefully)
- Orphaned files: stats-bar.tsx, pagination.tsx, AdLibraryStats interface (dead code from v6.0 replacements)
- Brand detail page does not use AdDetailLightbox (potential future enhancement)
- --accent-green CSS vars preserved for 46 files outside V1 scope

---
*Last updated: 2026-03-20 after v6.0 milestone*
