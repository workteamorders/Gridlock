// Side-view comic car, drawn with the same body shapes, wheels and livery rules as the on-chain card renderer
// (contracts/src/GridlockRenderer.sol) so the site and the cards look like one family. Colors come from tokens.css.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const token = (name) => {
  const value = css.match(new RegExp(`^\\s*${name}: (#[a-f0-9]{6});`, 'im'))?.[1];
  if (!value) throw new Error(`Missing color token ${name}`);
  return value;
};

// 0 hatchback, 1 coupe, 2 sedan, 3 van, 4 small truck, 5 wedge. The front is on the right.
export const BODY_PATHS = [
  'M24 140L44 140Q52 100 96 96L156 96Q196 98 220 128L240 132L240 160L24 160Z',
  'M20 142L48 138Q74 108 124 104L170 106Q204 110 228 134L248 138L248 162L20 162Z',
  'M22 160V138L58 134Q68 104 108 100L150 100Q180 102 200 124L240 130L248 140V160Z',
  'M28 160V94Q28 86 38 86L184 86Q204 86 216 112L244 134L244 160Z',
  'M20 160V112L96 112L96 100Q98 90 110 88L160 88Q184 90 198 108L206 126L242 130L248 140V160Z',
  'M20 160V110L60 100L190 118L236 134L250 144V160Z',
];
const WINDOWS = [
  'M62 126L74 106L100 104L100 126ZM110 104L152 104Q172 108 188 126L110 126Z',
  'M78 128L94 112L128 110L128 128ZM138 110L168 112Q190 118 204 130L138 130Z',
  'M72 126L80 108L112 106L112 126ZM122 106L150 106Q170 110 184 126L122 126Z',
  'M44 118L44 98L104 98L104 118ZM114 98L180 98Q192 100 200 118L114 118Z',
  'M112 98L158 98Q176 100 188 118L112 118Z',
  'M48 112L64 104L160 120L160 128L48 128Z',
];
const BOUNDS = [[24, 240], [20, 248], [22, 248], [28, 244], [20, 248], [20, 250]];
export const BODY_COLORS = ['--text', '--action', '--car-orange', '--text-dim', '--car-teal', '--info', '--ok', '--brush'];
export const LIVERIES = ['--action', '--brush', '--surface', '--text'];
/** Drawing box of one car with its wheels and speed lines. */
export const COMIC_VIEW = { x: -22, y: 80, w: 290, h: 106 };

const rect = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${token(color)}"/>`;
const path = (d, fill, stroke, width) => `<path d="${d}" fill="${token(fill)}" stroke="${token(stroke)}" stroke-width="${width}"/>`;

function livery(kind, color, shape) {
  if (kind === 0) return '';
  const [x0, x1] = BOUNDS[shape];
  const w = x1 - x0;
  if (kind === 1) return rect(x0, 142, w, 7, color);
  if (kind === 2) return rect(x0, 141, w, 4, color) + rect(x0, 149, w, 4, color);
  if (kind === 3) return rect(x0, 146, w, 12, color);
  if (kind === 4) {
    const bw = Math.floor((w - 8) / 9);
    return Array.from({ length: 5 }, (_, i) => rect(x0 + 4 + i * 2 * bw, 143, bw, 9, color)).join('');
  }
  if (kind === 5) {
    return Array.from({ length: 6 }, (_, i) => {
      const sx = x0 + 10 + i * 34;
      return `<polygon points="${sx},158 ${sx + 8},142 ${sx + 20},142 ${sx + 12},158" fill="${token(color)}"/>`;
    }).join('');
  }
  if (kind === 6) return `<g fill="${token(color)}">${Array.from({ length: 7 }, (_, i) => `<circle cx="${x0 + 14 + i * 30}" cy="150" r="4"/>`).join('')}</g>`;
  return rect(x0, 152, w, 5, color) + `<circle cx="${x0 + Math.floor(w / 2)}" cy="128" r="9" fill="${token(color)}" stroke="${token('--surface')}" stroke-width="3"/>`;
}

const wheel = (cx) => `<circle cx="${cx}" cy="162" r="20" fill="${token('--surface')}" stroke="${token('--text')}" stroke-width="3"/><circle cx="${cx}" cy="162" r="7" fill="${token('--text')}"/>`;

/** One car: cream sticker outline, inked body, windows, livery, wheels, optional speed lines behind it. */
export function comicCar({ shape = 2, body = 2, stripe = 1, stripeColor = 0, speed = true } = {}) {
  const bodyColor = BODY_COLORS[body % 8];
  let tint = LIVERIES[stripeColor % 4];
  if (token(tint) === token(bodyColor)) tint = LIVERIES[(stripeColor + 1) % 4];
  const d = BODY_PATHS[shape % 6];
  return [
    '<g stroke-linejoin="round">',
    speed ? `<path d="M-22 112H16M-26 128H10M-20 144H14" fill="none" stroke="${token('--text')}" stroke-width="4"/>` : '',
    path(d, '--text', '--text', 10),
    path(d, bodyColor, '--surface', 4),
    livery(stripe % 8, tint, shape % 6),
    path(WINDOWS[shape % 6], '--surface-2', '--surface', 3),
    wheel(76), wheel(200),
    '</g>',
  ].join('');
}
