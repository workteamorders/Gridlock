'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { readTokenImage, type CarInfo } from '@/lib/chain';
import { useChain } from '@/lib/chain-context';
import type { Stars } from '@/lib/heat';
import { CardImage } from './CardImage';
import { HeatStars } from './HeatStars';

/** Loads the card image from the contract only when the tile scrolls near the screen. */
export function useCarImage(id: number, eager = false) {
  const { deployment } = useChain();
  const ref = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible || !deployment) return;
    let cancelled = false;
    readTokenImage(deployment.cars, id).then((s) => { if (!cancelled) { if (s) setSrc(s); else setFailed(true); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visible, deployment, id]);
  return { ref, src, failed };
}

export function CarTile({ car }: { car: CarInfo }) {
  const { ref, src, failed } = useCarImage(car.id);
  const alt = `${car.hidden ? 'Hidden car' : `Rank ${car.rank} car`}, number ${car.id}, serial ${car.serial}`;
  return (
    <div ref={ref} className="stack-tight">
      <Link className="card-link" href={`/gallery/?id=${car.id}`} aria-label={`Open car ${car.id}`}>
        {failed ? <div className="empty"><p>Image unavailable</p></div> : <CardImage src={src} alt={alt} />}
      </Link>
      <p className="row">
        <span className="num">#{car.id}</span>
        <span>{car.hidden ? 'Hidden' : `Rank ${car.rank}`}</span>
        <HeatStars stars={car.stars as Stars} showLabel={false} />
      </p>
    </div>
  );
}
