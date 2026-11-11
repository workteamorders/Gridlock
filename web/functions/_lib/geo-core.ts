export interface GeoEnv { BLOCKED_COUNTRIES?: string }

/** Country comes from Cloudflare's CF-IPCountry header. Default blocklist is empty. View-only mode is an interface limit; the contract stays permissionless. */
export function handleGeo(req: Request, env: GeoEnv): Response {
  const blocked = (env.BLOCKED_COUNTRIES ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const country = (req.headers.get('cf-ipcountry') ?? '').toUpperCase();
  const isBlocked = country !== '' && blocked.includes(country);
  return new Response(JSON.stringify({ blocked: isBlocked }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
