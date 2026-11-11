// Post-build: hash every inline script in out/**/*.html and write out/_headers with a strict CSP.
// Run after `next build`. Pages serves out/_headers. No 'unsafe-inline' for scripts.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../out', import.meta.url).pathname;
const hashes = new Set();
function* walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) yield* walk(p); else if (p.endsWith('.html')) yield p; } }
for (const file of walk(OUT)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1]) hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
}
const connect = "'self'"; // reads go through the site's own /api/rpc
const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`,
  "style-src 'self' 'unsafe-inline'", // Next injects style attributes for layout; scripts stay strict
  "img-src 'self' data:",
  "font-src 'self'",
  // Wallet providers are injected into the page and talk to their own nodes, so they need no allowance here.
  `connect-src ${connect}`,
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'", 'upgrade-insecure-requests',
].join('; ');
const common = [
  `  Content-Security-Policy: ${csp}`,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
  '  Cross-Origin-Opener-Policy: same-origin',
  '  X-Frame-Options: DENY',
];
const body = ['/*', ...common, '', '/_next/static/*', '  Cache-Control: public, max-age=31536000, immutable', '', '/deployments/*', '  Cache-Control: no-cache', ''].join('\n');
writeFileSync(join(OUT, '_headers'), body);
console.log(`csp-headers: wrote out/_headers (${hashes.size} inline script hashes)`);
