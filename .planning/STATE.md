# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** v10.0 TikTok Ad Library

## Current Position

Phase: 74 (TikTok API client)
Plan: —
Status: Phase 73 and 74 code done; live DB column still missing; client untested against live API
Last activity: 2026-10-24, phase 74 client written

## Performance Metrics

**Velocity:**
- Total plans completed: 142
- Average duration: —
- Total execution time: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v9.0 decisions archived to milestones/v9.0-ROADMAP.md.
v10.0: platform lives on AdLibraryBrand only; TikTok ids carry a `tiktok-` prefix instead of a compound unique key.

### Blockers/Concerns

- TikTok Commercial Content API approval pending
- Live DB column must be added by hand before this code deploys (see ROADMAP phase 73). `prisma db push` is unsafe while the landing-page branch is unmerged

## Session Continuity

Last session: 2026-10-24
Stopped at: Phase 74, waiting for the live DB column and TikTok API keys
Resume file: None
