import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { HomeLadder } from '@/components/HomeLadder';
import { LiveJunction } from '@/components/fx/LiveJunction';

export const metadata: Metadata = { title: 'Gridlock: 2,475 wanted-poster cars, one ladder', alternates: { canonical: '/' } };

export default function HomePage() {
  return (
    <Shell current="/">
      <div className="wrap comic-page">
        <section className="comic-junction" aria-labelledby="junction-title">
          <LiveJunction title="Gridlock Junction" shortcut={
            <Link className="btn btn--primary btn--sm comic-ladder-shortcut" href="/ladder/">See the Ladder</Link>
          } />
        </section>
        <HomeLadder />
      </div>
    </Shell>
  );
}
