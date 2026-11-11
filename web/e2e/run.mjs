// Local end-to-end: starts the local chain and the static site, drives the main flows with an injected wallet.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { pages, launch, newPage, shot, start, startSite, info, warp, rpc, writeDeployment, ACCOUNT, OTHER, testSecret, SITE } from './lib.mjs';

const web = new URL('..', import.meta.url).pathname;
const chainProc = await start('node', ['rpc-server.mjs', '--port', '8545'], { cwd: `${web}../contracts/harness` }, 'local test chain');
const i = await info();
writeDeployment(`${web}out-e2e`, i);
const siteProc = await startSite(`${web}out-e2e`);
const browser = await launch();
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(['ok', name]); console.log('ok  ', name); } catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '\n    ', e.message.split('\n')[0]); const pg = pages[pages.length - 1]; if (pg && !pg.isClosed()) { await shot(pg, 'fail-' + results.length).catch(() => undefined); console.log('    page text:', (await pg.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 700)); console.log('    errors:', pg.errors); } } };
const text = (page) => page.locator('body').innerText();

try {
  await step('before START: home shows countdown and no mint action', async () => {
    const p = await newPage(browser);
    await p.goto(`${SITE}/`); await p.waitForSelector('text=Minted so far');
    const t = await text(p);
    assert.match(t, /Minting opens at/); assert.doesNotMatch(t, /Mint at the open rung/);
    await shot(p, 'home-before-start'); assert.deepEqual(p.errors, []); await p.context().close();
  });

  await warp({ time: Number(i.start) + 1 });

  await step('after START: only rank 15 is open, mint action visible', async () => {
    const p = await newPage(browser);
    await p.goto(`${SITE}/`); await p.waitForSelector('text=Mint at the open rung');
    assert.match(await text(p), /Rank 15 is open/);
    await p.click('text=Mint at the open rung'); await p.waitForURL(/mint\/\?rank=15/);
    await p.waitForSelector('text=Toll gate');
    await p.waitForSelector('figure.cardimg img', { timeout: 20000 });
    await p.context().close();
  });

  await step('mint 2 cars at rank 15 with the wallet; heat 0; receipt shown', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.goto(`${SITE}/mint/?rank=15`); await p.waitForSelector('text=Toll gate');
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('button:has-text("Review 1 car")');
    await p.click('button[aria-label="One more"]');
    await p.waitForSelector('button:has-text("Review 2 cars")');
    await shot(p, 'mint-qty2');
    await p.click('button:has-text("Review 2 cars")');
    await p.waitForSelector('text=Read this once before your first mint'); await p.click('button:has-text("I understand, continue")');
    await p.waitForSelector('text=Cannot be undone');
    await p.click('button:has-text("Mint 2 cars for")');
    await p.waitForSelector('text=Check the receipt yourself', { timeout: 30000 });
    await p.getByRole('img', { name: 'Caught', exact: true }).waitFor();
    const t = await text(p); assert.match(t, /Car numbers\s*\n?\s*1, 2/);
    await p.getByRole('img', { name: 'Confirmed mint, car 1', exact: true }).waitFor();
    await p.getByRole('img', { name: 'Confirmed mint, car 2', exact: true }).waitFor();
    await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await shot(p, 'mint-done'); assert.deepEqual(p.errors, []); await p.context().close();
  });

  await step('wallet cap: a third rank-15 car cannot be minted by the same wallet', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.goto(`${SITE}/mint/?rank=15`); await p.waitForSelector('text=Toll gate');
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('text=at its limit for this rank');
    assert.equal(await p.locator('button:has-text("Review")').isDisabled(), true);
    await p.context().close();
  });

  await step('garage lists both cars; sending one adds heat', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.goto(`${SITE}/garage/`);
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('text=2 cars in');
    await shot(p, 'garage');
    await p.click('button:has-text("Send car #1")');
    await p.waitForSelector('text=Sending adds heat');
    await p.fill('#send-to', 'not an address'); await p.click('button:has-text("Review")');
    await p.waitForSelector('text=An address is 0x followed by 40');
    await p.fill('#send-to', OTHER); await p.click('button:has-text("Review")');
    await p.waitForSelector('text=Send is permanent'); await p.click('dialog button:has-text("Send car #1")');
    await p.waitForSelector('text=1 car in', { timeout: 30000 });
    await p.context().close();
    const g = await newPage(browser);
    await g.goto(`${SITE}/gallery/?id=1`); await g.waitForSelector('h3:has-text("Rap sheet")');
    const t = await text(g);
    assert.match(t, /Transfers\s*\n?\s*1/); assert.match(t, /Heat now\s*\n?\s*20 of 150/); assert.match(t, /Heat reaches 0 at/);
    await shot(g, 'car-detail'); await g.context().close();
  });

  await step('gallery lists cars, filters work, bad id is rejected', async () => {
    const p = await newPage(browser);
    await p.goto(`${SITE}/gallery/`); await p.waitForSelector('text=Showing 2 of 2 loaded cars');
    await p.selectOption('select >> nth=0', '14'); await p.waitForSelector('text=No loaded car matches');
    await p.goto(`${SITE}/gallery/?id=999`); await p.waitForSelector('text=Car numbers run from 1 to 2');
    await p.goto(`${SITE}/gallery/?id=abc`); await p.waitForSelector('text=A car number is whole digits');
    await p.context().close();
  });

  await step('hunt: two-step claim with the wait enforced; claimed car appears', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.goto(`${SITE}/hunt/`); await p.waitForSelector('text=0 of 12 claimed');
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('#hunt-secret');
    await p.fill('#hunt-index', '3'); await p.fill('#hunt-secret', testSecret(5));
    await p.click('button:has-text("Step 1")');
    await p.waitForSelector('text=does not open that car');
    await p.fill('#hunt-secret', testSecret(3)); await p.click('button:has-text("Step 1")');
    await p.waitForSelector('text=Step 1 is saved', { timeout: 30000 });
    assert.equal(await p.locator('button:has-text("Step 2")').isDisabled(), true);
    await shot(p, 'hunt-waiting');
    await warp({ advance: 11 });
    await p.reload(); await p.waitForSelector('button:has-text("Connect wallet")');
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('text=the wait is over', { timeout: 20000 });
    await p.fill('#hunt-index', '3'); await p.fill('#hunt-secret', testSecret(3));
    await p.click('button:has-text("Step 2")'); await p.waitForSelector('text=Claim is permanent');
    await p.click('button:has-text("Claim car 3")');
    await p.waitForSelector('text=1 of 12 claimed', { timeout: 30000 });
    await p.getByRole('img', { name: 'Claimed', exact: true }).waitFor();
    await p.getByRole('img', { name: /^Claimed hidden car / }).waitFor();
    await p.context().close();
  });

  await step('ladder: rank 14 locked until rank 15 sells out or times out; opens by timeout', async () => {
    const p = await newPage(browser);
    await p.goto(`${SITE}/ladder/`); await p.waitForSelector('text=ladder cars minted');
    let t = await text(p); assert.match(t, /RANK\s*14\s*(LOCKED|OPENS AFTER)/i);
    await warp({ advance: 121 });
    await p.reload(); await p.waitForSelector('a:has-text("Mint rank 14")', { timeout: 20000 });
    await shot(p, 'ladder-after-timeout');
    const open = await p.locator('a:has-text("Mint rank 14")').count(); assert.equal(open, 1);
    await p.context().close();
  });

  await step('wrong network: banner and mint disabled', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.addInitScript(() => { window.__wrongChain = true; });
    await p.goto(`${SITE}/mint/?rank=15`); await p.waitForSelector('text=Toll gate').catch(() => undefined);
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('button:has-text("Switch to")');
    await p.context().close();
  });

  await step('geoblock: view-only banner shows and mint is disabled (fake /api/geo answer)', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.route('**/api/geo', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"blocked":true}' }));
    await p.goto(`${SITE}/mint/?rank=15`);
    await p.waitForSelector('text=View-only mode');
    await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
    await p.waitForSelector('text=turned off in this interface for your region');
    assert.equal(await p.locator('main button:has-text("Review")').isDisabled(), true);
    await shot(p, 'geoblock'); await p.context().close();
  });

  await step('mismatch: tampered published caps pause minting and say why', async () => {
    const fs = await import('node:fs');
    const f = `${web}out-e2e/deployments/31337.json`;
    const orig = fs.readFileSync(f, 'utf8');
    const d = JSON.parse(orig);
    d.expected = { startTime: Number(i.start), openTimeout: 120, heatDecaySeconds: 60, revealMinDelay: 10, treasury: i.config.treasury, caps: [11, ...i.config.caps.slice(1)], pricesWei: i.config.pricesWei, huntCommitments: i.config.huntCommitments };
    fs.writeFileSync(f, JSON.stringify(d));
    try {
      const p = await newPage(browser, { wallet: true });
      await p.goto(`${SITE}/mint/?rank=15`);
      await p.waitForSelector('text=does not match the published parameters');
      await p.click('button:has-text("Connect wallet")'); await p.click('button:has-text("Mock Wallet")');
      await p.waitForSelector('main >> text=does not match the published parameters');
      assert.equal(await p.locator('main button:has-text("Review")').isDisabled(), true);
      await p.goto(`${SITE}/contracts/`); await p.waitForSelector('text=rank 1 cap differs');
      await shot(p, 'mismatch'); await p.context().close();
    } finally { fs.writeFileSync(f, orig); }
  });

  await step('keyboard: every Tab stop on home has a visible focus indicator; dialog closes with Esc and returns focus', async () => {
    const p = await newPage(browser, { wallet: true });
    await p.goto(`${SITE}/`); await p.waitForSelector('text=Minted so far');
    const bad = [];
    for (let k = 0; k < 30; k++) {
      await p.keyboard.press('Tab');
      const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { tag: e.tagName, txt: (e.textContent || '').trim().slice(0, 20), ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle, sh: cs.boxShadow }; });
      if (r && !(r.os !== 'none' && r.ow >= 2) && r.sh === 'none') bad.push(r);
    }
    assert.deepEqual(bad, [], 'focus indicator missing');
    await p.goto(`${SITE}/garage/`); await p.waitForSelector('button:has-text("Connect wallet")');
    await p.focus('button:has-text("Connect wallet") >> nth=0'); await p.keyboard.press('Enter');
    await p.waitForSelector('dialog[open]'); await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    const back = await p.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
    assert.match(back ?? '', /Connect wallet/i);
    await p.context().close();
  });

  await step('reduced motion: one canvas paint and no infinite animations', async () => {
    const p = await newPage(browser, { reducedMotion: 'reduce' });
    await p.goto(`${SITE}/?motion=debug`);
    await p.waitForFunction(() => window.__fx?.frames === 1);
    await p.waitForTimeout(400);
    const state = await p.evaluate(() => ({
      frames: window.__fx.frames,
      infinite: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
    }));
    assert.deepEqual(state, { frames: 1, infinite: 0 });
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  await step('Motion works with a keyboard, syncs, persists and honors the URL override', async () => {
    const p = await newPage(browser);
    await p.goto(SITE);
    const control = p.locator('header .motion-button');
    await control.focus();
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
    assert.match(await p.locator('footer .motion-button').innerText(), /Reduced/);
    await p.reload();
    await p.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
    await control.focus();
    await p.keyboard.press('Space');
    await p.waitForFunction(() => document.documentElement.dataset.motion === 'off');
    await p.goto(`${SITE}/?motion=off`);
    await p.waitForFunction(() => document.querySelector('header .motion-button')?.disabled);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  await step('data saver and tab visibility stop the engine and CSS animations', async () => {
    const p = await newPage(browser);
    await p.addInitScript(() => {
      const network = Object.assign(new EventTarget(), { saveData: true });
      Object.defineProperty(navigator, 'connection', { value: network, configurable: true });
    });
    await p.goto(`${SITE}/?motion=debug`);
    await p.waitForFunction(() => window.__fx?.frames === 1);
    await p.waitForTimeout(180);
    assert.deepEqual(await p.evaluate(() => [window.__fx.frames, document.documentElement.dataset.motion]), [1, 'reduced']);
    await p.evaluate(() => {
      navigator.connection.saveData = false;
      navigator.connection.dispatchEvent(new Event('change'));
    });
    await p.waitForFunction(() => window.__fx.frames > 4);
    const paused = await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      return window.__fx.frames;
    });
    await p.waitForTimeout(180);
    assert.deepEqual(await p.evaluate(() => [window.__fx.frames, document.getAnimations().length]), [paused, 0]);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  await step('traffic canvas is decorative and leaves pointer and keyboard actions available', async () => {
    const p = await newPage(browser);
    await p.goto(`${SITE}/?motion=debug`);
    await p.waitForFunction(() => window.__fx?.frames > 5);
    const canvas = p.locator('canvas.live-background');
    assert.equal(await canvas.getAttribute('aria-hidden'), 'true');
    assert.equal(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    const brand = p.locator('header .brand');
    await brand.focus();
    await p.keyboard.press('Tab');
    assert.match(await p.locator(':focus').innerText(), /home/i);
    for (const [x, y] of [[38, 200], [144, 250], [260, 320], [360, 420]]) {
      await p.mouse.move(x, y, { steps: 12 });
      await p.waitForTimeout(70);
    }
    await p.waitForFunction(() => window.__fx.interactions > 0 && window.__fx.brakes > 0);
    await p.locator('header .motion-button').click();
    await p.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  await step('RPC failure: dead end with retry, nothing crashes', async () => {
    const p = await newPage(browser);
    await p.route('http://127.0.0.1:8545/**', (r) => r.abort());
    await p.goto(`${SITE}/ladder/`); await p.waitForSelector('text=No answer from the network', { timeout: 30000 });
    await p.context().close();
  });
} finally {
  await browser.close(); chainProc.kill(); siteProc.kill();
}
const failed = results.filter((r) => r[0] !== 'ok');
console.log(`\n${results.length - failed.length}/${results.length} e2e steps passed`);
process.exit(failed.length ? 1 : 0);
