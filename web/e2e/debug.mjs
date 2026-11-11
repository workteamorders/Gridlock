import { launch, newPage, start, info, writeDeployment, SITE } from './lib.mjs';
const web = new URL('..', import.meta.url).pathname;
const chainProc = await start('node', ['rpc-server.mjs', '--port', '8545'], { cwd: `${web}../contracts/harness` }, 'local test chain');
writeDeployment(`${web}out-e2e`, await info());
const siteProc = await start('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { cwd: `${web}out-e2e` }, 'Serving HTTP');
const b = await launch();
try {
  const p = await newPage(b);
  await p.goto(`${SITE}${process.argv[2] ?? '/'}`); await p.waitForTimeout(3000);
  console.log(p.errors);
  console.log((await p.locator('body').innerText()).slice(0, 1500));
} finally { await b.close(); chainProc.kill(); siteProc.kill(); }
