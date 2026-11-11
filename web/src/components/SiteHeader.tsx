'use client';

import { MotionButton } from './fx/Motion';
import { SoundButton } from './stage/SoundButton';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { ConnectButton } from './ConnectButton';

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/mint/', label: 'Mint' },
  { href: '/ladder/', label: 'Ladder' },
  { href: '/gallery/', label: 'Gallery' },
  { href: '/garage/', label: 'Garage' },
  { href: '/hunt/', label: 'Hunt' },
  { href: '/rules/', label: 'Rules' },
] as const;

export function SiteHeader({ current }: { current?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="wrap">
        <Link className="brand" href="/"><span className="slash" aria-hidden="true" />Gridlock</Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            {NAV.map((n) => (
              <li key={n.href}><Link href={n.href} aria-current={current === n.href ? 'page' : undefined}>{n.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="header-actions"><MotionButton /><SoundButton /><ConnectButton />
        <button type="button" className="btn btn--secondary menu-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="menu" /><span>Menu</span>
        </button></div>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu" variant="drawer">
        <nav aria-label="Main, mobile">
          <ul className="drawer-links">
            {NAV.map((n) => (
              <li key={n.href}><Link href={n.href} onClick={() => setOpen(false)} aria-current={current === n.href ? 'page' : undefined}>{n.label}</Link></li>
            ))}
          </ul>
        </nav>
      </Dialog>
    </header>
  );
}
