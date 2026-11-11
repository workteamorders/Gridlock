import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeArt } from '../scripts/make-art.mjs';
import { frameGovernor } from '../src/components/fx/governor.ts';

test('art generation is deterministic and checked-in files match', () => {
  const path = mkdtempSync(join(tmpdir(), 'gridlock-art-'));
  const target = pathToFileURL(path + '/');
  const source = new URL('../', import.meta.url);
  const hash = (root, name) => createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex');
  try {
    makeArt(target);
    const files = ['src/art/cars.ts', 'public/icon.svg', ...readdirSync(new URL('public/art/', target)).map((file) => 'public/art/' + file)];
    const expected = files.map((file) => hash(target, file));
    assert.deepEqual(expected, files.map((file) => hash(source, file)));
    makeArt(target);
    assert.deepEqual(files.map((file) => hash(target, file)), expected);
    const cars = readFileSync(new URL('public/art/cars.svg', target), 'utf8');
    assert.equal([...cars.matchAll(/<g transform=/g)].length, 6 * 8 * 4);
  } finally { rmSync(path, { recursive: true, force: true }); }
});

const sample = (g, ms, count) => {
  let result;
  for (let i = 0; i < count; i++) result = g.sample(ms);
  return result;
};

test('governor drops load after sustained slow frames and stops below 30 fps', () => {
  const g = frameGovernor(36);
  assert.equal(sample(g, 16, 125), 36);
  assert.equal(sample(g, 25, 79), 36);
  assert.equal(g.sample(25), 25);
  assert.equal(sample(g, 40, 50), 17);
  assert.equal(sample(g, 40, 50), 0);
});

test('paused time and isolated slow windows do not stop traffic', () => {
  const g = frameGovernor(14);
  assert.equal(sample(g, 40, 49), 14);
  g.pause();
  assert.equal(sample(g, 40, 50), 9);
  assert.equal(sample(g, 16, 125), 9);
  assert.equal(sample(g, 40, 50), 6);
});
