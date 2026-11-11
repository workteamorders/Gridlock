'use client';

import { StatusArt } from '@/components/fx/StatusArt';
import { Button } from '@/components/Button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="wrap section stack">
      <StatusArt kind="error" />
      <h1>Something broke on this page</h1>
      <p>Nothing was sent to the network and your wallet was not touched. Reload to try again.</p>
      <div><Button variant="primary" onClick={reset}>Try again</Button></div>
    </main>
  );
}
