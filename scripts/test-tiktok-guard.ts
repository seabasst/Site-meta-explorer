/**
 * Self-check: Meta ingestion must never run on a TikTok brand.
 *   DATABASE_URL=postgresql://nobody@127.0.0.1:1/none npx tsx scripts/test-tiktok-guard.ts
 * The dead DATABASE_URL is the point: if processBrand reached the DB it would throw.
 */
import assert from 'node:assert/strict';
import { processBrand, isNumericPageId } from '../src/lib/ingestion/ingest-core';
import { toTikTokId, isTikTokId } from '../src/lib/tiktok-api';

const id = toTikTokId('7123456789012345678');
assert.equal(id, 'tiktok-7123456789012345678');
assert.equal(isTikTokId(id), true);
// Non-numeric, so without the guard processBrand would take the search_terms path.
assert.equal(isNumericPageId(id), false);

// Meta ids, numeric and the legacy non-numeric ones, are not TikTok.
assert.equal(isTikTokId('104958162837'), false);
assert.equal(isTikTokId('spacegoods'), false);

processBrand('brand-id', id, 'Some Brand').then((r) => {
  assert.deepEqual(r, { success: false, brand: 'Some Brand', error: 'Not a Meta brand' });
  console.log('tiktok guard: 7 assertions passed, no DB touched');
  process.exit(0);
});
