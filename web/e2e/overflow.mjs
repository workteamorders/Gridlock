import { launch, newPage, start, info, warp, writeDeployment, SITE } from './lib.mjs';
const web = new URL('..', import.meta.url).pathname;
const c = await start('node', ['rpc-server.mjs', '--port', '8545'], { cwd: `${web}../contracts/harness` }, 'local test chain');
const i = await info(); writeDeployment(`${web}out-e2e`, i); await warp({ time: Number(i.start) + 1 });
const s = await start('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: `${web}out-e2e` }, 'Serving HTTP');
const b = await launch();
try {
  const p = await newPage(b, { width: 360, wallet: true });
  await p.goto(`${SITE}${process.argv[2]}`); await p.waitForTimeout(2000);
  console.log(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5).slice(0, 8).map((e) => e.outerHTML.slice(0,160) + ' ' + `${e.tagName}.${e.className} right=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`)));
} finally { await b.close(); c.kill(); s.kill(); }
