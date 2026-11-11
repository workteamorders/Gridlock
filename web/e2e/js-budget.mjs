import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [baseline, candidate = 'out'] = process.argv.slice(2);
if (!baseline) throw new Error('Usage: node e2e/js-budget.mjs BASELINE_OUT [CANDIDATE_OUT]');
const routes = ['index.html', 'mint/index.html', 'ladder/index.html', 'gallery/index.html', 'garage/index.html', 'hunt/index.html', 'rules/index.html', 'contracts/index.html', 'risk/index.html', 'offline/index.html', '404.html', 'styleguide/index.html'];
const path = '_next/static/chunks';
const chunks = new Map(readdirSync(join(candidate, path)).filter((f) => f.endsWith('.js')).map((file) => {
  const content = readFileSync(join(candidate, path, file));
  return [`${path}/${file}`, content];
}));
const traffic = [...chunks].filter(([, content]) => content.includes('Path2D') && content.includes('gridlock:motion')).map(([file]) => file);
if (!traffic.length) throw new Error('Could not identify the lazy traffic engine');
const gzip = (file, dir) => gzipSync(readFileSync(join(dir, file))).length;
const budget = (dir, html, lazy = []) => {
  const source = readFileSync(join(dir, html), 'utf8');
  const files = new Set([...source.matchAll(/(?:src|href)="\/(_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]));
  if (!files.size) throw new Error(`No JS found in ${dir}/${html}`);
  for (const file of lazy) {
    if ([...files].some((parent) => chunks.get(parent)?.includes(file.replace('_next/', '')))) files.add(file);
  }
  return [...files].reduce((sum, file) => sum + gzip(file, dir), 0);
};
const rows = routes.map((route) => {
  const before = budget(baseline, route);
  const after = budget(candidate, route, traffic);
  return { route, before, after, additional: after - before };
});
console.table(rows);
writeFileSync('e2e/shots/js-budget.json', JSON.stringify(rows, null, 2));
if (rows.some((row) => row.additional > 20_000)) process.exitCode = 1;
