---
phase: 71-manus-integration
verified: 2026-04-06T09:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "Toggle Deep Research ON in Hikaru chat, send 'Do a deep dive on Nike advertising strategy'"
    expected: "Returns JSON with taskId, polling card appears with timer, eventually resolves to full research"
    why_human: "Requires live MANUS_API_KEY and 2-5 min wait for Manus completion"
  - test: "Send a normal message with Deep Research OFF"
    expected: "Claude SSE streaming works as before -- no regression"
    why_human: "Need to verify real-time streaming behavior"
  - test: "Enter a website URL on brand profile settings, click 'Analyze Website'"
    expected: "Polling starts, profile fields populate after Manus completes"
    why_human: "Requires live MANUS_API_KEY and 3-5 min wait"
  - test: "Send message without MANUS_API_KEY configured"
    expected: "Clear error message shown to user (not a crash)"
    why_human: "Need to verify error UX in browser"
---

# Phase 71: Manus Integration & Deep Research Verification Report

**Phase Goal:** Async deep research via Manus API for complex brand analysis and website enrichment
**Verified:** 2026-04-06
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Deep research queries route to Manus API as async tasks with polling UI | VERIFIED | Hikaru route has `shouldRouteToManus()` pre-check (line 958), creates ManusTask via `createManusTask()`, returns JSON with `type: 'manus_task'`. Chat UI detects JSON response, switches to polling mode via `useManusTask` hook. |
| 2 | Simple/fast queries continue routing to Claude for instant streaming | VERIFIED | Manus routing is a short-circuit early return. If `shouldRouteToManus()` returns false, the entire existing Claude SSE flow (lines 1016-1160) executes unchanged. No modifications to Claude streaming logic. |
| 3 | User can auto-populate profile from website URL crawl via Manus | VERIFIED | `/api/manus/enrich/route.ts` creates website_enrichment task. Poll endpoint's `mergeWebsiteEnrichment()` function (lines 125-252 in `[taskId]/route.ts`) parses JSON, applies fill-empty + append-deduplicate merge to BrandProfile. Brand profile form has full "Enrich from Website" UI with URL input, polling, and success/error states. |
| 4 | Routing uses keyword matching + UI toggle, not LLM-classified | VERIFIED | `router.ts` exports `shouldRouteToManus()` with 16 keyword `includes()` checks and toggle override. Comment explicitly says "Do NOT use LLM classification." No AI/LLM calls in routing path. |
| 5 | Deep research messages show inline polling card with progress | VERIFIED | `ManusPollingCard` component (line 414) renders spinner, elapsed timer, and status. Chat rendering (lines 991-1004) switches between polling card and normal content based on `manusStatus`. |
| 6 | ManusTask records persist in database with full lifecycle tracking | VERIFIED | `ManusTask` model in schema.prisma (line 784) with status, resultText, resultJson, completedAt, errorMessage fields. Create route persists on creation, poll route updates on completion/failure. |
| 7 | Website enrichment results populate brand profile fields | VERIFIED | `mergeWebsiteEnrichment()` does selective merge: string fields (brandVoice, positioning, missionStatement) fill-empty only; array fields (demographics, interests, painPoints) append-deduplicate; color fields fill if null. User edits never overwritten. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/manus/types.ts` | Manus API v2 types | VERIFIED | 52 lines. Exports ManusCreateRequest, ManusCreateResponse, ManusTaskDetail, ManusTaskStatus, ManusMessagesResponse. |
| `src/lib/manus/client.ts` | API wrapper | VERIFIED | 161 lines. Exports createManusTask, getManusTask, getManusMessages, extractAssistantResponse. API key guard throws clear error. |
| `src/lib/manus/router.ts` | Keyword routing | VERIFIED | 42 lines. Exports DEEP_RESEARCH_KEYWORDS (16 keywords) and shouldRouteToManus(). |
| `src/app/api/manus/create/route.ts` | POST create task | VERIFIED | 59 lines. Validates prompt, calls Manus API, persists ManusTask to DB. |
| `src/app/api/manus/[taskId]/route.ts` | GET poll + enrichment merge | VERIFIED | 252 lines. Polls Manus, caches results, website enrichment auto-merge with fill-empty strategy. |
| `src/app/api/manus/enrich/route.ts` | POST website enrichment | VERIFIED | 107 lines. Validates URL, builds enrichment prompt, creates website_enrichment task. |
| `src/app/api/chat/hikaru/route.ts` | Routing pre-check | VERIFIED | Imports shouldRouteToManus + createManusTask. Lines 958-1013: short-circuit to Manus with brand context. |
| `src/app/dashboard/v2/hikaru/page.tsx` | Deep Research toggle + polling | VERIFIED | Deep Research toggle button (line 1078), useManusTask hook (line 358), ManusPollingCard component (line 414), dual response detection (line 792). |
| `src/app/dashboard/v2/settings/brand-profiles/brand-profile-form.tsx` | Website enrichment UI | VERIFIED | URL input, "Analyze Website" button, polling with status messages, profile refresh on completion. |
| `prisma/schema.prisma` | ManusTask model | VERIFIED | Model at line 784, relation on BrandProfile at line 759. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| hikaru/route.ts | manus/router.ts | shouldRouteToManus() | WIRED | Imported line 6, called line 958 |
| hikaru/route.ts | manus/client.ts | createManusTask() | WIRED | Imported line 7, called line 985 |
| hikaru/route.ts | prisma.manusTask | create | WIRED | Lines 988-997 |
| hikaru/page.tsx | /api/chat/hikaru | deepResearch in body | WIRED | Line 786 sends flag, line 792-817 detects JSON vs SSE response |
| hikaru/page.tsx | /api/manus/[taskId] | useManusTask poll | WIRED | Hook at line 358, polls line 377 |
| manus/create/route.ts | manus/client.ts | createManusTask() | WIRED | Imported line 3, called line 29 |
| manus/[taskId]/route.ts | manus/client.ts | getManusTask + getManusMessages | WIRED | Imported line 3, called lines 41 + 46 |
| manus/[taskId]/route.ts | prisma.brandProfile.update | merge enrichment | WIRED | mergeWebsiteEnrichment at line 233 |
| manus/enrich/route.ts | manus/client.ts | createManusTask() | WIRED | Imported line 3, called line 76 |
| brand-profile-form.tsx | /api/manus/enrich | fetch POST | WIRED | Line 668 |
| brand-profile-form.tsx | /api/manus/[taskId] | poll | WIRED | Line 597 |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| MANS-01: Deep research queries route to Manus API as async tasks | SATISFIED | Full routing + task creation + DB persistence |
| MANS-02: Simple/fast queries continue to Claude instant streaming | SATISFIED | Short-circuit pattern, Claude flow untouched |
| MANS-03: Manus results display with clear async state | SATISFIED | ManusPollingCard with spinner, timer, completion states |
| MANS-04: Routing is keyword-based + UI toggle, not LLM-classified | SATISFIED | Pure string matching, 16 keywords, toggle override |
| ENRC-02: Auto-populate profile from website URL crawl | SATISFIED | Enrichment endpoint + auto-merge + brand profile UI |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/manus/types.ts | 42 | TODO: refine types after live API testing | Info | Expected -- Manus message format not fully documented |

No blockers or warnings found. Single TODO is a legitimate note for post-launch refinement.

### Human Verification Required

### 1. Deep Research End-to-End
**Test:** Toggle Deep Research ON in Hikaru, send "Do a deep dive on Nike advertising strategy"
**Expected:** Polling card appears with spinner and timer, resolves to full markdown research after 2-5 min
**Why human:** Requires live MANUS_API_KEY and real Manus API response

### 2. Claude SSE No Regression
**Test:** Send a normal chat message with Deep Research OFF
**Expected:** Claude streams response as before with thinking steps and tool use
**Why human:** Need to verify real-time streaming behavior in browser

### 3. Website Enrichment Flow
**Test:** Go to brand profile settings, enter website URL, click "Analyze Website"
**Expected:** Polling state shows, profile fields auto-populate on completion
**Why human:** Requires live MANUS_API_KEY and 3-5 min wait

### 4. Missing API Key Error UX
**Test:** Trigger deep research or website enrichment without MANUS_API_KEY configured
**Expected:** Clear user-facing error message, no crash
**Why human:** Need to verify error presentation in browser

### Gaps Summary

No gaps found. All backend infrastructure (types, client, router, API routes, Prisma model) and frontend features (Deep Research toggle, polling card, website enrichment UI) are fully implemented and properly wired. The implementation follows the plan exactly -- keyword-based routing with toggle override, short-circuit pattern preserving Claude SSE, fill-empty enrichment merge pattern.

The only items requiring verification are live-testing dependent (MANUS_API_KEY must be configured for end-to-end testing).

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
