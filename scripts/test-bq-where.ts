/**
 * Self-check for the BigQuery sync's where-clause builder.
 *   npx tsx scripts/test-bq-where.ts
 * No DB, no BigQuery — it only exercises whereFor().
 *
 * This is the piece that decides how much data leaves Neon each night: drop the
 * watermark clause and an "incremental" table silently goes back to a full
 * re-read, which is exactly what exhausted the transfer quota.
 */
import assert from 'node:assert/strict';
import { whereFor, exceedsPruneCeiling } from '../src/lib/bq-sync';

const since = new Date('2026-09-13T00:00:00Z');

// First page of a first-ever (or post-fallback) run: no cursor, no watermark.
// Must be undefined, not an empty AND — Prisma treats `{ AND: [] }` as a filter.
assert.equal(whereFor(undefined, undefined, 'updatedAt'), undefined);

// Keyset only (full-refresh tables): cursor, no watermark.
assert.deepEqual(whereFor('cuid_1', undefined, 'updatedAt'), { AND: [{ id: { gt: 'cuid_1' } }] });

// Watermark only: first page of an incremental run.
assert.deepEqual(whereFor(undefined, since, 'updatedAt'), { AND: [{ updatedAt: { gt: since } }] });

// Both: later pages of an incremental run. Losing either clause is a bug —
// without the cursor the walk never advances, without the watermark it is a
// full table scan billed as egress.
assert.deepEqual(whereFor('cuid_1', since, 'updatedAt'), {
  AND: [{ id: { gt: 'cuid_1' } }, { updatedAt: { gt: since } }],
});

// The column is per-table, not hardcoded: classifications watermark on classifiedAt.
assert.deepEqual(whereFor(undefined, since, 'classifiedAt'), { AND: [{ classifiedAt: { gt: since } }] });

// --- prune safety gate -----------------------------------------------------
// The weekly prune deletes by anti-join against a list of live brand ids. A
// short read of that list looks exactly like "everything was deleted", so the
// gate must fail closed on anything implausible.

// Nothing to compare against: a zero-row raw_brands means the read is not
// trustworthy, so refuse rather than delete the warehouse.
assert.equal(exceedsPruneCeiling(0, 0), true);
assert.equal(exceedsPruneCeiling(10, 0), true);

// Normal case: a handful of hand-deleted brands out of thousands.
assert.equal(exceedsPruneCeiling(1, 5000), false);
assert.equal(exceedsPruneCeiling(499, 5000), false);

// At the 10% line: allowed exactly at, refused past it.
assert.equal(exceedsPruneCeiling(500, 5000), false);
assert.equal(exceedsPruneCeiling(501, 5000), true);

// The failure this exists to stop: a truncated id list marks most of the table
// stale, which would otherwise delete nearly everything.
assert.equal(exceedsPruneCeiling(4900, 5000), true);

console.log('whereFor + exceedsPruneCeiling: 13 assertions passed');
