/**
 * Self-check for the TikTok client against a stubbed fetch.
 *   npx tsx scripts/test-tiktok-api.ts
 * No network, no keys. Takes ~4s: two real retry backoffs.
 */
import assert from 'node:assert/strict';
import { fetchAllAds, fetchAdDetail, searchAdvertisers } from '../src/lib/tiktok-api';

process.env.TIKTOK_CLIENT_KEY = 'key';
process.env.TIKTOK_CLIENT_SECRET = 'secret';

const calls: { url: string; body: string }[] = [];
const queue: { status: number; body: string }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, body: String(init?.body) });
  if (url.includes('/oauth/token/')) {
    return new Response(JSON.stringify({ access_token: 'clt.x', expires_in: 7200, token_type: 'Bearer' }));
  }
  const next = queue.shift();
  assert.ok(next, `unexpected call ${url}`);
  return new Response(next.body, { status: next.status });
}) as typeof fetch;

const ok = (data: string) => `{"data":${data},"error":{"code":"ok","message":"","log_id":"x"}}`;
const tokenCalls = () => calls.filter((c) => c.url.includes('/oauth/token/')).length;
const BIG = '7012345678901234567'; // past Number.MAX_SAFE_INTEGER

async function main() {
  // Paging, a 429 mid-way, and ids that JSON would round.
  queue.push(
    { status: 200, body: ok(`{"ads":[{"ad":{"id":${BIG}},"advertiser":{"business_id":${BIG}}}],"has_more":"true","search_id":"s1"}`) },
    { status: 429, body: '{"error":{"code":"rate_limit_exceeded","message":"slow down"}}' },
    { status: 200, body: ok(`{"ads":[{"ad":{"id":12},"advertiser":{"business_id":${BIG}}}],"has_more":false,"search_id":"s1"}`) },
  );
  const ads = await fetchAllAds({ advertiserIds: [BIG] });
  assert.deepEqual(ads.map((a) => a.ad.id), [BIG, '12']);
  assert.equal(ads[0].advertiser.business_id, BIG);
  const queries = calls.filter((c) => c.url.includes('/ad/query/'));
  assert.equal(queries.length, 3); // page 1, the 429, page 2 again
  assert.ok(queries[0].body.includes(`"advertiser_business_ids":[${BIG}]`), 'id sent unrounded');
  assert.ok(!queries[0].body.includes('search_id'));
  assert.ok(queries[2].body.includes('"search_id":"s1"'));
  assert.equal(tokenCalls(), 1, 'token reused across calls');

  // A 400 means our request is wrong, so retrying only burns quota.
  calls.length = 0;
  queue.push({ status: 400, body: '{"error":{"code":"invalid_params","message":"bad filter"}}' });
  await assert.rejects(fetchAdDetail(BIG), /bad filter/);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.includes(`"ad_id":${BIG}`));

  // A 401 drops the cached token; the retry mints a new one.
  calls.length = 0;
  queue.push(
    { status: 401, body: '{"error":{"code":"access_token_invalid","message":"expired"}}' },
    { status: 200, body: ok('{"advertisers":[{"business_id":1,"business_name":"Acme"}]}') },
  );
  assert.deepEqual(await searchAdvertisers('Acme'), [{ business_id: '1', business_name: 'Acme' }]);
  assert.equal(tokenCalls(), 1, 'token re-minted after 401');

  console.log('tiktok-api: 12 assertions passed');
}

main();
