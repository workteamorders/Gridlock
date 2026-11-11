import { launch, start, SITE } from './lib.mjs';
const web = new URL('..', import.meta.url).pathname;
const s = await start('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: `${web}out` }, 'Serving HTTP');
const b = await launch();
try {
  const ctx = await b.newContext({ viewport: { width: 412, height: 823 } });
  await ctx.addInitScript(() => { window.__h = []; const f = () => { const l = document.querySelector('.hero-ladder .stack'); if (l) { const c = [...l.children].map((x) => Math.round(x.getBoundingClientRect().height) + '@' + Math.round(x.getBoundingClientRect().y)); const k = c.join(','); if (window.__h[window.__h.length - 1]?.k !== k) window.__h.push({ t: Math.round(performance.now()), k }); } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
  await p.goto(`${SITE}/`); await p.waitForTimeout(6000);
  console.log(JSON.stringify(await p.evaluate(() => window.__h)));
} finally { await b.close(); s.kill(); }
