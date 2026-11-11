import { createPublicClient, http, type Address } from 'viem';
import { carsAbi } from './gridlock-abi';
import { CHAIN_ID, RPC_URL, viemChain } from './config';

export const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(RPC_URL, { batch: { wait: 20, batchSize: 10 }, retryCount: 1, timeout: 15_000 }),
});

export interface Expected {
  startTime: number;
  openTimeout: number;
  heatDecaySeconds: number;
  revealMinDelay: number;
  treasury: Address;
  caps: number[];
  pricesWei: string[];
  huntCommitments: string[];
  rendererCodeHash?: string;
}
export interface Deployment { chainId: number; cars: Address; renderer: Address; expected?: Expected }

const isAddress = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

/** deployments/<chainId>.json is a static file. `{ "chainId": N, "deployed": false }` (or a missing file) means "not deployed".
 *  The placeholder keeps the browser console free of 404 noise on the common pre-launch state. */
export async function loadDeployment(): Promise<Deployment | null> {
  const res = await fetch(`/deployments/${CHAIN_ID}.json`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load the deployment file.');
  const j = (await res.json()) as Partial<Deployment> & { deployed?: boolean };
  if (j.deployed === false) return null;
  if (j.chainId !== CHAIN_ID || !isAddress(j.cars) || !isAddress(j.renderer)) throw new Error('The deployment file is not valid for this network.');
  return { chainId: j.chainId, cars: j.cars, renderer: j.renderer, ...(j.expected ? { expected: j.expected } : {}) };
}

export interface Rung { rank: number; sold: number; cap: number; priceWei: bigint; opensAtLatest: number; openedAt: number; isOpen: boolean; soldOutAt: number }
export interface Constants {
  startTime: number; openTimeout: number; heatDecaySeconds: number; revealMinDelay: number;
  treasury: Address; renderer: Address; royaltyBps: number; txCap: number; heatMax: number; heatPerTransfer: number;
}
export interface CarInfo {
  id: number; rank: number; serial: number; hidden: boolean; mintedAt: number; transferCount: number; heat: number; stars: number;
  peakHeat: number; peakStars: number; lastMovedAt: number; heatZeroAt: number; owner: Address;
}

const read = <F extends string>(cars: Address, functionName: F, args?: readonly unknown[]) =>
  publicClient.readContract({ address: cars, abi: carsAbi, functionName, ...(args ? { args } : {}) } as never) as Promise<never>;

export async function readConstants(cars: Address): Promise<Constants> {
  const [startTime, openTimeout, heat, delay, treasury, renderer, royalty, txCap, heatMax, perTransfer] = await Promise.all([
    read(cars, 'START_TIME') as Promise<bigint>, read(cars, 'OPEN_TIMEOUT') as Promise<bigint>, read(cars, 'HEAT_DECAY_SECONDS') as Promise<bigint>,
    read(cars, 'REVEAL_MIN_DELAY') as Promise<bigint>, read(cars, 'TREASURY') as Promise<Address>, read(cars, 'RENDERER') as Promise<Address>,
    read(cars, 'ROYALTY_BPS') as Promise<bigint>, read(cars, 'TX_CAP') as Promise<bigint>, read(cars, 'HEAT_MAX') as Promise<bigint>,
    read(cars, 'HEAT_PER_TRANSFER') as Promise<bigint>,
  ]);
  return {
    startTime: Number(startTime), openTimeout: Number(openTimeout), heatDecaySeconds: Number(heat), revealMinDelay: Number(delay),
    treasury, renderer, royaltyBps: Number(royalty), txCap: Number(txCap), heatMax: Number(heatMax), heatPerTransfer: Number(perTransfer),
  };
}

export async function readLadder(cars: Address): Promise<Rung[]> {
  const raw = (await read(cars, 'ladderState')) as readonly { rank: number; sold: number; cap: number; price: bigint; opensAtLatest: bigint; openedAt: bigint; isOpen: boolean; soldOutAt: bigint }[];
  return raw.map((r) => ({ rank: r.rank, sold: r.sold, cap: r.cap, priceWei: r.price, opensAtLatest: Number(r.opensAtLatest), openedAt: Number(r.openedAt), isOpen: r.isOpen, soldOutAt: Number(r.soldOutAt) }));
}

export async function readHead(): Promise<{ timestamp: number; fetchedAtMs: number }> {
  const b = await publicClient.getBlock({ blockTag: 'latest' });
  return { timestamp: Number(b.timestamp), fetchedAtMs: Date.now() };
}

export async function readTotalMinted(cars: Address): Promise<number> {
  return Number((await read(cars, 'totalMinted')) as bigint);
}

export async function readCar(cars: Address, id: number): Promise<CarInfo> {
  const [d, owner] = await Promise.all([
    read(cars, 'carData', [BigInt(id)]) as Promise<{ rank: number; serial: number; hidden: boolean; mintedAt: bigint; transferCount: number; heat: number; stars: number; peakHeat: number; peakStars: number; lastMovedAt: bigint; heatZeroAt: bigint }>,
    read(cars, 'ownerOf', [BigInt(id)]) as Promise<Address>,
  ]);
  return {
    id, rank: d.rank, serial: d.serial, hidden: d.hidden, mintedAt: Number(d.mintedAt), transferCount: d.transferCount, heat: d.heat, stars: d.stars,
    peakHeat: d.peakHeat, peakStars: d.peakStars, lastMovedAt: Number(d.lastMovedAt), heatZeroAt: Number(d.heatZeroAt), owner,
  };
}

export async function readPreview(cars: Address, rank: number): Promise<{ serial: number; svg: string }> {
  const [serial, svg] = (await read(cars, 'previewNext', [BigInt(rank)])) as readonly [bigint, string];
  return { serial: Number(serial), svg };
}

export async function readOwned(cars: Address, owner: Address, totalMinted: number): Promise<number[]> {
  const ids: number[] = [];
  let start = 1;
  for (let guard = 0; guard < 20 && start <= totalMinted; guard++) {
    const [found, next] = (await read(cars, 'ownedIds', [owner, BigInt(start), 700n])) as readonly [readonly bigint[], bigint];
    ids.push(...found.map(Number));
    start = Number(next);
  }
  return ids;
}

export async function readHunt(cars: Address): Promise<{ claimers: Address[]; tokenIds: number[] }> {
  const [claimers, tokenIds] = (await read(cars, 'huntStatus')) as readonly [readonly Address[], readonly bigint[]];
  return { claimers: [...claimers], tokenIds: tokenIds.map(Number) };
}

export async function readWalletMinted(cars: Address, owner: Address): Promise<number[]> {
  const out = await Promise.all(Array.from({ length: 15 }, (_, i) => read(cars, 'walletMinted', [owner, BigInt(i + 1)]) as Promise<bigint>));
  return out.map(Number);
}

export async function readCommit(cars: Address, owner: Address): Promise<{ commitment: `0x${string}`; committedAt: number; revealableAt: number }> {
  const [commitment, committedAt, revealableAt] = (await read(cars, 'claimCommit', [owner])) as readonly [`0x${string}`, bigint, bigint];
  return { commitment, committedAt: Number(committedAt), revealableAt: Number(revealableAt) };
}

/** tokenURI image as a data URI. Only a base64 SVG data URI is accepted, and it is only ever used as an <img> source. */
export async function readTokenImage(cars: Address, id: number): Promise<string | null> {
  const uri = (await read(cars, 'tokenURI', [BigInt(id)])) as string;
  if (!uri.startsWith('data:application/json;base64,')) return null;
  const json = JSON.parse(atob(uri.slice('data:application/json;base64,'.length))) as { image?: unknown };
  return typeof json.image === 'string' && /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(json.image) ? json.image : null;
}

export const svgToDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const rendererAbi = [{ type: 'function', name: 'svg', stateMutability: 'pure', inputs: [{ name: 'input', type: 'tuple', components: [
  { name: 'rank', type: 'uint8' }, { name: 'serial', type: 'uint16' }, { name: 'heat', type: 'uint16' },
  { name: 'transferCount', type: 'uint32' }, { name: 'peakHeat', type: 'uint16' }, { name: 'mintedAt', type: 'uint48' }] }], outputs: [{ name: '', type: 'string' }] }] as const;

/** Card SVG for any rank and serial at heat 0, straight from the renderer contract. */
export async function readSvg(renderer: Address, rank: number, serial: number): Promise<string> {
  return publicClient.readContract({ address: renderer, abi: rendererAbi, functionName: 'svg', args: [{ rank, serial, heat: 0, transferCount: 0, peakHeat: 0, mintedAt: 0 }] });
}

/** The public hash a hunt secret must match: keccak256(abi.encodePacked(secret)). */
export async function readHuntHash(cars: Address, index: number): Promise<`0x${string}`> {
  const all = (await read(cars, 'huntCommitments')) as readonly `0x${string}`[];
  const h = all[index];
  if (!h) throw new Error('No such hunt car');
  return h;
}
