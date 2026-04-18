# Codebase Review — Synthesis

**Date:** 2026-04-18
**Scope:** 5 parallel reviews across API routes, v2 UI, ingestion pipeline, data model + auth, and AI/LLM features
**Source reports:** `01-api-routes.md`, `02-v2-dashboard-ui.md`, `03-ingestion-pipeline.md`, `04-data-model-and-auth.md`, `05-ai-llm-features.md`
**Files reviewed:** ~200 source files, ~44 of 76 scripts, full Prisma schema, NextAuth config
**Total findings:** ~210 (38 P0, ~110 P1, ~62 P2)

---

## TL;DR

The app works but the **trust model is effectively absent**, and the **data layer has no migration history**. Any single one of the following, in isolation, would be a ship-blocker:

1. `demo@example.com / demo123` is a publicly-advertised login AND is in the admin allow-list. Anyone on the internet is admin.
2. Four IDOR patterns on `BrandProfile` return any user's brand voice/audience/positioning to any caller.
3. `prisma/migrations/` does not exist — Neon prod schema has been evolved via `db push` with no history, no rollback, no audit.
4. Hikaru chat and Manus deep-research endpoints burn paid LLM/agent tokens with no auth and no rate limit. A `while(true) curl` loop saturates the daily spend cap in minutes.
5. The daily Vercel cron re-downloads assets for **inactive** ads forever, violating a stated project invariant across 10+ code paths.
6. One untracked script (`rescrape-creator-brands.ts --fresh`) does `deleteMany({})` on the creator + partnership tables against shared prod with no confirmation.
7. `HikaruChat` / `HikaruMessage` routes call Prisma models that don't exist in the schema — they will 500 on first call. Wired into the chat sidebar.
8. Admin allow-list has a typo of **your own email** (`kirimediagroup.com` vs real `kirimedia.co`). You're not admin. Demo user is.

None of these require deep architecture work to fix — they're single-digit-line-change ship-blockers.

---

## Systemic themes (the five that explain most findings)

1. **Auth is opt-in, not middleware-enforced.** ~30 of 85 routes call `auth()`; the other 55 assume public access but many mutate data or call paid APIs. No `src/middleware.ts` exists.

2. **No rate limiting anywhere.** No `@upstash/ratelimit`, no token bucket, no IP throttle. Combined with the unauth LLM routes, this is the single largest cost + reliability risk.

3. **No schema migration history.** Schema ships via `db push` against shared prod. No rollback, no audit, no review. Any fix that requires a schema change is currently unsafe.

4. **Error leakage by default.** 40+ routes return `String(error)` / `err.message` directly to the client — leaks Prisma internals, Anthropic request shape, occasional token fragments.

5. **Shared prod+local DB.** Every unauthenticated mutation is a production blast-radius event. Every `db push` from a dev machine is a prod schema change.

---

## Recommended burn-down

The order below optimizes for (a) closing the widest-blast-radius holes first, (b) grouping changes that touch the same files, and (c) enabling later fixes — e.g. you can't safely change the schema until migrations exist.

### Phase 0 — Bleeding now (do before you sleep on it)

These are small, surgical, and each closes a live exploit or prevents unbounded cost.

| # | Change | Files | LoC est |
|---|---|---|---|
| 0.1 | Remove demo-credentials provider in prod (env-guard) | `src/auth.ts:17-23` | 2 |
| 0.2 | Fix admin allow-list typo + remove `demo@example.com` | `src/app/api/roadmap/[id]/route.ts:6`, `src/app/roadmap/page.tsx:28` | 2 |
| 0.3 | Flip all 4 cron guards to fail-closed (`!SECRET \|\|` pattern) | `cron/{ingest,assets,classify-poll,sov-snapshot}/route.ts` | 4 |
| 0.4 | Add `CRON_SECRET` check to the `POST` variant of `cron/ingest` | `src/app/api/ad-library/cron/ingest/route.ts:1246` | 3 |
| 0.5 | Add `auth()` gate + ownership check to the 3 Manus routes | `api/manus/{create,enrich,[taskId]}/route.ts` | ~15 |
| 0.6 | Add `auth()` + ownership check to Hikaru chat routes (until HikaruChat schema is fixed, just return 503) | `api/chat/hikaru/**` | ~10 |
| 0.7 | Add `auth()` to `/api/chat`, `/api/analyze`, `/api/analyze/diversity`, `/api/analyze/strategy`, `/api/analyze/generate-image`, `/api/classify/{inline,batch}`, `/api/creative-lab/{generate-brief,generate-config,generate-strategy,generate-batch,scrape-brand}`, `/api/strategy/**`, `/api/ad-library/assets/backfill`, `/api/ad-library/jobs POST`, `/api/ad-library/brands/[pageId] PATCH+DELETE` | ~18 route files | ~40 |
| 0.8 | Strip `userEmail` from `/api/roadmap` GET response for non-admins | `src/app/api/roadmap/route.ts:40-52` | 3 |
| 0.9 | Stop-gap for `generate-strategy`: either delete the route or guard `export const GET = process.env.ENABLE_STRATEGY === '1' ? handler : () => NextResponse.json({error:'disabled'}, {status:503})` | `api/creative-lab/generate-strategy/route.ts` | 3 |
| 0.10 | Add `isActive: true` to `processPendingAssets` in `src/lib/asset-pipeline.ts:213` | `src/lib/asset-pipeline.ts` | 1 |
| 0.11 | Delete or rename `scripts/rescrape-creator-brands.ts --fresh` branch; add `--yes` gate | `scripts/rescrape-creator-brands.ts:342-344` | 5 |

**Time estimate: 2–3 hours.** Covers 11 of the ~38 P0 findings; closes every live "unauth paid endpoint" exploit and the biggest data-loss script.

### Phase 1 — Foundation (required before most other fixes)

Until these exist, every other fix is fragile.

| # | Change | Why |
|---|---|---|
| 1.1 | Create `prisma/migrations/0_init/` from current schema, baseline against Neon, lock in `migrate dev` as the only path | Without migrations, every schema change you make next week is unsafe. Blocks items 2.1–2.4. |
| 1.2 | Add `src/middleware.ts` with an **explicit public allow-list** (signup, signin, /dashboard/v2/ads, /api/ad-library/ads GET, /api/dashboard/feed, cron with secret) — everything else requires session | Closes the ~55 unauth routes by default instead of chasing them one-by-one |
| 1.3 | Add `@upstash/ratelimit` (or equivalent). Apply two limiters: per-IP for anon public routes, per-user for authed mutations and all LLM routes | Closes cost DoS + brute force + Notion-spam vectors |
| 1.4 | Add `src/lib/api-error.ts` with `apiError(err)` helper that logs server-side and returns generic `{error: "Internal error"}` | Replaces 40+ `String(error)` leaks with one helper |
| 1.5 | Add `src/lib/llm/models.ts` central config (pinned model IDs, max_tokens, temperature, pricing) | Kills the 4-Sonnet-variants / 3-Haiku-variants sprawl and fixes the two broken model IDs |
| 1.6 | Add `src/lib/llm/call-claude.ts` wrapper that handles cost-tracking automatically | Only 5 of 21 LLM sites log cost today. Move the decision to one file. |

**Time estimate: 1 day.** Everything else builds on these.

### Phase 2 — Close the IDOR class

The four known IDORs are one pattern; fix it at the schema level so it can't recur.

| # | Change | Notes |
|---|---|---|
| 2.1 | Migration: drop `BrandProfile.isActive`, add `User.activeBrandProfileId String?` with FK | Now "the active profile" is inherently user-scoped. Requires Phase 1.1 first. |
| 2.2 | Replace every `findFirst({ where: { isActive: true } })` on BrandProfile with `user.activeBrandProfile` joined via session.user.id | 4 P0 routes + 2 P1 routes in creative-lab |
| 2.3 | Schema: either add `HikaruChat` / `HikaruMessage` models with `userId` FK + indexes, OR delete all routes under `api/chat/hikaru/history/**` | Currently a runtime 500 |
| 2.4 | Schema: add `userId` column + FK to `ManusTask`. Update routes to filter | Closes the task-leak P0 |
| 2.5 | Schema: add FK relations on `RoadmapRequest.userId` and `RoadmapUpvote.userId` | Prevents orphan rows on user delete |

**Time estimate: ~1 day** (schema change + code update + migration baseline).

### Phase 3 — Close the "active ads only" pipeline leak

The rule is a project invariant. Put it in code, not docs.

| # | Change | Files |
|---|---|---|
| 3.1 | Add `getDownloadableAssets(limit, brandId?)` helper that hard-codes `ad.isActive: true`. Make it the only way to read pending assets | `src/lib/asset-pipeline.ts` |
| 3.2 | Migrate `processPendingAssets`, `processAdsToR2`, the cron handler, and all 8 backfill/download scripts to use the helper | `src/lib/asset-pipeline.ts`, `src/lib/asset-processor.ts`, `scripts/**` |
| 3.3 | One-time SQL: set `downloadStatus='skipped_inactive'` for pending assets where ad is inactive | Cleanup |
| 3.4 | Unify the three R2 key conventions (`ads/{brandId}/{adId}/{type}-{pos}{ext}` vs `ads/{brandId}/{adId}.png` vs `creators/{adId}{ext}`) | Scripts |
| 3.5 | Delete `scripts/download-top-ads.ts` or relabel — it stores PNG screenshots as "images" regardless of video source | — |

**Time estimate: ~1 day.** Will noticeably drop R2 bill and Facebook request rate.

### Phase 4 — LLM cost containment

Phase 0.7 already closed the unauth holes. These are the structural fixes.

| # | Change |
|---|---|
| 4.1 | Per-user daily cost cap (not global), stored in `ApiCostLog` or Redis |
| 4.2 | Wire `callClaude()` into every one of the 21 LLM call sites. CI rule to forbid direct `client.messages.create` outside the wrapper |
| 4.3 | Cap `hikaru` agentic loop iterations as a function of user tier (anon = disabled, free = 3, pro = 15) |
| 4.4 | Pipe `request.signal` through every SSE LLM call so client disconnects stop billing |
| 4.5 | Set `temperature: 0` on all extraction/classification calls (currently default 1.0 everywhere) |
| 4.6 | Enable Anthropic prompt caching on the hikaru system prompt + the classification system prompt (input tokens ~5× cheaper) |
| 4.7 | Replace every `JSON.parse(response.text.replace(...))` with Anthropic structured output or at least `safeParse` |
| 4.8 | Add XML delimiters to all prompts that interpolate user/scraped/ad-body/LLM-output strings; instruct model to treat as untrusted |

**Time estimate: 2–3 days.** Every day you wait is cost-risk.

### Phase 5 — Script sprawl cleanup

43 of 76 scripts are untracked. Most are one-offs. All run against shared prod.

| # | Change |
|---|---|
| 5.1 | `mkdir scripts/_scratch && git mv` the one-offs there. Gitignore it |
| 5.2 | Track the ~15 reusable scripts. Delete clear duplicates (see sprawl table in report 03) |
| 5.3 | Write `scripts/README.md` — one line per script: what it does, safe-for-prod: yes/no, dry-run required: yes/no |
| 5.4 | Extract shared helpers: `src/lib/ingestion/token-manager.ts`, `src/lib/ingestion/upsert-ad.ts`, `src/lib/ingestion/partnership-regex.ts` (currently duplicated 5 places) |
| 5.5 | Gitignore `creator-partnerships*.json`, `new-brands-expansion.json`, `*.pptx` at repo root |
| 5.6 | Delete `prisma/dev.db` (leftover SQLite) |

**Time estimate: ~1 day.**

### Phase 6 — UI foundation

Most of v2 is client-side-with-useEffect. This works but throws away Next 16's best wins.

| # | Change |
|---|---|
| 6.1 | Add `tailwind.config.ts` color tokens: `brand: '#1235e2'`, `surface-dark: '#101322'`, `surface-light: '#f6f6f8'`, etc. Run a codemod to replace the 130+ hardcoded hex uses in `ads/**` |
| 6.2 | Switch dark mode to Tailwind's `dark:` variants. Remove prop-drilled `darkMode: boolean`. Keep `V2Provider` only for the toggle button state. Persist via cookie so it survives reload + no hydration flicker |
| 6.3 | Add `dashboard/v2/{loading,error,not-found}.tsx` route files |
| 6.4 | Migrate ad images from raw `<img>` to `next/image` with R2 `remotePatterns`. Biggest perf win on the site. |
| 6.5 | Extract one `<V2Modal>` primitive with `role="dialog"`, `aria-modal`, focus trap, return-focus-on-close. Replace the 3 hand-rolled copies (`AdDetailLightbox`, inline login modal, `CreatorLightbox`) |
| 6.6 | A11y pass on filter bar + cards: real `<button>` (not `<div onClick>`), real `<label>` on every input, `aria-label` on icon buttons |
| 6.7 | Delete `src/app/dashboard/v2/page-old-analytics.tsx` (dead code, no references) |
| 6.8 | Promote at least the brand-detail page to a server component with `async` data fetching — kill the 3-waterfall load |
| 6.9 | Fix real bugs: `filter-bar.tsx:376` empty-string format-chip clear, `filter-dropdown.tsx` unused `onClose` (no click-outside), `ads/page.tsx:94-99` lazy `useState` localStorage hydration flicker |

**Time estimate: 2–3 days.** 6.1, 6.2, 6.4, and 6.6 carry most of the impact.

### Phase 7 — Nice-to-haves / tech debt

Not urgent, but worth tracking.

- Convert 10+ free-form status columns to Prisma enums (User.subscriptionStatus, IngestionJob.status, ManusTask.status, …)
- Add `updatedAt` to 10 models that mutate without it
- Add `@db.Text` to long-form profile fields
- Replace the 17 re-implementations of the BigInt JSON serializer with one helper in `src/lib/serialize.ts`
- Switch from `session.user.email` lookup (~20 routes) to `session.user.id` directly (saves a DB round-trip and survives email changes)
- Zod schema on every POST/PUT/PATCH body (~15 routes currently use `as { ... }` casts)
- SSRF hardening: resolve DNS and block cloud metadata IP + IPv6 loopback/link-local in `scrape-brand`, `analyze-sitemap` server action, `manus/enrich`
- Consolidate admin allow-list into `User.role` enum; remove both hardcoded arrays

---

## Risk-weighted top 15 (if you only have 1 day)

1. Phase 0.1 — kill demo credentials in prod
2. Phase 0.2 — fix admin typo
3. Phase 0.3, 0.4 — cron secret fail-closed + POST auth
4. Phase 0.7 — middleware auth on the 18 LLM/mutation routes
5. Phase 0.5, 0.6 — Manus + Hikaru lockdown
6. Phase 0.10 — `isActive: true` in `processPendingAssets` (one-line fix)
7. Phase 0.11 — kill the `--fresh deleteMany` risk
8. Phase 0.8 — strip roadmap email leak
9. Phase 0.9 — disable `generate-strategy` until schema ships
10. Phase 1.1 — baseline Prisma migrations (so further schema fixes are safe)
11. Phase 1.3 — rate limiter wired to LLM routes
12. Phase 1.4 — `apiError()` helper + global replace of `String(error)` leaks
13. Phase 4.4 — abort-signal plumbing in hikaru SSE
14. Phase 2.3 or 2.4 — decide Hikaru fate (ship schema or delete routes)
15. Phase 6.4 — `next/image` migration for ad grid

---

## What this audit did NOT cover

- `src/lib/classification/**`, `src/lib/enrichment/**`, `src/lib/snapshot-builder.ts`, `src/lib/spend-estimator.ts` — the business logic inside the library functions
- ~20 untracked scripts (mostly one-off `check-*`, `lookup-*`, `inspect-*` read-only scripts)
- `benchmarks/`, `brand-guidelines/`, `competitors/`, `downloads/`, `onboarding/**`, `creative-lab/**` UI pages (skimmed, not read line-by-line)
- Stripe webhook logic beyond auth
- Client-side Hikaru / Chat components
- Test coverage (there don't appear to be tests)
- CI / deployment config beyond `vercel.json`
- Secret scanning (would recommend `gitleaks` or similar on the commit history as a separate pass)

---

## Report-level summaries

| Scope | File | Findings | P0 | P1 | P2 |
|---|---|---|---|---|---|
| 1 — API routes + server actions | `01-api-routes.md` | ~45 | 15 | 22 | 8 |
| 2 — v2 dashboard UI | `02-v2-dashboard-ui.md` | 35 | 4 | 19 | 12 |
| 3 — Ingestion + scripts + R2 | `03-ingestion-pipeline.md` | 47 | 14 | 25 | 8 |
| 4 — Data model + auth | `04-data-model-and-auth.md` | ~30 | 10 | 14 | 6 |
| 5 — AI / LLM features | `05-ai-llm-features.md` | ~35 | 6 | 19 | 10 |
| **Total** | | **~192** | **~49** | **~99** | **~44** |

(Double-counting is real: many items appear in multiple reports — e.g. the CRON_SECRET fail-open is counted in scopes 1, 3, and 4. Phase 0–7 above deduplicates.)
