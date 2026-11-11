import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chain } from '../evm.mjs';
import { deployFromConfig } from '../deploy-local.mjs';
import { testCommitment } from './common.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gen = join(here, '..', '..', 'scripts', 'gen-hunt.mjs');

test('gen-hunt (test mode) writes commitments equal to the labeled test secrets', () => {
  const out = mkdtempSync(join(tmpdir(), 'gh-'));
  execFileSync('node', [gen, '--test', '--out', out]);
  const c = JSON.parse(readFileSync(join(out, 'hunt-commitments.json'), 'utf8'));
  assert.equal(c.mode, 'TEST-ONLY');
  assert.deepEqual(c.huntCommitments, Array.from({ length: 12 }, (_, i) => testCommitment(i)));
  assert.equal(execFileSync('node', [gen, '--check', out]).toString().trim().startsWith('OK'), true);
});

test('gen-hunt refuses to write into a git repository in production mode and does not create the directory', () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'));
  mkdirSync(join(repo, '.git'));
  const target = join(repo, 'hunt-out');
  const r = spawnSync('node', [gen, '--out', target]);
  assert.equal(r.status, 2);
  assert.match(r.stderr.toString(), /Refusing/);
  assert.equal(existsSync(target), false);
});

test('gen-hunt --check detects a mismatch', () => {
  const out = mkdtempSync(join(tmpdir(), 'gh-'));
  execFileSync('node', [gen, '--test', '--out', out]);
  const f = join(out, 'hunt-commitments.json');
  const j = JSON.parse(readFileSync(f, 'utf8'));
  j.huntCommitments[3] = j.huntCommitments[4];
  writeFileSync(f, JSON.stringify(j));
  assert.equal(spawnSync('node', [gen, '--check', out]).status, 1);
});

test('deploy/anvil.json deploys in the harness and the ladder matches the spec', async () => {
  const chain = await Chain.create(1_700_000_000n);
  const { cars, start } = await deployFromConfig(join(here, '..', '..', 'deploy', 'anvil.json'), chain);
  const l = (await chain.view(cars, 'ladderState')).result;
  assert.equal(l.reduce((a, r) => a + r.cap, 0), 2475);
  assert.equal(l[14].opensAtLatest, start);
  assert.ok(l.every((r, i) => i === 14 || r.price >= l[i + 1].price));
  assert.deepEqual((await chain.view(cars, 'huntCommitments')).result, Array.from({ length: 12 }, (_, i) => testCommitment(i)));
});
