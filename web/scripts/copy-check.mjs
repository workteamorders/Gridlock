// Honest-copy gate. Scans visible text in src/ for words the project forbids.
// A line may mention a banned word only when it clearly negates it ("no", "not", "never", "does not", "without").
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [
  /\binvest(?:ment|ing|or|ors)?\b/i, /\bprofits?\b/i, /\bguarantee[sd]?\b/i, /\bpassive income\b/i, /\bairdrops?\b/i, /\bfloor price\b/i,
  /\bto the moon\b/i, /\bmoon(?:ing|shot)\b/i, /\brug ?pull/i, /\bget rich\b/i, /\b(?:will|can) (?:go up|appreciate)\b/i,
  /\brewards?\b/i, /\bprizes?\b/i, /\bpink slips?\b/i, /\bwhitelist\b/i, /\bpresale\b/i, /\bfomo\b/i, /\blast chance\b/i, /\bhurry\b/i,
  /\bsold out soon\b/i, /\bofficial\b/i, /\bleaderboard\b/i, /\bgambl\w+/i, /\blottery\b/i, /\bloot ?box/i, /\brandom(?:ly)?\b/i, /\brare(?:ness|st)?\b/i, /\brarity\b/i,
];
const LABELS = [/\baudited\b/i, /\bverified\b/i, /\bsecure\b/i, /\bsafe\b/i]; // allowed only when negated
const NEGATION = /\b(no|not|never|without|cannot|can't|does not|do not|isn't|aren't|nor|none|nobody|neither)\b|\bno external audit\b|unverified|not audited/i;
const IGNORE_DIRS = new Set(['styleguide']);

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!IGNORE_DIRS.has(f)) yield* walk(p); } else if (/\.(tsx?|mdx?)$/.test(f)) yield p;
  }
}

const problems = [];
for (const file of walk(new URL('../src', import.meta.url).pathname)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(import|export \* from|\/\/|\*|\/\*)/.test(line)) return;
    // Only look at text inside JSX or string literals, not identifiers like className.
    const text = [...line.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).concat([...line.matchAll(/(["'`])((?:\\.|(?!\1).)+)\1/g)].map((m) => m[2]).filter((s) => /\s/.test(s) && !/^[\w\-:.\/ ]+$/.test(s) || /\s/.test(s) && s.length > 12)).join(' ');
    if (!text) return;
    for (const re of BANNED) { const m = text.match(re); if (m && !NEGATION.test(text)) problems.push(`${file}:${i + 1}: "${m[0]}"`); }
    for (const re of LABELS) { const m = text.match(re); if (m && !NEGATION.test(text)) problems.push(`${file}:${i + 1}: label "${m[0]}" without negation`); }
  });
}
if (problems.length) { console.error(`copy-check: ${problems.length} problem(s)\n${problems.join('\n')}`); process.exit(1); }
console.log('copy-check: ok');
