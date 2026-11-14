// Flat silhouettes drawn on a 64 × 32 grid, with the nose facing right.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const bodies = [
  'M-29 -9 L-17 -13 H12 L30 -8 V8 L12 13 H-17 L-29 9 Z',
  'M-30 -7 L-17 -11 H10 L30 -6 V6 L10 11 H-17 L-30 7 Z',
  'M-31 -12 H12 L29 -8 V8 L12 12 H-31 Z',
  'M-28 -12 H4 L15 -8 H26 L31 -5 V5 L26 8 H15 L4 12 H-28 Z',
  'M-29 -8 L-22 -12 H16 L29 -10 V10 L16 12 H-22 L-29 8 Z',
  'M-31 -10 L-8 -14 L15 -11 L31 -5 V5 L15 11 L-8 14 L-31 10 Z',
];
const windows = [
  'M-9 -9 H6 L13 -6 V6 L6 9 H-9 L-14 5 V-5 Z',
  'M-7 -7 H5 L12 -4 V4 L5 7 H-7 L-15 4 V-4 Z',
  'M3 -9 H10 L17 -6 V6 L10 9 H3 Z',
  'M-5 -8 H4 L10 -5 V5 L4 8 H-5 Z M-23 -7 H-13 V7 H-23 Z',
  'M-5 -8 H9 L14 -6 V6 L9 8 H-5 L-11 5 V-5 Z',
  'M-9 -9 L8 -7 L15 -4 V4 L8 7 L-9 9 L-15 4 V-4 Z',
];
const liveries = [
  'M20 -2 H27 V2 H20 Z',
  'M19 -5 H27 V-3 H19 Z M19 3 H27 V5 H19 Z',
  'M19 -5 H22 V-2 H19 Z M23 -2 H26 V1 H23 Z M19 1 H22 V4 H19 Z',
  'M-25 -5 L-19 0 L-25 5 H-21 L-15 0 L-21 -5 Z',
];
const paint = ['--action', '--brush', '--text', '--info', '--ok', '--text-dim', '--bad', '--brush-deep'];
const exampleSales = [[15, 400], [14, 360], [13, 212]];
const svg = (width, height, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>\n`;
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const token = (name) => {
  const value = css.match(new RegExp(`^${'\\s*'}${name}: (#[a-f0-9]{6});`, 'im'))?.[1];
  if (!value) throw new Error(`Missing color token ${name}`);
  return value;
};
const rect = (x, y, width, height, name) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${token(name)}"/>`;
export const car = (shape, color, livery) => {
 const accent=token(color%2?'--brush':'--action');
 const wheels=[-23,15].flatMap(x=>[-14,10].map(y=>`<rect x="${x}" y="${y}" width="10" height="4" fill="#0b0b0c" stroke="#ffffff" stroke-width=".65"/>`)).join('');
 return wheels+`<path fill="#ffffff" stroke="#0b0b0c" stroke-width="1.3" d="${bodies[shape]}"/><path fill="#0b0b0c" stroke="#ffffff" stroke-width=".65" d="${windows[shape]}"/><path fill="#0b0b0c" d="M14 -8L27 -5V5L14 8L17 0ZM-22 -9L-17 -5V5L-22 9Z"/><path fill="none" stroke="#0b0b0c" stroke-width=".6" d="M13 -9L10 -5V5L13 9M-14 -10L-10 -11H5L9 -9"/><path fill="#ffffff" d="M-10 -8L-7 -9L-1 7L-3 7Z"/><path stroke="${accent}" stroke-width="1.2" d="M-18 10H16M28 -6V6"/><path stroke="#0b0b0c" stroke-width=".8" d="M-25 -4V4M-22 -4V4M-19 -4V4"/>`;
};
const at = (transform, content) => `<g transform="${transform}">${content}</g>`;
const cone = `<path fill="${token('--brush')}" d="M20 3 H28 L37 32 H11 Z"/>${rect(7, 32, 34, 5, '--action')}${rect(16, 19, 16, 4, '--text')}`;
const hazard = rect(0, 0, 32, 16, '--action') + `<path fill="${token('--surface')}" d="M0 0H12L2 16H0ZM28 0H32V16H18Z"/>`;
const dots = Array.from({ length: 16 }, (_, i) => `<circle cx="${4 + i % 4 * 8}" cy="${4 + Math.floor(i / 4) * 8}" r="1.4" fill="${token('--action')}"/>`).join('');
const stamp = (word, tone) => svg(180, 50, rect(0, 0, 180, 50, tone) + rect(4, 4, 172, 42, '--surface') + `<text x="90" y="33" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="${token(tone)}">${word}</text>`);
const status = (kind) => {
  const frame = rect(0, 0, 160, 90, '--surface') + rect(0, 39, 160, 2, '--line-dim') + rect(0, 65, 160, 2, '--line-dim');
  const art = kind === 'empty' ? at('translate(73 53)', car(4, 2, 3)) : kind === 'offline'
    ? at('translate(54 26)', rect(14, 0, 17, 53, '--line-dim') + rect(0, 0, 45, 32, '--action') + `<path fill="${token('--surface')}" d="M9 7H16L36 25H29ZM29 7H36L16 25H9Z"/>`)
    : at('translate(56 26)', cone) + at('translate(100 26)', cone);
  return svg(160, 90, frame + art);
};

const junction = svg(560, 360,
  '<g id="junction-map">' + rect(0, 0, 560, 360, '--surface-2')
  + [[22, 16], [374, 16], [22, 267], [374, 267]].map(([x, y], i) =>
    rect(x + 5, y + 5, 164, 64, '--surface') + rect(x, y, 164, 64, '--surface-3')
    + rect(x + 8, y + 8, 99, 42, '--surface-2') + rect(x + 117, y + 8, 38, 42, '--surface-2')
    + rect(x + 8, y + 52, 74, 5, i % 2 ? '--brush' : '--action')).join('')
  + rect(0, 115, 560, 130, '--line-dim') + rect(215, 0, 130, 360, '--line-dim')
  + rect(0, 118, 560, 124, '--surface') + rect(218, 0, 124, 360, '--surface')
  + rect(231, 131, 98, 98, '--surface-2')
  + `<path fill="none" stroke="${token('--action')}" stroke-dasharray="12 12" stroke-width="2" d="M0 180h186m188 0h186M280 0v86m0 188v86"/>`
  + [0, 90, 180, 270].map((angle, i) => at(`translate(280 180) rotate(${angle})`,
    rect(-65, 3, 3, 56, '--action')
    + Array.from({ length: 8 }, (_, j) => rect(-56, -54 + j * 14, 10, 6, '--text-dim')).join('')
    + rect(-84, 64, 33, 15, '--surface')
    + rect(-80, 67, 10, 9, i % 2 ? '--brush' : '--surface-3')
    + rect(-65, 67, 10, 9, i % 2 ? '--surface-3' : '--ok')
    + [78, 113, 148, 183].map((distance, j) =>
      at(`translate(${-distance} 17) scale(.49)`, car((i + j) % bodies.length, (i * 3 + j) % paint.length, j))).join('')
  )).join('') + '</g>');

export const icon = svg(180, 180, rect(0, 0, 180, 180, '--surface') + at('translate(10 12) scale(5)', dots) + at('translate(90 90) rotate(-18) scale(2.4)', car(5, 0, 2)));
export const social = svg(1200, 630,
  rect(0, 0, 1200, 630, '--surface')
  + at('translate(740 65) scale(12)', dots)
  + rect(0, 480, 1200, 18, '--brush')
  + at('translate(936 312) rotate(-18) scale(7)', car(5, 0, 2))
  + `<g font-family="sans-serif" font-weight="bold" fill="${token('--text')}"><text x="65" y="253" font-size="120">GRIDLOCK</text><text x="70" y="335" font-size="37">ON-CHAIN WANTED POSTERS</text><text x="70" y="389" font-size="32">2,475 cars · 15 ranks</text></g>`);

export function makeArt(root = new URL('../', import.meta.url)) {
  const save = (name, value) => writeFileSync(new URL(name, root), value);
  for (const dir of ['src/art/', 'public/art/']) mkdirSync(new URL(dir, root), { recursive: true });
  const variants = [];
  for (let s = 0; s < bodies.length; s++) {
    for (let c = 0; c < paint.length; c++) {
      for (let l = 0; l < liveries.length; l++) {
        variants.push(at(`translate(${c * 80 + 40} ${(s * 4 + l) * 44 + 22})`, car(s, c, l)));
      }
    }
  }
  save('src/art/cars.ts', '// Generated by scripts/make-art.mjs.\n'
    + Object.entries({ carBodies: bodies, carWindows: windows, liveries, carPaint: paint, exampleSales })
      .map(([name, data]) => `export const ${name} = ${JSON.stringify(data, null, 2)} as const;\n`).join(''));
  save('public/art/cars.svg', svg(640, 1056, rect(0, 0, 640, 1056, '--surface-3') + variants.join('')));
  save('public/art/cone.svg', svg(48, 42, cone));
  save('public/art/junction.svg', junction);
  save('public/art/hazard.svg', svg(32, 16, hazard));
  save('public/art/halftone.svg', svg(32, 32, dots));
  save('public/art/signal.svg', svg(32, 64, rect(0, 0, 32, 64, '--surface') + rect(8, 8, 16, 20, '--brush') + rect(8, 36, 16, 20, '--ok')));
  save('public/art/light-bar.svg', svg(48, 16, rect(0, 0, 24, 16, '--brush') + rect(24, 0, 24, 16, '--action')));
  for (const [name, tone] of [['open', '--ok'], ['sold-out', '--bad'], ['caught', '--action'], ['claimed', '--ok'], ['wanted', '--action']]) {
    save(`public/art/${name}.svg`, stamp(name.replace('-', ' ').toUpperCase(), tone));
  }
  for (const kind of ['empty', 'offline', 'error']) save(`public/art/${kind}.svg`, status(kind));
  save('public/icon.svg', icon);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { makeArt(); (await import('./make-hero.mjs')).makeHero(); }
