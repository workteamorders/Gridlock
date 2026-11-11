// Deploys from a deploy/*.json config into the in-process harness EVM (never a public network). Exits non-zero if the constructor rejects it.
import { readFileSync } from 'node:fs';
import { Chain } from './evm.mjs';

export async function deployFromConfig(path, chain) {
  const c = JSON.parse(readFileSync(path, 'utf8'));
  const start = BigInt(c.startTime || chain.now + BigInt(c.startOffsetSeconds ?? 0));
  const renderer = await chain.deploy('GridlockRenderer');
  const cars = await chain.deploy('GridlockCars', [{
    treasury: c.treasury, renderer: renderer.address, startTime: start,
    openTimeout: BigInt(c.openTimeoutSeconds), heatDecaySeconds: BigInt(c.heatDecaySeconds), revealMinDelay: BigInt(c.revealMinDelaySeconds),
    caps: c.caps, prices: c.pricesWei.map(BigInt), huntCommitments: c.huntCommitments,
  }]);
  return { renderer, cars, config: c, start };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chain = await Chain.create(1_700_000_000n);
  const { cars, renderer, start } = await deployFromConfig(process.argv[2] ?? '../deploy/anvil.json', chain);
  const l = (await chain.view(cars, 'ladderState')).result;
  console.log(`local deploy ok (harness EVM, no network). renderer ${renderer.address} cars ${cars.address} start ${start}`);
  console.log(`rank 15: cap ${l[14].cap} price ${l[14].price}; rank 1: cap ${l[0].cap} price ${l[0].price}`);
}
