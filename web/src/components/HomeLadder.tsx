'use client';

import Link from 'next/link';
import { useChain } from '@/lib/chain-context';
import { exampleLadder } from '@/lib/mock';
import { nextOpening, openRung, toRungData } from '@/lib/ladder-view';
import { formatEth, formatUtc } from '@/lib/format';
import { Ladder, LoadingLadder } from './Ladder';
import { Countdown } from './Countdown';
import { Icon } from './Icon';

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
  const disabled = c.viewOnly || c.mismatches.length > 0;

  return (
    <div className="hero-ladder">
      <div className="stack">
        <h1>2,475 wanted-poster cars. One ladder.</h1>
        <p>Gridlock Cars are original comic cards drawn fully on-chain. Rank 15 opens first and is the cheapest. Each next rank opens when the one before sells out or times out, up to rank 1. You see the exact car before you pay.</p>

        {live ? (
          <div key="live" className="panel stack-tight hero-panel">
            <span className="label">Minted so far</span>
            <p className="big-number num">{ladderTotal} <small className="dim">of 2,475</small></p>
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
          </div>
        ) : c.phase === 'error' ? (
          <div className="panel hero-panel"><p>The network is not answering, so live numbers are not shown. Nothing is affected. Try again in a moment.</p></div>
        ) : (
          <div key="sk" className="panel skeleton hero-panel-sk" aria-busy="true" aria-label="Loading ladder" />
        )}
      </div>
      <div>
        {live ? <Ladder rungs={toRungData(rungs)} /> : c.phase === 'undeployed' ? <Ladder rungs={exampleLadder()} /> : <LoadingLadder rungs={exampleLadder()} />}
      </div>
    </div>
  );
}
