import { RouteWipe } from './fx/RouteWipe';
import { LiveBackground } from './fx/LiveBackground';
import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { Banners } from './Banners';
import { IntroStamp } from './stage/IntroStamp';
import { Magnetic } from './stage/Magnetic';
import { SoundEffects } from './stage/SoundEffects';

/** Every page is a thin wrapper: Shell + a client page body. */
export function Shell({ current, children }: { current?: string; children: ReactNode }) {
  return (
    <>
      {current === '/' ? null : <LiveBackground mint={current === '/mint/'} />}
      <RouteWipe />
      {current === '/' ? <IntroStamp /> : null}
      <Magnetic />
      <SoundEffects />
      <SiteHeader {...(current ? { current } : {})} />
      <Banners />
      <main id="main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </>
  );
}
