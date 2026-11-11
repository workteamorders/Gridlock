// Deterministic hero art: a wall of pinned wanted posters, drawn only from project tokens and the car silhouettes.
// Two layers (back, front) so the page can move them at different speeds. No text, no bitmaps, no outside assets.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { car } from './make-art.mjs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const token = (name) => {
  const value = css.match(new RegExp(`^\\s*${name}: (#[a-f0-9]{6});`, 'im'))?.[1];
  if (!value) throw new Error(`Missing color token ${name}`);
  return value;
};
let seed = 20261111;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (n) => Math.floor(rnd() * n);
const r2 = (n) => Math.round(n * 10) / 10;
const W = 1600, H = 900, PW = 200, PH = 280;

const rect = (x, y, w, h, name, extra = '') => `<rect x="${r2(x)}" y="${r2(y)}" width="${w}" height="${h}" fill="${token(name)}"${extra}/>`;
// Halftone fields are SVG patterns, not thousands of circles, so the files stay small and cheap to paint.
const patterns = [['dot-text', '--text', 12, 1.8], ['dot-surface', '--surface', 12, 1.8], ['dot-grid', '--surface-3', 24, 3]];
const defs = (prefix) => `<defs>${patterns.map(([id, name, step, r]) => `<pattern id="${prefix}-${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${token(name)}"/></pattern>`).join('')}</defs>`;
const dots = (id, w, h) => `<rect width="${w}" height="${h}" fill="url(#${prefix}-${id})"/>`;
let prefix = 'a';

function poster(rot, tone, shape, paint, livery, stars, misreg) {
  const field = ['--brush', '--action', '--surface-3', '--info'][tone];
  const ink = tone === 1 ? '--surface' : '--text';
  const bars = [90 + pick(60), 60 + pick(80)];
  const body = [
    misreg ? rect(-PW / 2 + 9, -PH / 2 + 7, PW, PH, '--brush') : '',
    rect(-PW / 2 - 4, -PH / 2 - 4, PW + 8, PH + 8, '--text'),
    rect(-PW / 2, -PH / 2, PW, PH, field),
    `<g transform="translate(${-PW / 2} ${-PH / 2 + 4})" opacity="0.28">${dots(ink === '--surface' ? 'dot-surface' : 'dot-text', PW, 150)}</g>`,
    `<g transform="translate(0 -22) scale(2.7)">${car(shape, paint, livery)}</g>`,
    rect(-PW / 2 + 14, 58, PW - 28, 8, ink),
    rect(-PW / 2 + 14, 74, bars[0], 8, ink, ' opacity="0.75"'),
    rect(-PW / 2 + 14, 96, bars[1], 8, ink, ' opacity="0.45"'),
    Array.from({ length: 5 }, (_, i) => rect(-PW / 2 + 14 + i * 22, 118, 16, 16, i < stars ? '--brush' : ink, i < stars ? '' : ' opacity="0.25"')).join(''),
    rect(-40, -PH / 2 - 12, 80, 22, '--action', ' transform="rotate(-3)" opacity="0.92"'),
  ].join('');
  return `<g transform="rotate(${rot})">${body}</g>`;
}

function layer(count, scale) {
  const cols = Math.ceil(Math.sqrt(count * (W / H)));
  const rows = Math.ceil(count / cols);
  const out = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = (c + 0.5) * (W / cols) + (rnd() - 0.5) * 70;
    const y = (r + 0.5) * (H / rows) + (rnd() - 0.5) * 60;
    out.push(`<g transform="translate(${r2(x)} ${r2(y)}) scale(${scale})">${poster(r2((rnd() - 0.5) * 14), pick(4), pick(6), pick(8), pick(4), pick(6), rnd() > 0.55)}</g>`);
  }
  return out.join('');
}

const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${content}</svg>\n`;

export function makeHero(root = new URL('../', import.meta.url)) {
  mkdirSync(new URL('public/art/', root), { recursive: true });
  seed = 20261111;
  writeFileSync(new URL('public/art/hero-back.svg', root),
    (prefix = 'back', svg(defs(prefix) + rect(0, 0, W, H, '--surface-2') + dots('dot-grid', W, H) + layer(18, 0.62) + rect(0, 0, W, H, '--surface-2', ' opacity="0.45"'))));
  writeFileSync(new URL('public/art/climb-car.svg', root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-34 -16 68 32" width="68" height="32">${car(0, 0, 1)}</svg>\n`);
  seed = 777;
  writeFileSync(new URL('public/art/hero-front.svg', root), (prefix = 'front', svg(defs(prefix) + layer(7, 1.12))));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) makeHero();
