// Compares a deployed pair of contracts with this repository.
//   node scripts/verify-deployment.mjs [--chain 46630] [--rpc URL] [--artifacts DIR] [--write]
// 1. Runtime code of both contracts equals the compiled code (immutable slots masked, since they hold constructor values).
// 2. Every parameter the contract reports equals public/deployments/<chain>.json "expected" (unless --write fills it).
// 3. Hunt commitments are read from the contract and listed in "expected".
// It checks bytes and numbers. It is not an audit. It reads only; it never sends a transaction.
import { createPublicClient, http, getAddress } from 'viem';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const WRITE = process.argv.includes('--write');
const CHAIN = Number(arg('chain', process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630));
const RPCS = { 4663: 'https://rpc.mainnet.chain.robinhood.com', 46630: 'https://rpc.testnet.chain.robinhood.com', 31337: 'http://127.0.0.1:8545' };
const rpc = arg('rpc', process.env.VERIFY_RPC_URL ?? RPCS[CHAIN]);
const root = new URL('..', import.meta.url).pathname;
const artDirs = [arg('artifacts', ''), resolve(root, '../contracts/harness/build')].filter(Boolean);
const depPath = resolve(root, `public/deployments/${CHAIN}.json`);
if (!rpc) { console.error(`No RPC for chain ${CHAIN}. Pass --rpc.`); process.exit(2); }
if (!existsSync(depPath)) { console.error(`Missing ${depPath}`); process.exit(2); }
const dep = JSON.parse(readFileSync(depPath, 'utf8'));
if (dep.deployed === false || !dep.cars) { console.error(`Chain ${CHAIN} is marked as not deployed in ${depPath}. Nothing to verify.`); process.exit(2); }
const client = createPublicClient({ transport: http(rpc) });

function artifact(name) {
  for (const d of artDirs) { const p = resolve(d, `${name}.json`); if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')); }
  throw new Error(`No compiled artifact for ${name}. Run: cd ../contracts/harness && node compile.mjs`);
}
function mask(hex, refs) {
  const b = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  for (const list of Object.values(refs ?? {})) for (const { start, length } of list) b.fill(0, start, start + length);
  return b.toString('hex');
}
const failures = [];
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => { failures.push(m); console.log(`FAIL  ${m}`); };

for (const [name, address] of [['GridlockCars', dep.cars], ['GridlockRenderer', dep.renderer]]) {
  const a = artifact(name);
  const onchain = await client.getCode({ address });
  if (!onchain || onchain === '0x') { bad(`${name}: no code at ${address}`); continue; }
  const same = mask(onchain, a.immutableReferences) === mask(a.deployedBytecode, a.immutableReferences);
  same ? ok(`${name}: runtime code equals the compiled code (immutables masked)`) : bad(`${name}: runtime code differs from the compiled code`);
}

const cars = artifact('GridlockCars');
const rd = (functionName, args) => client.readContract({ address: dep.cars, abi: cars.abi, functionName, ...(args ? { args } : {}) });
const live = {
  startTime: Number(await rd('START_TIME')), openTimeout: Number(await rd('OPEN_TIMEOUT')),
  heatDecaySeconds: Number(await rd('HEAT_DECAY_SECONDS')), revealMinDelay: Number(await rd('REVEAL_MIN_DELAY')),
  treasury: getAddress(await rd('TREASURY')),
  caps: [], pricesWei: [], huntCommitments: [],
};
for (let r = 1; r <= 15; r++) { live.caps.push(Number(await rd('capOf', [BigInt(r)]))); live.pricesWei.push((await rd('priceOf', [BigInt(r)])).toString()); }
live.huntCommitments = [...(await rd('huntCommitments'))];
const fixed = { ROYALTY_BPS: 500n, TX_CAP: 2n, HEAT_MAX: 150n, HEAT_PER_TRANSFER: 20n, RANK_COUNT: 15n, HUNT_COUNT: 12n };
for (const [k, v] of Object.entries(fixed)) { const got = await rd(k); got === v ? ok(`${k} = ${v}`) : bad(`${k} is ${got}, expected ${v}`); }
const rendererOnCars = getAddress(await rd('RENDERER'));
rendererOnCars === getAddress(dep.renderer) ? ok('RENDERER matches deployments file') : bad(`RENDERER on the contract is ${rendererOnCars}`);

if (WRITE) {
  dep.expected = live;
  writeFileSync(depPath, JSON.stringify(dep, null, 2) + '\n');
  console.log(`wrote "expected" into ${depPath}. Review it against your published parameters before committing.`);
} else if (!dep.expected) {
  bad('deployments file has no "expected" block. Fill it from your published parameters (or run with --write after checking them by hand).');
} else {
  const e = dep.expected;
  for (const k of ['startTime', 'openTimeout', 'heatDecaySeconds', 'revealMinDelay']) e[k] === live[k] ? ok(`${k} = ${live[k]}`) : bad(`${k}: contract ${live[k]}, expected ${e[k]}`);
  getAddress(e.treasury) === live.treasury ? ok(`treasury = ${live.treasury}`) : bad(`treasury: contract ${live.treasury}, expected ${e.treasury}`);
  JSON.stringify(e.caps) === JSON.stringify(live.caps) ? ok('caps match') : bad('caps differ');
  JSON.stringify(e.pricesWei) === JSON.stringify(live.pricesWei) ? ok('prices match') : bad('prices differ');
  JSON.stringify(e.huntCommitments.map((x) => x.toLowerCase())) === JSON.stringify(live.huntCommitments.map((x) => x.toLowerCase())) ? ok('hunt commitments match') : bad('hunt commitments differ');
}
if (failures.length) { console.error(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log('\nAll checks passed. This compares bytes and numbers only. It is not an audit.');
