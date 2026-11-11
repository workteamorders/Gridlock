'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keccak256 } from 'viem';
import { loadDeployment, publicClient, readConstants, readHead, readLadder, readTotalMinted, type Constants, type Deployment, type Rung } from './chain';
import { SPEC } from './config';

export type Phase = 'loading' | 'undeployed' | 'error' | 'ready';
interface ChainApi {
  phase: Phase;
  deployment: Deployment | null;
  constants: Constants | null;
  rungs: Rung[];
  totalMinted: number;
  mismatches: string[];
  testClock: boolean;
  error: string | null;
  viewOnly: boolean;
  /** Chain time in unix seconds: the latest block time plus the time since it was read. */
  now(): number;
  refresh(): Promise<void>;
}
const Ctx = createContext<ChainApi | null>(null);
export function useChain(): ChainApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChain must be used inside ChainProvider');
  return v;
}

export function compareDeployment(c: Constants, rungs: Rung[], dep: Deployment): string[] {
  const out: string[] = [];
  if (c.royaltyBps !== SPEC.royaltyBps) out.push(`royalty is ${c.royaltyBps} bps, expected ${SPEC.royaltyBps}`);
  if (c.txCap !== SPEC.txCap) out.push(`transaction cap is ${c.txCap}, expected ${SPEC.txCap}`);
  if (c.heatMax !== SPEC.heatMax) out.push(`heat max is ${c.heatMax}, expected ${SPEC.heatMax}`);
  if (c.heatPerTransfer !== SPEC.heatPerTransfer) out.push(`heat per transfer is ${c.heatPerTransfer}, expected ${SPEC.heatPerTransfer}`);
  if (rungs.length !== SPEC.rankCount) out.push('the ladder does not have 15 ranks');
  for (let i = 0; i + 1 < rungs.length; i++) if (rungs[i]!.priceWei < rungs[i + 1]!.priceWei) out.push('prices do not rise from rank 15 to rank 1');
  const e = dep.expected;
  if (e) {
    if (e.startTime !== c.startTime) out.push('start time differs from the published value');
    if (e.openTimeout !== c.openTimeout) out.push('open timeout differs from the published value');
    if (e.heatDecaySeconds !== c.heatDecaySeconds) out.push('heat decay differs from the published value');
    if (e.revealMinDelay !== c.revealMinDelay) out.push('reveal delay differs from the published value');
    if (e.treasury.toLowerCase() !== c.treasury.toLowerCase()) out.push('treasury differs from the published address');
    rungs.forEach((r, i) => {
      if (e.caps[i] !== r.cap) out.push(`rank ${r.rank} cap differs from the published value`);
      if (e.pricesWei[i] !== r.priceWei.toString()) out.push(`rank ${r.rank} price differs from the published value`);
    });
  }
  if (c.renderer.toLowerCase() !== dep.renderer.toLowerCase()) out.push('the renderer address differs from the deployment file');
  return out;
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [rungs, setRungs] = useState<Rung[]>([]);
  const [totalMinted, setTotalMinted] = useState(0);
  const [mismatches, setMismatches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const head = useRef<{ timestamp: number; fetchedAtMs: number } | null>(null);
  const depRef = useRef<Deployment | null>(null);
  const checkedCode = useRef(false);

  const refresh = useCallback(async () => {
    try {
      let dep = depRef.current;
      if (!dep) {
        dep = await loadDeployment();
        if (!dep) { setPhase('undeployed'); return; }
        depRef.current = dep; setDeployment(dep);
      }
      const [c, l, h, n] = await Promise.all([readConstants(dep.cars), readLadder(dep.cars), readHead(), readTotalMinted(dep.cars)]);
      head.current = h;
      const problems = compareDeployment(c, l, dep);
      if (!checkedCode.current && dep.expected?.rendererCodeHash) {
        checkedCode.current = true;
        const code = await publicClient.getCode({ address: dep.renderer });
        if (!code || keccak256(code) !== dep.expected.rendererCodeHash) problems.push('the renderer code differs from the published code hash');
      }
      setConstants(c); setRungs(l); setTotalMinted(n); setMismatches(problems); setError(null); setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The network did not answer.');
      setPhase((p) => (p === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    const id = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [refresh]);

  useEffect(() => {
    fetch('/api/geo', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { blocked: false })).then((j: { blocked?: boolean }) => setViewOnly(j.blocked === true)).catch(() => setViewOnly(false));
  }, []);

  const now = useCallback(() => {
    const h = head.current;
    return h ? h.timestamp + (Date.now() - h.fetchedAtMs) / 1000 : Date.now() / 1000;
  }, []);

  const testClock = constants !== null && (constants.openTimeout !== SPEC.production.openTimeout || constants.heatDecaySeconds !== SPEC.production.heatDecaySeconds || constants.revealMinDelay !== SPEC.production.revealMinDelay);

  const value = useMemo<ChainApi>(() => ({ phase, deployment, constants, rungs, totalMinted, mismatches, testClock, error, viewOnly, now, refresh }), [phase, deployment, constants, rungs, totalMinted, mismatches, testClock, error, viewOnly, now, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
