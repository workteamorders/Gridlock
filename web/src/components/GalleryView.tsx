'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { readCar, type CarInfo } from '@/lib/chain';
import { useChain } from '@/lib/chain-context';
import { checkCarId } from '@/lib/validation';
import { formatUtc, shortAddress } from '@/lib/format';
import { explorerAddress } from '@/lib/config';
import type { Stars } from '@/lib/heat';
import { Button } from './Button';
import { CarTile, useCarImage } from './CarTile';
import { CardImage } from './CardImage';
import { DeadEnd } from './Signs';
import { Gate } from './Gate';
import { HeatStars } from './HeatStars';

const CHUNK = 24;

function Detail({ id }: { id: number }) {
  const c = useChain();
  const [car, setCar] = useState<CarInfo | null>(null);
  const [err, setErr] = useState(false);
  const { src, failed } = useCarImage(id, true);
  useEffect(() => {
    if (!c.deployment) return;
    let off = false;
    setCar(null); setErr(false);
    readCar(c.deployment.cars, id).then((x) => { if (!off) setCar(x); }).catch(() => { if (!off) setErr(true); });
    return () => { off = true; };
  }, [c.deployment, id]);
  if (err) return <DeadEnd title="Could not load this car" actions={<Link className="btn btn--secondary" href="/gallery/">Back to the Gallery</Link>}><p>The network did not answer. Nothing changed.</p></DeadEnd>;
  const link = car ? explorerAddress(car.owner) : undefined;
  return (
    <div className="split">
      {failed ? <div className="empty"><p>Image unavailable</p></div> : <CardImage src={src} size={340} alt={car ? `${car.hidden ? 'Hidden car' : `Rank ${car.rank} car`}, number ${car.id}, serial ${car.serial}` : 'Loading card'} />}
      <div className="stack">
        <h2>Car #{id}</h2>
        {car ? (
          <>
            <p className="row"><span>{car.hidden ? 'Hidden car' : `Rank ${car.rank}`}</span><HeatStars stars={car.stars as Stars} /></p>
            <h3>Rap sheet</h3>
            <dl className="kv">
              <dt>Serial</dt><dd className="num">{car.serial}</dd>
              <dt>Minted</dt><dd>{formatUtc(car.mintedAt)}</dd>
              <dt>Transfers</dt><dd className="num">{car.transferCount}</dd>
              <dt>Heat now</dt><dd className="num">{car.heat} of {c.constants?.heatMax ?? 150}</dd>
              <dt>Peak heat</dt><dd className="num">{car.peakHeat} ({car.peakStars} of 5 stars)</dd>
              <dt>Last moved</dt><dd>{car.lastMovedAt ? formatUtc(car.lastMovedAt) : 'Never moved'}</dd>
              <dt>Owner</dt><dd className="num">{link ? <a href={link} rel="noopener noreferrer">{shortAddress(car.owner)}</a> : shortAddress(car.owner)}</dd>
            </dl>
            <p className="dim">{car.heat > 0 && car.heatZeroAt ? `Heat reaches 0 at ${formatUtc(car.heatZeroAt)} if the car is not moved.` : 'This car has no heat.'} Heat is a picture of recent transfers. It changes no price, rule or right.</p>
          </>
        ) : <div className="skeleton gate-sk" aria-busy="true" />}
        <Link className="btn btn--secondary" href="/gallery/">Back to the Gallery</Link>
      </div>
    </div>
  );
}

function List() {
  const c = useChain();
  const [cars, setCars] = useState<CarInfo[]>([]);
  const [next, setNext] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rank, setRank] = useState('all');
  const [stars, setStars] = useState('all');
  const [hidden, setHidden] = useState('all');
  const busy = useRef(false);
  const total = c.totalMinted;
  const cars0 = c.deployment?.cars;

  const more = useCallback(async () => {
    if (!cars0 || busy.current) return;
    busy.current = true; setLoading(true); setFailed(false);
    try {
      const end = Math.min(total, next + CHUNK - 1);
      const ids = Array.from({ length: Math.max(0, end - next + 1) }, (_, i) => next + i);
      const got = await Promise.all(ids.map((id) => readCar(cars0, id)));
      setCars((p) => [...p, ...got]); setNext(end + 1);
    } catch { setFailed(true); } finally { busy.current = false; setLoading(false); }
  }, [cars0, next, total]);

  useEffect(() => { if (cars.length === 0 && total > 0 && !busy.current) void more(); }, [total, cars.length, more]);

  const shown = useMemo(() => cars.filter((x) =>
    (rank === 'all' || String(x.rank) === rank) && (stars === 'all' || String(x.stars) === stars) && (hidden === 'all' || (hidden === 'yes') === x.hidden)).reverse(), [cars, rank, stars, hidden]);

  if (total === 0) return <div className="empty"><div><h2>No cars yet</h2><p>Cars appear here as soon as the first one is minted.</p></div></div>;
  return (
    <div className="stack">
      <div className="row" role="group" aria-label="Filters">
        <label className="stack-tight"><span className="label">Rank</span>
          <select className="select" value={rank} onChange={(e) => setRank(e.target.value)}><option value="all">All ranks</option>{Array.from({ length: 15 }, (_, i) => <option key={i} value={i + 1}>Rank {i + 1}</option>)}</select></label>
        <label className="stack-tight"><span className="label">Heat stars</span>
          <select className="select" value={stars} onChange={(e) => setStars(e.target.value)}><option value="all">Any</option>{[0, 1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="stack-tight"><span className="label">Hidden cars</span>
          <select className="select" value={hidden} onChange={(e) => setHidden(e.target.value)}><option value="all">All</option><option value="yes">Hidden only</option><option value="no">Hide hidden</option></select></label>
      </div>
      <p className="dim" role="status">Showing {shown.length} of {cars.length} loaded cars. {total} cars exist. Filters apply to the cars loaded so far.</p>
      {shown.length === 0 && !loading ? <div className="empty"><p>No loaded car matches. Load more or change the filters.</p></div> : (
        <ul className="card-grid">{shown.map((x) => <li key={x.id}><CarTile car={x} /></li>)}</ul>
      )}
      {failed ? <div className="alert alert--bad" role="alert"><p>Some cars did not load. Nothing changed.</p></div> : null}
      {next <= total ? <div><Button variant="secondary" loading={loading} onClick={() => void more()}>Load {Math.min(CHUNK, total - next + 1)} more</Button></div> : null}
    </div>
  );
}

export function GalleryView() {
  const c = useChain();
  const params = useSearchParams();
  const raw = params.get('id');
  const checked = raw !== null ? checkCarId(raw, c.totalMinted) : null;
  return (
    <Gate>
      {checked ? (checked.ok ? <Detail id={checked.value} /> : <div className="stack"><div className="alert alert--bad" role="alert"><p>{checked.error}</p></div><Link className="btn btn--secondary" href="/gallery/">Back to the Gallery</Link></div>) : <List />}
    </Gate>
  );
}
