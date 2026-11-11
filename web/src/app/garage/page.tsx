import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { GarageView } from '@/components/GarageView';

export const metadata: Metadata = { title: 'Garage', description: 'The Gridlock cars in your wallet, their heat, and a way to send one with a clear warning.', alternates: { canonical: '/garage/' } };

export default function GaragePage() {
  return (
    <Shell current="/garage/">
      <section className="wrap section stack">
        <h1>Garage</h1>
        <p>The cars in your wallet and what each one has been through.</p>
        <GarageView />
      </section>
    </Shell>
  );
}
