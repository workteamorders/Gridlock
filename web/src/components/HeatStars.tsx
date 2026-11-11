const STAR = '12,2 15,9 22,9.5 16.5,14 18.5,21.5 12,17.5 5.5,21.5 7.5,14 2,9.5 9,9';

export function HeatStars({ stars, showLabel = true }: { stars: 0 | 1 | 2 | 3 | 4 | 5; showLabel?: boolean }) {
  const label = stars === 0 ? 'No heat' : `Heat ${stars} of 5`;
  return (
    <span className="heat" role="img" aria-label={label}>
      <svg viewBox="0 0 120 24" width="90" height="18" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${i * 24},0)`}>
            <polygon
              points={STAR}
              fill={i < stars ? 'var(--action)' : 'none'}
              stroke={i < stars ? 'var(--action)' : 'var(--text-dim)'}
              strokeWidth="2"
              strokeLinejoin="miter"
            />
          </g>
        ))}
      </svg>
      {showLabel ? <span aria-hidden="true">{label}</span> : null}
    </span>
  );
}
