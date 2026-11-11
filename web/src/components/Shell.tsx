import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { Banners } from './Banners';

/** Every page is a thin wrapper: Shell + a client page body. */
export function Shell({ current, children }: { current?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader {...(current ? { current } : {})} />
      <Banners />
      <main id="main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </>
  );
}
