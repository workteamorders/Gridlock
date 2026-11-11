import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';
import { HuntView } from '@/components/HuntView';

export const metadata: Metadata = { title: 'The Hunt', description: 'Twelve hidden cars are opened by secret codes. Claim in two steps so nobody can copy your code.', alternates: { canonical: '/hunt/' } };

export default function HuntPage() {
  return (
    <Shell current="/hunt/">
      <section className="wrap section stack">
        <h1>The Hunt</h1>
        <p>Twelve hidden cars. Find a code, claim in two steps.</p>
        <HuntView />
      </section>
    </Shell>
  );
}
