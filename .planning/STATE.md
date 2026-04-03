# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** Phase 69 — Context Injection & Onboarding

## Current Position

Phase: 69 of 72 (Context Injection & Onboarding)
Plan: 1/2 complete
Status: In progress
Last activity: 2026-04-03 — Completed 69-01-PLAN.md (context compiler + route wiring)

Progress: ██▓░░░░░░░ 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 134
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (v9.0): Manus API for async deep analysis, Claude for streaming chat
- (v9.0): BrandProfile as multi-table Prisma model (not JSON blob, not single table)
- (v9.0): Context injection into system prompts with ~2K token budget
- (v9.0): Onboarding wizard — soft prompt, never blocking
- (v9.0): Keyword-based message routing, not LLM-classified
- (69-01): compileBrandContext() as shared utility for all AI routes, character-based budgeting (7500 chars)
- (69-01): BrandGuidelines model kept as dead code, all routes now read from BrandProfile

### Blockers/Concerns

- Manus API access/keys needed (Phase 71)
- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25

## Session Continuity

Last session: 2026-04-03
Stopped at: Completed 69-01-PLAN.md — ready for 69-02
Resume file: None
