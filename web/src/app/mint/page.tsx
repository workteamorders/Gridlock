import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/Shell';
import { MintView } from '@/components/MintView';

export const metadata: Metadata = { title: 'Mint', description: 'Pick an open rank, see the exact card, read the toll gate, then mint. Payment must be exact and there are no refunds.', alternates: { canonical: '/mint/' } };

export default function MintPage() {
  return (
    <Shell current="/mint/">
      <section className="wrap section stack">
        <h1>Mint</h1>
        <p>Pick an open rank, check the exact card and the toll gate, then sign in your wallet.</p>
        <Suspense fallback={<div className="skeleton gate-sk" aria-busy="true" />}><MintView /></Suspense>
      </section>
    </Shell>
  );
}
