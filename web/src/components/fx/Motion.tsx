'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Mode = 'full' | 'reduced' | 'off';
type Connection = EventTarget & { saveData?: boolean };
export const connection = () => (navigator as Navigator & { connection?: Connection }).connection;
const key = 'gridlock.motion';
const modes = ['full', 'reduced', 'off'] as const;
const labels = { full: 'Full', reduced: 'Reduced', off: 'Off' };
let selected: Mode | undefined;
let loaded = false;
const media = () => matchMedia('(prefers-reduced-motion: reduce)');
const forcedOff = () => new URLSearchParams(location.search).get('motion') === 'off';
const preferred = (): Mode => media().matches ? 'reduced' : 'full';

function snapshot() {
  return forcedOff() ? 'off' : selected ?? preferred();
}

function update() {
  const mode = snapshot();
  document.documentElement.dataset.motion = mode === 'full' && (media().matches || document.hidden || connection()?.saveData)
    ? 'reduced' : mode;
  window.dispatchEvent(new Event('gridlock:motion'));
}

function subscribe(listener: () => void) {
  window.addEventListener('gridlock:motion', listener);
  return () => window.removeEventListener('gridlock:motion', listener);
}

export function useMotionSettings() {
  useEffect(() => {
    if (!loaded) {
      loaded = true;
      try {
        const stored = localStorage.getItem(key);
        selected = modes.find((mode) => mode === stored);
      } catch {}
    }
    const query = media();
    const network = connection();
    query.addEventListener('change', update);
    network?.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      query.removeEventListener('change', update);
      network?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  // Shell mounts for each route, including navigation back to the same route.
  useEffect(update);
}

export function MotionButton() {
  const mode = useSyncExternalStore(subscribe, snapshot, (): Mode => 'full');
  const locked = useSyncExternalStore(subscribe, forcedOff, () => false);
  return (
    <button type="button" className="motion-button" disabled={locked} onClick={() => {
      selected = modes[(modes.indexOf(mode) + 1) % modes.length];
      try { if (selected) localStorage.setItem(key, selected); } catch {}
      update();
    }}>Motion: {labels[mode]}</button>
  );
}
