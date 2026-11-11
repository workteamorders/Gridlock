import type { RungData } from './mock';
import type { Rung } from './chain';
import { formatEth, formatUtc } from './format';

/** Turns on-chain rungs into the display model of the Ladder component. */
export function toRungData(rungs: Rung[]): RungData[] {
  const byRank = new Map(rungs.map((r) => [r.rank, r]));
  return rungs.map((r) => {
    const soldOut = r.sold >= r.cap;
    const prev = byRank.get(r.rank + 1);
    const base: RungData = { rank: r.rank, status: 'locked', sold: r.sold, cap: r.cap, price: formatEth(r.priceWei) };
    if (soldOut) return { ...base, status: 'sold' };
    if (r.isOpen) return { ...base, status: 'open' };
    if (!prev) return { ...base, status: 'timed', openAt: formatUtc(r.opensAtLatest) };
    const prevOpenOrSold = prev.isOpen || prev.sold >= prev.cap;
    if (prevOpenOrSold) return { ...base, status: 'after', afterRank: prev.rank, openAt: `or at ${formatUtc(r.opensAtLatest)}, whichever comes first` };
    return base;
  });
}

/** The open rung with cars left and the highest rank number (cheapest, first in line). This is the default of the main action. */
export function openRung(rungs: Rung[]): Rung | null {
  const open = rungs.filter((r) => r.isOpen && r.sold < r.cap);
  return open.length ? open.reduce((a, b) => (a.rank > b.rank ? a : b)) : null;
}

export function nextOpening(rungs: Rung[], now: number): { rank: number; at: number } | null {
  const waiting = rungs.filter((r) => !r.isOpen && r.sold < r.cap && r.opensAtLatest > now);
  if (!waiting.length) return null;
  const n = waiting.reduce((a, b) => (a.opensAtLatest <= b.opensAtLatest ? a : b));
  return { rank: n.rank, at: n.opensAtLatest };
}
