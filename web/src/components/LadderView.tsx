'use client';

import Link from 'next/link';
import { useChain } from '@/lib/chain-context';
import { exampleLadder } from '@/lib/mock';
import { toRungData } from '@/lib/ladder-view';
import { formatEth, formatUtc } from '@/lib/format';
import { Gate } from './Gate';
import { Ladder, LoadingLadder } from './Ladder';

/** Full ladder: rungs, a details table (cards on narrow screens by CSS) and the opening rule in plain words. */
export function LadderView() {
  const c = useChain();
  const live = c.phase === 'ready';
  const disabled = c.viewOnly || c.mismatches.length > 0;
  const example = c.phase === 'undeployed';
  const total = c.rungs.reduce((a, r) => a + r.sold, 0);
  const caps = c.rungs.reduce((a, r) => a + r.cap, 0);

  return (
    <div className="stack">
      {example ? (
        <div className="panel stack-tight">
          <span className="badge badge--example">Example</span>
          <p>Gridlock is not deployed yet. These rungs show the real caps with example prices and sales.</p>
        </div>
      ) : null}
      {c.phase === 'loading' ? <LoadingLadder rungs={exampleLadder()} /> : (
      <Gate needs={example ? 'none' : 'ready'}>
        {live ? <p className="dim num">{total} of {caps} ladder cars minted.</p> : null}
        <Ladder
          rungs={live ? toRungData(c.rungs) : exampleLadder()}
          ctaFor={live ? (r) => (r.status === 'open' && !disabled ? <Link className="btn btn--primary btn--sm" href={`/mint/?rank=${r.rank}`}>Mint rank {r.rank}</Link> : null) : undefined}
        />
        {live ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Details of all 15 ranks</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Price</th><th scope="col">Sold</th><th scope="col">Cap</th><th scope="col">Status</th><th scope="col">Opens by</th></tr></thead>
              <tbody>
                {[...c.rungs].sort((a, b) => b.rank - a.rank).map((r) => (
                  <tr key={r.rank}>
                    <th scope="row" className="num">{r.rank}</th>
                    <td data-label="Price" className="num">{formatEth(r.priceWei)}</td>
                    <td data-label="Sold" className="num">{r.sold}</td>
                    <td data-label="Cap" className="num">{r.cap}</td>
                    <td data-label="Status">{r.sold >= r.cap ? 'Sold out' : r.isOpen ? 'Open' : 'Waiting'}</td>
                    <td data-label="Opens by">{r.isOpen || r.sold >= r.cap ? '—' : formatUtc(r.opensAtLatest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Gate>
      )}
      <section className="stack-tight" aria-labelledby="rule-h">
        <h2 id="rule-h">How a rank opens</h2>
        <p>Rank 15 opens first, at the start time. Every other rank opens when the rank before it (the next number up) sells out, or when its own time limit passes, whichever comes first. The contract applies this rule by itself. Nobody can open a rank early, close one, or change a price.</p>
        <p>Prices only go up as the rank number goes down. Caps only get smaller. Limits per wallet are 2 cars for ranks 15 to 6 and 1 car for ranks 5 to 1, and a single transaction mints at most 2.</p>
      </section>
    </div>
  );
}
