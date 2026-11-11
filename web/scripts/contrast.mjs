// Computes WCAG contrast for the token pairs the UI uses. Reads src/styles/tokens.css directly.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const t = {};
for (const m of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) t[m[1]] = m[2];

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(t[a]), y = lum(t[b]); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [fg, bg, need, label]
const pairs = [
  ['--text', '--surface', 4.5, 'text on base'], ['--text', '--surface-2', 4.5, 'text on panel'], ['--text', '--surface-3', 4.5, 'text on float'],
  ['--text-dim', '--surface', 4.5, 'dim on base'], ['--text-dim', '--surface-2', 4.5, 'dim on panel'], ['--text-dim', '--surface-3', 4.5, 'dim on float'],
  ['--text-on-action', '--action', 4.5, 'on action'], ['--text-on-action', '--action-hover', 4.5, 'on action hover'], ['--text-on-action', '--action-press', 4.5, 'on action pressed'],
  ['--text-on-brush', '--brush', 4.5, 'white on brush'], ['--text-on-brush', '--brush-deep', 4.5, 'white on brush deep'], ['--text-on-brush', '--brush-press', 4.5, 'white on brush pressed'],
  ['--action', '--surface', 4.5, 'action text on base'], ['--action', '--surface-2', 4.5, 'action text on panel'],
  ['--bad', '--surface', 4.5, 'bad text on base'], ['--bad', '--surface-2', 4.5, 'bad text on panel'], ['--bad', '--surface-3', 4.5, 'bad text on float'],
  ['--ok', '--surface', 4.5, 'ok text'], ['--info', '--surface', 4.5, 'info text'], ['--warn', '--surface', 4.5, 'warn text'],
  ['--brush', '--surface', 3, 'brush strokes and large text on base'], ['--brush', '--surface-2', 3, 'brush on panel (large only)'],
  ['--focus', '--surface', 3, 'focus ring on base'], ['--focus', '--surface-2', 3, 'focus ring on panel'],
  ['--line', '--surface', 3, 'ink border on base'], ['--line-dim', '--surface', 3, 'dim border on base'], ['--line-dim', '--surface-2', 3, 'dim border on panel'],
  ['--text-dim', '--text-on-action', 0, 'n/a'],
];
let fail = 0;
for (const [a, b, need, label] of pairs) {
  if (!need) continue;
  const r = ratio(a, b);
  const ok = r >= need;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}  need ${need}  ${label}  (${a} on ${b})`);
}
process.exit(fail ? 1 : 0);
