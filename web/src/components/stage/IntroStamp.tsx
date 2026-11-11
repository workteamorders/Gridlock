'use client';

import { useEffect, useState } from 'react';

const key = 'gridlock.intro';

/** One short stamp on the first visit of a session. Never blocks input, any key, tap or scroll skips it, and it only runs in full motion. */
export function IntroStamp() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch { seen = true; }
    if (seen) return;
    // The Motion setting is applied by whichever component mounts first, so wait until it exists.
    const decide = () => {
      const mode = document.documentElement.dataset.motion;
      if (!mode) return false;
      window.removeEventListener('gridlock:motion', decide);
      if (mode !== 'full') return true;
      try { sessionStorage.setItem(key, '1'); } catch {}
      setOn(true);
      return true;
    };
    if (decide()) return;
    window.addEventListener('gridlock:motion', decide);
    return () => window.removeEventListener('gridlock:motion', decide);
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
