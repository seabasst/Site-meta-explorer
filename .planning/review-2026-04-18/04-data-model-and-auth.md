# Data Model & Auth Review

**Reviewed:** schema (26 models in `prisma/schema.prisma`), 0 migrations (directory does not exist), ~12 auth-touching files
**Date:** 2026-04-18

## Summary

The data model is generally well-indexed for read patterns but has four structural holes that directly drive the IDOR class of bugs the team already knows about: `BrandProfile.isActive` is a per-row boolean with no way to express "this is THE active profile for user X" without an owner-filter, `HikaruChat` is referenced in code but **does not exist in the schema at all** (the chat-history routes will 500 on first call — this is a P0 blocker rather than a history-leak), and several user-owned trees lack FK cascades that would keep data consistent on user deletion. On the auth side, the situation is worse than the known demo-creds P0: the allow-list email (`sebastian@kirimediagroup.com`) is a typo of the real user domain (`kirimedia.co`), the CRON\_SECRET guard is the classic "open when unset" pattern (`if (CRON_SECRET && ...)`), the ingestion `POST` bypass has no auth at all, and multiple generation/research endpoints (`/api/strategy/*`, `/api/manus/create`, `/api/manus/enrich`, `/api/classify/batch`, `/api/ad-library/assets/backfill`) are unauthenticated while consuming paid Claude/Manus/Gemini tokens. **There is no `prisma/migrations/` directory at all** — the shared Neon DB has been evolved via `prisma db push` without a migration history, meaning prod schema drift is untracked and unrollbackable. This is the single most concerning finding in this scope.

## Schema health snapshot

- **Index coverage:** reasonable on hot paths (AdLibraryAd, AdLibraryBrand, AdClassification — each has 3–8 indexes). Gaps on `AdCreator.pageName`, `SavedAd.adId`, `AdLibraryAd.startDate/isActive/reachEstimate` as standalone indexes (the feed route filters by `startDate` and sorts by `reachEstimate` without an index).
- **Cascade policies:** mostly `onDelete: Cascade` for owned children, which is correct. Three places missing/inconsistent: `AdLibraryAd.ingestionJob` uses the default `NoAction` (orphans on job delete), `AdTemplate.brand` uses the default (orphans), and `ManusTask.brandProfile` uses `SetNull` which is fine, but `ManusTask` has **no** `userId` column so tasks are not owned by anyone.
- **Ownership columns:** `HikaruChat` missing entirely (model doesn't exist); `ManusTask` has no `userId`; `AdTemplate` has no `userId` despite being a "saved template" concept; `BrandProfile` has `userId` but the app's single-active-profile concept has no DB constraint.
- **Enum usage:** **zero enums.** Status-like columns (`User.subscriptionStatus`, `AdLibraryBrand.ingestionStatus`, `IngestionJob.status`, `ClassificationJob.status`, `AdCreator.tier`, `RoadmapRequest.type`, `RoadmapRequest.status`, `ManusTask.status`, `AdLibraryAd.displayFormat`) are all free-form `String` — typos in app code will silently write invalid values.
- **Timestamps:** good on most models. Missing `updatedAt` on `BrandSnapshot`, `HookGroup`, `SovSnapshot`, `AdAsset`, `ApiCostLog`, `RoadmapUpvote`, `BrandCompetitor`, `CreatorPartnership`, `AdAnalysis`, `AdClassification`. Several of those mutate (e.g., `AdAsset.downloadStatus` flips pending→completed) so the absence is a real debugging handicap.
- **Uniqueness:** `User.email` unique ✓, `AdLibraryBrand.pageId` unique ✓, `AdLibraryAd.adId` unique ✓. `TrackedBrand` has `@@unique([trackerId, facebookPageId])` — good. `BenchmarkBrand` has `@@unique([benchmarkId, facebookPageId])` — good.
- **BigInt handling:** `BigInt` used for reach (correct) but app code serializes via ad-hoc `JSON.stringify(value => typeof value === 'bigint' ? Number(value) : value)` in multiple places — lossy for brands over `Number.MAX_SAFE_INTEGER` reach (theoretical but the pattern is wrong).

## Findings

### P0 — ship-blockers

- **[Schema] `HikaruChat` / `HikaruMessage` models do not exist in `schema.prisma`** — `prisma/schema.prisma:1-803` (no matches) vs `src/app/api/chat/hikaru/history/route.ts:8`, `src/app/api/chat/hikaru/history/[chatId]/route.ts:13`, `src/app/api/chat/hikaru/history/[chatId]/messages/route.ts:22`. These routes call `prisma.hikaruChat.*` / `prisma.hikaruMessage.*` which will throw `TypeError: Cannot read properties of undefined` at runtime. Confirmed absent from the generated client at `node_modules/.prisma/client/schema.prisma` too. Either (a) the models were removed from the schema but not the code, or (b) they were added to code first and the schema update was never committed. The known "HikaruChat chat history is public" P0 from scope 1 may actually be dead code — but the routes are wired into the chat sidebar. Fix: either add the models (with `userId String` + FK cascade + `@@index([userId, updatedAt])`) or delete the history routes.

- **[Migrations] No `prisma/migrations/` directory exists** — `prisma/` contains only `schema.prisma` and a stray `dev.db` SQLite file. The shared Neon Postgres has been evolved via `prisma db push` with no migration history, no rollback path, and no audit trail of destructive changes. Prod schema drift from dev is invisible. Fix: run `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`, baseline with `prisma migrate resolve --applied 0_init` against Neon, and make `migrate dev` the only way to change schema going forward. Until then, no schema change is safely reversible.

- **[Auth] Demo credentials hardcoded and active in production, with no env guard** — `src/auth.ts:17-23, 44-59`. `demo@example.com / demo123` is always an accepted login, including on `https://facebookadexplorer.kirimedia.co`. Every saved ad, monitored brand, brand profile, benchmark, and roadmap request created under this login lands on the single `demo-user-1` user row, which becomes a shared account visible to anyone who guesses the password. Fix: wrap the `Credentials` provider in `process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_LOGIN === '1'` and keep it off in prod.

- **[Auth] Hardcoded admin allow-list uses the wrong domain** — `src/app/api/roadmap/[id]/route.ts:6` and `src/app/roadmap/page.tsx:28` both list `['demo@example.com', 'sebastian@kirimediagroup.com']`. The real user email per memory is `sebastian@kirimedia.co`. So: the real owner is NOT admin (no moderation access to roadmap), and `demo@example.com` IS admin (anyone who signs in with the demo creds can approve brand requests, which creates `AdLibraryBrand` rows that enter the paid ingestion pipeline). Fix: move to a DB-backed `User.role` enum and delete both allow-lists. Immediate hotfix: correct the domain and remove `demo@example.com`.

- **[Auth] `CRON_SECRET` guard is open when unset** — `src/app/api/ad-library/cron/ingest/route.ts:1180`, `src/app/api/ad-library/cron/assets/route.ts:16`, `src/app/api/ad-library/cron/classify-poll/route.ts:15`, `src/app/api/ad-library/cron/sov-snapshot/route.ts:20`. Pattern: `if (CRON_SECRET && authHeader !== ...) return 401`. If the env var is missing (typo, new environment, local override), every cron endpoint becomes world-callable — and the ingest cron initiates paid Facebook API + downstream jobs. Fix: require the secret: `if (!CRON_SECRET || authHeader !== ...) return 401`.

- **[Auth] `/api/ad-library/cron/ingest` `POST` has no auth at all** — `src/app/api/ad-library/cron/ingest/route.ts:1246-1371`. The `GET` handler checks `CRON_SECRET` (modulo the bug above), but the manual-trigger `POST` accepts `brandIds`, `resetTokens: true`, `dcongressOnly: true`, etc., with zero authentication. `resetTokens` wipes the token rotation state for the whole service. Anyone who finds the URL can trigger arbitrary paid ingestion or reset your Facebook token pool. Fix: require admin session or `CRON_SECRET` on POST too.

- **[Auth] `/api/manus/create` and `/api/manus/enrich` are unauthenticated** — `src/app/api/manus/create/route.ts:8-58`, `src/app/api/manus/enrich/route.ts:7-106`. Both endpoints create paid Manus research tasks on demand. `manus/create` accepts an arbitrary `prompt` and `brandProfileId` (also IDOR — can attach a task to any other user's profile). `manus/enrich` accepts any `brandProfileId` and any `websiteUrl`, burning Manus budget per call. Fix: require `auth()` + verify `brandProfile.userId === session.user.id` before creating tasks. Add per-user rate limit on top.

- **[Auth] `/api/manus/[taskId]` leaks task content with no auth** — `src/app/api/manus/[taskId]/route.ts:7-106`. Task IDs are cuid (unguessable) but there is no ownership check; anyone with a leaked task id (URL sharing, logs, XSS) gets the full `resultText` and `resultJson`. Since `ManusTask` has no `userId` column, there's no way to enforce ownership even if added. Fix: add `ManusTask.userId` FK + filter in the route.

- **[Auth] `/api/strategy/generate-concept`, `/api/strategy/personalized`, `/api/strategy/[pageId]` all unauthenticated** — `src/app/api/strategy/generate-concept/route.ts:36`, `src/app/api/strategy/personalized/route.ts:30`, `src/app/api/strategy/[pageId]/route.ts:23`. They call Claude Haiku per request (token cost) and the first two access any active `BrandProfile` without user filter (the known IDOR root-cause, see schema finding below). Fix: require session + owner-scope the profile lookup.

- **[Auth] `/api/classify/batch`, `/api/ad-library/assets/backfill`, `/api/creative-lab/scrape-brand` unauthenticated** — `src/app/api/classify/batch/route.ts:12`, `src/app/api/ad-library/assets/backfill/route.ts:11`. The first launches paid Anthropic batch classification; the second writes DB rows and schedules downloads. Anyone can submit these jobs. Fix: require session.

- **[Schema] `BrandProfile.isActive` has no unique constraint scoped to `userId`** — `prisma/schema.prisma:753-763`. The app logic (`src/app/api/brand-profiles/[id]/route.ts:136-140`) implements "only one active per user" in application code only. Concurrent PUTs can set two profiles active. More importantly, this is the data-model root cause of the 4 known IDORs: the `findFirst({ where: { isActive: true } })` pattern works because *any* user's active profile is returned (there's no natural user-scope in the query), and the schema doesn't force the query to be owner-scoped. Fix: add a partial unique index `@@unique([userId]) WHERE isActive = true` (Postgres-native) via `@@index([userId], where: {...})` isn't supported in Prisma; use a `Prisma.raw` migration. Better: drop `isActive` from `BrandProfile` and add `User.activeBrandProfileId String?` with FK — then there is exactly one active profile per user and queries must join through `User`.

### P1 — important

- **[Auth] JWT session strategy used but `AUTH_SECRET` is unchecked** — `src/auth.ts:28-99`. NextAuth v5 will fall back to a dev-only secret if `AUTH_SECRET` is missing in non-production mode, and throw at runtime in production — but if the env var is set to an empty string or a committed default, tokens become forgeable. `.env.local.example:7` ships with `AUTH_SECRET=` (empty). Fix: assert presence at module load (`if (!process.env.AUTH_SECRET) throw new Error(...)`) so startup fails loud.

- **[Auth] JWT callback upserts user on every sign-in, rate-limited only by Google** — `src/auth.ts:67-91`. Every JWT refresh calls `prisma.user.upsert`. If a compromised Google account signs in repeatedly, this walks the Prisma connection pool. Minor but worth noting.

- **[Auth] `session.user.email` used as the lookup key in ~20 routes instead of `session.user.id`** — e.g., `src/app/api/ad-library/saved/route.ts:13-17`, `src/app/api/ad-library/brands/monitor/route.ts:13-17`, `src/app/api/brand-profiles/route.ts:63`, `src/app/api/brand-guidelines/route.ts:38-46`, `src/app/api/brand-profiles/[id]/route.ts:66, 104, 191`. Pattern is `session.user.email` → `prisma.user.findUnique({ where: { email } })` → use `user.id`. (a) emails can legitimately change in Google OAuth (rare but possible), which would orphan all user data; (b) adds one DB round-trip to every authed request; (c) `session.user.id` is already populated in the JWT callback (`src/auth.ts:92-97`), so the email lookup is redundant. Fix: use `session.user.id` directly.

- **[Schema] `HikaruChat`/`HikaruMessage`, if re-added, must include `userId`** — referenced by scope 1 as "chat history is fully public". Current code has no `userId` even in the route (`history/route.ts:8` does `findMany` with no filter). When adding the model, require `userId String` + `@@index([userId, updatedAt])` and fix the routes to filter.

- **[Schema] `ManusTask` has no `userId`** — `prisma/schema.prisma:784-803`. Already called out as P0 for auth. Adding the column cascades to the poll route and to `/api/manus/create`. Also missing: `@@index([userId, status])` for the "my running tasks" query users will inevitably want.

- **[Schema] `AdTemplate` has no `userId` and no uniqueness** — `prisma/schema.prisma:537-574`. If this is intended to be user-owned, add `userId` + cascade. If it's a global catalog, rename/comment it and add a unique on `(category, name)` to prevent dupes.

- **[Schema] `RoadmapRequest.userId` references `User.id` but there's no FK relation declared** — `prisma/schema.prisma:596-597`. `userId String` and `userEmail String` are plain columns, no `user User @relation(...)`. So deleting a user leaves their roadmap requests orphaned with dangling `userId` values. Fix: add the relation with `onDelete: SetNull` (keep requests as "by former user") or `Cascade`.

- **[Schema] `RoadmapUpvote.userId` has no FK relation either** — `prisma/schema.prisma:614-624`. Same issue. Deleting a user leaves orphan upvotes and `RoadmapRequest.upvoteCount` drifts from reality. Fix: add relation + on user-delete, decrement counts in a transaction or use a computed view.

- **[Schema] `User.subscriptionStatus` should be an enum** — `prisma/schema.prisma:18`. Free-form string with comment `// free, pro, past_due, cancelled`. `src/lib/subscription.ts` and `src/app/api/brands/save/route.ts:34` branch on these values. Typo in ingestion = silent wrong tier. Fix: `enum SubscriptionStatus { free pro past_due cancelled }`.

- **[Schema] `IngestionJob.status`, `ClassificationJob.status`, `ManusTask.status`, `AdAsset.downloadStatus`, `AdLibraryBrand.ingestionStatus`, `RoadmapRequest.status`, `RoadmapRequest.type` should all be enums** — same reasoning. `AdLibraryAd.displayFormat` too (image/video/carousel/dpa).

- **[Schema] `BrandCompetitor` has no `updatedAt` but app has `notes` field that users edit** — `prisma/schema.prisma:765-778`. Edits to `notes` are invisible in audit logs.

- **[Schema] Foreign keys missing indexes the queries rely on** — `AdLibraryAd.ingestionJobId` has no index yet is queried in job reports; `ManusTask.brandProfileId` has `@@index([brandProfileId])` ✓; `AdAsset.adId` has `@@index([adId])` ✓. Biggest gap: `TrackedBrand.trackerId` has no index (only compound `@@unique([trackerId, facebookPageId])` which Postgres can use but is sub-optimal for `WHERE trackerId = X` alone), and `BrandSnapshot.userId` has no index despite the combined-with-date query pattern in `/api/dashboard/overview`.

- **[Cascade] `AdLibraryAd.ingestionJob` onDelete default (`NoAction`)** — `prisma/schema.prisma:306-307`. If an `IngestionJob` is deleted (admin cleanup), the `ingestionJobId` column dangles. Fix: `onDelete: SetNull`.

- **[Cascade] `AdTemplate.brand` onDelete default** — `prisma/schema.prisma:543`. If a brand is deleted, templates dangle.

- **[Auth] `/api/brand-profiles/[id]/competitors` validates ownership on POST/DELETE but not on the implicit read** — `src/app/api/brand-profiles/[id]/competitors/route.ts:33-42`. Good pattern overall. No finding — positive note. (Counted here for coverage.)

- **[Auth] `/api/benchmarks/[id]` returns 404 instead of 403 on ownership mismatch** — `src/app/api/benchmarks/[id]/route.ts:29-31`. Good choice (doesn't leak existence) — positive note.

- **[Auth] `/api/roadmap` `POST` trusts `session.user.id` from JWT but copies `userEmail` in separately** — `src/app/api/roadmap/route.ts:130-131`. The two are stored side-by-side; if a Google user changes their primary email upstream and re-signs in, new requests carry the new email but old ones carry the old — complicates audit. Minor. Fix: store only `userId` and join to `User` for email display.

- **[Secret storage] Prisma schema stores R2 logo keys in `BrandGuidelines.logoKey` and `BrandProfile.logoKey`** — these are not secrets per se but they're used as auth-bypass references in `/api/brand-guidelines/upload/route.ts:76` to build paths like `brand-assets/${user.id}/...` — which is correct scoping via `user.id`, no finding.

- **[Rate limit] `/api/signup` has no rate limit** — `src/app/api/signup/route.ts:10-82`. Anyone can spam the Notion database. Low-stakes (it's Notion, not auth) but worth adding a simple IP-based throttle.

### P2 — nits

- **[Schema] `String?` where `Boolean` would be clearer** — `AdLibraryAd.bylines` is used as "this ad is a partnership ad" indicator (see scope 1 creator-partnership discussion). Consider adding a derived `isPartnership Boolean` and index it.

- **[Schema] `BrandSnapshot` has 20+ fields for denormalized metrics** — `prisma/schema.prisma:109-154`. Consider splitting into `BrandSnapshot` (metadata, relations) + `BrandSnapshotMetrics` (scalar metrics) for cleaner serialization. Not urgent.

- **[Schema] `AdAnalysis` has `@@unique([adId])` AND `@@index([adId])`** — `prisma/schema.prisma:447-448`. Redundant; the unique already creates an index.

- **[Schema] `SavedAd` and `MonitoredBrand` both have `@@unique([userId, adId])` + `@@index([userId, createdAt])`** — good. No standalone `adId` / `brandId` index though, which means `adLibraryAd` → "who saved this ad" needs a seq scan. Low priority.

- **[Schema] `BigInt` for `CreatorPartnership.totalReach`** — declared as `Int`, not `BigInt` (`prisma/schema.prisma:664`). Inconsistent with `AdLibraryBrand.totalReach` being `BigInt`. A single creator x brand partnership likely never overflows `Int` but the inconsistency trips up serializers.

- **[Schema] Missing `@db.Text` on long-form fields** — `BrandProfile.brandVoice`, `positioning`, `missionStatement` are unbounded `String?`. Postgres handles it but the default map is `varchar` which may truncate. Fix: `String? @db.Text`.

- **[Auth] The `jwt` callback silently falls back to `user.id` from provider on DB error** — `src/auth.ts:84-88`. Google's id (sub) is NOT the same as Prisma cuid; if the DB upsert ever fails, the session has a mismatched `session.user.id` that won't match any DB row — cascading into 404s across the app. Fix: return null / throw to block login when DB is unavailable.

- **[Auth] No sign-out route test** — credentials provider has no corresponding sign-out flow beyond NextAuth defaults; no finding.

- **[Config] Schema datasource has no `url` field** — `prisma/schema.prisma:8-10`. Schema is valid (Prisma picks up `DATABASE_URL`) but explicit `url = env("DATABASE_URL")` is conventional and avoids surprise.

- **[Code smell] 17 separate BigInt serialization helpers** — each route reimplements `JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? Number(v) : v)`. Extract to `src/lib/serialize.ts`.

- **[Schema] `dev.db` file present in `prisma/`** — likely a leftover from an SQLite development phase. Remove from repo (after confirming it's in `.gitignore`) to avoid confusion.

## Ownership audit

| Model | Has userId? | Owner filter consistently used? | Risk |
|---|---|---|---|
| User | n/a (root) | n/a | — |
| SavedAd | yes | yes (all routes) | low |
| MonitoredBrand | yes | yes (all routes) | low |
| BrandGuidelines | yes (`@unique`) | yes | low |
| TrackedBrand | yes (`ownerId` / `trackerId`) | yes | low |
| BrandSnapshot | yes | yes in overview/dashboard | low |
| BenchmarkReport | yes | yes on all routes | low |
| BenchmarkBrand | no (via benchmark) | yes transitively | low |
| HookGroup | no (via snapshot) | yes transitively | low |
| **BrandProfile** | yes | **NO** in 4 known IDORs + `findFirst({isActive:true})` in creative-lab/strategy routes even when session is used the schema allows cross-user fallthrough | **HIGH — P0** |
| BrandCompetitor | no (via profile) | yes transitively when profile filter is correct | medium (inherits BrandProfile risk) |
| **ManusTask** | **NO** | n/a (no way to filter) | **HIGH — P0** |
| **HikaruChat** | **model doesn't exist** | n/a | **HIGH — P0 (broken routes)** |
| RoadmapRequest | `userId` column, no FK | in DELETE only | medium |
| RoadmapUpvote | `userId` column, no FK | in transactions | medium |
| AdTemplate | **NO** | — | medium (purpose unclear) |
| AdLibraryBrand | shared catalog, correct | n/a | — |
| AdLibraryAd | shared catalog | n/a | — |
| AdAsset | shared | n/a | — |
| IngestionJob | shared | n/a | — |
| ClassificationJob | shared | n/a | — |
| AdClassification | shared | n/a | — |
| AdAnalysis | shared | n/a | — |
| AdCreator / CreatorPartnership | shared | n/a | — |
| BrandAnalysisCache | shared | n/a | — |
| SovSnapshot | shared | n/a | — |
| ApiCostLog | no (global) | n/a | low |

## Migration risk log

**No migrations directory exists.** `prisma/migrations/` is absent. The schema has been evolved against the shared Neon database via `prisma db push` (or equivalent). This is itself the highest-risk migration finding:

- **No rollback path.** If a schema change breaks production, there is no `migrate resolve --rolled-back` target to fall back to.
- **No audit trail.** We cannot tell whether any `DROP COLUMN` / `DROP TABLE` has happened against the shared DB.
- **No review surface.** Schema changes ship implicitly whenever someone runs `prisma db push` locally against the shared connection string.
- **Prod drift undetectable.** `prisma migrate status` reports "no migrations" — can't diff prod vs expected schema.

Recommended action before any further schema change:
1. Snapshot current Neon schema: `pg_dump --schema-only` (stash).
2. Generate the initial migration: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260418000000_initial/migration.sql`.
3. Baseline: `prisma migrate resolve --applied 20260418000000_initial`.
4. From here on, all changes go through `prisma migrate dev` + PR review.

(Specific migration hygiene findings — destructive DDL on populated tables, narrowing type changes, etc. — are not applicable in this review because the artifacts don't exist to inspect.)

## Patterns worth addressing globally

1. **Email-as-lookup-key.** ~20 routes do `session.user.email` → `user.findUnique({email})` → `user.id`. Use `session.user.id` directly, save the round-trip, survive email changes. See callout under P1.
2. **Hardcoded allow-lists for admin.** Two copies of `['demo@example.com', 'sebastian@kirimediagroup.com']` — one of them wrong-domain. Replace with `User.role`.
3. **"Open when unset" secret guards.** `if (CRON_SECRET && ...)` pattern appears in all four cron routes. Canonical form is `if (!CRON_SECRET || ...)`.
4. **BigInt serialization.** Re-implemented in every route that returns reach data. Extract to a helper.
5. **`findFirst({ where: { isActive: true } })` without owner scope.** This is the schema-level root cause of the known IDORs — the app assumed a global "active" was meaningful without enforcing user-scope. The right fix is to replace `BrandProfile.isActive` with `User.activeBrandProfileId`.
6. **Enum-shaped strings everywhere.** 10+ status-like columns are free-form `String`. A single pass to convert to Prisma enums would catch a class of silent-typo bugs.
7. **No FK relations on `userId` columns in Roadmap models.** Cross-cutting data integrity issue — every `userId` column should be a FK.
8. **No per-user rate limiting on any paid endpoint.** `/api/manus/*`, `/api/classify/batch`, `/api/strategy/*`, `/api/brand-profiles/*/enrich`, `/api/creative-lab/*` all hit paid APIs and have no throttle. Combined with the unauthenticated ones, this is a cost-risk hole.

## Coverage notes

**Thoroughly reviewed:**
- `prisma/schema.prisma` (all 26 models, all indexes, all cascades).
- `src/auth.ts` (NextAuth config, callbacks, providers).
- `src/app/api/auth/**` (both routes).
- `src/app/api/brand-profiles/**` (all four routes) — ownership enforcement pattern.
- `src/app/api/chat/hikaru/**` (confirmed HikaruChat / HikaruMessage are undefined).
- `src/app/api/roadmap/**` (admin allow-list + orphan FK issue).
- `src/app/api/ad-library/cron/**` (all four cron routes).
- `src/app/api/manus/**` (all three routes, no auth).
- `src/app/api/strategy/**` (all three routes, no auth).
- `src/app/api/benchmarks/**`, `/saved`, `/monitor`, `/brand-guidelines/**`, `/dashboard/feed` — ownership patterns.
- Auth sign-in page, providers endpoint.

**Skimmed:**
- Creative-lab generate routes (checked auth header, didn't read full generation logic).
- Classification batch and analyze routes (checked auth, confirmed no owner model exists or is needed for the shared catalog).
- `src/middleware.ts` does not exist (explicitly checked).
- `.env.local.example` (noted empty `AUTH_SECRET=`).

**Not reviewed (out of scope):**
- V2 dashboard client-side session usage beyond `v2-shell.tsx` reference.
- Stripe webhook auth (`src/app/api/webhooks/stripe/route.ts` — covered in other scopes).
- Classification library internals (covered in scope 3: ingestion pipeline).
- Any SoV / Andromeda / creative-lab algorithmic code.
