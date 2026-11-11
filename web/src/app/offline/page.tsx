import { StatusArt } from '@/components/fx/StatusArt';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = { title: 'Offline help', description: 'What to do when this site or the network does not load.', robots: { index: false } };

export default function OfflinePage() {
  return (
    <Shell>
      <section className="wrap section stack">
        <StatusArt kind="offline" />
        <h1>Offline or not loading</h1>
        <p>If live numbers are missing, the site cannot reach the network. Your cars and ETH are not affected. They live on the chain, not on this site.</p>
        <ul className="stack-tight">
          <li>Check your internet connection, then reload.</li>
          <li>Wait a minute. The public network can be busy.</li>
          <li>You can always view your cars and the contracts on the block explorer, using the addresses on the <Link href="/contracts/">Contracts</Link> page.</li>
          <li>Never sign something you do not understand. If a wallet prompt looks different from what this site showed, cancel it.</li>
        </ul>
        <p><Link className="btn btn--primary" href="/">Try the home page</Link></p>
      </section>
    </Shell>
  );
}
