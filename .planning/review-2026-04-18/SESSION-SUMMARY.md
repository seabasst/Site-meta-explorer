# Audit Remediation Session — Summary

**Date:** 2026-04-18 (single overnight session)
**Branch:** `feat/strategy-mode`
**Starting point:** 82a9b3f (pre-existing WIP)
**Ending point:** f588335 (6 new commits)

## TL;DR

A 5-part parallel code review surfaced ~210 findings across API routes,
v2 UI, ingestion pipeline, data model, and AI features (see the other
files in this folder). This session executed 6 of the 7 remediation
phases from `00-SYNTHESIS.md`. Every practically-addressable P0 is
closed; the one remaining phase (Phase 2) needs a laptop session.

**~150 files touched. 6 commits. Zero new type errors. No manual review
happened — every change was shipped under a kill switch or with an
explicit deferral for work that was too risky without eyes on.**

---

## Commit log

| Commit | Phase | What | Files | Δ |
|---|---|---|---|---|
| 930d363 | **0** | Close auth gaps + destructive-op risks | 57 | +2071 / -56 |
| d15be2f | **1** | Foundation layer (migrations, middleware, rate-limit, error helper, LLM models/wrapper) | 9 | +1568 |
| a8ef19c | **4** | LLM cost containment (per-user caps, rate limits, abort signals, prompt hardening, caching) | 25 | +783 / -62 |
| 861bcd5 | **6** | v2 UI foundation (next/image, V2Modal, a11y, boundaries, dead code) | 19 | +515 / -1161 |
| 6156254 | **3** | Enforce active-ads-only invariant in code | 12 | +1130 / -29 |
| f588335 | **5** | Script sprawl cleanup (_scratch/, README, track canonical) | 19 | +3224 |

Phases done in that order because of dependencies: 0 closes the bleeding,
1 lays infrastructure 4 needs, 4 uses 1's primitives, 6 is independent,
3 builds on 0, 5 cleans up after the others.

---

## What changed, by theme

### Auth (Phase 0 + 1)

Before: opt-in per route (`auth()` called in ~30 of 85 routes). Demo
credentials a real admin login in prod. Admin allow-list misspelled
your own email. Four IDORs on `BrandProfile.findFirst({isActive:true})`.
Cron routes fail-open on missing `CRON_SECRET`. Hikaru chat + Manus +
most LLM routes unauth.

After:
- `src/auth.ts`: demo credentials gated behind
  `ENABLE_DEMO_LOGIN=1` + non-prod.
- `ADMIN_EMAILS` env-driven, typo fixed to `sebastian@kirimedia.co`,
  `demo@example.com` removed.
- All 4 IDOR routes require `auth()` + ownership check.
- 21 paid LLM/mutation routes have `auth()` gates.
- Manus + Hikaru routes: auth + IDOR guards.
- Hikaru history routes → 503 stubs (Prisma models missing; see Phase 2).
- Cron routes fail-closed: `!CRON_SECRET || …`.
- `/api/ad-library/cron/ingest` POST requires same secret as GET.
- `/api/roadmap` GET strips `userEmail` unless admin/owner.
- `src/middleware.ts`: defense-in-depth layer enforces auth on
  sensitive path prefixes. Kill switch: `MIDDLEWARE_AUTH_ENFORCE=0`.

### LLM cost containment (Phase 4)

Before: 4 Sonnet IDs + 3 Haiku IDs hardcoded across 20 files, two of
them invalid. Only 5 of 21 LLM call sites cost-tracked. Global daily
cap (one user could block everyone). Hikaru loop at 15 iters × 4096 tok
× Sonnet for anyone. SSE disconnects didn't stop billing. 12
prompt-injection sites with no delimiters. `JSON.parse` unchecked in 8
places.

After:
- `src/lib/llm/models.ts`: pinned IDs, PRICING, DEFAULTS (extraction
  / creative / agent / vision).
- `src/lib/llm/call-claude.ts`: wrapper with automatic cost logging
  + abort signal.
- `src/lib/llm/guard.ts`: per-user daily spend cap + rate limit,
  tier-aware (free $0.50/day·20rph·3iters, pro $20/day·300rph·15iters).
  Noop fallback if Upstash unconfigured.
- `llmGuard()` applied to 18 LLM routes via delegated mechanical pass.
- Hikaru SSE: `AbortController` on stream.cancel + request.signal.
  Tier-based iteration cap instead of hardcoded 15.
- `temperature: 0` on extraction/classification sites.
- 7 `JSON.parse` sites hardened (route 502s, libs throw clear Error).
- XML delimiters + untrusted-data warnings on 9 prompt-injection
  surfaces. System prompt additions on both chat routes for user
  messages as untrusted.
- Anthropic prompt caching on Hikaru system prompt +
  classify-single + classify-batch.

### Data / ingestion (Phase 3)

Before: the "active ads only" rule was docs-only. 10+ code paths
violated it, scaling R2 + fbcdn cost with historical volume. The
ingest cron itself kept queueing pending rows for ads that had ended.
`scripts/rescrape-creator-brands.ts --fresh` wiped the creator graph
with no confirm.

After:
- `src/lib/asset-pipeline.ts::getDownloadableAssets()` — the ONLY
  approved way to read pending assets. Hard-codes `isActive:true`.
- `processPendingAssets`, `processAdsToR2`, the ingest cron, and 8
  backfill/download scripts routed through it.
- `scripts/rescrape-creator-brands.ts --fresh` requires
  `--yes-i-really-want-to-wipe-creators` AND prints target DB host.
- `prisma/ops/2026-04-18-skip-inactive-pending-assets.sql`:
  one-time cleanup SQL for the existing backlog. **Not executed.**
- `prisma/ops/ROADMAP-r2-key-unification.md`: documents the three
  competing R2 key conventions with a migration plan.
- `scripts/download-top-ads.ts`: deprecation banner. Still runnable
  for ad-hoc use, but flagged as wrong for pipeline use.

### Infrastructure (Phase 1)

Before: no Prisma migrations directory at all. Schema evolved via
`prisma db push` against shared Neon. No rate limiter. No central
error helper. No LLM config.

After:
- `prisma/migrations/20260418000000_init/migration.sql`: baseline
  generated from current schema. **Not applied** — user runs
  `prisma migrate resolve --applied …` manually.
- `src/middleware.ts` with kill switch.
- `src/lib/rate-limit.ts` + Upstash deps (fail-open if unconfigured).
- `src/lib/api-error.ts` — `apiError()` / `unauthorized()` /
  `validationError()` / `notFound()`.
- Helpers created but **not mass-retrofitted** — new code uses them,
  existing `String(error)` patterns are a separate cleanup pass.

### v2 UI (Phase 6)

Before: every v2 page client-only useEffect. No `loading.tsx` /
`error.tsx`. Raw `<img>` on 48-card grids, no `next/image`. No
a11y (no `<label>`s, no `role="dialog"`, clickable `<div>`s).
`#1235e2` hardcoded 130+ times. Format-chip clear broken. Dropdowns
never closed on outside-click. Hydration flicker on dark-mode bootstrap.

After:
- Deleted 7 dead files (`page-old-analytics.tsx` + 6 orphan charts).
- `dashboard/v2/{loading,error,not-found}.tsx` added.
- AdCard + SavedAdCard migrated to `next/image`. AdCard is
  `React.memo`'d.
- `dashboard/v2/components/v2-modal.tsx` — accessible modal with
  focus trap, Esc, backdrop dismiss, return-focus, body scroll lock.
  Retrofitted to the inline login modal.
- AdCard keyboard-focusable (role=button, Enter/Space). Search has
  a `<label sr-only>`. Sort-order toggle has `aria-label`. Bell
  icon removed (was non-functional).
- `src/app/globals.css`: `--color-brand`, `--color-brand-hover`,
  `--color-surface-dark{,-raised,-elevated}`, `--color-surface-light`
  added as Tailwind tokens. New code uses them; 130+ existing hex
  literals are a separate codemod.
- 3 real bugs fixed: format-chip clear actually clears; filter
  dropdowns close on outside click + Escape; no more hydration
  mismatch on demographic-peek collapsed state.

### Script sprawl (Phase 5)

Before: 43 of 76 scripts untracked. No README. All touch shared prod.

After:
- `scripts/_scratch/` (gitignored) with 25 moved one-offs (gruns-*,
  verify-*, sample-*, debug-*, inspect-*, list-*, lookup-*, per-batch
  imports).
- 18 canonical scripts tracked in source control for the first time.
- `scripts/README.md`: every script labeled with safety class
  (READ/WRITE/DESTRUCTIVE/NET/PUPPETEER). Conventions for new
  scripts.
- `prisma/dev.db` leftover deleted.
- Root-level data dumps (JSON / pptx) added to .gitignore.

---

## Open items you need a laptop for

Listed in priority order.

### 1. Baseline Prisma migrations against Neon

Before any Phase 2 schema change is safe:

```bash
# After confirming Neon has a recent backup:
npx prisma migrate resolve --applied 20260418000000_init
npx prisma migrate status   # expected: "Database schema is up to date!"
```

This is metadata-only — no DDL runs against prod. See
`prisma/migrations/README.md`.

### 2. Run the active-ads cleanup SQL

The Phase 3 cron filter stops re-queuing stale pending rows, but the
existing backlog needs a one-time sweep:

```bash
# Preview first, then apply:
npx prisma db execute --file prisma/ops/2026-04-18-skip-inactive-pending-assets.sql
```

The file has three statements: preview SELECT, UPDATE, verify SELECT.
Nothing is deleted. Completed rows are untouched.

### 3. Push the branch

Everything is local. The branch has 6 new commits. It's behind nothing
on origin but `git push origin feat/strategy-mode` is the obvious
gate before merging to main.

### 4. Wire up Upstash (prod)

Rate limits + per-user cost caps currently fail-open in prod because
the env vars aren't set. To activate:

```
UPSTASH_REDIS_REST_URL=<from Upstash dashboard>
UPSTASH_REDIS_REST_TOKEN=<from Upstash dashboard>
```

Create a free Upstash Redis DB — takes 90 seconds. Without these env
vars the guards don't enforce anything.

### 5. Phase 2 — schema fixes

Requires #1 above (migration baseline) to have happened first. Then:

- **2.1** — drop `BrandProfile.isActive`, add `User.activeBrandProfileId`
  FK. Fixes the root cause of the 4 IDORs (today they're gated by
  auth + ownership at the route level, which is belt-and-suspenders but
  the schema shape still encourages the anti-pattern).
- **2.3** — add `HikaruChat` + `HikaruMessage` models (or delete the
  history routes for good). Today they're 503 stubs.
- **2.4** — add `ManusTask.userId` FK + index. Today ownership is
  enforced via `brandProfile.userId` which only works when a brand
  profile is attached.
- **2.5** — add FK relations on `RoadmapRequest.userId` /
  `RoadmapUpvote.userId`. Prevents orphan rows.

Each should be its own `npx prisma migrate dev --name "…"` invocation.

### 6. Deferred Phase 6 UI items

- **6.2** — refactor dark mode from prop-drilled `darkMode:boolean` to
  Tailwind `dark:` variants. Touches every styled v2 component.
- **6.5 (partial)** — retrofit `AdDetailLightbox` and `CreatorLightbox`
  to `V2Modal`. They have custom prev/next nav + video handling that
  needs careful rewriting.
- **6.8** — promote at least the brand detail page to a server
  component with async data fetching (kill the 3-waterfall load).

### 7. Deferred Phase 5 items

- **5.2** — delete clear duplicates flagged in README (`download-media`
  vs `process-assets` vs the cron, multiple ingest scripts).
- **5.4** — extract shared helpers (`TokenManager`, `upsertAd`,
  partnership regex) to `src/lib/ingestion/`. Currently duplicated 5
  places.

---

## Pre-existing WIP (untouched this session)

These files were modified before Phase 0 started and I deliberately
did not commit them. They're your in-progress work. `git status` at
session end shows:

```
 M src/app/api/ad-library/creators/ads/route.ts       [has type errors]
 M src/app/dashboard/v2/ads/[pageId]/page.tsx
 M src/app/dashboard/v2/ads/components/ad-detail-lightbox.tsx
 M src/app/dashboard/v2/brands/page.tsx
 M src/app/dashboard/v2/categories/[slug]/page.tsx
 M src/app/dashboard/v2/creators/page.tsx
 M src/app/dashboard/v2/page.tsx
 M src/components/dashboard/top-brands-table.tsx
?? .planning/v7.0-MILESTONE-AUDIT.md
?? data/discovered-*.json
?? data/kids-clothing-*.json
?? src/app/api/requests/
```

The `creators/ads/route.ts` file has 3 type errors referencing
non-existent Prisma fields (`mediaUrl`, `mediaType`, `bodyText`) —
worth a look before you resume work on that route.

---

## Typecheck state

At session end, only **5 pre-existing errors** remain, all unrelated
to this session's work:

```
.next/types/validator.ts  — stale references to the old ad-library
                            route dir (from your rename; regenerates
                            on next build)
src/app/api/ad-library/creators/ads/route.ts  — stale field names
                                                on AdLibraryAd
```

No Phase 0–6 change introduced a new type error.

---

## Audit findings status

Out of ~210 findings in the original review:

- **P0 (ship-blocker, ~49):** ~38 closed; the rest are schema-level
  fixes that need the migration baseline first.
- **P1 (important, ~99):** substantially closed via the systemic
  changes (middleware, guard, apiError helper, active-ads helper).
  Individual nits unaddressed.
- **P2 (nits, ~62):** largely untouched — these were always lowest-
  priority.

Full findings remain in:
- `01-api-routes.md`
- `02-v2-dashboard-ui.md`
- `03-ingestion-pipeline.md`
- `04-data-model-and-auth.md`
- `05-ai-llm-features.md`

Synthesis + phase plan:
- `00-SYNTHESIS.md`

---

## Files worth knowing about

Created this session:

```
.planning/review-2026-04-18/
├── 00-SYNTHESIS.md                 ← start here for the plan
├── 01-api-routes.md                ← ~45 findings
├── 02-v2-dashboard-ui.md           ← 35 findings
├── 03-ingestion-pipeline.md        ← 47 findings
├── 04-data-model-and-auth.md       ← ~30 findings
├── 05-ai-llm-features.md           ← ~35 findings
└── SESSION-SUMMARY.md              ← you are here

prisma/
├── migrations/
│   ├── 20260418000000_init/migration.sql    ← baseline SQL
│   └── README.md                             ← baseline instructions
└── ops/
    ├── 2026-04-18-skip-inactive-pending-assets.sql   ← one-time cleanup
    └── ROADMAP-r2-key-unification.md                 ← deferred work

src/
├── middleware.ts                              ← auth defense-in-depth
├── lib/
│   ├── api-error.ts                           ← error helper
│   ├── rate-limit.ts                          ← Upstash wrapper
│   └── llm/
│       ├── models.ts                          ← CLAUDE_MODELS + PRICING
│       ├── call-claude.ts                     ← cost-logging wrapper
│       └── guard.ts                           ← tier-aware rate + spend
└── app/dashboard/v2/
    ├── components/v2-modal.tsx                ← accessible modal
    ├── error.tsx
    ├── loading.tsx
    └── not-found.tsx

scripts/
├── README.md                                   ← catalog + safety classes
└── _scratch/                                   ← gitignored one-offs
```

---

## Session kill switches (if something's wrong)

Every risky change has a kill switch. If a deploy breaks:

| Switch | What it disables |
|---|---|
| `MIDDLEWARE_AUTH_ENFORCE=0` | The src/middleware.ts auth layer. Per-route `auth()` gates from Phase 0 remain. |
| `ENABLE_DEMO_LOGIN=1` (non-prod only) | Re-enables demo credentials for local dev. |
| `ENABLE_GENERATE_STRATEGY=1` | Re-enables the WIP generate-strategy route (not recommended — it still 500s). |
| Upstash env vars unset | llmGuard fails open (no rate limit, no cost cap). |

---

## What I'd ship next (if you're scoping the next session)

Ranked by value-per-hour:

1. **Baseline migrations (#1 above)** — 5 minutes of manual work that
   unblocks all schema progress.
2. **Phase 2.4 — add `ManusTask.userId`** — small migration, closes a
   real IDOR stopgap (currently ownership is inferred via brandProfile).
3. **Phase 2.1 — replace `BrandProfile.isActive` with
   `User.activeBrandProfileId`** — fixes the root cause of the IDOR
   class, not just individual routes.
4. **Apply `apiError()` across the 40 routes with `String(error)` leaks**
   — helper already exists from Phase 1; this is mechanical.
5. **Retrofit `AdDetailLightbox` to `V2Modal`** — biggest remaining a11y
   win in v2.
6. **Phase 6.2 dark-mode refactor** — most visible debt cleanup,
   enables removing 130+ hex literals.

Everything else (Phase 2.3 Hikaru schema, 5.4 ingestion helpers, 6.8
server components) is real but incremental.
