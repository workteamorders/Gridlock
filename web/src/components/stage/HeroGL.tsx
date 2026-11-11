'use client';

import { useEffect, useRef, useState } from 'react';

/** Loads the halftone shader after the page has settled, only while motion is Full and a mouse or trackpad is present (it reacts to the pointer). Without WebGL the printed posters are all there is. */
export function HeroGL() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(document.documentElement.dataset.motion === 'full' && matchMedia('(any-pointer: fine)').matches);
    sync();
    window.addEventListener('gridlock:motion', sync);
    return () => window.removeEventListener('gridlock:motion', sync);
  }, []);
  useEffect(() => {
    const surface = canvas.current;
    const host = surface?.closest<HTMLElement>('.hero');
    if (!full || !surface || !host) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    let idle: number | undefined;
    const timer = window.setTimeout(() => {
      const start = () => {
        void import('./hero-gl').then(({ startHeroGL }) => { if (!cancelled) stop = startHeroGL(surface, host); }).catch(() => undefined);
      };
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(start); else start();
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
      stop?.();
    };
  }, [full]);
  return full ? <canvas ref={canvas} className="hero-gl" aria-hidden="true" /> : null;
}
