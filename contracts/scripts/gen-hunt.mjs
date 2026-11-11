#!/usr/bin/env node
// scripts/gen-hunt.mjs: create the 12 hunt secrets and their commitments. RUN THIS OFFLINE, ON A MACHINE YOU TRUST.
//
//   node scripts/gen-hunt.mjs --out /path/outside/the/repo
//
// Writes two files into --out:
//   hunt-secrets.txt      12 lines "index secret". SECRET. Never commit, never upload. Back it up somewhere safe.
//   hunt-commitments.json 12 hashes, keccak256(secret). Safe to publish. Goes into the deploy config as "huntCommitments".
//
// The contract checks keccak256(abi.encodePacked(secret)) with secret as bytes32, so a commitment is keccak256 of the 32 raw bytes.
// A secret is shown as 0x plus 64 hex characters. Spreading the clues outside the site is up to the owner.
//
// --test             TEST-ONLY mode. Secrets come from fixed labels (GRIDLOCK-TEST-ONLY-SECRET-<i>) and are worthless.
// --check <dir>      Verify that hunt-secrets.txt and hunt-commitments.json in <dir> match (offline sanity check).
// The agent that wrote this script never ran it in real mode. Tests use GEN_HUNT_TEST_RANDOM=1 (labeled test bytes).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { keccak256, toHex } from 'viem';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const HUNT = 12;

function insideGitRepo(dir) {
  let d = resolve(dir);
  for (;;) {
    if (existsSync(join(d, '.git'))) return true;
    const up = dirname(d);
    if (up === d) return false;
    d = up;
  }
}

function commitmentOf(secret) { return keccak256(secret); } // keccak256 of the 32 raw bytes

if (flag('--check')) {
  const dir = val('--check');
  const secrets = readFileSync(join(dir, 'hunt-secrets.txt'), 'utf8').trim().split('\n').map((l) => l.trim().split(/\s+/));
  const commitments = JSON.parse(readFileSync(join(dir, 'hunt-commitments.json'), 'utf8')).huntCommitments;
  let ok = secrets.length === HUNT && commitments.length === HUNT && new Set(commitments).size === HUNT;
  secrets.forEach(([i, s]) => { if (commitmentOf(s) !== commitments[Number(i)]) ok = false; });
  console.log(ok ? 'OK: 12 distinct commitments match the 12 secrets.' : 'MISMATCH');
  process.exit(ok ? 0 : 1);
}

const testMode = flag('--test') || process.env.GEN_HUNT_TEST_RANDOM === '1';
const out = val('--out');
if (!out) { console.error('Usage: node scripts/gen-hunt.mjs --out <dir outside the repo> [--test]'); process.exit(2); }
if (!testMode && insideGitRepo(out) && !flag('--allow-in-repo')) {
  console.error(`Refusing to write secrets inside a git repository: ${resolve(out)}\nChoose a directory outside the repo.`);
  process.exit(2);
}

const secrets = [];
for (let i = 0; i < HUNT; i++) {
  const s = testMode ? keccak256(toHex(`GRIDLOCK-TEST-ONLY-SECRET-${i}`)) : toHex(randomBytes(32));
  secrets.push(s);
}
if (new Set(secrets).size !== HUNT) { console.error('Duplicate secret. Run again.'); process.exit(1); }
const commitments = secrets.map(commitmentOf);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'hunt-commitments.json'), JSON.stringify({ mode: testMode ? 'TEST-ONLY' : 'PRODUCTION', huntCommitments: commitments }, null, 2) + '\n');
writeFileSync(join(out, 'hunt-secrets.txt'), secrets.map((s, i) => `${i} ${s}`).join('\n') + '\n', { mode: 0o600 });

console.log(testMode ? 'TEST-ONLY secrets written. They are worthless.' : 'PRODUCTION secrets written.');
console.log(`  ${join(out, 'hunt-secrets.txt')}      SECRET. Back it up. Never commit or upload it.`);
console.log(`  ${join(out, 'hunt-commitments.json')} public. Paste into the deploy config.`);
if (!testMode) console.log('Anyone who learns a secret can claim that car. Do not store secrets on this site or in this repo.');
