# Ingestion Pipeline Review

**Reviewed:** 44 scripts (of 76 total) + 14 library/route files + `vercel.json`
**Date:** 2026-04-18

## Summary

The pipeline works, but it's dangerous to run in its current state. Two of the project's three stated invariants — "only download assets for active ads" and "creator discovery via Puppeteer only" — are honored in the canonical paths (`scrape-partnerships.ts`, `detect-partnerships.ts`) but **violated by almost every asset‑download code path**, including the Vercel cron job `/api/ad-library/cron/assets` and the library function `processPendingAssets` that backs it. The daily cron happily re‑downloads every pending asset regardless of whether the ad is still active, which means the R2 bill and Meta/fbcdn request volume scale with historical ad volume, not with live ads. Several untracked scripts duplicate ingestion logic, some with destructive `deleteMany({})` calls guarded only by a CLI flag, and one (`rescrape-creator-brands.ts`) uses an R2 key namespace (`creators/${adId}`) that collides with `download-top-ads.ts`'s `ads/${brandId}/${adId}.png`. Token rotation, retries, and backoff are solid in the main cron and in `scrape-partnerships.ts`, but several one‑off scripts use a single token with no backoff, no timeouts on `fetch`, and no `page.goto` timeout (hang risk). The biggest latent risk is that `scripts/` is a graveyard: 43 of 76 scripts are untracked, many do the same thing three different ways, and there is no registry telling anyone which are safe to run against the shared Neon production DB.

## Findings

### P0 — ship-blockers

- **[Active-ads rule] Daily asset cron downloads ALL pending assets, not just active** — `src/app/api/ad-library/cron/assets/route.ts:41` calls `processPendingAssets(ASSETS_PER_RUN)` which is defined at `src/lib/asset-pipeline.ts:213-233` and filters only by `downloadStatus: 'pending'` with no `ad.isActive` check. This is the scheduled Vercel cron (`0 5 * * *` per `vercel.json`) and runs on shared prod data. Fix: add `ad: { isActive: true, ...(brandId && { brandId }) }` to the `where` clause.

- **[Active-ads rule] `processAdsToR2` ignores active status** — `src/lib/asset-processor.ts:177-186` selects ads with a `snapshotUrl` and no completed asset, with no `isActive` filter. Anything importing this function will violate the rule.

- **[Active-ads rule] `scripts/download-media.ts:387-403` downloads top‑10 by reach with no active filter** — The comment claims "active brands first" but the order-by is `[{ isActive: 'desc' }, { reachEstimate: 'desc' }]` which sorts active first but still includes inactive once active are exhausted. Fix: add `isActive: true` to `where`.

- **[Active-ads rule] `scripts/download-top-ads.ts:203-219` same pattern** — same bug as above (order by but no filter). Burns R2 storage on dead ads.

- **[Active-ads rule] `scripts/download-and-detect.ts:328-339` same pattern** — fetches top N ads per brand with snapshotUrl but no `isActive: true`. Also writes creator partnerships from inactive ads, which pollutes the `CreatorPartnership` table with stale data.

- **[Active-ads rule] `scripts/process-assets.ts:207-217` processes all pending assets** — same as the cron library; no active filter. Running this locally hits prod DB and fbcdn.

- **[Active-ads rule] `scripts/backfill-brand-assets.ts:42-49` no active filter** — fetches every ad that lacks a completed asset for a brand, regardless of whether the ad is still running. Asset keys are `ads/{brandId}/{adId}/{type}-{pos}{ext}` so the storage will continue to grow as brands accumulate inactive ads.

- **[Active-ads rule] `scripts/backfill-videos-and-links.ts:53-69` same issue** — queries `{ brandId, OR: [{ displayFormat: video, assets: none completed }, { linkUrl: null }] }` without `isActive: true`. Re-downloads videos for long-dead ads.

- **[Active-ads rule] `scripts/backfill-new-assets.ts:10-18` creates AdAsset rows for every ad with a snapshot, regardless of active status** — those rows then become fodder for `processPendingAssets`, which will try to download all of them. This is the main "fill the pending queue with stale work" bug.

- **[Destructive] `scripts/rescrape-creator-brands.ts:342-344` wipes the creator graph on a CLI flag with no confirmation prompt** — `if (FRESH) { await prisma.creatorPartnership.deleteMany({}); await prisma.adCreator.deleteMany({}); }`. There is no `--yes` gate, no "are you sure", no dry-run preview, no timestamped backup. One typo (`--fresh` instead of something else) and the entire partnership dataset is gone from the shared Neon prod DB.

- **[R2 correctness] Key-space collision between scripts** — `scripts/rescrape-creator-brands.ts:203` uploads under `creators/${adId}${ext}` while `scripts/download-top-ads.ts:109` and `scripts/download-and-detect.ts:149` upload under `ads/${brandId}/${adId}.png`. Different scripts, different bucket prefixes, same ad — the DB only tracks one `storedUrl` per `AdAsset`, so whichever script ran last wins and the other files become orphaned and unreachable (but still billed). Also `scripts/download-top-ads.ts` uses key `ads/{brandId}/{adId}.png` (position‑less) while `src/lib/r2.ts:generateAssetKey` uses `ads/{brandId}/{adId}/{type}-{pos}{ext}` — two brands' assets for the same ad end up in different places.

- **[Auth / cron] `POST /api/ad-library/cron/ingest` has no auth check at all** — `src/app/api/ad-library/cron/ingest/route.ts:1246` (the POST handler) accepts `{brandIds, dcongressOnly, limit, resetTokens}` with no `CRON_SECRET` or session check, so anyone with a URL can trigger ingestion, reset token states, or pick arbitrary brands to process. This hits Facebook API from the prod IP and burns the rate limit / could get the tokens flagged.

- **[Cron secret] `if (CRON_SECRET && ...)` pattern fails open when the env var is unset** — `src/app/api/ad-library/cron/assets/route.ts:16`, `src/app/api/ad-library/cron/classify-poll/route.ts:15`, `src/app/api/ad-library/cron/ingest/route.ts:1180`, `src/app/api/ad-library/cron/sov-snapshot/route.ts:20` all guard on `CRON_SECRET &&`, so a missing/empty env var silently disables auth. In prod, misconfiguration → unauthenticated cron endpoints.

### P1 — important

- **[Idempotency / asset churn] Ingest cron resets `downloadStatus` to `pending` on every run for any non‑completed asset** — `src/app/api/ad-library/cron/ingest/route.ts:1055-1064`. Combined with the cron assets route not filtering by active, a single ad that repeatedly fails to download will be retried every night forever. Suggest: cap retries via `failCount` and move to `permanently_failed` state.

- **[Puppeteer hygiene] Global shared browser in `src/lib/media-extractor.ts:14-37` never closes** — single module‑level `browserInstance` per Node process. If a single page hang holds the browser, subsequent requests stack up behind `browserLaunchPromise`. No periodic recycle. Long‑running Vercel invocations are not applicable, but the scripts that import this (e.g. `scripts/process-assets.ts`, `src/lib/asset-pipeline.ts`) share this behaviour. Add a max‑pages‑per‑browser counter and recycle.

- **[Puppeteer hygiene] `Promise.all` + unbounded concurrency of Puppeteer pages in `src/lib/asset-pipeline.ts:241-245`** — `CONCURRENCY = 5`, but each `processAsset` spawns a new `newPage()` via `extractMediaFromSnapshot`. Five concurrent pages per request × multiple concurrent function invocations = page explosion. Add a real semaphore or switch to p-limit.

- **[Puppeteer hygiene] `media-extractor.ts:72` uses `networkidle2` with a 15s timeout** — `networkidle2` on `facebook.com/ads/archive/render_ad` pages often never settles (tracking pixels keep firing). The fallback path in `scrape-partnerships.ts:147` uses `domcontentloaded` + `waitForFunction` which is the right pattern. The extractor used by the production cron and the `processAsset` library function is using the slow + flaky mode.

- **[FB rate-limit risk] `scripts/scrape-partnerships.ts:269-303` launches `CONCURRENCY = 5` Puppeteer pages in parallel against Facebook snapshot URLs** — also the default, 5 parallel snapshot renders per brand. Combined with multiple brands/day against the same IP, this is the most likely reason to get throttled. No per‑URL backoff on transient errors.

- **[FB rate-limit risk] `scripts/detect-partnerships.ts:24` uses `CONCURRENCY = 3`, `scripts/rescrape-creator-brands.ts:31` uses `CONCURRENCY = 3`, `scripts/download-and-detect.ts:51` uses `CONCURRENCY = 3`** — three scripts that can be run at the same time, each stacking 3 concurrent page loads against FB, means up to 9 parallel renders from the same IP. No coordinating mutex.

- **[FB rate-limit risk] `src/lib/asset-processor.ts:24-49` uses single env var `FACEBOOK_ACCESS_TOKEN`** — no token rotation, no rate-limit headers inspection, no backoff. If this is used it will burn one token fast and fail silently.

- **[FB rate-limit risk] `scripts/rerun-failed-brands.ts:11` uses single `FACEBOOK_ACCESS_TOKEN`**, no rotation.

- **[FB rate-limit risk] `scripts/find-gruns.ts:4`, `scripts/create-brand.ts:37`, `scripts/debug-partnership-ad.ts:7`** — all use single token, no rotation. Fine for a debug one‑shot, but should be annotated as such.

- **[Destructive] `scripts/reset-brands.ts:9-12` resets by `category: 'airline'` with no dry‑run** — touches shared prod DB, no preview, no confirmation. Small blast radius but still.

- **[Destructive] `scripts/reset-zero-ads.ts:7-16` resets every brand with no ads and `failCount < 10` to `pending`** — will re-queue hundreds of brands silently. No dry-run, no limit, runs directly on prod.

- **[Destructive] `scripts/fix-video-types.ts:51-61` does two `updateMany` calls on shared prod** — no dry-run, no transaction. The second `updateMany` (line 58) depends on the first having succeeded; if the second fails the DB is in a half-migrated state.

- **[Destructive] `scripts/fix-video-formats.ts:129-136` same pattern** — `updateMany` with no dry-run or transaction.

- **[Destructive] `scripts/normalize-countries.ts:50-61` mutates brand country codes without dry-run** — at least prints a preview before updating, but no confirmation.

- **[Destructive] `scripts/fix-page-ids.ts:101, 116` deletes brand rows when it can't resolve a page ID** — has `--dry-run`, but the default is to delete. Could nuke a large swath of brands in one run if the Graph API is having a bad day.

- **[R2 correctness] Several scripts upload without `CacheControl`** — `scripts/download-top-ads.ts:92-98`, `scripts/download-and-detect.ts:116-121`, `scripts/download-media.ts:257-262` omit `CacheControl`. Users will not get long-lived immutable caching. `src/lib/r2.ts:uploadToR2` does set it correctly.

- **[R2 correctness] `scripts/download-top-ads.ts:109` generates key `ads/{brandId}/{adId}.png` with fixed extension, even when the source is a video** — takes a Puppeteer `.screenshot({type:'png'})` so it's always a PNG screenshot not the actual creative, and the resulting AdAsset row has `assetType: 'image'` regardless of whether the ad is a video (line 138). The ad‑library UI then shows a screenshot instead of the actual video.

- **[R2 correctness] `scripts/rescrape-creator-brands.ts:203` key `creators/${adId}${ext}`** — if a creator posts multiple ads with the same ad ID across partnerships (shouldn't happen, but adId is the namespace), this key has no positional index, unlike `generateAssetKey()` which includes `position`.

- **[Idempotency] `scripts/download-and-detect.ts:259-273` increments `adCount`/`totalReach` with `increment` on re-run** — re-running inflates stats because there's no reset of the partnership counts. `scripts/scrape-partnerships.ts:385-402` does the same with `upsert`'s `update: { adCount: pData.adCount, ... }` (set, not increment) which is correct. `download-and-detect.ts` diverges.

- **[Puppeteer hygiene] Browser instance leaks on thrown errors** — `scripts/download-and-detect.ts:311-401` launches a browser and closes it in `finally` — good. But `scripts/detect-partnerships.ts:236-240` closes and re‑launches the browser on "too many consecutive errors" without closing the old one if the close promise rejects (`catch(() => {})`). Minor.

- **[Puppeteer hygiene] `fetch-facebook-page-ids.js:114` example code uses `page.goto(..., {waitUntil: 'networkidle2'})` with no timeout** — can hang forever. The actual function body is commented out so this is dormant, but leaving dangerous sample code in the tree is a footgun.

- **[Secrets hygiene] `creator-partnerships-backup.json`, `creator-partnerships.json`, `creator-partnerships-new.json` are untracked and NOT gitignored** — they live in the repo root. No secrets inside (I checked the first one), but the same pattern will trip up someone who dumps an env later. `.gitignore:52-60` excludes `data/gruns-*` but not `creator-partnerships*.json` or `new-brands-expansion.json` etc.

- **[Secrets hygiene] `scripts/debug-partnership-ad.ts:56-58` prints `bylines=${JSON.stringify(ad.bylines)}`** — benign, but several scripts log full Meta API error messages which can echo back the access token in the query string if the token is malformed. Example: `scripts/backfill-bylines.ts:101` throws the raw error message. Low probability but worth sanitizing in a shared helper.

- **[Error handling] `src/lib/media-extractor.ts:184` catches all errors and returns `null`** — no logging of *which* snapshot failed, no indication *why*. When the Vercel cron hits a wave of failures you can't distinguish "Facebook rate‑limited us" from "the snapshot URL expired" from "browser crashed". Add categorized logging.

- **[Error handling] `detect-partnerships.ts:117-126` retries once on any exception and then silently writes `ERROR:` as rawText** — errors get counted but the underlying cause is lost. Also, the "X consecutive errors → restart browser & wait 30s" logic at lines 234-240 resets `consecutiveErrors = 0` after the restart, but doesn't reset `brandErrors` or `grandTotalErrors`, so error counts keep piling.

- **[Error handling] Silent error swallowing in `scrape-partnerships.ts:182-184, 253-255`** — `catch { return null }` and `catch { break }`. At minimum log the URL and the `err.message`. Same in `rescrape-creator-brands.ts` throughout.

- **[Concurrency risk] `src/app/api/ad-library/cron/ingest/route.ts:387` instantiates `tokenManager` at module load** — the manager is shared process-wide. If the ingest POST endpoint is hit concurrently (e.g. a user + the cron), both callers mutate `currentIndex` and `tokenStates`. Not catastrophic but can cause token rotation to thrash. Consider making the manager per‑request.

- **[Concurrency risk] `src/lib/media-extractor.ts:18-37` serializes browser launch via `browserLaunchPromise` but not page creation** — fine, but if the cached browser dies mid-flight, two concurrent callers can both decide to launch. Low probability.

- **[Blast radius] `run-ingestion.ts` (tracked) and `src/app/api/ad-library/cron/ingest/route.ts` (tracked) duplicate all of `TokenManager`, `fetchAdsPage`, `fetchVideoAdIds`, `upsertAd`, `processBrand`** — any bug fix to one is at risk of missing the other. Extract `src/lib/ingestion/` and share.

- **[Missing batching] `scripts/scrape-partnerships.ts:428-432` does `findMany` with no limit, then loops** — fine for current scale (hundreds of brands), but if the DB grows to 10k+ brands this loads them all into memory. Add pagination or stream.

- **[Missing batching] `scripts/classify-creators.ts:239-247` loads all brands and all creators into memory, then does `Promise.all` in chunks of 100** — OK at current size but not future-proof.

### P2 — nits

- **[Style] `src/lib/asset-pipeline.ts:225-229` uses spread `...(brandId && { ... })`** which works but `...(brandId ? { ad: { brandId } } : {})` reads better.

- **[Style] `scripts/process-assets.ts:102` logs `Extracting media from snapshot...` without the ad ID** — harder to debug when a specific ad hangs.

- **[Maintainability] `src/lib/r2.ts:extensionFromContentType` and `scripts/process-assets.ts:60-69` are near‑duplicates** — the script could import the lib.

- **[Maintainability] `extractMediaFromSnapshot` regex patterns for bylines at `src/lib/media-extractor.ts:126-148` are duplicated in `scripts/scrape-partnerships.ts:158-186`, `scripts/detect-partnerships.ts:63-99`, `scripts/rescrape-creator-brands.ts:110-135`, `scripts/download-and-detect.ts:59-95`, `scripts/backfill-ad-text.ts`** — five places, five slightly different implementations. Extract to a shared lib.

- **[Docs] No README in `scripts/`** — 76 scripts, no index. Impossible to tell which are one-off vs still-used.

- **[Docs] `creator-partnerships-new.json`, `creator-partnerships.json`, `creator-partnerships-backup.json` naming convention suggests manual backup/rotate** — nothing in scripts automates this. If the person who did the backup forgets, a `--fresh` run (see P0) is permanent.

- **[Observability] Progress output uses `\r` everywhere** — nice for a TTY, useless in Vercel cron logs where every `\r` becomes a new line. `detect-partnerships.ts:248` and `download-and-detect.ts:386` both emit `\r`.

- **[Maintainability] Four separate script "ingest" flows** — `scripts/ingest-ads.ts`, `scripts/run-ingestion.ts`, `scripts/ingest-brand-list.ts`, `scripts/ingest-new-expansion.ts`. Three look like near-duplicates of the cron route's logic.

- **[Maintainability] Four "import" scripts** — `import-dcongress`, `import-discovered-brands`, `import-european-d2c`, `import-expansion-brands`, `import-qualified-brands`, `import-swedish-brands`, `import-swedish-realestate`. Clearly accretion; all probably consume a JSON file and upsert brand rows.

- **[Maintainability] Five "check-*" inspection scripts** (`check-brand`, `check-bylines`, `check-creators`, `check-new-brands`, `check-norwegian`, `check-stats`, `check-tokens`) — could be subcommands of one `scripts/check.ts` with flags.

- **[Maintainability] Gruns-specific debugging scripts** (`find-gruns.ts`, `gruns-analysis.ts`, `gruns-get-assets.ts`, `gruns-partnerships.ts`, `search-gruns.ts`, `scrape-gruns.ts`) — six one-offs for one brand. Should move to `/scratch/` or delete.

- **[Security-adjacent] `scrape-brand-authed.ts` uses `userDataDir: .puppeteer-meta-profile/`** — persists FB login cookies on disk. Gitignored (`.gitignore:57`) — good. But no warning in the script that the profile is a standing security exposure (anyone with disk access → FB session).

## "Active ads only" audit

Every code path I could find that downloads or regenerates ASSETS (images, videos, screenshots) from Facebook — not just metadata — was checked for an `isActive: true` filter. Metadata-only paths are fine.

| Path | Enforces active? | Notes |
|---|---|---|
| `src/lib/asset-pipeline.ts:213 processPendingAssets` | **NO** | Only filters `downloadStatus: 'pending'`. Backs the Vercel cron. **P0** |
| `src/app/api/ad-library/cron/assets/route.ts:41` (cron) | **NO** (inherits from above) | **P0** — daily run |
| `src/app/api/ad-library/assets/route.ts:57` (manual POST) | **NO** (same) | |
| `src/lib/asset-processor.ts:162 processAdsToR2` | **NO** | `where: { snapshotUrl: not null, assets: { none: completed } }` |
| `scripts/process-assets.ts:207` | **NO** | **P0** |
| `scripts/download-media.ts:387` | **NO** (sorts active-first but doesn't filter) | **P0** |
| `scripts/download-top-ads.ts:203` | **NO** (same pattern) | **P0** |
| `scripts/download-and-detect.ts:328` | **NO** (same pattern) | **P0** |
| `scripts/backfill-brand-assets.ts:42` | **NO** | **P0** |
| `scripts/backfill-videos-and-links.ts:53` | **NO** | **P0** |
| `scripts/backfill-new-assets.ts:10` (queue-filler) | **NO** | **P0** — fills pending queue with stale work |
| `scripts/rescrape-creator-brands.ts:229 fetchAndScrape` (via API `ad_active_status: ALL`) | **NO** | Explicitly fetches ALL ads, downloads creative. Intended for partnership research, but writes to `mediaUrl` under `creators/` — dead creatives still get uploaded |
| `scripts/detect-partnerships.ts:185` | **YES** | `where: { brandId, isActive: true, snapshotUrl: not null }` — correct |
| `scripts/scrape-partnerships.ts` | N/A | Uses Meta API `ad_active_status: ALL` by design (snapshot URL only, no asset download) |
| `src/app/api/ad-library/cron/ingest/route.ts:1046-1064` (asset row creation) | **NO** | Creates `AdAsset` row with `downloadStatus: 'pending'` for every ad with a snapshotUrl, even if `isActive=false` — feeds the pending queue |

**Recommendation:** Add `isActive: true` to `processPendingAssets`'s `where` clause (one line fix) and backfill a one‑time query to set `downloadStatus: 'skipped_inactive'` for all pending assets whose ad is inactive. The upstream scripts are secondary; the cron is the bleeding edge.

## "Creator discovery via Puppeteer" audit

All creator/partnership writes were checked. The rule says: creator/partnership detection MUST use Puppeteer rendering because "X with Y" lives only in rendered HTML.

| Path | Source of creator name | Rule-compliant? |
|---|---|---|
| `scripts/scrape-partnerships.ts` | Puppeteer `page.evaluate` on snapshot URL | YES |
| `scripts/detect-partnerships.ts` | Puppeteer `page.evaluate` | YES |
| `scripts/download-and-detect.ts` | Puppeteer `page.evaluate` | YES |
| `scripts/rescrape-creator-brands.ts` | Puppeteer `page.evaluate` | YES |
| `scripts/restore-creators-backup.ts` | Restores from JSON file produced by above | YES (downstream) |
| `scripts/gruns-partnerships.ts` | (not inspected deeply, but name suggests Puppeteer) | Likely YES |
| `scripts/classify-creators.ts` | Heuristic post-processing of existing `AdCreator.pageName` | YES (doesn't create creators) |
| `scripts/backfill-bylines.ts` | Meta Graph API field `bylines` | **Note:** writes `AdLibraryAd.bylines`, not `AdCreator`. Does NOT create creator records. Compliant. |
| `src/app/api/ad-library/cron/ingest/route.ts` | Writes `AdLibraryAd.bylines` from API field only | Compliant — no creator writes |
| `src/lib/media-extractor.ts:119-148` | Puppeteer `page.evaluate` + regex | Compliant, though writes to `Ad.bylines` not `AdCreator` |

**All creator-record writes use Puppeteer.** The Graph API `bylines` field is a separate concept (a display label on the ad) and the code correctly does not derive `AdCreator` rows from it. No violations found.

## Script sprawl analysis

33 tracked, 43 untracked, 76 total. Many are single-use or clearly deprecated by newer siblings.

| Script | Purpose | Status | Recommendation |
|---|---|---|---|
| `ingest-ads.ts` | Brand ad ingestion (old flow) | Tracked — possibly superseded | Consolidate with `run-ingestion.ts` and cron route |
| `run-ingestion.ts` | Brand ad ingestion (newer) | Tracked | Extract to `src/lib/ingestion/` and reuse in cron |
| `ingest-brand-list.ts` | Brand ad ingestion for curated list | Tracked | Likely redundant with run-ingestion |
| `ingest-new-expansion.ts` | One-off expansion | Untracked, one-off | Archive |
| `add-and-ingest-kids-top20.ts` | One-off kids clothing ingestion | Untracked, one-off | Archive |
| `reingest-brands.ts` | Hard-coded `PAGE_IDS = ['1414744892080419']` (Mockberg) | Tracked but one-off | Parameterize or archive |
| `rerun-failed-brands.ts` | Re-run from JSON file of failures | Tracked | Keep but document |
| `download-media.ts` | Download media (no-Puppeteer, regex extraction) | Tracked | Likely superseded by asset-pipeline; deprecate |
| `download-top-ads.ts` | Take screenshots of top ads | Tracked | Screenshots are lossy; deprecate in favour of asset-pipeline |
| `download-and-detect.ts` | Combined screenshot + partnership detection | Untracked | Overlaps with scrape-partnerships + download-media |
| `backfill-brand-assets.ts` | Puppeteer backfill for one brand | Untracked | Keep; scope is clear |
| `backfill-videos-and-links.ts` | Puppeteer backfill videos/landing URLs | Untracked | Keep |
| `backfill-new-assets.ts` | Creates AdAsset pending rows for all ads | Tracked | **High-blast-radius**; add active filter |
| `backfill-ad-text.ts` | Puppeteer to backfill ad bodies | Tracked | Keep |
| `backfill-bylines.ts` | API to backfill bylines | Untracked | Keep |
| `process-assets.ts` | Process pending assets (Puppeteer + R2) | Tracked | Duplicates `src/lib/asset-pipeline.ts` — deduplicate |
| `scrape-partnerships.ts` | CANONICAL creator scraper | Untracked | Track and document as the canonical path |
| `detect-partnerships.ts` | Older partnership detection | Untracked | Possibly superseded by scrape-partnerships |
| `rescrape-creator-brands.ts` | Re-scrape brands that already have partnerships + download creatives | Untracked | Dangerous `--fresh` flag (see P0) |
| `restore-creators-backup.ts` | Restore creators from JSON | Untracked | Keep as disaster-recovery |
| `classify-creators.ts` | Classify person vs business | Untracked | Keep |
| `sample-creators.ts`, `sample-demographics.ts`, `sample-targeting.ts` | Debug-only samples | Mixed | Archive / move to `scratch/` |
| `check-brand.ts`, `check-bylines.ts`, `check-creators.ts`, `check-new-brands.ts`, `check-norwegian.ts`, `check-stats.ts`, `check-tokens.ts` | Read-only inspection | Mostly untracked | Consolidate into `scripts/check.ts --target ...` |
| `inspect-brand-ads.ts`, `inspect-partnership.ts`, `list-active-brands.ts`, `list-pending.ts`, `lookup-brands.ts`, `lookup-page.ts`, `lookup-page-ids.ts` | Read-only | Untracked | Consolidate |
| `find-gruns.ts`, `gruns-*`, `scrape-gruns.ts`, `search-gruns.ts` | Grüns-specific debugging | Untracked | Move to `scratch/gruns/` or delete |
| `discover-european-brands.ts`, `discover-kids-clothing.ts`, `discover-wwf-pages.ts` | Brand discovery (one-shot) | Mixed | Keep as templates |
| `import-dcongress.ts`, `import-discovered-brands.ts`, `import-european-d2c.ts`, `import-expansion-brands.ts`, `import-qualified-brands.ts`, `import-swedish-brands.ts`, `import-swedish-realestate.ts` | JSON → brand import | Mixed | Collapse into `scripts/import.ts <json-file> [--category X]` |
| `fix-ad-formats.ts`, `fix-page-ids.ts`, `fix-video-formats.ts`, `fix-video-types.ts` | One-off data migrations | Mixed | Archive after run (they're one-time migrations) |
| `reset-brands.ts` (airline only), `reset-zero-ads.ts` | One-off resets | Untracked | Archive |
| `seed-brands.ts` | Initial seed | Tracked | Keep, document |
| `create-brand.ts`, `add-brand.ts` | Add single brand | Mixed | Pick one; delete the other |
| `snapshot-sov.ts` | Weekly SOV snapshot | Untracked | **Should be tracked** — referenced by cron or intended to be |
| `fetch-demographics.ts` | Calls local API endpoint | Tracked | Hit-local-API script; clearly dev-only |
| `fetch-fresh-ads.ts`, `fetch-facebook-page-ids.js` | Older experiments | Tracked | Probably abandoned — the `.js` file is stubs |
| `normalize-countries.ts` | One-off DB normalization | Untracked | Archive after run |
| `populate-demographics.ts` | Populate demographics via Meta API | Tracked | Keep, duplicates cron logic |
| `debug-analyze.ts`, `debug-partnership-ad.ts` | Debug | Mixed | Move to `scratch/` |
| `compare-ads.ts`, `test-partnership-search.ts`, `verify-kids-clothing-*.ts` | Debug/verification | Untracked | Archive |
| `bulk-download-assets.sh` | Bash loop hitting local API | Tracked | Keep as ops tool |

**Bottom line:** 43 untracked scripts × 100-500 lines each × most touching shared prod DB = an untenable attack surface. Recommendation:
1. Gitignore `scripts/_scratch/` and move all one-offs there.
2. Track the 15 scripts that are actually reusable (`scrape-partnerships`, `detect-partnerships`, `classify-creators`, `backfill-*`, `process-assets`, `run-ingestion`, `snapshot-sov`, the tracked seed/import/fix-* ones).
3. Add a `scripts/README.md` listing each with "safe to run on prod: yes/no/dry-run-first".

## Patterns worth addressing globally

1. **Cron secret fail-open.** Every cron route uses `if (CRON_SECRET && ...)` — switch to `if (!CRON_SECRET || authHeader !== ...) return 401;` and make `CRON_SECRET` required.

2. **Shared prod DB blindspot.** The memory document says "Shared Neon Postgres across local + prod." No script's top-of-file banner says "This modifies prod data." Add a helper that prints `⚠️ You are connected to $DATABASE_URL. Continue? [y/N]` for any script that does writes, and have CI fail if a new write-script lacks `--dry-run`.

3. **Duplicated ingestion/scraping logic.** `TokenManager`, `fetchAdsPage`, `fetchVideoAdIds`, `upsertAd`, partnership regex patterns, R2 upload helpers — all duplicated 3-5 times across scripts and lib files. Extract to `src/lib/ingestion/` and enforce via import lint.

4. **"Active ads only" not enforced at the library level.** It's a project invariant but lives only in docs. Add a single `getDownloadableAssets(limit, brandId?)` helper in `src/lib/asset-pipeline.ts` that ALWAYS filters `ad.isActive: true`, and ban direct `adAsset.findMany({downloadStatus:'pending'})` in CI (grep rule).

5. **No dry-run convention.** Some destructive scripts have `--dry-run`, others don't. Either make `--dry-run` the default (require `--write` / `--yes`) or enforce presence via a lint rule.

6. **No observability on Puppeteer failures.** `catch { return null }` is the default pattern. Failures should log the URL, error kind (timeout / network / nav), and optionally persist a screenshot under `/tmp/failures/` when running locally.

7. **R2 key generation is scattered.** `src/lib/r2.ts:generateAssetKey` is the canonical function but scripts frequently inline their own keys. Enforce import in a lint rule.

8. **Single-token scripts.** Any script hitting Graph API should use the multi-token manager. Extract to `src/lib/facebook-tokens.ts` and import everywhere.

9. **`data/` and root JSON files are not gitignored.** `creator-partnerships*.json`, `new-brands-expansion.json`, `gruns-ad-analysis.pptx` etc. live in the repo root untracked — one `git add .` away from committing PII‑adjacent brand research to a public repo. Expand `.gitignore` or move all data to `data/` (which is partially gitignored).

## Coverage notes

**Thorough read:** `src/lib/r2.ts`, `src/lib/asset-pipeline.ts`, `src/lib/asset-processor.ts`, `src/lib/media-extractor.ts`, `src/lib/media-cache.ts`, `src/lib/facebook-api.ts` (key parts), `src/app/api/ad-library/cron/ingest/route.ts` (all 1370 lines), `src/app/api/ad-library/cron/assets/route.ts`, `src/app/api/ad-library/cron/classify-poll/route.ts`, `src/app/api/ad-library/assets/route.ts`, `src/app/api/ad-library/assets/backfill/route.ts`, `src/app/api/media/resolve/route.ts`, `src/app/api/facebook-ads/route.ts`, `scripts/scrape-partnerships.ts`, `scripts/detect-partnerships.ts`, `scripts/download-and-detect.ts`, `scripts/download-media.ts`, `scripts/download-top-ads.ts`, `scripts/rescrape-creator-brands.ts`, `scripts/process-assets.ts`, `scripts/backfill-brand-assets.ts`, `scripts/backfill-videos-and-links.ts`, `scripts/backfill-new-assets.ts`, `scripts/backfill-bylines.ts`, `scripts/classify-creators.ts`, `scripts/restore-creators-backup.ts`, `scripts/scrape-brand-authed.ts` (key parts), `scripts/run-ingestion.ts`, `scripts/reingest-brands.ts`, `scripts/reset-brands.ts`, `scripts/reset-zero-ads.ts`, `scripts/fix-page-ids.ts`, `scripts/fix-video-types.ts`, `scripts/fix-video-formats.ts`, `scripts/normalize-countries.ts`, `vercel.json`, `.gitignore`.

**Skimmed (read first 50-80 lines only):** `scripts/discover-kids-clothing.ts`, `scripts/seed-brands.ts`, `scripts/backfill-ad-text.ts`, `scripts/gruns-analysis.ts`, `scripts/gruns-get-assets.ts`, `scripts/scrape-gruns.ts`, `scripts/snapshot-sov.ts`, `scripts/fetch-demographics.ts`, `scripts/find-gruns.ts`, `scripts/add-brand.ts`, `scripts/create-brand.ts`, `scripts/ingest-ads.ts`, `scripts/check-tokens.ts`, `scripts/rerun-failed-brands.ts`, `scripts/fetch-facebook-page-ids.js`, `scripts/bulk-download-assets.sh`, `scripts/debug-analyze.ts`, `scripts/debug-partnership-ad.ts`.

**Not read:** ~20 scripts that appear to be pure one-offs (`check-*.ts` subset, `sample-*.ts`, `lookup-*.ts`, `list-*.ts`, `inspect-*.ts`, `compare-ads.ts`, `test-partnership-search.ts`, `import-swedish-*.ts`, `discover-european-brands.ts`, `discover-wwf-pages.ts`, `verify-kids-clothing-*.ts`, `gruns-partnerships.ts`, `search-gruns.ts`, `fetch-fresh-ads.ts`, `fix-ad-formats.ts`, `populate-demographics.ts`, `import-dcongress.ts`, `import-discovered-brands.ts`, `import-european-d2c.ts`, `import-expansion-brands.ts`, `import-qualified-brands.ts`, `add-and-ingest-kids-top20.ts`, `check-brand.ts`, `check-new-brands.ts`, `check-norwegian.ts`, `check-stats.ts`, `check-creators.ts`, `check-bylines.ts`). I read their names and top-of-file purpose via Glob/ls, but did not audit internals. These are the highest-risk pool for additional destructive operations; treat this report as lower‑bound.

**Not read:** `src/lib/demographic-aggregator.ts`, `src/lib/demographics-normalizer.ts`, `src/lib/hook-extractor.ts`, `src/lib/snapshot-builder.ts`, `src/lib/spend-estimator.ts`, `src/lib/enrichment/*`, `src/lib/classification/*` — these are secondary to ingestion correctness.
