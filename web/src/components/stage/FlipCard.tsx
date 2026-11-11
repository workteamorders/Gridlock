'use client';

import { useState, type ReactNode } from 'react';
import { play } from '@/lib/sound';

/** A card that flips to its rap sheet. The back repeats facts shown beside the card, so it is hidden from screen readers. */
export function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="flip-wrap stack-tight">
      <div className="flip" data-flipped={flipped || undefined}>
        <div className="flip-inner">
          <div className="flip-face flip-front">{front}</div>
          <div className="flip-face flip-back" aria-hidden="true">{back}</div>
        </div>
      </div>
      <button type="button" className="btn btn--secondary" data-sound="flip" aria-pressed={flipped} onClick={() => { play('flip'); setFlipped((v) => !v); }}>
        {flipped ? 'Show the card' : 'Flip to the rap sheet'}
      </button>
    </div>
  );
}
