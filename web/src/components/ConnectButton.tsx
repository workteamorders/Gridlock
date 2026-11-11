'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { shortAddress } from '@/lib/format';
import { CHAIN } from '@/lib/config';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function ConnectButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);

  if (w.status === 'connected' && w.account) {
    if (w.wrongNetwork) {
      return <Button size="sm" variant="primary" onClick={() => void w.switchNetwork()}>Switch to {CHAIN.name}</Button>;
    }
    return (
      <>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog"><Icon name="wallet" /><span className="num">{shortAddress(w.account)}</span></Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Wallet" actions={<Button variant="secondary" onClick={() => { w.disconnect(); setOpen(false); }}>Disconnect wallet</Button>}>
          <p className="num">{w.account}</p>
          <p className="dim">Connected to {CHAIN.name}. Gridlock never holds your keys. Disconnecting here only forgets the connection on this site.</p>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} loading={w.status === 'connecting'} aria-haspopup="dialog"><Icon name="wallet" /><span>Connect wallet</span></Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Connect a wallet">
        {w.wallets.length === 0 ? (
          <div className="stack">
            <p>No browser wallet was found. Install or unlock one, then reload this page.</p>
            <p className="dim">You can still read everything on this site without a wallet.</p>
          </div>
        ) : (
          <ul className="drawer-links" aria-label="Wallets found in this browser">
            {w.wallets.map((x) => (
              <li key={x.uuid}>
                <button type="button" className="btn btn--secondary btn--lg" onClick={async () => { await w.connect(x.uuid); setOpen(false); }}>
                  {/* Wallet icons arrive as data URIs from the wallet itself. */}
                  {x.icon.startsWith('data:image/') ? <img src={x.icon} alt="" width={24} height={24} /> : null}
                  <span>{x.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {w.error ? <p className="error-text" role="alert"><Icon name="alert" /><span>{w.error}</span></p> : null}
      </Dialog>
    </>
  );
}
