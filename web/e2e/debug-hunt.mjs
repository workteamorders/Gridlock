import { launch, newPage, start, info, writeDeployment, warp, testSecret, SITE } from './lib.mjs';
const web = new URL('..', import.meta.url).pathname;
const chainProc = await start('node', ['rpc-server.mjs', '--port', '8545'], { cwd: `${web}../contracts/harness` }, 'local test chain');
const i = await info(); writeDeployment(`${web}out-e2e`, i);
const siteProc = await start('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: `${web}out-e2e` }, 'Serving HTTP');
const b = await launch();
try {
  await warp({ time: Number(i.start) + 1 });
  const p = await newPage(b, { wallet: true });
  await p.goto(`${SITE}/hunt/`); await p.waitForSelector('#hunt-secret', { state: 'attached' }).catch(() => {});
  await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
  await p.waitForSelector('#hunt-secret');
  await p.fill('#hunt-index', '3'); await p.fill('#hunt-secret', testSecret(3));
  await p.click('button:has-text("Step 1")'); await p.waitForSelector('text=Step 1 is saved', { timeout: 30000 });
  console.log('NOW', (await (await fetch('http://127.0.0.1:8545/__info')).json()).now, 'commit saved');
  console.log(await warp({ advance: 11 }));
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")'); await p.waitForTimeout(3000);
  await p.fill('#hunt-index', '3'); await p.fill('#hunt-secret', testSecret(3));
  await p.click('button:has-text("Step 2")'); await p.waitForTimeout(500);
  console.log('after step2 click:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(900, 1700));
  await p.click('button:has-text("Claim car 3")'); await p.waitForTimeout(4000);
  console.log((await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 1700));
  console.log(p.errors, await p.evaluate(() => window.__walletCalls));
} finally { await b.close(); chainProc.kill(); siteProc.kill(); }
