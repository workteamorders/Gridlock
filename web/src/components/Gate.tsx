'use client';

import { StatusArt } from '@/components/fx/StatusArt';
import type { ReactNode } from 'react';
import { useChain } from '@/lib/chain-context';
import { Button } from './Button';
import { DeadEnd } from './Signs';

/** Page body gate: skeleton while loading, honest empty state when undeployed, DeadEnd on failure. */
export function Gate({ children, needs = 'ready', exampleNote }: { children: ReactNode; needs?: 'ready' | 'none'; exampleNote?: ReactNode }) {
  const c = useChain();
  if (needs === 'none') return <>{children}</>;
  if (c.phase === 'loading') {
    return <div key="sk" className="skeleton gate-sk" role="status" aria-busy="true" aria-label="Loading" />;
  }
  if (c.phase === 'undeployed') {
    return <div key="empty" className="stack"><div className="empty gate-empty"><StatusArt kind="empty" /><div><h2>Nothing to show yet</h2><p>The contracts are not deployed on this network, so there is no live data. Read the Rules while you wait.</p></div></div>{exampleNote}</div>;
  }
  if (c.phase === 'error') {
    return <DeadEnd title="No answer from the network" actions={<Button variant="primary" onClick={() => void c.refresh()}>Try again</Button>}><p>Nothing was sent and nothing changed. Your ETH and cars are safe. Try again in a moment.</p></DeadEnd>;
  }
  return <>{children}</>;
}
