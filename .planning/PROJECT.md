# Ad Library Intelligence Platform

## What This Is

A competitive ad intelligence tool for brands and agencies. Users browse a database of Facebook ads, save ads for reference, track brands, and analyze creative strategies. Features an AI assistant (Hikaru), creative analysis lab, share of voice tracking, and configurable analytics dashboard. V1 public page serves as freemium entry point; V2 dashboard is the core product.

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

### Active (v5.0 Product Refocus)

- [ ] Sidebar restructure — Inspiration (Ad Library + Saved Ads + Brands + Categories as sub-items), Creative Lab as hero below Dashboard, Hikaru AI prominent
- [ ] Hide Competitors, Benchmarking, Compare from sidebar (keep code)
- [ ] Gray out Downloads in sidebar (not available yet)
- [ ] Fix Saved Ads — auth integration so saves are tied to logged-in user
- [ ] Fix Brands — monitoring works, clicking brand detail pages no longer 404
- [ ] Fix Categories — clicking category detail pages no longer 404
- [ ] Dashboard rework — configurable analytics view over full ad database with filters, sorting, and saveable dashboard configurations (not a duplicate of Ad Library)
- [ ] Hikaru AI improvement — richer output with graphs, charts, and visual answers
- [ ] Rename "Ad Library" to "Inspiration" in navigation
- [ ] V1 page (/) kept as freemium entry point

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

## Context

**Current State:**
- V2 dashboard is the core product with 13 feature pages
- V1 page serves as freemium public entry point
- 514 brands in database, ingestion pipeline with 3 token rotation
- Tech stack: Next.js 16, React 19, Recharts, Tailwind CSS v4, Auth.js, Stripe, Prisma + Neon PostgreSQL
- Deployed to Vercel at facebookadexplorer.kirimedia.co
- Cloudflare R2 for ad asset storage

**Known Issues (v5.0 must fix):**
- Saved Ads broken — no user context for saves
- Brand detail pages return 404
- Category detail pages return 404
- Dashboard duplicates Ad Library instead of showing analytics overview
- Demographics fallback fails silently when tokens expire

**Architecture:**
- `/api/facebook-ads` — Graph API integration with tier enforcement
- `/api/ad-library/*` — Ads, brands, categories, cron ingestion endpoints
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
| V1 as freemium, V2 as core product | Preserves SEO/traffic, focuses dev on V2 | — Pending |
| Hide features vs delete | Faster cleanup, reversible if product direction changes | — Pending |
| Rename Ad Library → Inspiration | Better framing for creative professionals | — Pending |
| Configurable dashboard over personal dashboard | Users want analytics over full dataset, not just their own data | — Pending |

## Current Milestone: v5.0 Product Refocus

**Goal:** Transform from experiment to focused product — fix broken features, restructure navigation, rework dashboard as configurable analytics view, and improve AI assistant output.

**Target features:**
- Sidebar restructure with Inspiration (Ad Library + sub-items), Creative Lab hero, Hikaru AI
- Fix broken features: Saved Ads auth, Brand detail 404s, Category detail 404s
- Dashboard rework: configurable analytics over full ad database with saveable configurations
- Hikaru AI: richer visual output with graphs and charts
- Hide unused features (Competitors, Benchmarking, Compare)
- Gray out Downloads

---
*Last updated: 2026-03-16 after v5.0 milestone start*
