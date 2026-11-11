'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { HeroGL } from './HeroGL';

/** Home hero: a wall of pinned posters that drifts with the pointer, and one plate holding the headline. */
export function Hero({ art, children }: { art: ReactNode; children?: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      node.style.setProperty('--px', x.toFixed(3));
      node.style.setProperty('--py', y.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      if (document.documentElement.dataset.motion !== 'full' || event.pointerType === 'touch') return;
      const box = node.getBoundingClientRect();
      x = ((event.clientX - box.left) / box.width - 0.5) * 2;
      y = ((event.clientY - box.top) / box.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => { x = 0; y = 0; if (!frame) frame = requestAnimationFrame(apply); };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={root} className="hero" aria-labelledby="hero-title">
      <div className="hero-art" aria-hidden="true">
        {art}
        <HeroGL />
      </div>
      <div className="wrap hero-wrap">
        <div className="hero-plate stack-tight">
          <p className="label hero-kicker">Case File 00: fictional cars, real chain</p>
          <h1 id="hero-title"><span>2,475 wanted-poster cars.</span> <span className="hero-slash">One ladder.</span></h1>
          <p>Gridlock Cars are original comic cards drawn fully on-chain. Rank 15 opens first and is the cheapest. Each next rank opens when the one before sells out or times out, up to rank 1. You see the exact car before you pay.</p>
          <div className="row">
            <Link className="btn btn--primary btn--lg" href="#ladder">See the ladder</Link>
            <Link className="btn btn--secondary btn--lg" href="/gallery/">Browse the cards</Link>
          </div>
        </div>
        {children ? <div className="hero-aside">{children}</div> : null}
      </div>
    </section>
  );
}
