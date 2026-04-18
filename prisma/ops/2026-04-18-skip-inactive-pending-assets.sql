-- One-time cleanup: mark pending AdAsset rows for inactive ads as
-- `skipped_inactive` so the daily cron stops retrying them.
--
-- Context: until Phase 3 of the 2026-04-18 audit (commit pending), every
-- code path that enqueued pending assets created rows for ads that had
-- already ended. The daily Vercel cron then kept downloading / retrying
-- those rows forever. The queue is now filtered at query time (see
-- src/lib/asset-pipeline.ts getDownloadableAssets) so new inactive rows
-- are ignored — but the existing backlog needs a one-time sweep.
--
-- HOW TO RUN (do this ONCE, next time you're at the laptop):
--
--   1. Confirm Neon has a recent backup.
--   2. Run the SELECT below first to preview the row count.
--   3. Run the UPDATE.
--   4. Verify with the final SELECT.
--
-- You can run via Neon SQL editor, `psql "$DATABASE_URL"`, or
-- `npx prisma db execute --file prisma/ops/2026-04-18-skip-inactive-pending-assets.sql`
-- (the prisma option reads DATABASE_URL from .env.local).

-- 1. Preview — how many pending rows are attached to inactive ads?
SELECT COUNT(*) AS stale_pending_rows
FROM "AdAsset" a
JOIN "AdLibraryAd" ad ON ad.id = a."adId"
WHERE a."downloadStatus" = 'pending'
  AND ad."isActive" = false;

-- 2. Sweep — mark them as skipped_inactive so the cron ignores them.
--    This does NOT delete any rows. Already-downloaded rows
--    (downloadStatus = 'completed') are untouched, so users can still
--    browse historical ad creatives we already pulled into R2.
UPDATE "AdAsset"
SET "downloadStatus" = 'skipped_inactive',
    "updatedAt" = NOW()
WHERE "downloadStatus" = 'pending'
  AND "adId" IN (
    SELECT id FROM "AdLibraryAd" WHERE "isActive" = false
  );

-- 3. Verify — expected: 0.
SELECT COUNT(*) AS remaining_stale_pending
FROM "AdAsset" a
JOIN "AdLibraryAd" ad ON ad.id = a."adId"
WHERE a."downloadStatus" = 'pending'
  AND ad."isActive" = false;
