'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Line } from './dispatch';
import { SoundButton } from '../stage/SoundButton';
import { useTrafficCanvas } from './useTrafficCanvas';

const loadJunction = () => import('./junction').then((module) => module.startJunction);

export function LiveJunction({ title, shortcut }: { title: string; shortcut: ReactNode }) {
  const canvas = useTrafficCanvas(loadJunction);
  const [line, setLine] = useState<Line | null>(null);
  const [radioState, setRadioState] = useState('idle');
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ line?: Line; state?: string }>).detail;
      if (detail.line) setLine(detail.line);
      if (detail.state) setRadioState(detail.state);
    };
    surface.addEventListener('gridlock:radio', update);
    return () => surface.removeEventListener('gridlock:radio', update);
  }, [canvas]);
  return (
    <figure className="junction">
      <h1 id="junction-title" className="junction-title">{title}</h1>
      <div className="junction-scene">
        <svg className="junction-poster" viewBox="0 0 560 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <use href="/art/junction.svg#junction-map" />
        </svg>
        <canvas ref={canvas} className="junction-canvas" aria-hidden="true" />
        <div className="chase-heat" aria-hidden="true">
          <span className="chase-label">Congestion</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <svg key={n} className="chase-star" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" /></svg>
          ))}
          <span className="chase-state chase-state--run">Pending</span>
          <span className="chase-state chase-state--busted">Reverted</span>
        </div>
      </div>
      <div className="junction-radio-transcript" data-speaking={radioState === 'speaking'} aria-live="off">
        <div className="junction-radio-toolbar">
          <span className="label">{radioState === 'speaking' ? 'Radio · transmitting' : 'Radio'}</span>
          <SoundButton />
        </div>
        <p>{line ? <><b>{line.tag}:</b> {line.text}</> : 'Standing by.'}</p>
        {radioState === 'unavailable' ? <p className="dim">Radio voice is unavailable on this device. The transcript stays available.</p> : null}
      </div>
      <figcaption className="junction-caption">
        <span className="junction-hint">Bots in the queue? Click the road ahead to block them</span>
        <div className="junction-actions">
          <button type="button" className="motion-button junction-cone"
            onClick={() => canvas.current?.dispatchEvent(new Event('gridlock:cone'))}>Drop cone</button>
          {shortcut}
        </div>
      </figcaption>
    </figure>
  );
}
