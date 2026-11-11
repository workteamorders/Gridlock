import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chain } from '../evm.mjs';
import { DEFAULT_CAPS, setup, mint, wallet, START } from './common.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(here, '..', 'golden');
const input = (rank, serial, heat = 0, transferCount = 0, peakHeat = 0, mintedAt = 0) => ({ rank, serial, heat, transferCount, peakHeat, mintedAt });
const sha = (s) => createHash('sha256').update(s).digest('hex');

const chain = await Chain.create();
const renderer = await chain.deploy('GridlockRenderer');
const svg = async (inp) => (await chain.view(renderer, 'svg', [inp])).result;
const uri = async (id, inp) => chain.view(renderer, 'tokenURI', [BigInt(id), inp]);

const FORBIDDEN = [/<script/i, /<style/i, /<pattern/i, /<clipPath/i, /<filter/i, /<image/i, /<foreignObject/i, /<text/i, /<use/i, /<animate/i, /<set\b/i, /href/i, /https?:/i, /url\(/i, /javascript/i, /\bon[a-z]+=/i, /@import/i, /<!\[CDATA/i, /&/];

function checkSvg(s) {
  assert.match(s, /^[\x20-\x7e]+$/, 'only printable ASCII');
  assert.ok(!s.includes('"'), 'attributes use single quotes only');
  // The xmlns attribute is a namespace name, not a reference that is fetched. Everything else must be free of URLs.
  const body = s.replace("xmlns='http://www.w3.org/2000/svg'", '');
  for (const re of FORBIDDEN) assert.ok(!re.test(body), `forbidden: ${re}`);
  assert.ok(s.startsWith("<svg xmlns='http://www.w3.org/2000/svg'"), 'standalone svg root');
  // tag balance
  const stack = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, , self] = m;
    if (self) continue;
    if (close) assert.equal(stack.pop(), tag, `unbalanced </${tag}>`);
    else stack.push(tag);
  }
  assert.equal(stack.length, 0, 'all tags closed');
}

test('SVG is safe, standalone and well formed across a sample of cards', async () => {
  const samples = [];
  for (let rank = 0; rank <= 15; rank++) for (const serial of rank === 0 ? [0, 5, 11] : [1, 2, DEFAULT_CAPS[rank - 1]]) for (const heat of [0, 20, 150]) samples.push(input(rank, serial, heat, heat * 7, heat));
  samples.push(input(10, 9, 120, 4_000_000_000, 150, 2 ** 40));
  for (const s of samples) checkSvg(await svg(s));
  if (process.env.XML_CHECK !== '0') {
    try {
      mkdirSync('/tmp/gl-xml', { recursive: true });
      writeFileSync('/tmp/gl-xml/s.svg', await svg(input(15, 1)));
      execFileSync('xmllint', ['--noout', '/tmp/gl-xml/s.svg']);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
});

test('deterministic, and different cards give different images', async () => {
  assert.equal(await svg(input(12, 7)), await svg(input(12, 7)));
  assert.notEqual(await svg(input(12, 7)), await svg(input(12, 8)));
  assert.notEqual(await svg(input(12, 7)), await svg(input(11, 7)));
  assert.notEqual(await svg(input(0, 3)), await svg(input(0, 4)));
  assert.notEqual(await svg(input(12, 7, 0)), await svg(input(12, 7, 20)));
  assert.notEqual(await svg(input(12, 7, 20, 1, 20)), await svg(input(12, 7, 20, 2, 20)));
  assert.equal(await svg(input(12, 7, 0, 0, 0, 111)), await svg(input(12, 7, 0, 0, 0, 999)), 'mintedAt is metadata only, so previewNext matches the minted card');
});

test('metadata JSON: fields, attributes, image data URI', async () => {
  const r = await uri(42, input(9, 33, 80, 5, 120, 1_700_000_000));
  assert.ok(r.result.startsWith('data:application/json;base64,'));
  const json = JSON.parse(Buffer.from(r.result.split(',')[1], 'base64').toString());
  assert.equal(json.name, 'Gridlock #42');
  assert.match(json.description, /Heat/);
  assert.match(json.description, /cached/);
  const a = Object.fromEntries(json.attributes.map((x) => [x.trait_type, x.value]));
  assert.deepEqual(a, { rank: 9, serial: 33, hidden: 'No', heat_stars: 4, transfers: 5, peak_stars: 5, minted_at: 1_700_000_000 });
  assert.ok(json.image.startsWith('data:image/svg+xml;base64,'));
  checkSvg(Buffer.from(json.image.split(',')[1], 'base64').toString());
  const h = JSON.parse(Buffer.from((await uri(7, input(0, 4))).result.split(',')[1], 'base64').toString());
  assert.equal(h.attributes.find((x) => x.trait_type === 'hidden').value, 'Yes');
});

test('star count in the image equals heat stars', async () => {
  for (const [heat, stars] of [[0, 0], [1, 1], [20, 2], [45, 3], [80, 4], [120, 5], [150, 5]]) {
    for (const rank of [15, 7, 1, 0]) {
      const s = await svg(input(rank, rank === 0 ? 2 : 3, heat, 0, 0));
      const filled = [...s.matchAll(/<polygon transform='translate\(\d+ 0\)' points='10,0[^']*' fill='([^']*)'/g)].filter((m) => m[1] !== 'none').length;
      assert.equal(filled, stars, `rank ${rank} heat ${heat}`);
    }
  }
});

test('tokenURI gas stays under 3,000,000 (worst cases included)', async () => {
  let max = 0n, which = '';
  const cases = [];
  for (let rank = 0; rank <= 15; rank++) cases.push(input(rank, rank === 0 ? 11 : DEFAULT_CAPS[rank - 1], 150, 99999, 150, 2 ** 40));
  cases.push(input(15, 400, 150, 4_294_967_295, 150, 2 ** 47));
  for (const c of cases) {
    const r = await uri(2487, c);
    if (r.gasUsed > max) { max = r.gasUsed; which = JSON.stringify(c); }
  }
  console.log(`# tokenURI max gas ${max} for ${which}`);
  assert.ok(max < 3_000_000n, `gas ${max}`);
  // Through the cars contract after real transfers
  const env = await setup();
  env.chain.warp(START);
  await mint(env, 15, 1, wallet(1));
  const r = await env.chain.view(env.cars, 'tokenURI', [1n]);
  console.log(`# cars.tokenURI gas ${r.gasUsed}`);
  assert.ok(r.gasUsed < 3_000_000n);
});

test('unique images over every rank and serial (reported, not assumed)', { timeout: 900000 }, async () => {
  const seen = new Map();
  let n = 0, maxBytes = 0;
  for (let rank = 1; rank <= 15; rank++) {
    for (let serial = 1; serial <= DEFAULT_CAPS[rank - 1]; serial++) {
      const s = await svg(input(rank, serial));
      maxBytes = Math.max(maxBytes, s.length);
      seen.set(sha(s), (seen.get(sha(s)) ?? 0) + 1); n++;
    }
  }
  for (let i = 0; i < 12; i++) { const s = await svg(input(0, i)); seen.set(sha(s), (seen.get(sha(s)) ?? 0) + 1); n++; }
  console.log(`# images rendered ${n}, unique ${seen.size}, largest svg ${maxBytes} bytes`);
  assert.equal(n, 2487);
  assert.equal(seen.size, n, 'every card renders a different image');
});

test('golden images: per rank, per star count, hidden', async () => {
  mkdirSync(goldenDir, { recursive: true });
  const file = join(goldenDir, 'golden.json');
  const cases = {};
  for (const rank of [15, 10, 6, 5, 1]) cases[`rank-${rank}`] = input(rank, 1);
  for (const [heat, stars] of [[0, 0], [1, 1], [20, 2], [45, 3], [80, 4], [120, 5]]) cases[`stars-${stars}`] = input(8, 14, heat, stars, heat);
  cases['hidden-0'] = input(0, 0); cases['hidden-11'] = input(0, 11, 120, 4, 120);
  const got = {};
  for (const [k, v] of Object.entries(cases)) {
    const s = await svg(v);
    got[k] = sha(s);
    writeFileSync(join(goldenDir, `${k}.svg`), s);
  }
  if (!existsSync(file) || process.env.UPDATE_GOLDEN === '1') { writeFileSync(file, JSON.stringify(got, null, 1)); console.log('# golden written'); return; }
  assert.deepEqual(got, JSON.parse(readFileSync(file, 'utf8')));
});
