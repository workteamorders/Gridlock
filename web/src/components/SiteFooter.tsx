import { MotionButton } from './fx/Motion';
import { SoundButton } from './stage/SoundButton';
import Link from 'next/link';
import { AUDIT_REPORT_URL, CONTACT_URL } from '@/lib/config';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap stack">
        <nav aria-label="Footer">
          <ul className="row">
            <li><Link href="/rules/">Rules</Link></li>
            <li><Link href="/contracts/">Contracts</Link></li>
            <li><Link href="/risk/">Risk and terms</Link></li>
            <li><Link href="/offline/">Offline help</Link></li>
            {CONTACT_URL ? <li><a href={CONTACT_URL} rel="noopener noreferrer">Contact</a></li> : null}
          </ul>
        </nav>
        <div className="footer-settings"><MotionButton /><SoundButton /></div>
        <p>
          {AUDIT_REPORT_URL ? <>External audit report: <a href={AUDIT_REPORT_URL} rel="noopener noreferrer">read it</a>. </> : <strong>No external audit yet. </strong>}
          Gridlock Cars are digital collectibles, not financial advice. No promise of value or return is made. This site stores no personal data. It uses browser storage to remember your wallet choice and your motion and sound settings.
        </p>
        <p className="dim">Not affiliated with any chain, marketplace or game, and not affiliated with any reference work. All cars, plates and names are invented. The disclaimers above do not replace a legal review.</p>
      </div>
    </footer>
  );
}
