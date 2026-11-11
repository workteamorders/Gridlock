import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup, mint, sellOut, ladder, expectErr, wallet, START, TIMEOUT, DAY, DEFAULT_CAPS, PRICES, TREASURY, testCommitment } from './common.mjs';

const small = { caps: Array(15).fill(3) }; // quick sell-outs for opening-rule tests

describe('constructor validation', () => {
  test('rejects non-monotone, zero and bad inputs', async () => {
    const e = await setup();
    const base = e.params;
    const bad = async (patch, name) => {
      const r = await e.chain.tryDeploy('GridlockCars', [{ ...base, ...patch }]);
      assert.equal(r.ok, false);
      assert.match(r.error, new RegExp(name));
    };
    const p = [...PRICES]; p[3] = PRICES[4] - 1n; // rank 4 cheaper than rank 5
    await bad({ prices: p }, 'InvalidPrices');
    const z = [...PRICES]; z[14] = 0n;
    await bad({ prices: z }, 'InvalidPrices');
    await bad({ caps: DEFAULT_CAPS.map((c, i) => (i === 2 ? 0 : c)) }, 'InvalidCaps');
    await bad({ treasury: '0x0000000000000000000000000000000000000000' }, 'InvalidTreasury');
    await bad({ renderer: wallet(1) }, 'InvalidRenderer');
    await bad({ openTimeout: 0n }, 'InvalidTimes');
    await bad({ heatDecaySeconds: 0n }, 'InvalidTimes');
    await bad({ revealMinDelay: 0n }, 'InvalidTimes');
    const dup = [...base.huntCommitments]; dup[5] = dup[2];
    await bad({ huntCommitments: dup }, 'InvalidHuntCommitments');
    const zero = [...base.huntCommitments]; zero[0] = '0x' + '00'.repeat(32);
    await bad({ huntCommitments: zero }, 'InvalidHuntCommitments');
    // equal adjacent prices are allowed (non-decreasing from rank 15 to rank 1)
    const eq = Array(15).fill(10n ** 15n);
    const ok = await e.chain.tryDeploy('GridlockCars', [{ ...base, prices: eq }]);
    assert.equal(ok.ok, true);
  });
});

describe('opening rule', () => {
  test('rank 15 opens exactly at START_TIME; others locked', async () => {
    const env = await setup();
    env.chain.warp(START - 1n);
    await mint(env, 15, 1, wallet(1), 'NotOpen');
    env.chain.warp(START);
    await mint(env, 15, 1, wallet(1));
    await mint(env, 14, 1, wallet(2), 'NotOpen');
    const l = await ladder(env);
    assert.equal(l[14].isOpen, true);
    assert.equal(l[13].isOpen, false);
    assert.equal(l[13].opensAtLatest, START + TIMEOUT);
    assert.equal(l[12].opensAtLatest, START + 2n * TIMEOUT);
    assert.equal(l[0].opensAtLatest, START + 14n * TIMEOUT);
  });

  test('rank 14 opens on timeout when rank 15 does not sell out (boundaries)', async () => {
    const env = await setup();
    env.chain.warp(START + TIMEOUT - 1n);
    await mint(env, 14, 1, wallet(1), 'NotOpen');
    env.chain.warp(START + TIMEOUT);
    await mint(env, 14, 1, wallet(1));
  });

  test('sell-out faster than timeout opens the next rank at the sell-out time', async () => {
    const env = await setup(small);
    env.chain.warp(START + 100n);
    await sellOut(env, 15);
    const l = await ladder(env);
    assert.equal(l[14].soldOutAt, START + 100n);
    assert.equal(l[13].opensAtLatest, START + 100n);
    assert.equal(l[13].isOpen, true);
    await mint(env, 14, 1, wallet(500));
    // rank 13 opens at min(sold out 14 or openedAt(14) + timeout)
    assert.equal((await ladder(env))[12].opensAtLatest, START + 100n + TIMEOUT);
  });

  test('timeout faster than sell-out: sell-out after the timeout does not move the time later', async () => {
    const env = await setup(small);
    env.chain.warp(START + TIMEOUT + 5n);
    await mint(env, 15, 2, wallet(1));
    await mint(env, 14, 1, wallet(2)); // open by timeout
    env.chain.warp(START + TIMEOUT + 3n * DAY);
    await mint(env, 15, 1, wallet(3)); // sells out rank 15 AFTER openedAt(14)
    const l = await ladder(env);
    assert.equal(l[14].soldOutAt, START + TIMEOUT + 3n * DAY);
    assert.equal(l[13].opensAtLatest, START + TIMEOUT, 'rank 14 time stays at the timeout');
  });

  test('chained ranks: openedAt(k) depends on openedAt(k + 1)', async () => {
    const env = await setup(small);
    env.chain.warp(START + 50n);
    await sellOut(env, 15); // rank 14 opens at START+50
    env.chain.warp(START + 60n);
    await sellOut(env, 14); // rank 13 opens at START+60
    const l = await ladder(env);
    assert.equal(l[12].opensAtLatest, START + 60n);
    assert.equal(l[11].opensAtLatest, START + 60n + TIMEOUT);
    env.chain.warp(START + 60n + TIMEOUT - 1n);
    await mint(env, 12, 1, wallet(900), 'NotOpen');
    env.chain.warp(START + 60n + TIMEOUT);
    await mint(env, 12, 1, wallet(900));
  });

  test('an opened rank stays open until sold out, then reverts SoldOut', async () => {
    const env = await setup(small);
    env.chain.warp(START);
    await sellOut(env, 15);
    env.chain.warp(START + 365n * DAY);
    await mint(env, 15, 1, wallet(77), 'SoldOut');
    const l = await ladder(env);
    assert.equal(l[14].sold, 3);
  });
});

describe('mint rules', () => {
  test('quantity, rank, payment, serial, wallet and supply limits', async () => {
    const env = await setup(small);
    env.chain.warp(START);
    const w = wallet(1);
    const sold = 0n;
    const call = (rank, q, serial, value, from = w) => env.chain.call(env.cars, 'mint', [BigInt(rank), BigInt(q), serial], { from, value });
    const p = PRICES[14];
    expectErr(await call(0, 1, 1n, p), 'BadRank');
    expectErr(await call(16, 1, 1n, p), 'BadRank');
    expectErr(await call(15, 0, 1n, 0n), 'BadQuantity');
    expectErr(await call(15, 3, 1n, 3n * p), 'BadQuantity');
    expectErr(await call(15, 1, 1n, p - 1n), 'WrongPayment');
    expectErr(await call(15, 1, 1n, p + 1n), 'WrongPayment');
    expectErr(await call(15, 2, 1n, p), 'WrongPayment');
    expectErr(await call(15, 1, 2n, p), 'SerialMismatch');
    assert.equal((await call(15, 2, 1n, 2n * p)).ok, true);
    expectErr(await call(15, 1, 3n, p), 'WalletCapReached');
    expectErr(await call(15, 2, 3n, 2n * p, wallet(2)), 'NotEnoughLeft');
    assert.equal((await call(15, 1, 3n, p, wallet(2))).ok, true);
    expectErr(await call(15, 1, 4n, p, wallet(3)), 'SoldOut');
    // ranks 5..1 allow one per wallet
    env.chain.warp(START + 14n * TIMEOUT);
    const p5 = PRICES[4];
    assert.equal((await call(5, 1, 1n, p5, wallet(9))).ok, true);
    expectErr(await call(5, 1, 2n, p5, wallet(9)), 'WalletCapReached');
    expectErr(await call(5, 2, 2n, 2n * p5, wallet(10)), 'WalletCapReached');
    assert.equal((await call(6, 2, 1n, PRICES[5] * 2n, wallet(9))).ok, true);
  });

  test('ETH accounting: balance equals payments, withdraw only to TREASURY, zero afterwards', async () => {
    const env = await setup(small);
    env.chain.warp(START);
    await mint(env, 15, 2, wallet(1));
    await mint(env, 15, 1, wallet(2));
    assert.equal(await env.chain.balance(env.cars.address), env.paid);
    const before = await env.chain.balance(TREASURY);
    const r = await env.chain.must(env.cars, 'withdraw', [], { from: wallet(99) }); // anyone may call
    assert.equal(await env.chain.balance(env.cars.address), 0n);
    assert.equal((await env.chain.balance(TREASURY)) - before, env.paid);
    assert.equal(await env.chain.balance(wallet(99)) >= 0n, true);
    await env.chain.must(env.cars, 'withdraw', [], { from: wallet(98) }); // second call is a no-op
    // no receive or fallback: plain ETH is rejected
    const raw = await env.chain.vm.evm.runCall({
      caller: (await import('@ethereumjs/util')).createAddressFromString(wallet(5)),
      to: (await import('@ethereumjs/util')).createAddressFromString(env.cars.address), value: 1n, gasLimit: 1_000_000n, block: env.chain.block(),
    });
    assert.ok(raw.execResult.exceptionError, 'plain ETH transfer must revert');
  });

  test('previewNext matches the card that is minted', async () => {
    const env = await setup();
    env.chain.warp(START);
    await mint(env, 15, 2, wallet(1));
    const pv = (await env.chain.view(env.cars, 'previewNext', [15n])).result;
    assert.equal(pv[0], 3n);
    await mint(env, 15, 1, wallet(2));
    const uri = (await env.chain.view(env.cars, 'tokenURI', [3n])).result;
    const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
    const img = Buffer.from(json.image.split(',')[1], 'base64').toString();
    assert.equal(img, pv[1], 'minted image equals previewed image at heat 0');
  });
});
