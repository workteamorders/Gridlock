import type { ReactNode } from 'react';

/** Section opener styled as a case-file tab: outline numeral, kicker, then the real heading. */
export function ChapterHead({ n, id, kicker, children }: { n: number; id: string; kicker: string; children: ReactNode }) {
  return (
    <header className="chapter">
      <span className="chapter-num" aria-hidden="true">{String(n).padStart(2, '0')}</span>
      <div className="stack-tight">
        <p className="label chapter-kicker">Case File {String(n).padStart(2, '0')}: {kicker}</p>
        <h2 id={id}>{children}</h2>
      </div>
    </header>
  );
}
