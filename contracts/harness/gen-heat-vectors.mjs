// Produces heat vectors straight from the compiled contract, for the site's heat test (web/tests/heat.test.mjs).
// Run: node gen-heat-vectors.mjs ../../web/tests/fixtures/heat-vectors.json   (after node compile.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { setup, mint, wallet, START, DECAY } from './tests/common.mjs';

const out = process.argv[2];
if (!out) { console.error('usage: node gen-heat-vectors.mjs <out.json>'); process.exit(1); }

let seed = 123456789;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

const env = await setup();
env.chain.warp(START);
const a = wallet(1), b = wallet(2);
await mint(env, 15, 1, a);
const read = async () => (await env.chain.view(env.cars, 'carData', [1n])).result;

const events = [];
let t = Number(START);
let holder = a;
const decay = Number(DECAY);
for (let step = 0; step < 90; step++) {
  const kind = rnd(3);
  const gap = kind === 0 ? 0 : kind === 1 ? rnd(decay * 3) : rnd(decay * 40);
  t += gap;
  env.chain.warp(t);
  const to = holder === a ? b : a;
  await env.chain.must(env.cars, 'transferFrom', [holder, to, 1n], { from: holder });
  holder = to;
  events.push({ type: 'transfer', at: t });
  for (const off of [0, 1, decay - 1, decay, 2 * decay + 7, rnd(decay * 200)]) {
    env.chain.warp(t + off);
    const d = await read();
    events.push({ type: 'observe', at: t + off, heat: Number(d.heat), stars: Number(d.stars), heatZeroAt: Number(d.heatZeroAt), peakHeat: Number(d.peakHeat) });
  }
  t = Number(env.chain.now);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ decay, mintedAt: Number(START), events }, null, 1));
console.log(`wrote ${events.length} events to ${out}`);
