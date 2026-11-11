import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { ContractsView } from '@/components/ContractsView';

export const metadata: Metadata = { title: 'Contracts', description: 'Contract addresses, live parameters, treasury and audit status for Gridlock Cars.', alternates: { canonical: '/contracts/' } };

export default function ContractsPage() {
  return (
    <Shell current="/contracts/">
      <section className="wrap section stack">
        <h1>Contracts</h1>
        <p>Check the addresses and numbers yourself. Everything here is read from the chain.</p>
        <ContractsView />
      </section>
    </Shell>
  );
}
