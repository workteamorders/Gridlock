import { launch, start, SITE } from './lib.mjs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const web = new URL('..', import.meta.url).pathname;
const s = await start('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: `${web}${process.argv[3] ?? 'out'}` }, 'Serving HTTP');
const b = await launch();
try {
  const ctx = await b.newContext({ viewport: { width: 412, height: 823 } });
  await ctx.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), s: e.sources.map((x) => `${x.node?.nodeName}.${(x.node?.className||'').toString().slice(0,30)} ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} h${Math.round(x.previousRect.height)}->${Math.round(x.currentRect.height)}`) }); }).observe({ type: 'layout-shift', buffered: true }); });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
  await p.goto(`${SITE}${process.argv[2] ?? '/'}`); await p.waitForTimeout(6000);
  console.log(JSON.stringify(await p.evaluate(() => window.__ls), null, 1));
} finally { await b.close(); s.kill(); }
