import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGeo } from '../functions/_lib/geo-core.ts';

const call = (country, env) => handleGeo(new Request('https://x.test/api/geo', { headers: country ? { 'cf-ipcountry': country } : {} }), env).json();

test('default blocklist is empty: nobody is view-only', async () => {
  assert.deepEqual(await call('US', {}), { blocked: false });
  assert.deepEqual(await call(undefined, {}), { blocked: false });
});
test('listed countries are view-only, case and spaces ignored', async () => {
  assert.deepEqual(await call('kp', { BLOCKED_COUNTRIES: ' KP , ir ' }), { blocked: true });
  assert.deepEqual(await call('IR', { BLOCKED_COUNTRIES: 'KP,IR' }), { blocked: true });
  assert.deepEqual(await call('DE', { BLOCKED_COUNTRIES: 'KP,IR' }), { blocked: false });
});
test('missing country header never blocks', async () => {
  assert.deepEqual(await call(undefined, { BLOCKED_COUNTRIES: 'KP' }), { blocked: false });
});
test('response is never cached', async () => {
  const r = handleGeo(new Request('https://x.test/api/geo'), {});
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
