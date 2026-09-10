/**
 * Self-check for the AdObservation write predicate.
 *   npx tsx scripts/test-delivery-moved.ts
 * No DB, no network — it only exercises deliveryMoved().
 */
import assert from 'node:assert/strict';
import { deliveryMoved } from '../src/lib/ingestion/ingest-core';

const A = (reachEstimate: number | null, isActive = true) => ({ reachEstimate, isActive });

// t0 anchor: a never-seen ad always logs, even with no reach yet.
assert.equal(deliveryMoved(null, A(null)), true);
assert.equal(deliveryMoved(null, A(0)), true);

// Steady state: an unchanged poll must not write a row. This is the whole
// reason the table stays proportional to live delivery.
assert.equal(deliveryMoved(A(5000), A(5000)), false);
assert.equal(deliveryMoved(A(null), A(null)), false);
assert.equal(deliveryMoved(A(0, false), A(0, false)), false);

// Reach moved: the delta is the signal, so any change logs.
assert.equal(deliveryMoved(A(5000), A(5001)), true);
assert.equal(deliveryMoved(A(null), A(1200)), true);
assert.equal(deliveryMoved(A(1200), A(null)), true);

// Status moved: the death of an ad is an observation even at flat reach.
assert.equal(deliveryMoved(A(5000, true), A(5000, false)), true);
assert.equal(deliveryMoved(A(5000, false), A(5000, true)), true);

// 0 and null are different states (no reach reported vs reported as zero) and
// must not collapse — a loose == here would silently drop t0 anchors.
assert.equal(deliveryMoved(A(0), A(null)), true);
assert.equal(deliveryMoved(A(null), A(0)), true);

console.log('deliveryMoved: 13 assertions passed');
