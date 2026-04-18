# Scripts

One-off and ops scripts for the Facebook Ad Explorer pipeline. Each script
is labeled with a **safety class** so you know what you're about to run.

**Everything in this directory talks to the shared Neon production DB
unless otherwise noted.** Double-check `DATABASE_URL` before running any
script that has `[WRITE]` or `[DESTRUCTIVE]` in its safety class.

---

## Safety classes

| Class | Meaning |
|---|---|
| `[READ]` | Read-only. Safe to run anytime. |
| `[WRITE]` | Writes to DB and/or R2. Creates rows; doesn't delete or overwrite in bulk. |
| `[DESTRUCTIVE]` | Can delete rows or mass-update. Always run with `--dry-run` first if available. |
| `[NET]` | Hits Facebook Graph API or fbcdn; counts against rate limits. |
| `[PUPPETEER]` | Launches a headless browser; slower, resource-heavy. |
| `[LOCAL]` | Only makes sense against a local DB / dev environment. |

---

## Canonical scripts (use these)

### Ingestion

| Script | Safety | What it does |
|---|---|---|
| `run-ingestion.ts` | `[WRITE] [NET]` | Pulls ads from Graph API into DB for a list of brands. Primary manual ingestion entry point. |
| `ingest-ads.ts` | `[WRITE] [NET]` | Older ingestion flow; kept for compatibility — prefer `run-ingestion.ts`. |
| `ingest-brand-list.ts` | `[WRITE] [NET]` | Ingest a curated list of brands by pageId. |
| `rerun-failed-brands.ts` | `[WRITE] [NET]` | Retry brands whose ingestion failed from a JSON file. |
| `seed-brands.ts` | `[WRITE]` | Initial seed of brand rows (typically dev only). |

### Asset pipeline (R2 + fbcdn)

| Script | Safety | What it does |
|---|---|---|
| `process-assets.ts` | `[WRITE] [NET] [PUPPETEER]` | Downloads pending AdAsset rows from fbcdn → R2. Same logic as the Vercel cron, but runnable manually. **Active-ads-only filter enforced.** |
| `backfill-new-assets.ts` | `[WRITE]` | Creates pending AdAsset rows for ads that don't have one. **Active-ads-only.** |
| `backfill-brand-assets.ts` | `[WRITE] [NET] [PUPPETEER]` | Backfill assets for one specific brand (pass `<pageId>`). **Active-ads-only.** |
| `backfill-videos-and-links.ts` | `[WRITE] [NET] [PUPPETEER]` | Fill in missing video creatives + landing URLs for a brand. **Active-ads-only.** |
| `backfill-ad-text.ts` | `[WRITE] [PUPPETEER]` | Backfill ad body text via Puppeteer when Graph API didn't return it. |
| `backfill-bylines.ts` | `[WRITE] [NET]` | Backfill `AdLibraryAd.bylines` from Graph API. |
| `download-media.ts` | `[WRITE] [NET]` | ⚠ Older, largely superseded by `process-assets.ts` + the cron. |
| `download-top-ads.ts` | `[WRITE] [PUPPETEER]` | ⚠ **DEPRECATED** — stores PNG screenshots for video ads too, mislabels as 'image'. Use `process-assets.ts`. See deprecation banner in the file. |
| `download-and-detect.ts` | `[WRITE] [NET] [PUPPETEER]` | Combined screenshot + partnership detection for top ads per brand. |
| `bulk-download-assets.sh` | `[WRITE] [NET]` | Bash loop calling the local Next.js API to trigger asset downloads. |

### Partnerships / creators

| Script | Safety | What it does |
|---|---|---|
| `scrape-partnerships.ts` | `[WRITE] [NET] [PUPPETEER]` | **Canonical** creator-partnership scraper. Renders ad snapshot URLs, extracts the "X with Y" byline via DOM, writes `AdCreator` + `CreatorPartnership`. |
| `detect-partnerships.ts` | `[WRITE] [NET] [PUPPETEER]` | Older partnership detector; still functional. |
| `rescrape-creator-brands.ts` | `[DESTRUCTIVE] [NET] [PUPPETEER]` | Re-scrape brands with known partnerships + download creatives to R2. The `--fresh` branch deletes ALL `CreatorPartnership` + `AdCreator` rows; it requires `--yes-i-really-want-to-wipe-creators` to actually run. |
| `classify-creators.ts` | `[WRITE]` | Classify existing creators as person/business via heuristics + (optionally) LLM. |
| `restore-creators-backup.ts` | `[WRITE]` | Disaster recovery — restore `CreatorPartnership` + `AdCreator` from a JSON backup. |
| `scrape-brand-authed.ts` | `[READ] [NET] [PUPPETEER]` | Uses a persistent FB-authenticated Puppeteer profile to scrape pages. Writes nothing unless you wire it up. |

### Brand discovery + imports

| Script | Safety | What it does |
|---|---|---|
| `discover-european-brands.ts` | `[READ] [NET]` | Discover European D2C brands (template; output JSON only). |
| `discover-kids-clothing.ts` | `[READ] [NET]` | Discover kids clothing brands (template). |
| `discover-wwf-pages.ts` | `[READ] [NET]` | Discover WWF-related pages (template). |
| `import-discovered-brands.ts` | `[WRITE]` | Import brands from a discovery JSON output. |
| `import-dcongress.ts` | `[WRITE]` | One-off: import D-Congress brand list. |
| `import-european-d2c.ts` | `[WRITE]` | One-off: import European D2C list. |
| `import-expansion-brands.ts` | `[WRITE]` | One-off: import expansion batch. |
| `import-qualified-brands.ts` | `[WRITE]` | Import filtered-by-criteria brands. |
| `import-swedish-brands.ts` | `[WRITE]` | One-off: Swedish brands. |
| `import-swedish-realestate.ts` | `[WRITE]` | One-off: Swedish real estate agencies. |
| `add-brand.ts` | `[WRITE]` | Add a single brand by pageId. |
| `create-brand.ts` | `[WRITE]` | Create a brand row with explicit fields. |

### Ops / inspection

| Script | Safety | What it does |
|---|---|---|
| `check-brand.ts` | `[READ]` | Print brand stats. |
| `check-new-brands.ts` | `[READ]` | List recently-added brands. |
| `check-norwegian.ts` | `[READ]` | Inspect Norwegian brand subset. |
| `check-stats.ts` | `[READ]` | Top-line DB stats. |
| `check-tokens.ts` | `[READ]` | Check FB access token health. |
| `check-bylines.ts` | `[READ]` | Inspect bylines distribution. |
| `check-creators.ts` | `[READ]` | Inspect creator / partnership stats. |
| `fetch-demographics.ts` | `[WRITE] [NET]` | Call local API to fetch + store demographics. |
| `populate-demographics.ts` | `[WRITE] [NET]` | Populate demographics via Meta API. Duplicates cron logic. |
| `snapshot-sov.ts` | `[WRITE]` | Manual SoV snapshot (normally runs via Vercel cron). |
| `fetch-fresh-ads.ts` | `[NET]` | Fetch fresh ads for a brand (debug). |
| `fetch-facebook-page-ids.js` | `[NET]` | Example code for finding page IDs. Mostly commented out. |
| `find-page-ids.ts` | `[READ] [NET]` | Resolve page names to page IDs. |

### Data cleanup (all `[DESTRUCTIVE]` — run carefully)

| Script | Safety | What it does |
|---|---|---|
| `fix-ad-formats.ts` | `[DESTRUCTIVE]` | One-off migration — normalize `displayFormat` values. |
| `fix-page-ids.ts` | `[DESTRUCTIVE] [NET]` | Resolve unresolvable page IDs; default deletes brand rows that fail resolution. Has `--dry-run`. **Use it.** |
| `fix-video-formats.ts` | `[DESTRUCTIVE]` | One-off — reclassify videos. |
| `fix-video-types.ts` | `[DESTRUCTIVE]` | One-off — migrate video type labels. |
| `reset-brands.ts` | `[DESTRUCTIVE]` | Resets ingestion status for category='airline' brands. Pre-audit script — no dry-run. |
| `reset-zero-ads.ts` | `[DESTRUCTIVE]` | Resets brands with zero ads back to pending. No dry-run. |
| `debug-analyze.ts` | `[READ]` | Run analyze pipeline debug. |

---

## `_scratch/` — archived one-offs

`scripts/_scratch/` is **gitignored**. It holds scripts that were one-off
experiments, personal debugging tools, or per-batch imports that are no
longer relevant. They're kept on the filesystem so you can reach for one if
you need the logic, but fresh clones of the repo don't get them.

Moved here by Phase 5 of the 2026-04-18 audit:

- Per-batch imports: `add-and-ingest-kids-top20`, `ingest-new-expansion`
- Brand-specific debugging: `find-gruns`, `gruns-analysis`,
  `gruns-get-assets`, `gruns-partnerships`, `scrape-gruns`, `search-gruns`
- Verification one-offs: `verify-kids-clothing-batch2`,
  `verify-kids-clothing-brands`
- Sample dumps: `sample-creators`, `sample-demographics`, `sample-targeting`
- Inspection one-offs: `inspect-brand-ads`, `inspect-partnership`,
  `list-active-brands`, `list-pending`, `lookup-brands`, `lookup-page`,
  `lookup-page-ids`
- One-off migrations: `normalize-countries`, `reingest-brands` (hardcoded
  to one brand), `fix-page-ids` (actually kept — has dry-run)
- Debug utilities: `compare-ads`, `debug-partnership-ad`,
  `test-partnership-search`

If any of these need to come back, `git mv scripts/_scratch/<file> scripts/`
and track it.

---

## Conventions for new scripts

1. **Active-ads rule.** If you query `AdAsset` rows to download, go
   through `getDownloadableAssets()` in `src/lib/asset-pipeline.ts`.
   Never hand-roll a `findMany({ where: { downloadStatus: 'pending' }})`.
2. **Dry-run gate.** Any script that deletes or mass-updates should
   default to preview mode. Require `--yes` (or similar explicit flag)
   to actually mutate.
3. **Show the target DB.** Print `DATABASE_URL` hostname at the top of
   destructive scripts so the operator can't miss "I'm about to mutate
   prod."
4. **R2 keys via `generateAssetKey()`.** Don't hand-roll key strings.
   See `prisma/ops/ROADMAP-r2-key-unification.md`.
5. **Token rotation.** Scripts hitting Graph API should use the
   multi-token pool helper from `src/app/api/ad-library/cron/ingest/route.ts`
   (Phase 5.4 will extract it to `src/lib/ingestion/`).

---

## References

- `.planning/review-2026-04-18/03-ingestion-pipeline.md` — the full
  audit of this directory (47 findings).
- `.planning/review-2026-04-18/00-SYNTHESIS.md` — Phase 5 scope.
- `prisma/ops/` — one-time SQL + migration plans.
