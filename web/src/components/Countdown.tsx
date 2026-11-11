'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  /** Target as unix seconds. */
  target: number;
  /** Fixed "now" in unix seconds, for the styleguide only. */
  frozenNow?: number;
  /** Chain-time source in unix seconds. Defaults to the device clock. */
  nowFn?: () => number;
  label: string;
}

function parts(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ target, frozenNow, nowFn, label }: CountdownProps) {
  const [now, setNow] = useState<number | null>(frozenNow ?? null);

  useEffect(() => {
    if (frozenNow !== undefined) return;
    const tick = () => setNow(Math.floor(nowFn ? nowFn() : Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [frozenNow, nowFn]);

  if (now === null) {
    return <div className="countdown skeleton" aria-label={`${label}: loading`} role="timer">&nbsp;</div>;
  }
  const p = parts(target - now);
  const text = `${p.d} days ${p.h} hours ${p.m} minutes ${p.s} seconds`;
  return (
    <div role="timer" aria-label={`${label}: ${text}`}>
      <div className="countdown" aria-hidden="true">
        <div><span>{p.d}</span><small>Days</small></div>
        <div><span>{pad(p.h)}</span><small>Hrs</small></div>
        <div><span>{pad(p.m)}</span><small>Min</small></div>
        <div><span>{pad(p.s)}</span><small>Sec</small></div>
      </div>
    </div>
  );
}
