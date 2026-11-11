// Road and print symbols for ranks 1–15. The order is independent of sales and status.
const rankMarks = [
  'M4 16 17 3l13 13M22 16 35 3l13 13',
  'M4 17h8V9h8V3h8v6h8v8h12',
  'M4 4h44M4 16h44M10 10h6m7 0h6m7 0h6',
  'M4 10 12 3l8 7-8 7zm16 0 8-7 8 7-8 7zm16 0 6-7 6 7-6 7z',
  'M4 15c5-14 10-14 15 0s10-14 15 0 9-14 14 0',
  'M4 16 15 4m0 12L26 4m0 12L37 4m0 12L48 4',
  'M4 16V4h12m8 0h12v12m-8 0H16V4m28 0h4v12',
  'M4 6h15l8 8h21M4 14h15l8-8h21',
  'M4 5h8v10h8V5h8v10h8V5h12',
  'M4 16h44M8 12V8m9 4V5m9 7V3m9 9V5m9 7V8',
  'M4 10h10l5-6 7 12 7-12 5 6h10',
  'M4 6h10m4 0h7m4 0h19M4 14h18m4 0h7m4 0h11',
  'M4 4l10 12L24 4l10 12L44 4m-33 0 10 12L31 4l10 12',
  'M4 4h10v12H4zm17 0h10v12H21zm17 0h10v12H38zM7 10h4m13 0h4m13 0h4',
  'M4 10h11m-4-5 5 5-5 5m9-5h11m-4-5 5 5-5 5m9-5h11m-4-5 5 5-5 5',
] as const;

export function RankMark({ rank }: { rank: number }) {
  const path = rankMarks[rank - 1];
  if (!path) return null;
  return (
    <svg className="rank-mark" viewBox="0 0 52 20" width="52" height="20" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function HuntMark({ index }: { index: number }) {
  return (
    <svg className="hunt-mark" viewBox="0 0 42 26" width="42" height="26" aria-hidden="true">
      <path d="M1 9V1h8m24 0h8v8m0 8v8h-8M9 25H1v-8" />
      {[0, 1, 2, 3].map((bit) => (
        <rect key={bit} x={6 + bit * 8} y={(index + 1) & (1 << bit) ? 6 : 13} width="6" height="7" />
      ))}
    </svg>
  );
}
