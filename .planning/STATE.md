# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** Phase 58 UGC Creator Briefs — Plan 01 complete (API + types)

## Current Milestone: v7.0 Creative Lab

**Goal:** Turn insights into action — generate, remix, and customize ad creatives directly in the platform.

## Current Position

Phase: 58 of 59 (UGC Creator Briefs)
Plan: 1 of ? complete
Status: In progress
Last activity: 2026-03-23 — Completed 58-01-PLAN.md (UGC Brief API & Types)

Progress: ███████░░░ 70% (v7.0)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 Polish | Partial (Phase 5 shipped, 6-9 superseded by v2.1) | 2026-01-25 |
| v2.0 Payments & Auth | Complete (Phases 10-13) | 2026-01-27 |
| v2.1 Polish & UX | Complete (Phases 14-17.2) | 2026-02-01 |
| v3.0 Brand Tracking | Complete (Phases 24-27) | 2026-02-02 |
| v3.1 Competitive Intelligence | Complete (Phases 28-31) | 2026-02-03 |
| v4.0 Analytics Platform | Partial (Phase 32 complete, 33-36 superseded) | — |
| v5.0 Product Refocus | Complete (Phases 38-43) | 2026-03-17 |
| v5.1 Visual Consistency | Complete (Phases 44-45) | 2026-03-18 |
| v6.0 Ad Library UX Overhaul | Complete (Phases 46-51) | 2026-03-20 |
| v6.1 Brand Monitoring & Cleanup | Complete (Phases 52-54) | 2026-03-21 |
| v7.0 Creative Lab | **Active** — Phases 55-59 | — |

## Performance Metrics

**Velocity:**
- Total plans completed: 115
- Average duration: —
- Total execution time: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

### Existing Infrastructure

- Creative Lab page rewritten at `/dashboard/v2/creative-lab/page.tsx` (~270 LOC, 3-state flow)
- ConfigScreen component at `/dashboard/v2/creative-lab/config-screen.tsx` (gap summary, suggestion grid, generate button)
- SuggestionCard component at `/dashboard/v2/creative-lab/suggestion-card.tsx` (pillar, reasoning, toggle, editable prompt)
- GenerationGallery component at `/dashboard/v2/creative-lab/generation-gallery.tsx` (progressive loading, zip download)
- BenchmarkComparison component at `/dashboard/v2/creative-lab/benchmark-comparison.tsx` (281 LOC, no longer imported)
- Andromeda analysis API at `/api/analyze/diversity` (now caches results to BrandAnalysisCache)
- Benchmark API at `/api/analyze/benchmark` (brand vs category comparison)
- Image generation API at `/api/analyze/generate-image` (Flux Schnell, now brand-aware via opt-in flag)
- BrandGuidelines model + CRUD API at `/api/brand-guidelines` (GET/PUT) + upload at `/api/brand-guidelines/upload` (POST)
- Brand search API at `/api/search-pages`
- Five Pillars + Andromeda scoring already built
- BrandAnalysisCache model stores scores, metrics, and distribution data per brand
- generate-config API at `/api/creative-lab/generate-config` (Claude-powered suggestion synthesis)
- generate-batch API at `/api/creative-lab/generate-batch` (Flux Schnell image generation)
- Shared types at `src/lib/creative-lab-types.ts` (GenerationSuggestion, GenerationConfig, GenerationResult)

### Roadmap Evolution

- Phase 56.1 inserted after Phase 56: Brand Guidelines Setup — brand persona form (voice, audience, visual identity) to steer AI generation (INSERTED 2026-03-23). Design reference from Figma (Google Stitch export).
- Phase 57 redefined (2026-03-23): Text Overlay Editor → AI Creative Generation. Manual template editing was wrong direction — Creative Lab should be AI-driven with minimal user input. EDIT-01..05 superseded by AIGEN-01..05.

### Blockers/Concerns

- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25 — schedule refresh mid-April
- AI generation requires external API key (Flux Schnell) — cost and key management TBD

## Session Continuity

Last session: 2026-03-23
Stopped at: Completed 58-01-PLAN.md (UGC Brief API & Types)
Resume file: None
