'use client';

import { useEffect, useRef, useState } from 'react';
import { rollValue } from '@/lib/stage';

const duration = 700;

/** A number that rolls to its new value when it changes. The first value is shown at once, and so is every value outside full motion. */
export function RollNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (document.documentElement.dataset.motion !== 'full' || from.current === value) { from.current = value; setShown(value); return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / duration;
      setShown(rollValue(origin, value, t));
      if (t < 1) frame = requestAnimationFrame(tick); else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = value; };
  }, [value]);
  return <>{shown}</>;
}
