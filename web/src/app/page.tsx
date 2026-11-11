import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { HomeLadder } from '@/components/HomeLadder';
import { SupplyChart } from '@/components/SupplyChart';

export const metadata: Metadata = { title: 'Gridlock: 2,475 wanted-poster cars, one ladder', alternates: { canonical: '/' } };

export default function HomePage() {
  return (
    <Shell current="/">
      <section className="wrap section"><HomeLadder /></section>

      <div className="hazard-tape" aria-hidden="true" />
      <section className="wrap section" aria-labelledby="why">
        <div className="split">
          <div className="panel stack">
            <h2 id="why">Why it is built this way</h2>
            <p>Every card is decided by its rank and serial number, with no randomness. The next card for each rank is shown before you sign, drawn by the contract itself.</p>
            <p>The contracts have no owner and no admin functions. The price, the timers and the caps are fixed when they are deployed, and sales go to one treasury address you can read on the Contracts page.</p>
            <p><Link href="/rules/">Read the rules</Link> or <Link href="/contracts/">check the contracts yourself</Link>.</p>
          </div>
          <SupplyChart />
        </div>
      </section>

      <section className="wrap section" aria-labelledby="how">
        <div className="panel stack">
          <h2 id="how">How it works</h2>
          <ol className="stack steps">
            <li><b>Pick a rung.</b> Only open ranks can be minted. Each wallet can take 2 cars per rank for ranks 15 to 6, and 1 car per rank for ranks 5 to 1.</li>
            <li><b>Check the toll gate.</b> You see the exact car, the total, where the money goes, and what cannot be undone. Then your wallet signs.</li>
            <li><b>Watch the heat.</b> Each time a car changes hands it gets 20 heat points, and heat drains by 1 point every hour. Heat is only a picture of recent moves. It changes no price, rule or right.</li>
          </ol>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="hunt">
        <div className="panel stack">
          <h2 id="hunt">The Hunt</h2>
          <p>12 hidden cars cannot be bought. Each one is claimed by finding a secret code somewhere outside this site. Claiming costs only gas. It is about finding information, not luck, and codes leak once they are found.</p>
          <p><Link className="btn btn--secondary" href="/hunt/">See the 12 hidden cars</Link></p>
        </div>
      </section>
    </Shell>
  );
}
