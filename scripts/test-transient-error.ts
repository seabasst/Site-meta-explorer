/**
 * Self-check for isTransientError — the guard that decides whether a failed
 * ingestion counts against a brand's failCount (3 strikes retires it forever).
 *
 *   npx tsx scripts/test-transient-error.ts
 */
import assert from 'node:assert';
import { isTransientError } from '../src/lib/ingestion/ingest-core';

// Real messages taken from IngestionJob.errorMessage on 2026-09-15.
const transient = [
  'API Error: (#613) Calls to this api have exceeded the rate limit. (code: 613)',
  'API Error: An unexpected error has occurred. Please retry your request later.',
  'Rate limit reached, backing off',
];
const permanent = [
  'API Error: (#100) Invalid parameter',
  'Page not found',
  'Unsupported get request. Object with ID does not exist',
  '',
];

for (const m of transient) assert.equal(isTransientError(m), true, `should be transient: ${m}`);
for (const m of permanent) assert.equal(isTransientError(m), false, `should be permanent: ${m}`);

console.log(`ok — ${transient.length} transient, ${permanent.length} permanent`);
