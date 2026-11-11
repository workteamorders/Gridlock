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
      </div>
      <figcaption className="junction-caption">
        <span className="junction-hint">Click or tap the road</span>
        <div className="junction-actions">
          <button type="button" className="motion-button junction-cone"
            onClick={() => canvas.current?.dispatchEvent(new Event('gridlock:cone'))}>Drop cone</button>
          {shortcut}
        </div>
      </figcaption>
    </figure>
  );
}
