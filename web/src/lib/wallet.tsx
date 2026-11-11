'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPublicClient, createWalletClient, custom, type Address, type PublicClient, type WalletClient } from 'viem';
import { CHAIN, CHAIN_ID, viemChain } from './config';

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...a: unknown[]) => void): void;
  removeListener?(event: string, handler: (...a: unknown[]) => void): void;
}
export interface WalletInfo { uuid: string; name: string; icon: string; rdns: string }
interface Discovered { info: WalletInfo; provider: Eip1193Provider }

export type WalletStatus = 'disconnected' | 'connecting' | 'connected';
interface WalletApi {
  wallets: WalletInfo[];
  status: WalletStatus;
  account: Address | null;
  chainId: number | null;
  wrongNetwork: boolean;
  error: string | null;
  connect(uuid: string): Promise<void>;
  disconnect(): void;
  switchNetwork(): Promise<void>;
  walletClient: WalletClient | null;
  walletPublic: PublicClient | null;
}

const Ctx = createContext<WalletApi | null>(null);
export function useWallet(): WalletApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet must be used inside WalletProvider');
  return v;
}

const PREF_KEY = 'gridlock.wallet';
const hex = (n: number) => `0x${n.toString(16)}`;

export function WalletProvider({ children }: { children: ReactNode }) {
  const found = useRef(new Map<string, Discovered>());
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selected, setSelected] = useState<Discovered | null>(null);
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // EIP-6963 discovery.
  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Discovered>).detail;
      if (!d?.info?.uuid || typeof d.provider?.request !== 'function') return;
      found.current.set(d.info.uuid, d);
      setWallets([...found.current.values()].map((x) => x.info));
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce);
  }, []);

  // Follow account and network changes of the selected wallet.
  useEffect(() => {
    const p = selected?.provider;
    if (!p?.on) return;
    const onAccounts = (a: unknown) => {
      const list = a as string[];
      if (!list?.length) { setAccount(null); setStatus('disconnected'); } else setAccount(list[0] as Address);
    };
    const onChain = (c: unknown) => setChainId(Number(c));
    p.on('accountsChanged', onAccounts);
    p.on('chainChanged', onChain);
    return () => { p.removeListener?.('accountsChanged', onAccounts); p.removeListener?.('chainChanged', onChain); };
  }, [selected]);

  const connect = useCallback(async (uuid: string) => {
    const d = found.current.get(uuid);
    if (!d) { setError('That wallet is not available any more. Reload the page and try again.'); return; }
    setStatus('connecting'); setError(null);
    try {
      const accounts = (await d.provider.request({ method: 'eth_requestAccounts' })) as string[];
      const cid = Number(await d.provider.request({ method: 'eth_chainId' }));
      if (!accounts[0]) throw new Error('No account was shared.');
      setSelected(d); setAccount(accounts[0] as Address); setChainId(cid); setStatus('connected');
      try { localStorage.setItem(PREF_KEY, d.info.rdns); } catch { /* preference only */ }
    } catch (e) {
      setStatus('disconnected');
      const code = (e as { code?: number }).code;
      setError(code === 4001 ? 'You closed the wallet request. Nothing was shared.' : 'The wallet did not connect. Nothing was sent. Try again.');
    }
  }, []);

  const disconnect = useCallback(() => { setSelected(null); setAccount(null); setChainId(null); setStatus('disconnected'); setError(null); }, []);

  const switchNetwork = useCallback(async () => {
    const p = selected?.provider;
    if (!p) return;
    setError(null);
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex(CHAIN_ID) }] });
    } catch (e) {
      if ((e as { code?: number }).code === 4902) {
        try {
          await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex(CHAIN_ID), chainName: CHAIN.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [CHAIN.rpcPublic], ...(CHAIN.explorer ? { blockExplorerUrls: [CHAIN.explorer] } : {}) }] });
        } catch { setError('The network was not added. Add it in your wallet, then try again.'); }
      } else setError('The network was not switched. Switch it in your wallet, then try again.');
    }
  }, [selected]);

  const clients = useMemo(() => {
    if (!selected) return { walletClient: null, walletPublic: null };
    const transport = custom(selected.provider);
    return {
      walletClient: createWalletClient({ chain: viemChain, transport }),
      walletPublic: createPublicClient({ chain: viemChain, transport }),
    };
  }, [selected]);

  const value: WalletApi = {
    wallets, status, account, chainId, wrongNetwork: status === 'connected' && chainId !== CHAIN_ID, error,
    connect, disconnect, switchNetwork, ...clients,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
