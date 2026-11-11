'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { armOnGesture, setSound, soundOn, subscribeSound } from '@/lib/sound';

/** Sound is off until the person turns it on. The choice is remembered on this device. */
export function SoundButton() {
  const on = useSyncExternalStore(subscribeSound, soundOn, () => false);
  useEffect(() => { window.dispatchEvent(new Event('gridlock:sound')); return armOnGesture(); }, []);
  return (
    <button type="button" className="sound-button" aria-pressed={on} onClick={() => setSound(!on)}>Sound: {on ? 'On' : 'Off'}</button>
  );
}
