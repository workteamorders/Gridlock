'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { RungData } from '@/lib/mock';
import { Icon, type IconName } from './Icon';
import { RankMark } from './PanelMark';
import { play } from '@/lib/sound';

const STATUS: Record<RungData['status'], { icon: IconName; word: string }> = {
  sold: { icon: 'x', word: 'Sold out' },
  open: { icon: 'check', word: 'Open' },
  timed: { icon: 'clock', word: 'Opens at' },
  after: { icon: 'clock', word: 'Opens after' },
  locked: { icon: 'lock', word: 'Locked' },
};

export function Rung({ r, cta, live = false }: { r: RungData; cta?: ReactNode; live?: boolean }) {
  const st = STATUS[r.status];
  const left = r.cap - r.sold;
  const previous = useRef(r.status);
  const [opened, setOpened] = useState(false);
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (live && previous.current !== r.status) { const justOpened = r.status === 'open'; setOpened(justOpened && document.documentElement.dataset.motion === 'full'); if (justOpened) play('open'); }
    previous.current = r.status;
  }, [r.status, live]);
  useEffect(() => {
    const bar = fill.current;
    if (!bar) return;
    const ratio = String(r.cap ? r.sold / r.cap : 0);
    if (live && bar.style.getPropertyValue('--fill') && bar.style.getPropertyValue('--fill') !== ratio) {
      bar.dataset.changed = 'true';
    }
    bar.style.setProperty('--fill', ratio);
  }, [r.sold, r.cap, live]);
  return (
    <li className={`rung rung--${r.status}`} data-rank={r.rank} data-just-opened={live && opened || undefined} onAnimationEnd={() => setOpened(false)}>
      <div className="rung-rank"><small>Rank</small>{r.rank}<RankMark rank={r.rank} /></div>
      <div className="rung-main">
        <span className={`rung-status${live && (r.status === 'sold' || r.status === 'open') ? ' rung-stamp' : ''}`}><Icon name={st.icon} />{st.word}{r.status === 'timed' && r.openAt ? ` ${r.openAt}` : ''}</span>
        <span className="rung-meta">
          <span>Price <b>{r.price}</b></span>
          <span>Cap <b>{r.cap}</b></span>
          {r.status === 'open' ? <span>Left <b>{left}</b></span> : null}
          {r.status === 'sold' ? <span>Sold <b>{r.sold}</b></span> : null}
        </span>
        {r.status === 'after' && r.afterRank ? (
          <span className="rung-meta">After rank {r.afterRank} sells out, {r.openAt}</span>
        ) : null}
        {r.status === 'locked' ? <span className="rung-meta">Opens when rank {r.rank + 1} sells out or times out</span> : null}
        <span className="rung-progress" role="progressbar" aria-label={`Rank ${r.rank} minted`} aria-valuemin={0} aria-valuemax={r.cap} aria-valuenow={r.sold}>
          <span ref={fill} />
        </span>
      </div>
      {cta ? <div className="rung-cta">{cta}</div> : null}
    </li>
  );
}

/** DOM order is rank 15 to rank 1 (the order they open); CSS shows rank 1 on top. */
export function Ladder({ rungs, ctaFor, live = false }: { rungs: RungData[]; live?: boolean; ctaFor?: (r: RungData) => ReactNode }) {
  const ordered = [...rungs].sort((a, b) => b.rank - a.rank);
  return (
    <ol className="ladder ladder--up" aria-label="Ladder of 15 ranks, rank 15 opens first">
      {ordered.map((r) => (
        <Rung key={r.rank} r={r} live={live} cta={ctaFor?.(r)} />
      ))}
    </ol>
  );
}

/** Same size as the real ladder, so nothing jumps when data arrives. Hidden from assistive tech while loading. */
export function LoadingLadder({ rungs }: { rungs: RungData[] }) {
  return (
    <div className="loading-ladder" aria-busy="true">
      <span className="sr-only" role="status">Loading the ladder</span>
      <div aria-hidden="true" inert><Ladder rungs={rungs} /></div>
    </div>
  );
}
