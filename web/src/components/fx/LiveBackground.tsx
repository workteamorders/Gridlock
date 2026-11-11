'use client';

import { useEffect } from 'react';
import { useTrafficCanvas } from './useTrafficCanvas';

const loadTraffic = () => import('./traffic').then((module) => module.startTraffic);

export function LiveBackground({ mint }: { mint: boolean }) {
  const canvas = useTrafficCanvas(loadTraffic);
  useEffect(() => {
    document.documentElement.dataset.fxRoute = mint ? 'mint' : '';
    return () => { delete document.documentElement.dataset.fxRoute; };
  }, [mint]);
  return <canvas ref={canvas} className="live-background" aria-hidden="true" />;
}
