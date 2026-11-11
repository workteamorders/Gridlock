import { useId } from 'react';
import { carBodies, carWindows, liveries, carPaint } from '@/art/cars';
import { HeatStars } from './HeatStars';

export type CarShape = 'hatch' | 'coupe' | 'van';
export type CardKind = 'standard' | 'rank1' | 'hidden';

const SHAPES = { hatch: 0, coupe: 1, van: 2 } as const;

interface CardArtProps {
  kind: CardKind;
  rank?: number;
  plate: string;
  shape?: CarShape;
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  transfers?: number;
  peak?: number;
}

export function CardArt({ kind, rank, plate, shape = 'hatch', stars, transfers = 0, peak = 0 }: CardArtProps) {
  const hidden = kind === 'hidden';
  const top = kind === 'rank1';
  const paper = top ? 'var(--action)' : hidden ? 'var(--surface)' : 'var(--surface-2)';
  const ink = top ? 'var(--text-on-action)' : 'var(--text)';
  const band = top ? 'var(--brush)' : 'var(--action)';
  const bandInk = top ? 'var(--text-on-brush)' : 'var(--text-on-action)';
  const title = hidden ? 'Redacted' : 'Wanted';
  const rankText = hidden ? '??' : String(rank ?? 0).padStart(2, '0');
  const desc = hidden
    ? 'Hidden car, claimed only through the hunt'
    : `Rank ${rank}, plate ${plate}, heat ${stars} of 5, ${transfers} transfers, peak heat ${peak}`;
  const uid = useId();
  const variant = SHAPES[shape];
  const paint = carPaint[(rank ?? 0) % carPaint.length];
  return (
    <figure className="cardart">
      <span className="badge badge--example">Example</span>
      <svg viewBox="0 0 300 420" role="img" aria-label={desc}>
        <defs>
          <pattern id={`dots-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx="4" cy="4" r="1.8" fill={top ? 'var(--text-on-action)' : 'var(--text-dim)'} />
          </pattern>
        </defs>
        <rect x="3" y="3" width="294" height="414" fill={paper} stroke={hidden ? 'var(--text-dim)' : ink} strokeWidth="6" strokeDasharray={hidden ? '14 8' : undefined} />
        <rect x="3" y="3" width="294" height="52" fill={band} />
        <text x="150" y="42" textAnchor="middle" fontFamily="var(--font-display)" fontSize="38" fill={bandInk}>{title.toUpperCase()}</text>
        <polygon points="3,168 297,92 297,176 3,252" fill="var(--brush)" />
        <rect x="150" y="190" width="147" height="62" fill={`url(#dots-${uid})`} opacity="0.5" />
        {hidden ? (
          <g>
            <rect x="46" y="118" width="208" height="26" fill="var(--text)" />
            <rect x="46" y="154" width="130" height="26" fill="var(--text)" />
          </g>
        ) : (
          <g transform="translate(149 152) rotate(-12) scale(3.6)">
            <path d={carBodies[variant]} fill="var(--surface)" transform="translate(1.8 2)" />
            <path d={carBodies[variant]} fill={`var(${paint})`} stroke="var(--surface)" strokeWidth="1.5" />
            <path d={carWindows[variant]} fill="var(--surface)" />
            <path d={liveries[(rank ?? 0) % liveries.length]} fill="var(--surface)" />
          </g>
        )}
        <text x="22" y="352" fontFamily="var(--font-display)" fontSize="112" fill={ink}>{rankText}</text>
        <rect x="170" y="296" width="110" height="38" fill="var(--surface)" stroke={ink} strokeWidth="3" />
        <text x="225" y="323" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize="20" fill="var(--text)">{plate}</text>
        {!hidden ? (
          <g transform="translate(170,346)">
            {[0, 1, 2, 3, 4].map((i) => (
              <polygon key={i} transform={`translate(${i * 22},0)`} points="10,0 12.6,6.6 19.5,7 14.2,11.3 16,18.2 10,14.4 4,18.2 5.8,11.3 0.5,7 7.4,6.6" fill={i < stars ? 'var(--action)' : 'none'} stroke={i < stars ? 'var(--action)' : 'var(--text-dim)'} strokeWidth="1.8" />
            ))}
          </g>
        ) : null}
        <text x="22" y="394" fontFamily="var(--font-mono)" fontSize="13" fill={ink}>
          {hidden ? 'HUNT CAR, NOT SOLD' : `TRANSFERS ${transfers}  PEAK HEAT ${peak}`}
        </text>
        <path d="M3 410 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 l12 -7 l12 7 L297 420 L3 420 Z" fill="var(--surface)" />
      </svg>
      <figcaption className="sr-only">{desc}</figcaption>
    </figure>
  );
}

export { HeatStars };
