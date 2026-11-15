// npx tsx scripts/check-meta-ad-url.ts — stored snapshot URLs carry our Meta token; this must never leak.
import assert from 'node:assert';
import { publicSnapshotUrl } from '../src/lib/meta-ad-url';

assert.equal(publicSnapshotUrl('https://www.facebook.com/ads/archive/render_ad/?id=1201342498488618&access_token=EAAsecret'), 'https://www.facebook.com/ads/library/?id=1201342498488618');
assert.equal(publicSnapshotUrl('https://www.facebook.com/ads/archive/render_ad/?access_token=EAAx&id=42'), 'https://www.facebook.com/ads/library/?id=42');
assert.equal(publicSnapshotUrl('https://example.com/?access_token=x'), null);
assert.equal(publicSnapshotUrl(null), null);
console.log('publicSnapshotUrl ok');
