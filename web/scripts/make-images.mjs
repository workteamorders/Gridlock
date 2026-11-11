// Renders apple-touch-icon.png and og.png from the project's own art. Run once; outputs are committed.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const icon = readFileSync(`${root}public/icon.svg`, 'utf8');
const card = (n) => `data:image/svg+xml;base64,${readFileSync(`${root}../contracts/harness/golden/rank-${n}.svg`).toString('base64')}`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const shoot = async (w, h, html, out) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.screenshot({ path: out }); await p.close(); };
await shoot(180, 180, `<body style="margin:0">${icon.replace('<svg ', '<svg width="180" height="180" ')}</body>`, `${root}public/apple-touch-icon.png`);
await shoot(1200, 630, `<body style="margin:0;background:#0b0b0c;width:1200px;height:630px;position:relative;font-family:Impact,'Arial Black',sans-serif;color:#f2eee3;overflow:hidden">
<div style="position:absolute;left:60px;top:70px;font-size:120px;letter-spacing:4px;color:#ffc61a">GRIDLOCK</div>
<div style="position:absolute;left:64px;top:230px;font-size:44px;line-height:1.25;width:560px">15 ranks.<br>2,475 wanted-poster cars.<br>Drawn fully on-chain.</div>
<div style="position:absolute;left:64px;top:480px;width:480px;height:10px;background:#e4262b"></div>
${[15, 10, 1].map((n, i) => `<img src="${card(n)}" style="position:absolute;left:${640 + i * 190}px;top:${70 + i * 20}px;width:260px;height:364px;border:4px solid #0b0b0c">`).join('')}
</body>`, `${root}public/og.png`);
await b.close();
console.log('images written');
