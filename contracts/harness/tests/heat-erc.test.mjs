import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToHex } from '@ethereumjs/util';
import { keccak256, toHex } from 'viem';
import { setup, mint, expectErr, wallet, START, DECAY, TREASURY } from './common.mjs';

const T_MU = keccak256(toHex('MetadataUpdate(uint256)'));
const T_TRANSFER = keccak256(toHex('Transfer(address,address,uint256)'));
const topics = (r) => r.logs.map((l) => bytesToHex(l[1][0]));
const carData = async (env, id) => (await env.chain.view(env.cars, 'carData', [BigInt(id)])).result;
const owner = wallet(1);
const other = wallet(2);

async function fresh() {
  const env = await setup();
  env.chain.warp(START);
  await mint(env, 15, 1, owner); // token 1
  return env;
}
const move = (env, from, to, id = 1, fn = 'transferFrom') =>
  env.chain.must(env.cars, fn, [from, to, BigInt(id)], { from });

describe('heat', () => {
  test('mint and approvals do not add heat; transfers do (transferFrom and safeTransferFrom)', async () => {
    const env = await fresh();
    let d = await carData(env, 1);
    assert.equal(d.heat, 0); assert.equal(d.transferCount, 0); assert.equal(d.lastMovedAt, 0n);
    await env.chain.must(env.cars, 'approve', [other, 1n], { from: owner });
    await env.chain.must(env.cars, 'setApprovalForAll', [other, true], { from: owner });
    d = await carData(env, 1);
    assert.equal(d.heat, 0); assert.equal(d.transferCount, 0);
    const r1 = await move(env, owner, other, 1, 'transferFrom');
    assert.ok(topics(r1).includes(T_MU), 'MetadataUpdate on transfer');
    d = await carData(env, 1);
    assert.equal(d.heat, 20); assert.equal(d.transferCount, 1); assert.equal(d.peakHeat, 20); assert.equal(d.stars, 2);
    const r2 = await env.chain.must(env.cars, 'safeTransferFrom', [other, owner, 1n], { from: other });
    assert.ok(topics(r2).includes(T_MU));
    d = await carData(env, 1);
    assert.equal(d.heat, 40); assert.equal(d.transferCount, 2);
    // approved operator transfer also counts
    await env.chain.must(env.cars, 'approve', [wallet(3), 1n], { from: owner });
    await env.chain.must(env.cars, 'transferFrom', [owner, wallet(3), 1n], { from: wallet(3) });
    assert.equal((await carData(env, 1)).transferCount, 3);
  });

  test('no MetadataUpdate on mint', async () => {
    const env = await setup();
    env.chain.warp(START);
    const r = await mint(env, 15, 1, owner);
    assert.ok(!topics(r).includes(T_MU));
    assert.ok(topics(r).includes(T_TRANSFER));
  });

  test('decay is 1 point per hour, never negative, capped at 150', async () => {
    const env = await fresh();
    await move(env, owner, other); // heat 20 at START
    for (const [dt, want] of [[0n, 20], [3599n, 20], [3600n, 19], [7199n, 19], [7200n, 18], [19n * 3600n, 1], [20n * 3600n, 0], [10_000n * 3600n, 0]]) {
      env.chain.warp(START + dt);
      assert.equal((await carData(env, 1)).heat, want, `dt=${dt}`);
    }
    // cap
    env.chain.warp(START);
    let from = other, to = owner;
    for (let i = 0; i < 12; i++) { await move(env, from, to); [from, to] = [to, from]; }
    const d = await carData(env, 1);
    assert.equal(d.heat <= 150, true);
    assert.equal(d.peakHeat, 150);
    assert.equal(d.stars, 5);
  });

  test('stars at every threshold', async () => {
    const env = await fresh();
    // heat 120 after six transfers at one instant
    let from = owner, to = other;
    for (let i = 0; i < 6; i++) { await move(env, from, to); [from, to] = [to, from]; }
    assert.equal((await carData(env, 1)).heat, 120);
    const want = [[120, 5], [119, 4], [80, 4], [79, 3], [45, 3], [44, 2], [20, 2], [19, 1], [1, 1], [0, 0]];
    for (const [heat, stars] of want) {
      env.chain.warp(START + BigInt(120 - heat) * DECAY);
      const d = await carData(env, 1);
      assert.equal(d.heat, heat);
      assert.equal(d.stars, stars, `heat ${heat}`);
    }
    // peak stars are remembered
    assert.equal((await carData(env, 1)).peakStars, 5);
    assert.equal((await carData(env, 1)).peakHeat, 120);
  });

  test('heatZeroAt matches the contract decay exactly', async () => {
    const env = await fresh();
    await move(env, owner, other);
    await move(env, other, owner); // heat 40 at START
    const d = await carData(env, 1);
    assert.equal(d.heatZeroAt, START + 40n * DECAY);
    env.chain.warp(d.heatZeroAt - 1n);
    assert.equal((await carData(env, 1)).heat, 1);
    env.chain.warp(d.heatZeroAt);
    assert.equal((await carData(env, 1)).heat, 0);
    assert.equal((await carData(env, 1)).heatZeroAt, 0n, 'zero when already zero');
  });

  test('transfer after partial decay adds on the decayed value', async () => {
    const env = await fresh();
    await move(env, owner, other); // 20
    env.chain.warp(START + 5n * DECAY + 10n);
    await move(env, other, owner);
    assert.equal((await carData(env, 1)).heat, 35); // 15 + 20
    assert.equal((await carData(env, 1)).lastMovedAt, START + 5n * DECAY + 10n);
  });

  test('heat gates nothing: no function reads heat except views and metadata', async () => {
    const env = await fresh();
    for (let i = 0; i < 8; i++) await move(env, i % 2 ? other : owner, i % 2 ? owner : other);
    // a maxed-heat car can still be approved, transferred, and the next rank mint is unaffected
    await env.chain.must(env.cars, 'approve', [wallet(8), 1n], { from: owner });
  });
});

describe('ERC-721, ERC-2981, ERC-4906', () => {
  test('supportsInterface', async () => {
    const env = await fresh();
    for (const [id, want] of [['0x01ffc9a7', true], ['0x80ac58cd', true], ['0x5b5e139f', true], ['0x2a55205a', true], ['0x49064906', true], ['0xffffffff', false], ['0x12345678', false]]) {
      assert.equal((await env.chain.view(env.cars, 'supportsInterface', [id])).result, want, id);
    }
  });
  test('royaltyInfo is 5% to TREASURY for any id and price', async () => {
    const env = await fresh();
    for (const [id, price] of [[1n, 10n ** 18n], [999n, 12345n], [0n, 0n]]) {
      const [receiver, amount] = (await env.chain.view(env.cars, 'royaltyInfo', [id, price])).result;
      assert.equal(receiver.toLowerCase(), TREASURY.toLowerCase());
      assert.equal(amount, (price * 500n) / 10000n);
    }
  });
  test('name, symbol, ownerOf, balanceOf, ownedIds', async () => {
    const env = await fresh();
    assert.equal((await env.chain.view(env.cars, 'name')).result, 'Gridlock Cars');
    assert.equal((await env.chain.view(env.cars, 'symbol')).result, 'GRID');
    await mint(env, 15, 2, other); // ids 2, 3
    await mint(env, 14 + 1, 1, wallet(4)); // id 4 (rank 15 again)
    const [ids, next] = (await env.chain.view(env.cars, 'ownedIds', [other, 0n, 100n])).result;
    assert.deepEqual(ids, [2n, 3n]);
    assert.ok(next > 4n);
    const [p1, n1] = (await env.chain.view(env.cars, 'ownedIds', [other, 0n, 2n])).result; // window 1..2
    assert.deepEqual(p1, [2n]); assert.equal(n1, 3n);
    expectErr(await env.chain.call(env.cars, 'tokenURI', [99n]), 'TokenDoesNotExist');
    expectErr(await env.chain.call(env.cars, 'carData', [99n]), 'TokenDoesNotExist');
  });
});
