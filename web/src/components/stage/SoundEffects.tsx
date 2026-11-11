'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { play } from '@/lib/sound';

const PRESSABLE = 'a[href], button, [role="button"], summary';

/** Page-wide sounds: engine rev on the mint call to action, a tick on every other press, a soft tick on hover, a whoosh for each chapter. Does nothing while sound is off. */
export function SoundEffects() {
  const pathname = usePathname();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || target.closest('.sound-button, [data-sound]')) return;
      if (target.closest('a.btn--primary[href^="/mint"]')) { play('rev'); return; }
      if (target.closest(PRESSABLE)) play('click');
    };
    let hovered: Element | null = null;
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const el = (event.target as Element | null)?.closest(PRESSABLE) ?? null;
      if (el === hovered) return;
      hovered = el;
      if (el && !el.closest('.sound-button, [data-sound], [disabled]')) play('hover');
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onOver, { passive: true });
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', onOver);
    };
  }, []);
  // Each chapter heading whooshes once, the first time it is well inside the screen.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const born = performance.now();
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || seen.has(e.target)) continue;
        seen.add(e.target);
        // Chapters that were already on screen when the page opened do not announce themselves.
        if (performance.now() - born > 600) play('whoosh');
      }
    }, { threshold: 0.9 });
    const timer = window.setTimeout(() => document.querySelectorAll('.chapter').forEach((n) => io.observe(n)), 50);
    return () => { window.clearTimeout(timer); io.disconnect(); };
  }, [pathname]);
  return null;
}
