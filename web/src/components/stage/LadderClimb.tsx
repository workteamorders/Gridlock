'use client';

import { useEffect, useRef, useState } from 'react';
import { SPEC } from '@/lib/config';
import { play } from '@/lib/sound';
import { CLIMB_STEPS, capOfRank, climbProgress, climbStep, rankAtStep } from '@/lib/stage';
import { ChapterHead } from './ChapterHead';

const steps = Array.from({ length: CLIMB_STEPS }, (_, i) => i);

/** Scroll story: a car climbs from rank 15 to rank 1 while the section stays pinned. Without full motion it is a plain list. */
export function LadderClimb() {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const heard = useRef<number | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (document.documentElement.dataset.motion !== 'full') { node.style.removeProperty('--p'); setStep(0); heard.current = null; return; }
      const box = node.getBoundingClientRect();
      const p = climbProgress(box.top, box.height, window.innerHeight);
      node.style.setProperty('--p', p.toFixed(4));
      const next = climbStep(p);
      setStep(next);
      // The first reading only sets the baseline, so opening the page halfway down is silent. After that every rung makes a note, rising with the climb.
      if (heard.current !== null && next !== heard.current) play(next === CLIMB_STEPS - 1 ? 'summit' : 'step', next);
      heard.current = next;
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('gridlock:motion', queue);
    queue();
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      window.removeEventListener('gridlock:motion', queue);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const rank = rankAtStep(step);
  return (
    <section ref={root} className="climb section" aria-labelledby="climb-title" data-step={step}>
      <div className="climb-pin">
        <div className="wrap stack">
          <ChapterHead n={2} id="climb-title" kicker="the climb">From rank 15 to rank 1</ChapterHead>
          <p className="climb-lead">Each rung up costs more and has fewer cars. Scroll to climb it.</p>
          <div className="climb-stage" aria-hidden="true">
            <ol className="climb-steps">
              {steps.map((i) => <li key={i} className="climb-step" data-lit={i <= step || undefined} data-here={i === step || undefined} />)}
            </ol>
            <span className="climb-car" />
          </div>
          <p className="climb-readout num" aria-hidden="true"><b>Rank {rank}</b> <span>{capOfRank(SPEC.defaultCaps, rank)} cars</span></p>
          <ol className="climb-list">
            {steps.map((i) => <li key={i}>Rank {rankAtStep(i)}: {capOfRank(SPEC.defaultCaps, rankAtStep(i))} cars</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}
