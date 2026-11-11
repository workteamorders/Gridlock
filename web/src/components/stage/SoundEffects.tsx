'use client';

import { useEffect } from 'react';
import { play } from '@/lib/sound';

/** Plays the "rev" when the mint call to action is pressed. Does nothing while sound is off. */
export function SoundEffects() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest('a.btn--primary[href^="/mint"]');
      if (el) play('rev');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
