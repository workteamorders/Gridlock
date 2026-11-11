import { HeatStars } from './HeatStars';

export type CarShape = 'hatch' | 'coupe' | 'van';
export type CardKind = 'standard' | 'rank1' | 'hidden';

const BODY: Record<CarShape, string> = {
  hatch: 'M24 140 L44 140 Q52 100 96 96 L156 96 Q196 98 220 128 L240 132 L240 160 L24 160 Z',
  coupe: 'M20 142 L48 138 Q74 108 124 104 L170 106 Q204 110 228 134 L248 138 L248 162 L20 162 Z',
  van: 'M28 160 L28 94 Q28 86 38 86 L184 86 Q204 86 216 112 L244 134 L244 160 Z',
};
const WINDOW: Record<CarShape, string> = {
  hatch: 'M62 126 L74 106 L100 104 L100 126 Z M110 104 L152 104 Q172 108 188 126 L110 126 Z',
  coupe: 'M78 128 L94 112 L128 110 L128 128 Z M138 110 L168 112 Q190 118 204 130 L138 130 Z',
  van: 'M44 118 L44 98 L104 98 L104 118 Z M114 98 L180 98 Q192 100 200 118 L114 118 Z',
};

interface CardArtProps {
  kind: CardKind;
  rank?: number;
  plate: string;
  shape?: CarShape;
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  transfers?: number;
  peak?: number;
  /** Label shown above the card. The styleguide art is a mock, not renderer output. */
  example?: boolean;
}

export function CardArt({ kind, rank, plate, shape = 'hatch', stars, transfers = 0, peak = 0, example = true }: CardArtProps) {
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
  const uid = `${kind}-${plate}`.replace(/[^a-z0-9]/gi, '');
  return (
    <figure className="cardart">
      {example ? <span className="badge badge--example">Example mock</span> : null}
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
          <g stroke={ink} strokeWidth="5" strokeLinejoin="round">
            <path d={BODY[shape]} fill={ink === 'var(--text)' ? 'var(--text)' : 'var(--text-on-action)'} />
            <path d={WINDOW[shape]} fill={paper} strokeWidth="3" />
            <circle cx="76" cy="162" r="20" fill={paper} />
            <circle cx="200" cy="162" r="20" fill={paper} />
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
