import { StatusArt } from '@/components/fx/StatusArt';
import Link from 'next/link';
import { Shell } from '@/components/Shell';

export default function NotFound() {
  return (
    <Shell>
      <section className="wrap section stack">
        <StatusArt kind="error" />
        <h1>Dead end</h1>
        <p>This page does not exist. Nothing was sent and nothing changed.</p>
        <p className="row"><Link className="btn btn--primary" href="/">Back to the start</Link><Link className="btn btn--secondary" href="/ladder/">See the Ladder</Link></p>
      </section>
    </Shell>
  );
}
