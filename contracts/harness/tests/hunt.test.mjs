import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup, expectErr, wallet, START, DELAY, testSecret, claimCommitment, salt } from './common.mjs';

const commit = (env, from, secret, s) => env.chain.must(env.cars, 'commitClaim', [claimCommitment(secret, from, s)], { from });
const reveal = (env, from, index, secret, s) => env.chain.call(env.cars, 'revealClaim', [BigInt(index), secret, s], { from });
const fresh = async () => { const env = await setup(); env.chain.warp(START); return env; };
const status = async (env) => (await env.chain.view(env.cars, 'huntStatus')).result;

describe('hunt (two-step claim). Secrets are TEST-ONLY values.', () => {
  test('happy path: commit, wait, reveal mints a hidden car', async () => {
    const env = await fresh();
    const w = wallet(1);
    await commit(env, w, testSecret(3), salt(1));
    env.chain.advance(DELAY);
    const r = await reveal(env, w, 3, testSecret(3), salt(1));
    assert.equal(r.ok, true, r.error);
    const [claimers, ids] = await status(env);
    assert.equal(claimers[3].toLowerCase(), w.toLowerCase());
    assert.equal(ids[3], 1n);
    assert.equal(claimers[2], '0x0000000000000000000000000000000000000000');
    const d = (await env.chain.view(env.cars, 'carData', [1n])).result;
    assert.equal(d.hidden, true); assert.equal(d.rank, 0); assert.equal(d.serial, 3);
    assert.equal((await env.chain.view(env.cars, 'ownerOf', [1n])).result.toLowerCase(), w.toLowerCase());
  });

  test('wrong secret, wrong index, wrong salt', async () => {
    const env = await fresh();
    const w = wallet(1);
    await commit(env, w, testSecret(3), salt(1));
    env.chain.advance(DELAY);
    expectErr(await reveal(env, w, 4, testSecret(3), salt(1)), 'BadSecret'); // right secret, wrong index
    expectErr(await reveal(env, w, 3, testSecret(4), salt(1)), 'CommitMismatch'); // secret differs from committed
    expectErr(await reveal(env, w, 3, testSecret(3), salt(2)), 'CommitMismatch');
    expectErr(await reveal(env, w, 12, testSecret(3), salt(1)), 'BadIndex');
    // wrong secret committed honestly
    const bogus = '0x' + 'ab'.repeat(32);
    await commit(env, wallet(2), bogus, salt(1));
    env.chain.advance(DELAY);
    expectErr(await reveal(env, wallet(2), 0, bogus, salt(1)), 'BadSecret');
  });

  test('too early, exactly at the delay, and no commit', async () => {
    const env = await fresh();
    const w = wallet(1);
    expectErr(await reveal(env, w, 0, testSecret(0), salt(1)), 'NoCommit');
    await commit(env, w, testSecret(0), salt(1));
    expectErr(await reveal(env, w, 0, testSecret(0), salt(1)), 'RevealTooEarly');
    env.chain.advance(DELAY - 1n);
    expectErr(await reveal(env, w, 0, testSecret(0), salt(1)), 'RevealTooEarly');
    env.chain.advance(1n);
    assert.equal((await reveal(env, w, 0, testSecret(0), salt(1))).ok, true);
  });

  test('another wallet cannot reveal someone else\'s commitment', async () => {
    const env = await fresh();
    await commit(env, wallet(1), testSecret(5), salt(1));
    env.chain.advance(DELAY * 10n);
    expectErr(await reveal(env, wallet(2), 5, testSecret(5), salt(1)), 'NoCommit');
    // even after committing something else
    await commit(env, wallet(2), testSecret(6), salt(9));
    env.chain.advance(DELAY);
    expectErr(await reveal(env, wallet(2), 5, testSecret(5), salt(1)), 'CommitMismatch');
  });

  test('mempool theft simulation: copying a reveal fails', async () => {
    const env = await fresh();
    const victim = wallet(1), thief = wallet(2);
    await commit(env, victim, testSecret(7), salt(1));
    env.chain.advance(DELAY);
    // The thief sees the victim's reveal(7, secret, salt) pending. Case 1: replay it with no commitment.
    expectErr(await reveal(env, thief, 7, testSecret(7), salt(1)), 'NoCommit');
    // Case 2: the thief commits now using the leaked secret, then reveals in the same instant.
    await commit(env, thief, testSecret(7), salt(2));
    expectErr(await reveal(env, thief, 7, testSecret(7), salt(2)), 'RevealTooEarly');
    // The victim's reveal lands first.
    assert.equal((await reveal(env, victim, 7, testSecret(7), salt(1))).ok, true);
    // After the delay the thief is too late.
    env.chain.advance(DELAY);
    expectErr(await reveal(env, thief, 7, testSecret(7), salt(2)), 'AlreadyClaimed');
  });

  test('double claim and two simultaneous finders', async () => {
    const env = await fresh();
    const a = wallet(1), b = wallet(2);
    await commit(env, a, testSecret(2), salt(1));
    await commit(env, b, testSecret(2), salt(1));
    env.chain.advance(DELAY);
    assert.equal((await reveal(env, a, 2, testSecret(2), salt(1))).ok, true);
    expectErr(await reveal(env, b, 2, testSecret(2), salt(1)), 'AlreadyClaimed');
    expectErr(await reveal(env, a, 2, testSecret(2), salt(1)), 'NoCommit'); // commitment was consumed
    // the loser can still claim a different car
    await commit(env, b, testSecret(8), salt(3));
    env.chain.advance(DELAY);
    assert.equal((await reveal(env, b, 8, testSecret(8), salt(3))).ok, true);
  });

  test('a failed reveal keeps the commitment; empty commitment is rejected; recommit restarts the clock', async () => {
    const env = await fresh();
    const w = wallet(1);
    expectErr(await env.chain.call(env.cars, 'commitClaim', ['0x' + '00'.repeat(32)], { from: w }), 'EmptyCommitment');
    await commit(env, w, testSecret(1), salt(1));
    env.chain.advance(DELAY);
    expectErr(await reveal(env, w, 9, testSecret(1), salt(1)), 'BadSecret');
    assert.equal((await reveal(env, w, 1, testSecret(1), salt(1))).ok, true);
    await commit(env, w, testSecret(0), salt(1));
    env.chain.advance(DELAY - 10n);
    await commit(env, w, testSecret(0), salt(1)); // recommit resets the clock
    env.chain.advance(DELAY - 10n);
    expectErr(await reveal(env, w, 0, testSecret(0), salt(1)), 'RevealTooEarly');
  });

  test('hunt cars do not use wallet caps or ladder state, and cannot exceed 12', async () => {
    const env = await fresh();
    const w = wallet(1);
    for (let i = 0; i < 12; i++) {
      await commit(env, w, testSecret(i), salt(i));
      env.chain.advance(DELAY);
      assert.equal((await reveal(env, w, i, testSecret(i), salt(i))).ok, true, `claim ${i}`);
    }
    assert.equal((await env.chain.view(env.cars, 'totalMinted')).result, 12n);
    assert.equal((await env.chain.view(env.cars, 'balanceOf', [w])).result, 12n);
    const l = (await env.chain.view(env.cars, 'ladderState')).result;
    assert.ok(l.every((x) => x.sold === 0));
    expectErr(await reveal(env, w, 12, testSecret(0), salt(0)), 'BadIndex');
  });
});
