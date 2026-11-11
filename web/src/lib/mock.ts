/* Mock data for /styleguide only. Everything here is labeled EXAMPLE in the UI. */
export type RungStatus = 'sold' | 'open' | 'timed' | 'after' | 'locked';

export interface RungData {
  rank: number;
  status: RungStatus;
  sold: number;
  cap: number;
  price: string;
  openAt?: string;
  afterRank?: number;
}

/* Real caps from the spec (total 2,475). Prices and sold counts are placeholders. */
export const RANK_CAPS: Record<number, number> = {
  15: 400, 14: 360, 13: 320, 12: 280, 11: 240, 10: 200, 9: 170, 8: 140,
  7: 110, 6: 85, 5: 65, 4: 45, 3: 30, 2: 20, 1: 10,
};

export function exampleLadder(): RungData[] {
  const out: RungData[] = [];
  for (let rank = 15; rank >= 1; rank -= 1) {
    const cap = RANK_CAPS[rank] ?? 0;
    const price = `${(0.002 + (15 - rank) * 0.0015).toFixed(4)} ETH`;
    let status: RungStatus = 'locked';
    let sold = 0;
    const base: RungData = { rank, status, sold, cap, price };
    if (rank === 15 || rank === 14) { base.status = 'sold'; base.sold = cap; }
    else if (rank === 13) { base.status = 'open'; base.sold = 212; }
    else if (rank === 12) { base.status = 'after'; base.afterRank = 13; base.openAt = 'or 7 days after rank 13 opens'; }
    else if (rank === 11) { base.status = 'timed'; base.openAt = 'Thu 20 Nov 2026, 14:00 UTC'; }
    out.push(base);
  }
  return out;
}
