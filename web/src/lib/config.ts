import { defineChain } from 'viem';

export interface ChainInfo {
  id: number;
  name: string;
  testnet: boolean;
  explorer: string;
  faucet?: string;
  rpcPublic: string; // only used to add the network to a wallet
}

// Facts from docs.robinhood.com/chain/connecting, checked 2026 (docs/DECISIONS.md section 1).
export const CHAINS: Record<number, ChainInfo> = {
  4663: { id: 4663, name: 'Robinhood Chain', testnet: false, explorer: 'https://robinhoodchain.blockscout.com', rpcPublic: 'https://rpc.mainnet.chain.robinhood.com' },
  46630: { id: 46630, name: 'Robinhood Chain Testnet', testnet: true, explorer: 'https://explorer.testnet.chain.robinhood.com', faucet: 'https://faucet.testnet.chain.robinhood.com', rpcPublic: 'https://rpc.testnet.chain.robinhood.com' },
  31337: { id: 31337, name: 'Local test chain', testnet: true, explorer: '', rpcPublic: 'http://127.0.0.1:8545' },
};

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);
export const CHAIN: ChainInfo = CHAINS[CHAIN_ID] ?? CHAINS[46630]!;
/** Reads go through the site's own relay unless a direct URL is set (local testing only). */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? '/api/rpc';
export const AUDIT_REPORT_URL = process.env.NEXT_PUBLIC_AUDIT_REPORT_URL ?? '';
export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL ?? '';

export const viemChain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [CHAIN.rpcPublic] } },
  ...(CHAIN.explorer ? { blockExplorers: { default: { name: 'Explorer', url: CHAIN.explorer } } } : {}),
});

/** Fixed parts of the specification. Anything else a deployment reports is compared with deployments/<chainId>.json. */
export const SPEC = {
  rankCount: 15,
  huntCount: 12,
  txCap: 2,
  royaltyBps: 500,
  heatPerTransfer: 20,
  heatMax: 150,
  defaultCaps: [10, 20, 30, 45, 65, 85, 110, 140, 170, 200, 240, 280, 320, 360, 400],
  production: { openTimeout: 604800, heatDecaySeconds: 3600, revealMinDelay: 60 },
} as const;

export const walletRankCap = (rank: number) => (rank >= 6 ? 2 : 1);
export const explorerAddress = (a: string) => (CHAIN.explorer ? `${CHAIN.explorer}/address/${a}` : '');
export const explorerTx = (h: string) => (CHAIN.explorer ? `${CHAIN.explorer}/tx/${h}` : '');
