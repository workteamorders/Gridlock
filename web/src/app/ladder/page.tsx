import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { LadderView } from '@/components/LadderView';

export const metadata: Metadata = { title: 'Ladder', description: 'All 15 ranks with live price, supply, status and opening time. Rank 15 opens first; each next rank opens when the one before sells out or times out.', alternates: { canonical: '/ladder/' } };

export default function LadderPage() {
  return (
    <Shell current="/ladder/">
      <section className="wrap section stack">
        <h1>The Ladder</h1>
        <p>Fifteen ranks, 2,475 cars. See what is open, what it costs, and when the next rank opens.</p>
        <LadderView />
      </section>
    </Shell>
  );
}
