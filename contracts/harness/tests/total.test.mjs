import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, mint, sellOut, expectErr, wallet, START, TREASURY, DEFAULT_CAPS, PRICES, testSecret, claimCommitment, salt, DELAY, ladder } from './common.mjs';

test('full ladder sells out to exactly 2,475, hunt adds 12, maximum is 2,487', { timeout: 600000 }, async () => {
  const env = await setup();
  env.chain.warp(START);
  let total = 0;
  for (let rank = 15; rank >= 1; rank--) {
    total += await sellOut(env, rank);
    const cap = DEFAULT_CAPS[rank - 1];
    assert.equal((await env.chain.view(env.cars, 'soldOf', [BigInt(rank)])).result, BigInt(cap));
    await mint(env, rank, 1, wallet(9_999_999), 'SoldOut');
    env.chain.advance(1n);
  }
  assert.equal(DEFAULT_CAPS.reduce((a, b) => a + b, 0), 2475);
  assert.equal(total, 2475);
  assert.equal((await env.chain.view(env.cars, 'totalMinted')).result, 2475n);
  for (let i = 0; i < 12; i++) {
    const w = wallet(8_000_000 + i);
    await env.chain.must(env.cars, 'commitClaim', [claimCommitment(testSecret(i), w, salt(i))], { from: w });
    env.chain.advance(DELAY);
    await env.chain.must(env.cars, 'revealClaim', [BigInt(i), testSecret(i), salt(i)], { from: w });
  }
  assert.equal((await env.chain.view(env.cars, 'totalMinted')).result, 2487n);
  assert.equal((await env.chain.view(env.cars, 'totalSupply')).result, 2487n);
  // no further car can exist
  const w = wallet(8_100_000);
  expectErr(await env.chain.call(env.cars, 'revealClaim', [0n, testSecret(0), salt(0)], { from: w }), 'NoCommit');
  const l = await ladder(env);
  assert.ok(l.every((r, i) => r.sold === DEFAULT_CAPS[i] && r.soldOutAt > 0n));
  // ETH: contract holds exactly the payments, withdraw empties it to TREASURY only
  assert.equal(await env.chain.balance(env.cars.address), env.paid);
  const expectedRevenue = DEFAULT_CAPS.reduce((a, c, i) => a + BigInt(c) * PRICES[i], 0n);
  assert.equal(env.paid, expectedRevenue);
  const before = await env.chain.balance(TREASURY);
  await env.chain.must(env.cars, 'withdraw', [], { from: wallet(1) });
  assert.equal(await env.chain.balance(env.cars.address), 0n);
  assert.equal((await env.chain.balance(TREASURY)) - before, expectedRevenue);
});
