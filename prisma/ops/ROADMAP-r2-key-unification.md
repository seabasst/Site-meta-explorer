# R2 Key Unification — Deferred

Phase 3.4 of the 2026-04-18 audit. Tracked here for a future session
because it requires coordinated DB + R2 surgery that isn't safe from
a remote session.

## Problem

The project uses **three different R2 key conventions** for what is
conceptually the same data (an ad creative). Whichever script ran last
wins in the DB — the other objects become orphan bytes, unreachable
via the API but still billed.

| Source | Key pattern | Used by |
|---|---|---|
| Canonical (`src/lib/r2.ts::generateAssetKey`) | `ads/{brandId}/{adId}/{type}-{pos}{ext}` | `src/lib/asset-pipeline.ts`, daily cron |
| Screenshot-dump (deprecated) | `ads/{brandId}/{adId}.png` | `scripts/download-top-ads.ts`, `scripts/download-and-detect.ts` |
| Creator scrape | `creators/{adId}{ext}` | `scripts/rescrape-creator-brands.ts` |

`AdAsset` stores ONE `storedUrl` per ad, so when two scripts upload
under different keys, the DB tracks only the most-recent upload and
the other R2 object is orphaned.

## Why deferred

Unifying the key space requires:

1. Choosing the single canonical pattern (probably `generateAssetKey`).
2. Rewriting the deprecated scripts to use it.
3. Migrating existing R2 objects: copy under the canonical key and
   delete the old one, updating `AdAsset.storedKey` / `storedUrl`.
4. Running a verification pass that every `AdAsset` still resolves.

Steps 3 and 4 mutate production R2 + prod DB at scale. Do this at the
laptop with the ability to preview, sample, and roll back.

## Proposed migration plan

1. **Freeze**: ship a lint rule (or CI grep) that forbids any new
   uploads under `ads/{brandId}/{adId}.png` or `creators/` outside
   `src/lib/r2.ts`.
2. **Inventory**: list all R2 objects under each prefix; produce a
   reconciliation report (how many objects match each pattern, how
   many AdAsset rows point to each).
3. **Rewrite deprecated scripts** (download-top-ads.ts,
   download-and-detect.ts, rescrape-creator-brands.ts) to use
   `generateAssetKey()`.
4. **Backfill script**: for every AdAsset whose `storedKey` matches
   the deprecated pattern, COPY the object to the canonical key,
   update the row, and DELETE the old object. Support `--dry-run`
   and `--limit N`.
5. **Delete orphans**: objects in R2 not referenced by any AdAsset.
   Separate script with its own dry-run gate.

## Until then

- `download-top-ads.ts` has a deprecation banner. Do not wire it into
  automations.
- New code uses `generateAssetKey` via `src/lib/r2.ts`. No hand-rolled
  key strings.
- The cron + `process-assets.ts` are already on the canonical pattern,
  so automated pipelines are consistent. Only the ad-hoc tools drift.

## References

- `.planning/review-2026-04-18/03-ingestion-pipeline.md`
  (P0 "R2 key-namespace collision")
- `.planning/review-2026-04-18/00-SYNTHESIS.md` (Phase 3.4)
