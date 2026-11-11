import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridlock.example';
const INDEXABLE = process.env.NEXT_PUBLIC_INDEXABLE === '1';

/** Staging and testnet stay out of search engines unless NEXT_PUBLIC_INDEXABLE=1 is set on purpose. */
export default function robots(): MetadataRoute.Robots {
  return INDEXABLE
    ? { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/styleguide/', '/offline/'] }, sitemap: `${SITE}/sitemap.xml` }
    : { rules: { userAgent: '*', disallow: '/' } };
}
