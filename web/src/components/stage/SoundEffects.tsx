'use client';

import { useEffect } from 'react';
import { play } from '@/lib/sound';

/** Engine rev on the mint call to action, a tick on other buttons. Does nothing while sound is off. */
export function SoundEffects() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('a.btn--primary[href^="/mint"]')) { play('rev'); return; }
      if (target?.closest('.btn') && !target.closest('[data-sound]')) play('click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
