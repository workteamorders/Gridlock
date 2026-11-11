import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/Providers';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/fx.css';
import '@/styles/stage.css';
import '@/styles/panels.css';

const anton = localFont({ src: '../fonts/anton-latin-400-normal.woff2', weight: '400', variable: '--font-anton', display: 'swap', adjustFontFallback: 'Arial' });
const barlow = localFont({
  src: [
    { path: '../fonts/barlow-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/barlow-latin-500-normal.woff2', weight: '500' },
    { path: '../fonts/barlow-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-barlow',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
const spaceMono = localFont({
  src: [
    { path: '../fonts/space-mono-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/space-mono-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridlock.example'),
  title: { default: 'Gridlock: comic wanted-poster car cards', template: '%s | Gridlock' },
  description: 'Gridlock Cars are 2,475 original comic wanted-poster car cards sold on a 15-rank ladder, plus 12 hidden cars found through the Hunt. Everything is visible before you mint.',
  openGraph: { title: 'Gridlock', description: 'An original comic wanted-poster car collection with a 15-rank ladder. No randomness, no admin keys.', type: 'website', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Gridlock wanted-poster car cards' }] },
  twitter: { card: 'summary_large_image', title: 'Gridlock', description: 'An original comic wanted-poster car collection with a 15-rank ladder.', images: ['/og.png'] },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  robots: process.env.NEXT_PUBLIC_INDEXABLE === '1' ? { index: true, follow: true } : { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#0b0b0c', colorScheme: 'dark', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${spaceMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
