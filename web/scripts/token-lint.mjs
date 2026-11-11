// Fails if components, base, page CSS, or TSX contain loose colors or inline styles.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.css', '.tsx', '.ts'].includes(extname(p)) && !p.endsWith('tokens.css') && !p.includes('/fonts/')) files.push(p);
  }
})(root);

const problems = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !line.includes('aria-') && !line.includes('themeColor') && !line.trim().startsWith('//')) problems.push(`${f}:${i + 1} raw hex: ${line.trim().slice(0, 80)}`);
    if (/\b(rgb|rgba|hsl)\(/.test(line) && !f.endsWith('.tsx')) problems.push(`${f}:${i + 1} raw color fn: ${line.trim().slice(0, 80)}`);
    if (/style=\{\{/.test(line)) problems.push(`${f}:${i + 1} inline style: ${line.trim().slice(0, 80)}`);
  });
}
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`token-lint: ${files.length} files clean`);
