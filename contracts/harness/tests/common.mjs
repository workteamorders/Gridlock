import { keccak256, toHex, encodeAbiParameters } from 'viem';
import { Chain, addr } from '../evm.mjs';
import assert from 'node:assert/strict';

export const START = 1_000_000n;
export const DAY = 86_400n;
export const TIMEOUT = 7n * DAY;
export const DECAY = 3600n;
export const DELAY = 60n;
export const TREASURY = addr(0x7ea5);
export const DEFAULT_CAPS = [10, 20, 30, 45, 65, 85, 110, 140, 170, 200, 240, 280, 320, 360, 400]; // index i = rank i + 1
export const PRICES = Array.from({ length: 15 }, (_, i) => BigInt(15 - i) * 10n ** 15n); // index i = rank i + 1

// TEST-ONLY hunt secrets. They are labeled, deterministic and worthless. Real secrets come from scripts/gen-hunt.
export const testSecret = (i) => keccak256(toHex(`GRIDLOCK-TEST-ONLY-SECRET-${i}`));
export const testCommitment = (i) => keccak256(testSecret(i)); // keccak256(abi.encodePacked(bytes32))
export const claimCommitment = (secret, claimer, salt) =>
  keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }], [secret, claimer, salt]));
export const salt = (n) => keccak256(toHex(`TEST-SALT-${n}`));

export const wallet = (n) => addr(0x10000 + n);
export const walletCap = (rank) => (rank >= 6 ? 2 : 1);

export async function setup(over = {}) {
  const chain = await Chain.create(START - 1000n);
  const renderer = await chain.deploy('GridlockRenderer');
  const params = {
    treasury: TREASURY,
    renderer: renderer.address,
    startTime: START,
    openTimeout: TIMEOUT,
    heatDecaySeconds: DECAY,
    revealMinDelay: DELAY,
    caps: DEFAULT_CAPS,
    prices: PRICES,
    huntCommitments: Array.from({ length: 12 }, (_, i) => testCommitment(i)),
    ...over,
  };
  const cars = await chain.deploy('GridlockCars', [params]);
  return { chain, renderer, cars, params };
}

export const priceOf = (rank, prices = PRICES) => prices[rank - 1];

/** Mint `qty` of `rank` from `from`, previewing the serial first like the site does. */
export async function mint(env, rank, qty, from, expect = null) {
  const sold = (await env.chain.view(env.cars, 'soldOf', [BigInt(rank)])).result;
  const r = await env.chain.call(env.cars, 'mint', [BigInt(rank), BigInt(qty), sold + 1n], {
    from, value: priceOf(rank, env.params.prices) * BigInt(qty),
  });
  if (expect) assert.equal(r.ok, false, `expected revert ${expect}`), assert.match(r.error, new RegExp(expect));
  else assert.equal(r.ok, true, `mint rank ${rank} failed: ${r.error}`);
  if (r.ok) env.paid = (env.paid ?? 0n) + priceOf(rank, env.params.prices) * BigInt(qty);
  return r;
}

/** Sell out a rank using fresh wallets. Returns the number of cars minted. */
export async function sellOut(env, rank, base = rank * 100000) {
  const cap = Number((await env.chain.view(env.cars, 'capOf', [BigInt(rank)])).result);
  let sold = Number((await env.chain.view(env.cars, 'soldOf', [BigInt(rank)])).result);
  let k = 0;
  while (sold < cap) {
    const q = Math.min(walletCap(rank), cap - sold, 2);
    await mint(env, rank, q, wallet(base + k++));
    sold += q;
  }
  return sold;
}

export const ladder = async (env) => (await env.chain.view(env.cars, 'ladderState')).result;
export const expectErr = (r, name) => {
  assert.equal(r.ok, false, `expected revert ${name}, call succeeded`);
  assert.match(r.error, new RegExp(`^${name}`), `got ${r.error}`);
};
