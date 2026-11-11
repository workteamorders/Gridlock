'use client';

import { useChain } from '@/lib/chain-context';
import { SPEC } from '@/lib/config';
import { nextOpening, openRung } from '@/lib/ladder-view';
import { formatEth, formatUtc } from '@/lib/format';
import { ribbonFacts } from './ribbon';

/** Tilted hazard-tape ribbon. Fixed facts always; live numbers only when they were read from the chain. */
export function ChainRibbon() {
  const c = useChain();
  const live = c.phase === 'ready';
  const open = live ? openRung(c.rungs) : null;
  const now = live ? c.now() : 0;
  const minted = live ? c.rungs.reduce((a, r) => a + r.sold, 0) : null;
  const next = live ? nextOpening(c.rungs, now) : null;
  const items = ribbonFacts({
    minted,
    open: open ? { rank: open.rank, left: open.cap - open.sold, price: formatEth(open.priceWei) } : null,
    next: next ? { rank: next.rank, at: formatUtc(next.at) } : null,
    royaltyPercent: SPEC.royaltyBps / 100,
  });
  const track = (hidden: boolean) => (
    <ul className={`ribbon-list${hidden ? ' ribbon-dup' : ''}`} {...(hidden ? { 'aria-hidden': true } : {})}>
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
  return (
    <div className="ribbon-stage">
      <div className="ribbon" role="region" aria-label="Gridlock facts">
        <div className="ribbon-track">{track(false)}{track(true)}</div>
      </div>
    </div>
  );
}
