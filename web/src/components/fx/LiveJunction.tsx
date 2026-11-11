'use client';

import { useTrafficCanvas } from './useTrafficCanvas';

const loadJunction = () => import('./junction').then((module) => module.startJunction);

export function LiveJunction() {
  const canvas = useTrafficCanvas(loadJunction);
  return (
    <figure className="junction">
      <div className="junction-scene">
        <svg className="junction-poster" viewBox="0 0 560 360" aria-hidden="true">
          <use href="/art/junction.svg#junction-map" />
        </svg>
        <canvas ref={canvas} className="junction-canvas" aria-hidden="true" />
      </div>
      <figcaption className="junction-caption">
        <span>Live junction</span>
        <button type="button" className="motion-button junction-cone"
          onClick={() => canvas.current?.dispatchEvent(new Event('gridlock:cone'))}>Drop cone</button>
      </figcaption>
    </figure>
  );
}
