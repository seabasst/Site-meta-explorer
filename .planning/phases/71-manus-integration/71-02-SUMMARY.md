---
phase: 71-manus-integration
plan: 02
subsystem: ui
tags: [manus, deep-research, hikaru, chat, polling, website-enrichment, brand-profiles]

# Dependency graph
requires:
  - phase: 71-01
    provides: Manus API client, ManusTask model, create/poll endpoints, keyword router
  - phase: 69-brand-context
    provides: BrandProfile model and compileBrandContext utility
  - phase: 70-auto-enrichment
    provides: Fill-empty + append-deduplicate merge pattern for enrichment
provides:
  - Deep Research toggle in Hikaru chat with async Manus polling UI
  - Dual response mode in Hikaru (instant Claude SSE + async Manus polling)
  - Website enrichment endpoint (POST /api/manus/enrich)
  - Auto-merge of Manus enrichment results into BrandProfile
  - Brand profile "Analyze Website" UI trigger with polling progress
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-response-routing, inline-polling-card, website-enrichment-via-manus]

key-files:
  created:
    - src/app/api/manus/enrich/route.ts
  modified:
    - src/app/api/chat/hikaru/route.ts
    - src/app/dashboard/v2/hikaru/page.tsx
    - src/app/api/manus/[taskId]/route.ts
    - src/app/dashboard/v2/settings/brand-profiles/brand-profile-form.tsx

key-decisions:
  - "Manus routing is a short-circuit early return in Hikaru POST -- existing Claude SSE flow untouched"
  - "useManusTask polling hook inline in page file, not a separate module"
  - "Website enrichment auto-merges JSON results into BrandProfile using fill-empty strategy"
  - "JSON parse failure on enrichment results stores raw text -- no crash, user can still read it"

patterns-established:
  - "Dual response detection: check Content-Type (JSON vs event-stream) to switch between polling and SSE"
  - "Inline polling card with elapsed timer replaces message content on completion"

# Metrics
duration: 4min
completed: 2026-04-06
---

# Phase 71 Plan 02: Deep Research UI + Website Enrichment Summary

**Hikaru Deep Research toggle with async Manus polling cards, plus website enrichment endpoint that auto-merges crawl results into brand profiles**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-06T01:17:00Z
- **Completed:** 2026-04-06T01:21:33Z
- **Tasks:** 2 auto + 1 checkpoint
- **Files modified:** 5

## Accomplishments
- Hikaru chat now supports dual response modes: instant Claude SSE (unchanged) and async Manus deep research with polling UI
- Deep Research toggle button renders near the send input with blue active state
- Manus polling card shows animated spinner, elapsed time, and replaces with markdown content on completion
- Website enrichment endpoint creates Manus tasks for deep site crawling
- Completed enrichment results auto-merge into BrandProfile using fill-empty + append-deduplicate strategy (user edits never overwritten)
- Brand profile form shows "Enrich from Website" section with URL input, analyze button, and polling progress

## Task Commits

Each task was committed atomically:

1. **Task 1: Hikaru route routing + chat UI with Deep Research toggle and polling** - `d974a50` (feat)
2. **Task 2: Website enrichment endpoint via Manus + brand profile UI trigger** - `1c53ad6` (feat)

## Files Created/Modified
- `src/app/api/chat/hikaru/route.ts` - Added Manus routing pre-check before Claude SSE flow; short-circuits to JSON response for deep research queries
- `src/app/dashboard/v2/hikaru/page.tsx` - Deep Research toggle, useManusTask polling hook, inline polling card with progress states
- `src/app/api/manus/enrich/route.ts` - POST endpoint for website-based brand profile enrichment via Manus
- `src/app/api/manus/[taskId]/route.ts` - Extended poll endpoint with post-completion auto-merge for website_enrichment tasks
- `src/app/dashboard/v2/settings/brand-profiles/brand-profile-form.tsx` - "Enrich from Website" section with URL input, analyze button, and polling progress UI

## Decisions Made
- Manus routing is a short-circuit early return in the Hikaru POST handler -- the existing Claude SSE streaming code is completely untouched, preventing any regression
- useManusTask polling hook kept inline in the page file (not extracted to a separate module) to keep the change surface minimal
- Website enrichment auto-merges JSON results into BrandProfile using the same fill-empty + append-deduplicate pattern from Phase 70
- If Manus returns non-JSON enrichment results, raw text is stored without crashing -- user can still read the analysis even if auto-merge fails
- Polling interval set at 5 seconds, matching the plan specification

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness
- Phase 71 (Manus Integration) is now complete
- All Manus integration features are functional pending MANUS_API_KEY configuration
- Deep Research toggle and website enrichment ready for live testing once API key is set

---
*Phase: 71-manus-integration*
*Completed: 2026-04-06*
