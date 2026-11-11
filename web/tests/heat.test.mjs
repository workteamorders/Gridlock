// The site's heat math must equal the contract's. Vectors come from the compiled contract
// (contracts/harness/gen-heat-vectors.mjs), so this test cannot agree with itself by accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heatNow, heatZeroAt, heatAfterTransfer, starsFor } from '../src/lib/heat.ts';

const v = JSON.parse(readFileSync(new URL('./fixtures/heat-vectors.json', import.meta.url), 'utf8'));

test('heat, stars and heat-zero time equal the contract over 630 observations', () => {
  let stored = 0, updatedAt = v.mintedAt, peak = 0, n = 0;
  for (const e of v.events) {
    if (e.type === 'transfer') {
      stored = heatAfterTransfer(stored, updatedAt, e.at, v.decay);
      updatedAt = e.at;
      peak = Math.max(peak, stored);
    } else {
      const h = heatNow(stored, updatedAt, e.at, v.decay);
      assert.equal(h, e.heat, `heat at ${e.at}`);
      assert.equal(starsFor(h), e.stars, `stars at ${e.at}`);
      assert.equal(heatZeroAt(stored, updatedAt, e.at, v.decay), e.heatZeroAt, `heat-zero time at ${e.at}`);
      assert.equal(peak, e.peakHeat, `peak at ${e.at}`);
      n++;
    }
  }
  assert.ok(n >= 500);
});
