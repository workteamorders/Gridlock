// Seeded randomized sequence test. Predicts every mint outcome from an independent JS model and checks invariants after each step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, wallet, walletCap, START, TIMEOUT, DAY, DECAY, DELAY, PRICES, TREASURY, testSecret, claimCommitment, salt } from './common.mjs';

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

for (const seed of [1, 2, 3, 4, 5, 6]) {
  test(`random operations keep every invariant (seed ${seed})`, { timeout: 600000 }, async () => {
    const R = rng(seed);
    const pick = (n) => Math.floor(R() * n);
    const CAP = 3;
    const env = await setup({ caps: Array(15).fill(CAP) });
    const { chain, cars } = env;
    chain.warp(START - 10n);
    const actors = Array.from({ length: 6 }, (_, i) => wallet(i + 1));
    // model
    const sold = Array(16).fill(0), soldOutAt = Array(16).fill(0n);
    const minted = new Map(); // `${addr}:${rank}` -> n
    const tokens = []; // {id, owner, rank, serial, heat, upd, transfers, peak}
    const claimed = new Set();
    const commits = new Map();
    let paid = 0n, withdrawn = 0n;
    const heatNow = (t) => { const d = (chain.now - t.upd) / DECAY; return t.heat > d ? t.heat - d : 0n; };
    const openedAt = (rank) => { let t = START; for (let r = 15; r > rank; r--) { const dl = t + TIMEOUT; t = soldOutAt[r] !== 0n && soldOutAt[r] < dl ? soldOutAt[r] : dl; } return t; };

    for (let step = 0; step < 220; step++) {
      const op = pick(10);
      chain.advance(BigInt(pick(4)) * (R() < 0.5 ? DAY : 600n) + BigInt(pick(3)));
      const who = actors[pick(actors.length)];
      if (op <= 4) { // mint
        const rank = R() < 0.6 ? 15 - pick(Math.min(15, 1 + Math.floor(step / 20))) : 1 + pick(15);
        const qty = 1 + pick(2);
        const nextSerial = sold[rank] + 1;
        const key = `${who}:${rank}`;
        const predicted = chain.now >= openedAt(rank) && sold[rank] + qty <= CAP && (minted.get(key) ?? 0) + qty <= walletCap(rank);
        const value = PRICES[rank - 1] * BigInt(qty);
        const r = await chain.call(cars, 'mint', [BigInt(rank), BigInt(qty), BigInt(nextSerial)], { from: who, value });
        assert.equal(r.ok, predicted, `step ${step} mint rank ${rank} qty ${qty}: ${r.error}`);
        if (r.ok) {
          paid += value;
          for (let k = 0; k < qty; k++) { sold[rank]++; tokens.push({ id: tokens.length + 1, owner: who, rank, serial: sold[rank], heat: 0n, upd: chain.now, transfers: 0, peak: 0n }); }
          minted.set(key, (minted.get(key) ?? 0) + qty);
          if (sold[rank] === CAP) soldOutAt[rank] = chain.now;
        }
      } else if (op <= 7 && tokens.length) { // transfer
        const t = tokens[pick(tokens.length)];
        const to = actors[pick(actors.length)];
        const r = await chain.call(cars, 'transferFrom', [t.owner, to, BigInt(t.id)], { from: t.owner });
        assert.equal(r.ok, true, `transfer: ${r.error}`);
        const h = heatNow(t) + 20n;
        t.heat = h > 150n ? 150n : h; t.upd = chain.now; t.transfers++; if (t.heat > t.peak) t.peak = t.heat; t.owner = to;
      } else if (op === 8) { // hunt commit or reveal
        const idx = pick(12);
        const c = commits.get(who);
        if (c && R() < 0.7) {
          const ok = chain.now >= c.at + DELAY && !claimed.has(c.idx);
          const r = await chain.call(cars, 'revealClaim', [BigInt(c.idx), testSecret(c.idx), salt(c.s)], { from: who });
          assert.equal(r.ok, ok, `reveal ${c.idx}: ${r.error}`);
          if (r.ok) { claimed.add(c.idx); commits.delete(who); tokens.push({ id: tokens.length + 1, owner: who, rank: 0, serial: c.idx, heat: 0n, upd: chain.now, transfers: 0, peak: 0n }); }
        } else {
          const s = pick(1000);
          await chain.must(cars, 'commitClaim', [claimCommitment(testSecret(idx), who, salt(s))], { from: who });
          commits.set(who, { idx, s, at: chain.now });
        }
      } else { // withdraw
        const bal = await chain.balance(cars.address);
        await chain.must(cars, 'withdraw', [], { from: who });
        withdrawn += bal;
      }

      // invariants
      const l = (await chain.view(cars, 'ladderState')).result;
      let totalSold = 0;
      for (let rank = 1; rank <= 15; rank++) {
        const x = l[rank - 1];
        assert.equal(x.sold, sold[rank]); assert.ok(x.sold <= x.cap);
        assert.equal(x.soldOutAt, soldOutAt[rank]);
        assert.equal(x.opensAtLatest, openedAt(rank), `opensAtLatest rank ${rank}`);
        assert.equal(x.isOpen, chain.now >= openedAt(rank));
        assert.equal(x.openedAt, x.isOpen ? openedAt(rank) : 0n);
        assert.equal(x.soldOutAt !== 0n, x.sold === x.cap);
        totalSold += x.sold;
      }
      assert.equal((await chain.view(cars, 'totalMinted')).result, BigInt(tokens.length));
      assert.equal(tokens.length, totalSold + claimed.size);
      const bal = await chain.balance(cars.address);
      assert.equal(bal + withdrawn, paid, 'balance + withdrawn == payments');
      if (step % 11 === 0 || step === 219) {
        for (const t of tokens) {
          const d = (await chain.view(cars, 'carData', [BigInt(t.id)])).result;
          assert.equal(BigInt(d.heat), heatNow(t), `heat token ${t.id}`);
          assert.ok(d.heat <= 150);
          assert.equal(d.transferCount, t.transfers);
          assert.equal(BigInt(d.peakHeat), t.peak);
          assert.equal(d.rank, t.rank); assert.equal(d.serial, t.serial); assert.equal(d.hidden, t.rank === 0);
          assert.equal((await chain.view(cars, 'ownerOf', [BigInt(t.id)])).result.toLowerCase(), t.owner.toLowerCase());
        }
        for (const a of actors) {
          assert.equal((await chain.view(cars, 'balanceOf', [a])).result, BigInt(tokens.filter((t) => t.owner === a).length));
        }
      }
    }
  });
}
