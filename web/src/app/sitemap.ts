import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridlock.example';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/mint/', '/ladder/', '/gallery/', '/garage/', '/hunt/', '/rules/', '/contracts/', '/risk/'].map((p) => ({ url: `${SITE}${p}` }));
}
