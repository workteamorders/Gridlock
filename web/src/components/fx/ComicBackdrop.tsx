'use client';

import { useEffect, useRef } from 'react';

/** Decorative ink layers: one queued frame per input, no continuous JS loop. */
export function ComicBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let pointerX = innerWidth / 2;
    let pointerY = innerHeight / 2;
    const active = () => document.documentElement.dataset.motion === 'full' && !document.hidden;
    const paint = () => {
      frame = 0;
      if (!active()) { el.removeAttribute('style'); return; }
      el.style.setProperty('--comic-x', `${x * 22}px`);
      el.style.setProperty('--comic-y', `${y * 16}px`);
      el.style.setProperty('--comic-scroll', `${-Math.min(scrollY * 0.07, 320)}px`);
      el.style.setProperty('--comic-pointer-x', `${pointerX}px`);
      el.style.setProperty('--comic-pointer-y', `${pointerY}px`);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !active()) return;
      pointerX = event.clientX; pointerY = event.clientY;
      x = pointerX / innerWidth - 0.5; y = pointerY / innerHeight - 0.5;
      el.dataset.tracking = 'true';
      queue();
    };
    const reset = () => { x = 0; y = 0; delete el.dataset.tracking; queue(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', reset);
    window.addEventListener('gridlock:motion', reset);
    document.addEventListener('visibilitychange', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    queue();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', reset);
      window.removeEventListener('gridlock:motion', reset);
      document.removeEventListener('visibilitychange', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
    };
  }, []);
  return (
    <div ref={ref} className="comic-backdrop" aria-hidden="true">
      <div className="comic-backdrop__dots" />
      <div className="comic-backdrop__rails"><i /><i /></div>
      <div className="comic-backdrop__streaks"><i /><i /><i /></div>
      <div className="comic-backdrop__cursor" />
    </div>
  );
}
