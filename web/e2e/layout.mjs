// Layout, overflow and accessibility sweep: every page at 360/768/1440, live chain and undeployed.
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeFunctionData } from 'viem';
import { launch, newPage, shot, start, startSite, info, warp, rpc, writeDeployment, ACCOUNT, OTHER, SITE, SHOTS } from './lib.mjs';

const web = new URL('..', import.meta.url).pathname;
const abi = JSON.parse(readFileSync(`${web}../contracts/harness/build/GridlockCars.json`, 'utf8')).abi;
const axeSrc = readFileSync(`${process.env.GRIDLOCK_E2E_TOOLS ?? '/tmp/tools/node_modules'}/axe-core/axe.min.js`, 'utf8');
const MODE = process.argv[2] ?? 'live'; // live | undeployed
const dir = MODE === 'live' ? 'out-e2e' : 'out';

const chainProc = MODE === 'live' ? await start('node', ['rpc-server.mjs', '--port', '8545'], { cwd: `${web}../contracts/harness` }, 'local test chain') : null;
const siteProc = await startSite(`${web}${dir}`);
const send = (to, fn, args, from, value = 0n) => rpc('eth_sendTransaction', [{ from, to, data: encodeFunctionData({ abi, functionName: fn, args }), value: '0x' + value.toString(16) }]);
if (MODE === 'live') {
  const i = await info();
  writeDeployment(`${web}out-e2e`, i);
  await warp({ time: Number(i.start) + 1 });
  const price15 = 1000000000000000n;
  await send(i.cars, 'mint', [15n, 2n, 1n], ACCOUNT, 2n * price15);
  await send(i.cars, 'transferFrom', [ACCOUNT, OTHER, 1n], ACCOUNT);
  await warp({ advance: 121 });
  await send(i.cars, 'mint', [14n, 1n, 1n], OTHER, 2000000000000000n);
}
const PAGES = ['/', '/mint/?rank=15', '/ladder/', '/gallery/', '/gallery/?id=1', '/garage/', '/hunt/', '/rules/', '/contracts/', '/risk/', '/offline/', '/does-not-exist/', '/styleguide/'];
const WIDTHS = [360, 768, 1440];
const b = await launch();
const rows = []; let bad = 0;
try {
  for (const w of WIDTHS) for (const path of PAGES) {
    const p = await newPage(b, { width: w, height: 900, wallet: true });
    await p.goto(`${SITE}${path}`); await p.waitForTimeout(1800);
    const over = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    await p.addScriptTag({ content: axeSrc });
    const axe = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ') })); });
    const slug = `${MODE}-${path.replace(/[^a-z0-9]+/gi, '_')}-${w}`;
    await p.clock.setFixedTime(new Date(0));
    await p.goto(`${SITE}${path}${path.includes('?') ? '&' : '?'}motion=off`);
    await p.waitForFunction(() => document.documentElement.dataset.motion === 'off');
    await p.waitForTimeout(600);
    await shot(p, slug);
    if (w === 1440) {
      await p.addStyleTag({ content: 'html{filter:grayscale(1)}' });
      await shot(p, slug + '-gray');
    }
    if (MODE === 'undeployed' && path === '/') {
      const ribbon = (await p.locator('.ribbon-list').first().locator('li').allTextContents()).join(' | ');
      if (/minted|left|opens by|open at/i.test(ribbon)) p.errors.push(`ribbon shows live numbers without a deployment: ${ribbon}`);
    }
    const hscroll = over.sw > over.iw + 1;
    if (hscroll || axe.length || p.errors.length) bad++;
    rows.push({ w, path, hscroll: hscroll ? `${over.sw}>${over.iw}` : '', axe: axe.map((a) => `${a.id}(${a.impact},${a.n}) ${a.sample}`), errors: p.errors });
    await p.context().close();
  }
} finally { await b.close(); chainProc?.kill(); siteProc.kill(); }
for (const r of rows) if (r.hscroll || r.axe.length || r.errors.length) console.log(`${r.w} ${r.path}`, r.hscroll && `H-SCROLL ${r.hscroll}`, r.axe.length ? `\n   axe: ${r.axe.join('\n        ')}` : '', r.errors.length ? `\n   errors: ${r.errors.join(' | ')}` : '');
console.log(`\n${MODE}: ${rows.length} page/width combos, ${bad} with findings`);

writeFileSync(`${SHOTS}${MODE}-layout.json`, JSON.stringify(rows, null, 2));
process.exitCode = bad ? 1 : 0;
