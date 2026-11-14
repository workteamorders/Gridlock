// Turns the static export (out/) into a Vercel deployment using the Build Output API (version 3).
//   node scripts/vercel-output.mjs        run after `next build` and `scripts/csp-headers.mjs`
//
// Why not plain vercel.json: the Content-Security-Policy contains a hash of every inline script, and those
// hashes only exist after the build. vercel.json is static, so the headers are read from out/_headers (written by
// csp-headers.mjs) and turned into routes here.
//
// Result in .vercel/output/:
//   static/            a copy of out/ (without _headers, which Vercel does not read)
//   functions/api/rpc.func, geo.func   Edge Functions generated from functions/_lib/*.ts (types stripped, one file each)
//   config.json        headers on every path, trailing-slash handling, the 404 page
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..');

/** Parses the Cloudflare-style _headers text written by csp-headers.mjs into [{ pattern, headers }]. */
export function parseHeadersFile(text) {
  const blocks = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') { cur = null; continue; }
    if (!raw.startsWith(' ') && !raw.startsWith('\t')) { cur = { pattern: raw.trim(), headers: {} }; blocks.push(cur); continue; }
    if (!cur) throw new Error(`_headers: header line without a path: ${raw}`);
    const i = raw.indexOf(':');
    if (i < 0) throw new Error(`_headers: bad header line: ${raw}`);
    cur.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return blocks;
}

const escapeRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const patternToRegex = (p) => `^${p.split('*').map(escapeRe).join('.*')}$`;

export function buildRoutes(headerBlocks) {
  return [
    // Headers first. continue:true keeps routing, so every later rule still runs.
    ...headerBlocks.map((b) => ({ src: patternToRegex(b.pattern), headers: b.headers, continue: true })),
    // The export is written as folder/index.html (trailingSlash). Say so explicitly instead of relying on directory indexes.
    { src: '^/$', dest: '/index.html' },
    { src: '^/(.+)/$', dest: '/$1/index.html' },
    { handle: 'filesystem' },
    { handle: 'miss' },
    // /risk -> /risk/ (only paths without a dot, never /api).
    { src: '^/(?!api(?:/|$))((?:[^/.]+/)*[^/.]+)$', status: 308, headers: { Location: '/$1/' } },
    { handle: 'error' },
    { src: '^/(?!api(?:/|$)).*$', status: 404, dest: '/404.html' },
  ];
}

const read = (p) => readFileSync(p, 'utf8');
const strip = (file) => stripTypeScriptTypes(read(file), { mode: 'strip' });

const RPC_ENTRY = `
// ---- Vercel Edge entry (generated) ----
// Best-effort cache for hot reads, per function instance. Entries live for a few seconds.
const memo = new Map();
const cache = {
  async get(key) { const hit = memo.get(key); if (hit && hit.exp > Date.now()) return hit.value; memo.delete(key); return null; },
  async put(key, value, ttl) { if (memo.size > 500) memo.clear(); memo.set(key, { value, exp: Date.now() + ttl * 1000 }); },
};
// Vercel sets x-real-ip itself. The Cloudflare header is never trusted here: a visitor could send it to dodge the rate limit.
const clientIp = (req) => req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
export default function handler(request) {
  return handleRpc(request, process.env, { fetchImpl: (...args) => fetch(...args), now: () => Date.now(), cache, clientIp });
}
`;

const GEO_ENTRY = `
// ---- Vercel Edge entry (generated) ----
// x-vercel-ip-country is set by Vercel. The Cloudflare header is ignored on purpose.
export default function handler(request) {
  return handleGeo(request, process.env, 'x-vercel-ip-country');
}
`;

/** Builds .vercel/output from an existing export. Paths are parameters so a test can run it in a temporary folder. */
export function buildVercelOutput({ outDir = join(WEB, 'out'), destDir = join(WEB, '.vercel', 'output'), libDir = join(WEB, 'functions', '_lib') } = {}) {
  const headersFile = join(outDir, '_headers');
  if (!existsSync(headersFile)) throw new Error('out/_headers is missing. Run `node scripts/csp-headers.mjs` after `next build` first.');
  if (!existsSync(join(outDir, 'index.html'))) throw new Error('out/index.html is missing. Run `next build` first.');
  const blocks = parseHeadersFile(read(headersFile));
  if (!blocks.some((b) => b.pattern === '/*' && Object.keys(b.headers).some((k) => k.toLowerCase() === 'content-security-policy'))) {
    throw new Error('out/_headers has no Content-Security-Policy for /*. Refusing to build a deployment without it.');
  }

  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(join(destDir, 'static'), { recursive: true });
  cpSync(outDir, join(destDir, 'static'), { recursive: true, filter: (src) => !src.endsWith('/_headers') });

  const fns = [['rpc', 'rpc-core.ts', RPC_ENTRY], ['geo', 'geo-core.ts', GEO_ENTRY]];
  for (const [name, core, entry] of fns) {
    const dir = join(destDir, 'functions', 'api', `${name}.func`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.js'), strip(join(libDir, core)) + entry);
    writeFileSync(join(dir, '.vc-config.json'), JSON.stringify({ runtime: 'edge', entrypoint: 'index.js' }, null, 2));
  }

  writeFileSync(join(destDir, 'config.json'), JSON.stringify({ version: 3, routes: buildRoutes(blocks) }, null, 2));
  const files = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [e.name]));
  return { static: files(join(destDir, 'static')).length, functions: fns.map((f) => f[0]), routes: buildRoutes(blocks).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = buildVercelOutput();
  console.log(`vercel-output: .vercel/output ready (${r.static} static files, functions: ${r.functions.join(', ')}, ${r.routes} routes)`);
}
