'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { play, setSound, soundChoice } from '@/lib/sound';

const key = 'gridlock.intro';
/** What gets blocked from focus and clicks while the gate is open. */
const BEHIND = '.site-header, #main, .site-footer';
/** Sounds of the 2.4 s sequence, in milliseconds after the press: tape, stamp, car. */
const CUES: [number, 'whoosh' | 'stamp' | 'rev'][] = [[0, 'whoosh'], [600, 'stamp'], [1250, 'rev']];

type Phase = 'idle' | 'gate' | 'play';

/** Tells the live scenes underneath (the junction) to rest while the intro covers them, and to start fresh when it ends. */
function setCovered(on: boolean) {
  const root = document.documentElement;
  if (on === root.hasAttribute('data-intro')) return;
  if (on) root.setAttribute('data-intro', 'on'); else root.removeAttribute('data-intro');
  window.dispatchEvent(new Event('gridlock:intro'));
}

/**
 * Once per session on the home page, in full motion only: a gate asks for one press (a press is what lets the browser
 * play sound), then tape, stamp and a car drive past with sound while the page is wiped in. Nothing is asked: sound just
 * plays, unless the visitor muted it earlier, and the Sound button in the header turns it off at any time.
 * The page is already loaded underneath, so nothing waits on this. Any key, tap or scroll skips the sequence.
 */
export function IntroStamp() {
  const [phase, setPhase] = useState<Phase>('idle');
  const gate = useRef<HTMLDivElement>(null);
  const cues = useRef<number[]>([]);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch { seen = true; }
    if (seen) return;
    // The Motion setting is applied by whichever component mounts first, so wait until it exists.
    const decide = () => {
      const mode = document.documentElement.dataset.motion;
      if (!mode) return false;
      window.removeEventListener('gridlock:motion', decide);
      if (mode === 'full') setPhase('gate');
      return true;
    };
    if (decide()) return;
    window.addEventListener('gridlock:motion', decide);
    return () => window.removeEventListener('gridlock:motion', decide);
  }, []);

  const finish = useCallback(() => {
    cues.current.forEach((t) => window.clearTimeout(t));
    cues.current = [];
    setPhase('idle');
  }, []);

  /** `silent` is Escape: no sound this time, and nothing is saved. A visitor who muted earlier stays muted. */
  const enter = useCallback((silent: boolean) => {
    try { sessionStorage.setItem(key, '1'); } catch {}
    if (!silent && soundChoice() !== 'off') setSound(true, true);
    setPhase('play');
    for (const [ms, kind] of CUES) cues.current.push(window.setTimeout(() => play(kind), ms));
  }, []);

  // Gate: focus the first button, keep Tab inside, block the page behind, Escape enters without sound.
  useEffect(() => {
    if (phase !== 'gate') return;
    const root = gate.current;
    const behind = Array.from(document.querySelectorAll<HTMLElement>(BEHIND));
    behind.forEach((n) => n.setAttribute('inert', ''));
    root?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); enter(true); return; }
      if (event.key !== 'Tab' || !root) return;
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      else if (!root.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
    };
    // The page behind should not scroll while the gate is open.
    const stop = (event: Event) => event.preventDefault();
    const closeIfMotionChanges = () => { if (document.documentElement.dataset.motion !== 'full') setPhase('idle'); };
    document.addEventListener('keydown', onKey);
    root?.addEventListener('wheel', stop, { passive: false });
    root?.addEventListener('touchmove', stop, { passive: false });
    window.addEventListener('gridlock:motion', closeIfMotionChanges);
    return () => {
      behind.forEach((n) => n.removeAttribute('inert'));
      document.removeEventListener('keydown', onKey);
      root?.removeEventListener('wheel', stop);
      root?.removeEventListener('touchmove', stop);
      window.removeEventListener('gridlock:motion', closeIfMotionChanges);
    };
  }, [phase, enter]);

  // Sequence: any key, tap or scroll skips it, but not the press that started it.
  useEffect(() => {
    if (phase !== 'play') return;
    const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
    const arm = window.setTimeout(() => events.forEach((e) => window.addEventListener(e, finish, { passive: true, once: true })), 350);
    window.addEventListener('gridlock:motion', finish);
    return () => {
      window.clearTimeout(arm);
      events.forEach((e) => window.removeEventListener(e, finish));
      window.removeEventListener('gridlock:motion', finish);
    };
  }, [phase, finish]);

  useEffect(() => {
    setCovered(phase !== 'idle');
    return () => setCovered(false);
  }, [phase]);

  if (phase === 'gate') {
    return (
      <div ref={gate} className="intro intro--gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-note">
        <span className="intro-tape" aria-hidden="true" />
        <div className="panel stack gate-card">
          <p className="label">Case File 00</p>
          <p id="gate-title" className="gate-title">Gridlock</p>
          <p id="gate-note" className="dim gate-note">Sound plays from here. Turn it off in the header.</p>
          <div className="gate-actions">
            <button type="button" className="btn btn--primary" data-sound="gate" onClick={() => enter(false)}>Open the case</button>
          </div>
        </div>
      </div>
    );
  }
  if (phase === 'play') {
    return (
      <div className="intro intro--play" aria-hidden="true" onAnimationEnd={(event) => { if (event.target === event.currentTarget) finish(); }}>
        <span className="intro-tape" />
        <span className="intro-stamp">Case open</span>
        <span className="intro-run"><span className="intro-speed" /><img className="intro-car" src="/art/climb-car.svg" alt="" width={290} height={106} /></span>
      </div>
    );
  }
  return null;
}
