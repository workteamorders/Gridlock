import { writeFileSync } from 'node:fs';
import { launch, newPage, SHOTS, shot, SITE, startSite } from './lib.mjs';

const server = await startSite(new URL('../out/', import.meta.url).pathname);
const browser = await launch();
const rows = [];
try {
  for (const width of [360, 768, 1440]) {
    const p = await newPage(browser, { width });
    await p.goto(`${SITE}/?motion=debug`);
    await p.waitForFunction(() => window.__fx?.times.length >= 10);
    const scene = p.locator('.junction-scene');
    const box = await scene.boundingBox();
    if (!box) throw new Error('The junction scene is missing');
    if (width === 360 || width === 1440) await shot(p, `junction-${width}`, { fullPage: false });
    for (let i = 0; i < 6; i++) {
      await p.mouse.move(box.x + box.width * (0.19 + 0.12 * i), box.y + box.height * (0.42 + 0.04 * i), { steps: 6 });
      await p.waitForTimeout(600);
    }
    const frames = await p.evaluate(() => window.__fx.times.slice(8));
    const average = 1000 * frames.length / frames.reduce((a, b) => a + b, 0);
    const sorted = frames.map((ms) => 1000 / ms).sort((a, b) => a - b);
    rows.push({ width, frames: frames.length, average: +average.toFixed(1), p5: +sorted[Math.floor(sorted.length * 0.05)].toFixed(1), errors: p.errors });
    await p.context().close();
  }
} finally { await browser.close(); server.kill(); }
console.table(rows);
writeFileSync(`${SHOTS}fps.json`, JSON.stringify(rows, null, 2));
if (rows.some((row) => row.average < (row.width === 1440 ? 55 : 30) || row.errors.length)) process.exitCode = 1;
