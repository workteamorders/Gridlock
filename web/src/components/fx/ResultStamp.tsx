import type { ReactNode } from 'react';

export function ResultStamp({ kind, children }: { kind: 'caught' | 'claimed'; children?: ReactNode }) {
  return (
    <div className="result-stamp">
      {children}
      <img className="result-stamp-mark" src={`/art/${kind}.svg`} alt={kind === 'caught' ? 'Caught' : 'Claimed'} width={180} height={50} />
      <svg className="result-confetti" viewBox="0 0 320 200" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => {
          const angle = i * Math.PI / 12;
          const x = 160 + Math.round(Math.cos(angle) * (88 + i % 4 * 18));
          const y = 100 + Math.round(Math.sin(angle) * (49 + i % 4 * 13));
          return <path key={i} transform={`translate(${x} ${y}) rotate(${i * 31})`}
            d={i % 2 ? 'M-4 -4H4V4H-4Z' : 'M0 -5L5 4H-5Z'} />;
        })}
      </svg>
    </div>
  );
}
