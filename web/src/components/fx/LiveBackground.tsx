'use client';

import { useEffect, useRef } from 'react';
import { useMotionSettings } from './Motion';

export function LiveBackground({ mint }: { mint: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useMotionSettings();
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let cancelled = false;
    let idle: number | undefined;
    let timer: number | undefined;
    let stop: (() => void) | undefined;
    let lastPaint = 0;
    const lcp = typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')
      ? new PerformanceObserver((list) => { lastPaint = list.getEntries().at(-1)?.startTime ?? lastPaint; })
      : undefined;
    lcp?.observe({ type: 'largest-contentful-paint', buffered: true });

    const queue = () => {
      const deadline = performance.now() + 2000;
      const start = () => {
        if (cancelled) return;
        lcp?.disconnect();
        void import('./traffic').then(({ startTraffic }) => {
          if (!cancelled) stop = startTraffic(surface);
        }).catch(() => undefined);
      };
      const afterPaint = () => {
        const now = performance.now();
        if (lastPaint && now - lastPaint < 200 && now < deadline) {
          timer = window.setTimeout(afterPaint, 200);
          return;
        }
        if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(start);
        else timer = window.setTimeout(start, 0);
      };
      timer = window.setTimeout(afterPaint, 350);
    };
    if (document.readyState === 'complete') queue();
    else window.addEventListener('load', queue, { once: true });
    return () => {
      cancelled = true;
      lcp?.disconnect();
      window.removeEventListener('load', queue);
      if (idle !== undefined) cancelIdleCallback(idle);
      window.clearTimeout(timer);
      stop?.();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.fxRoute = mint ? 'mint' : '';
    return () => { delete document.documentElement.dataset.fxRoute; };
  }, [mint]);
  return <canvas ref={canvas} className="live-background" aria-hidden="true" />;
}
