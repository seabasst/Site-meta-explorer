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
import { whereFor } from '../src/lib/bq-sync';

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

console.log('whereFor: 5 assertions passed');
