/**
 * Self-check for TokenManager.confirmDead / reviveDeadTokens.
 *   npx tsx scripts/test-token-revive.ts
 * No DB, no network — fetch is stubbed per token.
 */
import assert from 'node:assert/strict';
import { TokenManager } from '../src/lib/ingestion/ingest-core';

for (let i = 1; i <= 10; i++) delete process.env[`FACEBOOK_ACCESS_TOKEN${i}`];
process.env.FACEBOOK_ACCESS_TOKEN1 = 'good';
process.env.FACEBOOK_ACCESS_TOKEN2 = 'expired';
process.env.FACEBOOK_ACCESS_TOKEN3 = 'offline';

// What a probe with each token returns. 'good' starts out failing like TOKEN1 did on 10-23.
const probe: Record<string, () => object> = {
  good: () => ({ error: { code: 190, error_subcode: 460, message: 'Session invalidated' } }),
  expired: () => ({ error: { code: 190, error_subcode: 463, message: 'Session has expired' } }),
  offline: () => { throw new TypeError('fetch failed'); },
};
const probed: string[] = [];
globalThis.fetch = (async (url: string) => {
  const token = new URL(url).searchParams.get('access_token')!;
  probed.push(token);
  const body = probe[token]();
  return { json: async () => body } as Response;
}) as typeof fetch;

async function main() {
  const tm = new TokenManager();
  const err = { code: 10, message: 'Application does not have permission for this action' };

  // A token whose probe passes is never marked dead: the error belonged to that request.
  probe.good = () => ({ data: [] });
  assert.equal(await tm.confirmDead('good', err), false);
  assert.equal(tm.getStatusSummary().active, 3);

  // A network failure during the probe proves nothing either.
  assert.equal(await tm.confirmDead('offline', err), false);

  // Probe fails the same way: dead. Kill all three (good fails its probe this time).
  probe.good = () => ({ error: { code: 190, error_subcode: 460, message: 'Session invalidated' } });
  probe.offline = () => ({ error: { code: 200, message: 'Permissions error' } });
  for (const t of ['good', 'expired', 'offline']) assert.equal(await tm.confirmDead(t, err), true);
  assert.equal(tm.hasUsableTokens(), false);
  assert.match(tm.describeDeadTokens(), /T1 expired: .*code 10 .*probe: code 190\/460/);
  assert.match(tm.describeDeadTokens(), /T3 invalid: .*probe: code 200/);

  // Revive: 'good' now answers, 'expired' still 190, 'offline' unreachable.
  probe.good = () => ({ data: [{ id: '1' }] });
  probe.offline = () => { throw new TypeError('fetch failed'); };
  probed.length = 0;
  const t0 = 1_000_000_000_000;
  assert.equal(await tm.reviveDeadTokens(t0), 1);
  assert.deepEqual(probed, ['good', 'expired', 'offline']);
  assert.equal(tm.hasUsableTokens(), true);
  assert.equal(tm.getBestToken(), 'good');
  assert.equal(tm.getStatusSummary().expired, 1);
  assert.equal(tm.getStatusSummary().invalid, 1);

  // Throttled: no probes inside 15 min, then only the still-dead tokens are re-probed.
  probed.length = 0;
  assert.equal(await tm.reviveDeadTokens(t0 + 14 * 60_000), 0);
  assert.deepEqual(probed, []);
  probe.offline = () => ({ error: { code: 4, message: 'Application request limit reached' } });
  assert.equal(await tm.reviveDeadTokens(t0 + 15 * 60_000), 1); // a rate limit is not a dead token
  assert.deepEqual(probed, ['expired', 'offline']);
  assert.equal(tm.getStatusSummary().active, 2);

  console.log('token revive: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
