import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildVercelOutput, buildRoutes, parseHeadersFile } from '../scripts/vercel-output.mjs';

const HEADERS = [
  '/*',
  "  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-AAA='",
  '  X-Frame-Options: DENY',
  '',
  '/_next/static/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  '/deployments/*',
  '  Cache-Control: no-cache',
  '',
].join('\n');

let root, out, dest, rpc, geo;
const realEnv = { ...process.env };

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'vercel-out-'));
  out = join(root, 'out');
  dest = join(root, 'output');
  mkdirSync(join(out, 'risk'), { recursive: true });
  writeFileSync(join(out, 'index.html'), '<html></html>');
  writeFileSync(join(out, '404.html'), '<html>404</html>');
  writeFileSync(join(out, 'risk', 'index.html'), '<html>risk</html>');
  writeFileSync(join(out, '_headers'), HEADERS);
  buildVercelOutput({ outDir: out, destDir: dest });
  // The generated file is a plain ES module. Node needs a .mjs name to load it from a temporary folder.
  const load = async (name) => {
    const target = join(root, `${name}.mjs`);
    copyFileSync(join(dest, 'functions', 'api', `${name}.func`, 'index.js'), target);
    return (await import(pathToFileURL(target).href)).default;
  };
  rpc = await load('rpc');
  geo = await load('geo');
});

after(() => {
  process.env = realEnv;
  rmSync(root, { recursive: true, force: true });
});

test('headers file is parsed into blocks', () => {
  const blocks = parseHeadersFile(HEADERS);
  assert.deepEqual(blocks.map((b) => b.pattern), ['/*', '/_next/static/*', '/deployments/*']);
  assert.equal(blocks[0].headers['X-Frame-Options'], 'DENY');
  assert.match(blocks[0].headers['Content-Security-Policy'], /sha256-AAA=/);
});

test('output layout: static copy without _headers, two edge functions, config version 3', () => {
  assert.ok(existsSync(join(dest, 'static', 'index.html')));
  assert.ok(existsSync(join(dest, 'static', 'risk', 'index.html')));
  assert.equal(existsSync(join(dest, 'static', '_headers')), false);
  for (const n of ['rpc', 'geo']) {
    const cfg = JSON.parse(readFileSync(join(dest, 'functions', 'api', `${n}.func`, '.vc-config.json'), 'utf8'));
    assert.deepEqual(cfg, { runtime: 'edge', entrypoint: 'index.js' });
  }
  assert.equal(JSON.parse(readFileSync(join(dest, 'config.json'), 'utf8')).version, 3);
});

test('routes: security headers on every path first, then folder index, filesystem, redirect, 404', () => {
  const routes = JSON.parse(readFileSync(join(dest, 'config.json'), 'utf8')).routes;
  assert.equal(routes[0].src, '^/.*$');
  assert.equal(routes[0].continue, true);
  assert.equal(routes[0].headers['X-Frame-Options'], 'DENY');
  const idx = (pred) => routes.findIndex(pred);
  const fs = idx((r) => r.handle === 'filesystem');
  const miss = idx((r) => r.handle === 'miss');
  const err = idx((r) => r.handle === 'error');
  assert.ok(0 < fs && fs < miss && miss < err, 'phases are in order');
  assert.ok(routes.slice(0, fs).every((r) => r.continue || r.dest), 'before the filesystem only header and rewrite rules');
  // Header rules all come before any rewrite, otherwise a rewrite would stop them from running.
  const firstRewrite = idx((r) => r.dest);
  assert.ok(routes.slice(0, firstRewrite).every((r) => r.continue === true));
  const re = (route, path) => new RegExp(route.src).test(path);
  const redirect = routes[miss + 1];
  assert.equal(redirect.status, 308);
  assert.equal(re(redirect, '/risk'), true);
  assert.equal(re(redirect, '/hunt/claim'), true);
  assert.equal(re(redirect, '/api/rpc'), false, 'the API is never redirected');
  assert.equal(re(redirect, '/logo.png'), false, 'files with an extension are never redirected');
  assert.equal(re(redirect, '/risk/'), false);
  const notFound = routes[err + 1];
  assert.equal(notFound.dest, '/404.html');
  assert.equal(re(notFound, '/api/nothing'), false);
});

test('the build refuses to run without a CSP', () => {
  const bad = join(root, 'bad');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'index.html'), 'x');
  writeFileSync(join(bad, '_headers'), '/*\n  X-Frame-Options: DENY\n');
  assert.throws(() => buildVercelOutput({ outDir: bad, destDir: join(root, 'bad-out') }), /Content-Security-Policy/);
  const none = join(root, 'none');
  mkdirSync(none, { recursive: true });
  assert.throws(() => buildVercelOutput({ outDir: none, destDir: join(root, 'none-out') }), /_headers is missing/);
});

test('geo function reads the Vercel country header and ignores the Cloudflare one', async () => {
  process.env.BLOCKED_COUNTRIES = 'XX, YY';
  const ask = async (headers) => (await geo(new Request('https://x.test/api/geo', { headers }))).json();
  assert.deepEqual(await ask({ 'x-vercel-ip-country': 'XX' }), { blocked: true });
  assert.deepEqual(await ask({ 'x-vercel-ip-country': 'DE' }), { blocked: false });
  assert.deepEqual(await ask({}), { blocked: false });
  assert.deepEqual(await ask({ 'cf-ipcountry': 'XX' }), { blocked: false }, 'a visitor-sent Cloudflare header changes nothing');
  delete process.env.BLOCKED_COUNTRIES;
});

const CARS = '0x' + 'ab'.repeat(20);
const post = (body, headers = {}) => new Request('https://gridlock.example/api/rpc', {
  method: 'POST', headers: { origin: 'https://gridlock.example', ...headers }, body: JSON.stringify(body),
});
const rpcCall = (method, params = [], id = 1) => ({ jsonrpc: '2.0', id, method, params });

test('rpc function forwards an allowed read, hides the key, rejects a write, caches a hot read', async () => {
  Object.assign(process.env, { UPSTREAM_RPC_URL: 'https://upstream.invalid/SECRET_KEY', CONTRACT_ADDRESSES: CARS, RATE_LIMIT_PER_MIN: '1000' });
  const upstream = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { upstream.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x2a' })); };
  try {
    const first = await (await rpc(post(rpcCall('eth_blockNumber'), { 'x-real-ip': '9.9.9.1' }))).json();
    assert.equal(first.result, '0x2a');
    assert.ok(!JSON.stringify(first).includes('SECRET_KEY'));
    assert.equal(upstream.length, 1);
    assert.equal(upstream[0].url, 'https://upstream.invalid/SECRET_KEY');

    const again = await (await rpc(post(rpcCall('eth_blockNumber', [], 2), { 'x-real-ip': '9.9.9.1' }))).json();
    assert.equal(again.result, '0x2a');
    assert.equal(again.id, 2);
    assert.equal(upstream.length, 1, 'second identical read comes from the in-memory cache');

    const write = await (await rpc(post(rpcCall('eth_sendRawTransaction', ['0x00']), { 'x-real-ip': '9.9.9.1' }))).json();
    assert.match(write.error.message, /not allowed/);
    assert.equal(upstream.length, 1, 'a write is never forwarded');

    const foreign = await (await rpc(new Request('https://gridlock.example/api/rpc', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify(rpcCall('eth_chainId')) }))).json();
    assert.match(foreign.error.message, /origin not allowed/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('rpc rate limit counts by the Vercel address and cannot be dodged with a Cloudflare header', async () => {
  Object.assign(process.env, { UPSTREAM_RPC_URL: 'https://upstream.invalid/k', CONTRACT_ADDRESSES: CARS, RATE_LIMIT_PER_MIN: '3', CACHE_SECONDS: '0' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }));
  try {
    const statuses = [];
    // The same visitor changes the Cloudflare header on every request. If that header counted, none would be limited.
    for (let i = 0; i < 5; i += 1) statuses.push((await rpc(post(rpcCall('eth_chainId'), { 'x-real-ip': '7.7.7.7', 'cf-connecting-ip': `1.1.1.${i}` }))).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    // Another visitor is unaffected.
    assert.equal((await rpc(post(rpcCall('eth_chainId'), { 'x-real-ip': '8.8.8.8' }))).status, 200);
    // Without x-real-ip the first x-forwarded-for entry is used.
    const viaForwarded = [];
    for (let i = 0; i < 4; i += 1) viaForwarded.push((await rpc(post(rpcCall('eth_chainId'), { 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }))).status);
    assert.deepEqual(viaForwarded, [200, 200, 200, 429]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('buildRoutes does not mutate header values', () => {
  const blocks = parseHeadersFile(HEADERS);
  const before = JSON.stringify(blocks);
  buildRoutes(blocks);
  assert.equal(JSON.stringify(blocks), before);
});
