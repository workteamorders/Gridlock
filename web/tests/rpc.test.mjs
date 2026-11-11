import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, resetRateLimits, ALLOWED_METHODS } from '../functions/_lib/rpc-core.ts';
import { handleGeo } from '../functions/_lib/geo-core.ts';

const CARS = '0x' + 'ab'.repeat(20);
const OTHER = '0x' + 'cd'.repeat(20);
const env = { UPSTREAM_RPC_URL: 'https://upstream.invalid/SECRET_KEY', CONTRACT_ADDRESSES: CARS, RATE_LIMIT_PER_MIN: '1000', MAX_LOG_RANGE: '1000' };
let calls = [];
const deps = (extra = {}) => ({
  now: () => 1_000_000, fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' })); }, ...extra,
});
const post = (body, headers = {}) => new Request('https://gridlock.example/api/rpc', { method: 'POST', headers: { origin: 'https://gridlock.example', 'cf-connecting-ip': '1.1.1.1', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const rpc = (method, params = []) => ({ jsonrpc: '2.0', id: 7, method, params });
const run = async (req, e = env, d = deps()) => { const r = await handleRpc(req, e, d); return { status: r.status, body: await r.json() }; };
beforeEach(() => { resetRateLimits(); calls = []; });

test('allowlisted read passes through and the upstream key never reaches the client', async () => {
  const { body } = await run(post(rpc('eth_blockNumber')));
  assert.equal(body.result, '0x1');
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(body).includes('SECRET_KEY'));
});

test('methods outside the allowlist are rejected and never forwarded', async () => {
  for (const m of ['eth_sendRawTransaction', 'eth_sendTransaction', 'eth_accounts', 'debug_traceCall', 'personal_sign', 'eth_subscribe', 'net_version', 'eth_getStorageAt', 'eth_sign']) {
    const { body } = await run(post(rpc(m)));
    assert.match(body.error.message, /not allowed/, m);
  }
  assert.equal(calls.length, 0);
  assert.equal(ALLOWED_METHODS.includes('eth_sendRawTransaction'), false);
});

test('eth_call is limited to project contracts', async () => {
  assert.equal((await run(post(rpc('eth_call', [{ to: OTHER, data: '0x' }, 'latest'])))).body.error.message, 'calls are limited to the project contracts');
  assert.equal((await run(post(rpc('eth_call', [{ to: CARS, data: '0x12345678' }, 'latest'])))).body.result, '0x1');
  assert.match((await run(post(rpc('eth_call', [{ data: '0x' }, 'latest'])))).body.error.message, /needs a "to"/);
});

test('eth_getLogs: other address, wide range, open range and blockHash are rejected', async () => {
  const f = (o) => rpc('eth_getLogs', [{ address: CARS, fromBlock: '0x10', toBlock: '0x20', ...o }]);
  assert.equal((await run(post(f({})))).body.result, '0x1');
  assert.match((await run(post(f({ address: OTHER })))).body.error.message, /limited to the project/);
  assert.match((await run(post(f({ address: [CARS, OTHER] })))).body.error.message, /limited to the project/);
  assert.match((await run(post(f({ toBlock: '0x2000' })))).body.error.message, /block range/);
  assert.match((await run(post(f({ toBlock: 'latest' })))).body.error.message, /hex block numbers/);
  assert.match((await run(post(f({ fromBlock: '0x30' })))).body.error.message, /block range/);
  assert.match((await run(post(rpc('eth_getLogs', [{ address: CARS, blockHash: '0x' + '11'.repeat(32) }])))).body.error.message, /blockHash/);
  assert.match((await run(post(rpc('eth_getLogs', [{ fromBlock: '0x1', toBlock: '0x2' }])))).body.error.message, /limited to the project/);
});

test('batch size, body size and bad JSON', async () => {
  const many = Array.from({ length: 11 }, () => rpc('eth_blockNumber'));
  assert.equal((await run(post(many))).status, 400);
  assert.equal((await run(post(Array.from({ length: 10 }, () => rpc('eth_blockNumber'))))).body.length, 10);
  assert.equal((await run(post({ ...rpc('eth_call', [{ to: CARS, data: '0x' + '00'.repeat(9000) }]) }))).status, 413);
  assert.equal((await run(post('{not json'))).status, 400);
  assert.equal((await run(post([]))).status, 400);
});

test('origin: other origins and missing origin are rejected; extra allowed origins work', async () => {
  assert.equal((await run(post(rpc('eth_blockNumber'), { origin: 'https://evil.example' }))).status, 403);
  const noOrigin = new Request('https://gridlock.example/api/rpc', { method: 'POST', body: JSON.stringify(rpc('eth_blockNumber')) });
  assert.equal((await run(noOrigin)).status, 403);
  assert.equal((await run(post(rpc('eth_blockNumber'), { origin: 'https://preview.example' }), { ...env, ALLOWED_ORIGINS: 'https://preview.example' })).status, 200);
  const get = new Request('https://gridlock.example/api/rpc', { method: 'GET', headers: { origin: 'https://gridlock.example' } });
  assert.equal((await run(get)).status, 405);
});

test('rate limit per IP', async () => {
  const low = { ...env, RATE_LIMIT_PER_MIN: '5' };
  for (let i = 0; i < 5; i++) assert.equal((await run(post(rpc('eth_blockNumber')), low)).status, 200);
  assert.equal((await run(post(rpc('eth_blockNumber')), low)).status, 429);
  assert.equal((await run(post(rpc('eth_blockNumber'), { 'cf-connecting-ip': '2.2.2.2' }), low)).status, 200, 'another IP is unaffected');
});

test('upstream failures become clear errors, short cache serves hot reads', async () => {
  const bad = deps({ fetchImpl: async () => new Response('x', { status: 429 }) });
  assert.match((await run(post(rpc('eth_blockNumber')), env, bad)).body.error.message, /busy/);
  const down = deps({ fetchImpl: async () => { throw new Error('down'); } });
  assert.match((await run(post(rpc('eth_blockNumber')), env, down)).body.error.message, /busy/);
  const store = new Map();
  const cache = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
  await run(post(rpc('eth_blockNumber')), env, deps({ cache }));
  await run(post(rpc('eth_blockNumber')), env, deps({ cache }));
  assert.equal(calls.length, 1, 'second read came from the cache');
  assert.equal((await run(post(rpc('eth_blockNumber')), { ...env, UPSTREAM_RPC_URL: undefined })).body.error.message, 'rpc is not configured');
});

test('geo: blocked countries get view-only, default is empty, header is case-insensitive', async () => {
  const get = (c) => handleGeo(new Request('https://x.example/api/geo', { headers: c ? { 'cf-ipcountry': c } : {} }), { BLOCKED_COUNTRIES: 'xx, yy' }).json();
  assert.deepEqual(await get('XX'), { blocked: true });
  assert.deepEqual(await get('yy'), { blocked: true });
  assert.deepEqual(await get('US'), { blocked: false });
  assert.deepEqual(await get(), { blocked: false });
  assert.deepEqual(await handleGeo(new Request('https://x.example/api/geo', { headers: { 'cf-ipcountry': 'XX' } }), {}).json(), { blocked: false });
});
