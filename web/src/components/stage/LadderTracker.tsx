'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CLIMB_STEPS, nearestToMiddle, trackerPosition } from '@/lib/stage';
import { play } from '@/lib/sound';

interface Fact { label: string; value: string }
interface Reading { rank: number; status: string; facts: Fact[]; states: string[]; openRank: number | null }
const ranks = Array.from({ length: CLIMB_STEPS }, (_, i) => i + 1);
const first: Reading = { rank: CLIMB_STEPS, status: '', facts: [], states: [], openRank: null };

/**
 * Beside the tall ladder: a small road with a comic car that drives to whichever rung is in the middle of the screen,
 * or to the one the pointer rests on. It only repeats what the ladder already says, so it is hidden from screen readers
 * apart from the mint link. Sticky on wide screens, hidden on narrow ones where the ladder fills the width.
 */
export function LadderTracker() {
  const road = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<Reading>(first);
  const heard = useRef<number | null>(null);
  useEffect(() => {
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.ladder--up > .rung'));
    let frame = 0;
    let hover: number | null = null;
    const read = () => {
      frame = 0;
      const list = rows();
      if (!list.length) return;
      let index: number;
      if (hover !== null) index = list.findIndex((r) => Number(r.dataset.rank) === hover);
      else index = nearestToMiddle(list.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }), window.innerHeight / 2);
      const row = list[Math.max(0, index)]!;
      const rank = Number(row.dataset.rank);
      const states = ranks.map((n) => (list.find((r) => Number(r.dataset.rank) === n)?.className.match(/rung--(\w+)/)?.[1]) ?? 'locked');
      const open = list.find((r) => r.classList.contains('rung--open'));
      const next: Reading = {
        rank,
        status: row.querySelector('.rung-status')?.textContent?.trim() ?? '',
        facts: Array.from(row.querySelectorAll('.rung-meta > span')).flatMap((s): Fact[] => {
          const value = s.querySelector('b')?.textContent?.trim();
          const label = s.firstChild?.textContent?.trim();
          return value && label ? [{ label, value }] : [];
        }).slice(0, 3),
        states,
        openRank: open ? Number(open.dataset.rank) : null,
      };
      setNow((was) => (was.rank === next.rank && was.status === next.status && JSON.stringify(was.facts) === JSON.stringify(next.facts) && was.openRank === next.openRank && was.states.join() === next.states.join() ? was : next));
      road.current?.style.setProperty('--pos', trackerPosition(rank).toFixed(4));
      // A note per rung, as in the climb: low at rank 15, high at rank 1. The first reading only sets the baseline.
      if (heard.current !== null && heard.current !== rank) play('step', CLIMB_STEPS - rank);
      heard.current = rank;
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    const over = (event: Event) => { const row = (event.target as Element).closest<HTMLElement>('.ladder--up > .rung'); hover = row ? Number(row.dataset.rank) : null; queue(); };
    const leave = () => { hover = null; queue(); };
    const watch = new MutationObserver(queue);
    const ladder = document.querySelector('.ladder--up')?.parentElement;
    if (ladder) watch.observe(ladder, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerleave', leave);
    queue();
    return () => {
      watch.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerleave', leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="panel stack-tight ladder-tracker">
      <div ref={road} className="tracker-road" aria-hidden="true">
        <span className="label">You are here</span>
        <div className="tracker-lane">
          <img className="tracker-car" src="/art/climb-car.svg" alt="" width={290} height={106} loading="lazy" decoding="async" />
        </div>
        <ol className="tracker-pips">
          {ranks.map((n, i) => <li key={n} data-state={now.states[i] ?? 'locked'} data-here={n === now.rank || undefined} />)}
        </ol>
        <div className="tracker-ends"><span>Rank 1</span><span>Rank 15</span></div>
        <p className="tracker-readout num"><b>Rank {now.rank}</b> <span>{now.status}</span></p>
        <dl className="tracker-facts">
          {now.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className="num">{f.value}</dd></div>)}
        </dl>
        <ul className="tracker-legend">
          <li data-state="open">Open</li><li data-state="sold">Sold out</li><li data-state="locked">Locked</li>
        </ul>
      </div>
      {now.openRank !== null ? <Link className="btn btn--primary btn--sm" href={`/mint/?rank=${now.openRank}`}>Mint at rank {now.openRank}</Link> : null}
    </div>
  );
}
