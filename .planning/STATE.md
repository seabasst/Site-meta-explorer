# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.
**Current focus:** Phase 6 — Ad Preview

## Current Position

Phase: 6 of 9 (Ad Preview)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-01-26 — Completed 06-01-PLAN.md

Progress: █████████████░░░░░░░ 65% (v1.0 complete, v1.1 phase 6/9, 5/16 plans)

## Milestones

| Version | Status | Shipped |
|---------|--------|---------|
| v1.0 MVP | Complete | 2026-01-25 |
| v1.1 | In Progress | - |

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (v1.1)
- Average duration: 4 min
- Total execution time: 17 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 4/4 | 16 min | 4 min |
| 06 | 1/2 | 1 min | 1 min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.1: Link-out approach for ad previews (Facebook blocks embedding)
- v1.1: shadcn/ui for component library (React 19 + Tailwind v4 compatible)
- 05-01: shadcn/ui new-york style with Tailwind v4 configuration
- 05-02: Zod 4.x uses .issues (not .errors) for validation error access
- 05-03: Toaster position top-right with richColors for visibility
- 05-04: On-blur URL validation (not on-change) to avoid annoying users while typing
- 05-04: Dual error feedback (toast + inline ApiErrorAlert) ensures visibility
- 06-01: External link icon inline with title for clear UX association
- 06-01: Fallback text uses last 6 chars of adArchiveId for identification

### Pending Todos

None.

### Blockers/Concerns

- PDF export may require Vercel Pro (60s timeout) — verify during Phase 8

## Session Continuity

Last session: 2026-01-26
Stopped at: Completed 06-01-PLAN.md (AdPreviewCard component)
Resume file: None
