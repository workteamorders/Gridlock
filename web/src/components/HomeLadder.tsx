'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readPreview, svgToDataUri } from '@/lib/chain';
import { CardImage } from './CardImage';
import { useChain } from '@/lib/chain-context';
import { nextOpening, openRung } from '@/lib/ladder-view';
import { formatEth, formatUtc } from '@/lib/format';
import { Countdown } from './Countdown';
import { Icon } from './Icon';
import { RollNumber } from './stage/RollNumber';

/** The wanted poster and ladder panels share one view of the current rank. */
export function HomeLadder() {
  const c = useChain();
  const live = c.phase === 'ready';
  const rungs = live ? c.rungs : [];
  const ladderTotal = rungs.reduce((a, r) => a + r.sold, 0);
  const allSold = live && rungs.length === 15 && rungs.every((r) => r.sold >= r.cap);
  const open = live ? openRung(rungs) : null;
  const now = live ? c.now() : 0;
  const beforeStart = live && c.constants !== null && now < c.constants.startTime;
  const next = live ? nextOpening(rungs, now) : null;
  const cars = c.deployment?.cars;
  const rank = open?.rank;
  const sold = open?.sold;
  const [preview, setPreview] = useState<{ rank: number; sold: number; src: string } | null>(null);
  useEffect(() => {
    if (!cars || rank === undefined || sold === undefined) return;
    let cancelled = false;
    void readPreview(cars, rank).then(({ svg }) => {
      if (!cancelled) setPreview({ rank, sold, src: svgToDataUri(svg) });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [cars, rank, sold]);
  const disabled = c.viewOnly || c.mismatches.length > 0;

  const currentPreview = preview && preview.rank === rank && preview.sold === sold ? preview : null;

  return (
    <>
      <section className="comic-wanted" aria-labelledby="wanted-title">
        <header className="comic-wanted-copy stack-tight">
          <h2 id="wanted-title">Wanted</h2>
          <p>{currentPreview ? `Rank ${currentPreview.rank} · next card` : 'Example poster'}</p>
        </header>
        <CardImage
          src={currentPreview?.src ?? '/art/example-card.svg'}
          example={!currentPreview}
          size={300}
          alt={currentPreview ? `Wanted poster for the next car at rank ${currentPreview.rank}` : 'Illustrated wanted poster of an orange comic car'}
        />
      </section>
      <section id="ladder" className="comic-ladder stack" aria-labelledby="ladder-title">
        <h2 id="ladder-title">The Ladder</h2>
        <div className="comic-ladder-status stack-tight" aria-busy={c.phase === 'loading'}>
          {live ? (
            <>
              {allSold ? (
                <h3><Icon name="check" /> Ladder complete</h3>
              ) : beforeStart && c.constants ? (
                <>
                  <p>Minting opens at {formatUtc(c.constants.startTime)}.</p>
                  <Countdown target={c.constants.startTime} nowFn={c.now} label="Time until minting opens" />
                </>
              ) : open ? (
                <>
                  <h3>Rank {open.rank} is open</h3>
                  <p><b>{formatEth(open.priceWei)}</b> · {open.cap - open.sold} of {open.cap} left</p>
                </>
              ) : (
                <p>No rank is open right now.</p>
              )}
              {!allSold && next && !beforeStart ? (
                <p className="dim">Rank {next.rank} opens by {formatUtc(next.at)}, sooner if rank {next.rank + 1} sells out.</p>
              ) : null}
              <p className="dim">Minted so far · <RollNumber value={ladderTotal} /> of 2,475</p>
              {open && !disabled ? (
                <Link className="btn btn--primary btn--sm comic-mint" href={`/mint/?rank=${open.rank}`}>Mint at the open rung</Link>
              ) : (
                <p className="dim">{c.viewOnly ? 'Minting is turned off in this interface for your region.' : c.mismatches.length ? 'Minting is paused until the deployment matches the published parameters.' : allSold ? 'Hunt cars are still claimable.' : 'Minting is not open yet.'}</p>
              )}
            </>
          ) : c.phase === 'undeployed' ? (
            <p>Gridlock is not deployed yet. See the Ladder for an example of the 15 ranks.</p>
          ) : c.phase === 'error' ? (
            <p>Live ladder status is unavailable. The network is not answering.</p>
          ) : (
            <p role="status">Checking ladder status…</p>
          )}
        </div>
        <nav className="comic-ladder-links" aria-label="Explore the collection">
          <Link className="btn btn--primary" href="/ladder/">See the Ladder</Link>
          <Link className="btn btn--secondary" href="/gallery/">Browse the Cards</Link>
        </nav>
      </section>
    </>
  );
}
