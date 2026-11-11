import { RANK_CAPS } from '@/lib/mock';

const W = 640, H = 260, PL = 44, PB = 40, PT = 28;

export function SupplyChart() {
  const ranks = Array.from({ length: 15 }, (_, i) => 15 - i);
  const max = 400;
  const bw = (W - PL) / ranks.length;
  const summary = `Supply shrinks from 400 cards at rank 15 to 10 cards at rank 1. Total ladder supply is 2,475.`;
  return (
    <figure className="chart chart--supply">
      <figcaption>
        <h3 className="chart-title">{summary}</h3>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <line className="axis" x1={PL} y1={H - PB} x2={W} y2={H - PB} />
        <line className="axis" x1={PL} y1={PT} x2={PL} y2={H - PB} />
        {[0, 200, 400].map((v) => {
          const y = H - PB - (v / max) * (H - PB - PT);
          return <text key={v} x={PL - 6} y={y + 4} textAnchor="end">{v}</text>;
        })}
        {ranks.map((r, i) => {
          const cap = RANK_CAPS[r] ?? 0;
          const h = (cap / max) * (H - PB - PT);
          return (
            <g key={r}>
              <rect className={r <= 3 ? 'bar bar--hot' : 'bar'} x={PL + i * bw + 4} y={H - PB - h} width={bw - 8} height={h}>
                <title>{`Rank ${r}: ${cap} cards`}</title>
              </rect>
              <text x={PL + i * bw + bw / 2} y={H - PB - h - 4} textAnchor="middle">{cap}</text>
              <text x={PL + i * bw + bw / 2} y={H - PB + 16} textAnchor="middle">{r}</text>
            </g>
          );
        })}
        <text x={PL + (W - PL) / 2} y={H - 6} textAnchor="middle">Rank (15 opens first, 1 opens last)</text>
        <text x={4} y={PT - 2} textAnchor="start">Cards</text>
      </svg>
      <p className="dim">Bars with a brush-red fill are ranks 3, 2, and 1, the three ranks with the fewest cars. The number above each bar is that rank's exact cap.</p>
    </figure>
  );
}
