'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readPreview, svgToDataUri } from '@/lib/chain';
import { CardImage } from './CardImage';
import { useChain } from '@/lib/chain-context';
import { exampleLadder } from '@/lib/mock';
import { nextOpening, openRung, toRungData } from '@/lib/ladder-view';
import { formatEth, formatUtc } from '@/lib/format';
import { Ladder, LoadingLadder } from './Ladder';
import { Countdown } from './Countdown';
import { Icon } from './Icon';
import { ChapterHead } from './stage/ChapterHead';
import { RollNumber } from './stage/RollNumber';

/** Home hero: the live ladder, a countdown to the next event, and one action. */
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

  return (
    <div className="hero-ladder">
      <div className="stack">
        <div className="panel stack-tight">
          <ChapterHead n={1} id="ladder-title" kicker="the ladder">Climb the ladder</ChapterHead>
          <p>Lit rungs are open. A locked rung opens when the one before it sells out or times out.</p>
        </div>

        {live ? (
          <div key="live" className="panel stack-tight hero-panel">
            <span className="label">Minted so far</span>
            <p className="big-number num"><RollNumber value={ladderTotal} /> <small className="dim">of 2,475</small></p>
            {allSold ? (
              <p><Icon name="check" /> The ladder is finished. All 2,475 cars are minted. Hunt cars are still claimable.</p>
            ) : beforeStart && c.constants ? (
              <>
                <p>Minting opens at {formatUtc(c.constants.startTime)}.</p>
                <Countdown target={c.constants.startTime} nowFn={c.now} label="Time until minting opens" />
              </>
            ) : open ? (
              <p>Rank {open.rank} is open at <b>{formatEth(open.priceWei)}</b>. {open.cap - open.sold} of {open.cap} left.</p>
            ) : (
              <p>No rank is open right now.</p>
            )}
            {!allSold && next && !beforeStart ? (
              <>
                <p className="dim">Rank {next.rank} opens by {formatUtc(next.at)}, sooner if rank {next.rank + 1} sells out.</p>
                <Countdown target={next.at} nowFn={c.now} label={`Time until rank ${next.rank} opens at the latest`} />
              </>
            ) : null}
            {open && !disabled ? (
              <Link className="btn btn--primary btn--lg" href={`/mint/?rank=${open.rank}`}>Mint at the open rung</Link>
            ) : (
              <span className="dim">{c.viewOnly ? 'Minting is turned off in this interface for your region.' : c.mismatches.length ? 'Minting is paused on this site until the deployment matches the published parameters.' : beforeStart ? 'Minting is not open yet.' : allSold ? '' : 'Wait for a rank to open.'}</span>
            )}
          </div>
        ) : c.phase === 'undeployed' ? (
          <div key="undeployed" className="panel stack-tight hero-panel">
            <span className="badge badge--example">Example</span>
            <p>Gridlock is not deployed yet. The ladder on this page shows the real caps with example prices and sales so you can see how it will work.</p>
            <img className="hero-example-art" src="/icon.svg" alt="" width={128} height={128} />
          </div>
        ) : c.phase === 'error' ? (
          <div className="panel hero-panel"><p>The network is not answering, so live numbers are not shown. Nothing is affected. Try again in a moment.</p></div>
        ) : (
          <div key="sk" className="panel skeleton hero-panel-sk" role="status" aria-busy="true" aria-label="Loading ladder" />
        )}
      </div>
      <div id="ladder">
        {live ? <Ladder live rungs={toRungData(rungs)} /> : c.phase === 'undeployed' ? <Ladder rungs={exampleLadder()} /> : <LoadingLadder rungs={exampleLadder()} />}
      </div>
        {preview && preview.rank === rank && preview.sold === sold ? (
          <div className="panel stack-tight home-preview"><p className="label">Next card at rank {rank}</p><CardImage src={preview.src} size={220} alt={`Next card at rank ${rank}, drawn by the contract`} /></div>
        ) : null}
    </div>
  );
}
