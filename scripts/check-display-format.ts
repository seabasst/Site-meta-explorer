/**
 * Self-check for the display-format rules (no DB, no network).
 *   npx tsx scripts/check-display-format.ts
 * Cases come from the IM8 render of 2026-10-06: flexible ads ("1 of N") must
 * never become carousel, and login-wall renders must not overwrite anything.
 */
import assert from 'node:assert/strict';
import { classifyRender } from '../src/lib/media-extractor';
import { mergeDisplayFormat } from '../src/lib/ingestion/ingest-core';

const base = { ctas: 1, multipleVersions: false, loginWall: false, hasVideo: false };

assert.equal(classifyRender(base), 'image');
assert.equal(classifyRender({ ...base, hasVideo: true }), 'video');
assert.equal(classifyRender({ ...base, ctas: 3 }), 'carousel');
// Flexible ad: several CTAs in the DOM but "This ad has multiple versions"
assert.equal(classifyRender({ ...base, ctas: 2, multipleVersions: true }), 'image');
assert.equal(classifyRender({ ...base, ctas: 2, multipleVersions: true, hasVideo: true }), 'video');
// Login wall shows 2 button-like CTAs; no verdict
assert.equal(classifyRender({ ...base, ctas: 2, loginWall: true }), undefined);

// A re-poll must not downgrade a render/video verdict back to the API guess
assert.equal(mergeDisplayFormat('carousel', 'image'), 'carousel');
assert.equal(mergeDisplayFormat('video', 'image'), 'video');
assert.equal(mergeDisplayFormat('image', 'video'), 'video');
assert.equal(mergeDisplayFormat(null, 'image'), 'image');
assert.equal(mergeDisplayFormat('unknown', 'image'), 'image');

console.log('display-format checks passed');
