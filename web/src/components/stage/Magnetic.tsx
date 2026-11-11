'use client';

import { useEffect } from 'react';
import { magnetOffset } from '@/lib/stage';

const radius = 90;
const max = 7;
const selector = '.btn--primary:not(:disabled):not([aria-disabled=true])';

/** Primary buttons lean toward a nearby mouse pointer. Mouse only, full motion only, and never more than a few pixels. */
export function Magnetic() {
  useEffect(() => {
    if (!matchMedia('(any-pointer: fine)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const clear = () => document.querySelectorAll<HTMLElement>(selector).forEach((el) => el.style.removeProperty('translate'));
    const apply = () => {
      frame = 0;
      if (document.documentElement.dataset.motion !== 'full') { clear(); return; }
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        const box = el.getBoundingClientRect();
        if (box.bottom < -radius || box.top > innerHeight + radius) return;
        const [dx, dy] = magnetOffset(x - (box.left + box.width / 2), y - (box.top + box.height / 2), radius + box.width / 2, max);
        if (dx === 0 && dy === 0) el.style.removeProperty('translate'); else el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      });
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX; y = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => { clear(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('gridlock:motion', clear);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('gridlock:motion', clear);
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, []);
  return null;
}
