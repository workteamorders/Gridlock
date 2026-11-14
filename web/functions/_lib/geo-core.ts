export interface GeoEnv { BLOCKED_COUNTRIES?: string }

/** Country comes from a header the host sets itself: CF-IPCountry on Cloudflare (the default), x-vercel-ip-country on Vercel. Default blocklist is empty. View-only mode is an interface limit; the contract stays permissionless. */
export function handleGeo(req: Request, env: GeoEnv, countryHeader = 'cf-ipcountry'): Response {
  const blocked = (env.BLOCKED_COUNTRIES ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const country = (req.headers.get(countryHeader) ?? '').toUpperCase();
  const isBlocked = country !== '' && blocked.includes(country);
  return new Response(JSON.stringify({ blocked: isBlocked }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
