// Fails when the built site or the repository contains something that looks like a secret.
//   node scripts/secret-scan.mjs [dir ...]   (default: out ../contracts/src ../contracts/script ../contracts/deploy ../docs src functions public)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['out', '../contracts/src', '../contracts/script', '../contracts/deploy', '../contracts/scripts', '../docs', 'src', 'functions', 'public', 'scripts'];
const SKIP = new Set(['node_modules', '.next', 'lib', 'build', 'cache', 'golden', 'fixtures']);
const RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
  [/\b(?:PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*[=:]\s*['"]?[^\s'"<$]{12,}/i, 'private key or mnemonic assignment'],
  [/https?:\/\/[^\s'"]*(?:alchemy\.com|infura\.io|quiknode\.pro|ankr\.com\/[a-z_]+\/[0-9a-f]{16,}|blastapi\.io|drpc\.org\/[a-z]+\/[A-Za-z0-9_-]{20,})[^\s'"]*/i, 'third-party RPC URL (may contain a key)'],
  [/[?&](?:api[_-]?key|apikey|key|token)=[A-Za-z0-9_-]{16,}/i, 'API key in a URL'],
  [/\bGRIDLOCK-TEST-ONLY-SECRET\b/, 'test hunt secret label'],
];
// Where test secrets may legitimately appear (never in the built site).
const TEST_OK = [/contracts\/(?:harness|test|deploy)/, /docs\//, /e2e\//, /tests?\//, /scripts\/(?:gen-hunt|secret-scan)/];
const hits = [];
function* walk(d) { for (const f of readdirSync(d)) { if (SKIP.has(f)) continue; const p = join(d, f); const st = statSync(p); if (st.isDirectory()) yield* walk(p); else if (st.size < 3_000_000 && !/\.(png|woff2?|ico)$/.test(f)) yield p; } }
for (const d of dirs) {
  let base; try { base = join(root, d); statSync(base); } catch { continue; }
  for (const f of walk(base)) {
    const rel = relative(root, f); const text = readFileSync(f, 'utf8');
    for (const [re, label] of RULES) {
      const m = text.match(re);
      if (!m) continue;
      if (label === 'test hunt secret label' && TEST_OK.some((t) => t.test(rel)) && !rel.startsWith('out')) continue;
      hits.push(`${rel}: ${label}: ${m[0].slice(0, 80)}`);
    }
  }
}
if (hits.length) { console.error(`secret-scan: ${hits.length} finding(s)\n${hits.join('\n')}`); process.exit(1); }
console.log(`secret-scan: clean (${dirs.join(', ')})`);
