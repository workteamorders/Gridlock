'use client';

import type { ReactNode } from 'react';
import { useTrafficCanvas } from './useTrafficCanvas';

const loadJunction = () => import('./junction').then((module) => module.startJunction);

export function LiveJunction({ title, shortcut }: { title: string; shortcut: ReactNode }) {
  const canvas = useTrafficCanvas(loadJunction);
  return (
    <figure className="junction">
      <h1 id="junction-title" className="junction-title">{title}</h1>
      <div className="junction-scene">
        <svg className="junction-poster" viewBox="0 0 560 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <use href="/art/junction.svg#junction-map" />
        </svg>
        <canvas ref={canvas} className="junction-canvas" aria-hidden="true" />
        <div className="chase-heat" aria-hidden="true">
          <span className="chase-label">Heat</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <svg key={n} className="chase-star" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" /></svg>
          ))}
          <span className="chase-state chase-state--run">Pursuit</span>
          <span className="chase-state chase-state--busted">Busted</span>
        </div>
      </div>
      <figcaption className="junction-caption">
        <span className="junction-hint">Siren? Click the road ahead to block it</span>
        <div className="junction-actions">
          <button type="button" className="motion-button junction-cone"
            onClick={() => canvas.current?.dispatchEvent(new Event('gridlock:cone'))}>Drop cone</button>
          {shortcut}
        </div>
      </figcaption>
    </figure>
  );
}
