import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/Shell';
import { GalleryView } from '@/components/GalleryView';

export const metadata: Metadata = { title: 'Gallery', description: 'Every minted Gridlock car, drawn by the contract, with rank, heat and rap sheet.', alternates: { canonical: '/gallery/' } };

export default function GalleryPage() {
  return (
    <Shell current="/gallery/">
      <section className="wrap section stack">
        <h1>Gallery</h1>
        <p>Every car, exactly as the contract draws it today. Open a car to see its rap sheet.</p>
        <Suspense fallback={<div className="skeleton gate-sk" aria-busy="true" />}><GalleryView /></Suspense>
      </section>
    </Shell>
  );
}
