// Shared helpers for the local end-to-end run (local chain + static site + injected mock wallet).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { keccak256, toHex } from 'viem';

export const pages = [];
export const RPC = 'http://127.0.0.1:8545';
export const SITE = 'http://127.0.0.1:4173';
export const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
export const testSecret = (i) => keccak256(toHex(`GRIDLOCK-TEST-ONLY-SECRET-${i}`));
export const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

export const rpc = async (method, params = []) => {
  const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json();
  if (r.error) throw new Error(r.error.message);
  return r.result;
};
export const warp = (body) => fetch(`${RPC}/__warp`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
export const info = () => fetch(`${RPC}/__info`).then((r) => r.json());

export function start(cmd, args, opts, ready) {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((res, rej) => {
    let buf = '';
    const on = (d) => { buf += d; if (buf.includes(ready)) res(p); };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('exit', (c) => rej(new Error(`${cmd} exited ${c}: ${buf}`)));
    setTimeout(() => rej(new Error(`timeout waiting for ${cmd}: ${buf}`)), 60000);
  });
}

const MOCK_WALLET = (account) => `
(() => {
  const RPC = '${RPC}';
  const call = async (method, params) => { const r = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; e.data = r.error.data; throw e; } return r.result; };
  window.__walletCalls = [];
  const provider = { request: async ({ method, params = [] }) => {
    window.__walletCalls.push(method);
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['${account}'];
    if (method === 'eth_chainId') return window.__wrongChain ? '0x1' : '0x7a69';
    if (method === 'wallet_switchEthereumChain') { window.__wrongChain = false; return null; }
    if (method === 'eth_sendTransaction') return call(method, [{ ...params[0], from: '${account}' }]);
    return call(method, params);
  }, on() {}, removeListener() {} };
  const info = { uuid: 'mock-wallet-0001', name: 'Mock Wallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZmZjNjFhIi8+PC9zdmc+', rdns: 'test.mock' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce); announce();
})();`;

export async function launch() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  return browser;
}
export async function newPage(browser, { wallet = false, width = 1280, height = 900, reducedMotion = 'no-preference', headers = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion, extraHTTPHeaders: headers });
  if (wallet) await ctx.addInitScript(MOCK_WALLET(ACCOUNT));
  const page = await ctx.newPage();
  const errors = [];
  page.on('response', (r) => { if (r.status() === 404 && !r.url().endsWith('/api/geo')) errors.push('404: ' + r.url()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.errors = errors;
  pages.push(page);
  return page;
}
export const shot = (page, name, opts = {}) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true, ...opts });

export function writeDeployment(root, i) {
  mkdirSync(`${root}/deployments`, { recursive: true });
  writeFileSync(`${root}/deployments/31337.json`, JSON.stringify({ chainId: 31337, cars: i.cars, renderer: i.renderer }, null, 2));
}
