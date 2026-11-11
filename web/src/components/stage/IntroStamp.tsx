'use client';

import { useEffect, useState } from 'react';

const key = 'gridlock.intro';

/** One short stamp on the first visit of a session. Never blocks input, any key, tap or scroll skips it, and it only runs in full motion. */
export function IntroStamp() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch { seen = true; }
    if (seen || document.documentElement.dataset.motion !== 'full') return;
    try { sessionStorage.setItem(key, '1'); } catch {}
    setOn(true);
  }, []);
  useEffect(() => {
    if (!on) return;
    const done = () => setOn(false);
    const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, done, { passive: true, once: true }));
    window.addEventListener('gridlock:motion', done);
    return () => {
      events.forEach((e) => window.removeEventListener(e, done));
      window.removeEventListener('gridlock:motion', done);
    };
  }, [on]);
  if (!on) return null;
  return (
    <div className="intro" aria-hidden="true" onAnimationEnd={(event) => { if (event.target === event.currentTarget) setOn(false); }}>
      <span className="intro-tape" />
      <span className="intro-stamp">Case open</span>
    </div>
  );
}
