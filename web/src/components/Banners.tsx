'use client';

import { useChain } from '@/lib/chain-context';
import { useWallet } from '@/lib/wallet';
import { CHAIN } from '@/lib/config';
import { Button } from './Button';
import { Icon } from './Icon';

/** Honest system state: shown above the page content on every page. */
export function Banners() {
  const c = useChain();
  const w = useWallet();
  return (
    <div className="wrap stack-tight" aria-live="polite">
      {/* The undeployed state is explained inside each page body (Gate, Home panel, EXAMPLE badges), so nothing above the content shifts when the deployment file answers 404. */}
      {c.phase === 'error' || (c.phase === 'ready' && c.error) ? (
        <div className="alert alert--warn" role="status"><Icon name="alert" /><div><p className="alert-title">The network is not answering</p><p>{c.phase === 'error' ? 'Nothing here is current.' : 'Numbers below may be out of date.'} Your ETH and cars are not affected. Try again in a moment.</p><Button size="sm" variant="secondary" onClick={() => void c.refresh()}>Try again</Button></div></div>
      ) : null}
      {c.testClock ? (
        <div className="alert alert--warn"><Icon name="alert" /><div><p className="alert-title">TEST CLOCK</p><p>This deployment uses short timers. Times here are not production times.</p></div></div>
      ) : null}
      {c.mismatches.length > 0 ? (
        <div className="alert alert--bad" role="alert"><Icon name="alert" /><div><p className="alert-title">This deployment does not match the published parameters</p><p>Do not mint or claim. Differences: {c.mismatches.slice(0, 3).join('; ')}{c.mismatches.length > 3 ? `; and ${c.mismatches.length - 3} more` : ''}.</p></div></div>
      ) : null}
      {c.viewOnly ? (
        <div className="alert alert--info"><Icon name="info" /><div><p className="alert-title">View-only mode</p><p>Minting, claiming and sending are turned off in this interface for your region. This is a limit of the site only. The contract itself has no permission checks.</p></div></div>
      ) : null}
      {w.status === 'connected' && w.wrongNetwork ? (
        <div className="alert alert--warn"><Icon name="alert" /><div><p className="alert-title">Wrong network</p><p>Your wallet is on another network. Switch to {CHAIN.name} to continue.</p><Button size="sm" variant="primary" onClick={() => void w.switchNetwork()}>Switch to {CHAIN.name}</Button></div></div>
      ) : null}
    </div>
  );
}
