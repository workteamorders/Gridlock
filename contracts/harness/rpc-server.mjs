// Local JSON-RPC server over the in-process harness EVM. A stand-in for anvil, for LOCAL testing of the site only.
//   node rpc-server.mjs [config.json] [--port 8545] [--start-in <seconds>]
// Extras (not standard RPC): eth_sendTransaction executes immediately from any `from` (no signatures), and
// POST /__warp {"time": <unix>} or {"advance": <seconds>} moves the chain clock. GET /__info lists addresses.
import http from 'node:http';
import { createAddressFromString, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { keccak256, toHex } from 'viem';
import { Chain, addr } from './evm.mjs';
import { deployFromConfig } from './deploy-local.mjs';
import { decodeRevert } from './evm.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const cfgPath = argv.find((a) => a.endsWith('.json')) ?? '../deploy/anvil.json';
const PORT = Number(flag('port', 8545));
const CHAIN_ID = 31337;
const t0 = BigInt(Math.floor(Date.now() / 1000));
const chain = await Chain.create(t0);
chain.number = 1000n;
const dep = await deployFromConfig(cfgPath, chain);
if (flag('start-in')) { /* deployFromConfig already used startOffsetSeconds or startTime from the config */ }
const abis = { cars: dep.cars.abi, renderer: dep.renderer.abi };
const hex = (n) => '0x' + BigInt(n).toString(16);
const receipts = new Map();
let txCount = 0;

const header = () => ({
  number: hex(chain.number), hash: keccak256(toHex(`block-${chain.number}`)), parentHash: keccak256(toHex(`block-${chain.number - 1n}`)), timestamp: hex(chain.now),
  gasLimit: hex(30_000_000), gasUsed: '0x0', baseFeePerGas: '0x0', miner: addr(0), nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0',
  extraData: '0x', logsBloom: '0x' + '0'.repeat(512), receiptsRoot: keccak256('0x'), sha3Uncles: keccak256('0x'), stateRoot: keccak256('0x'), transactionsRoot: keccak256('0x'), size: '0x200', transactions: [], uncles: [],
});

async function run(tx, { apply }) {
  const from = tx.from ?? addr(0xa11ce);
  const value = tx.value ? BigInt(tx.value) : 0n;
  const need = value + 10n ** 18n;
  if ((await chain.balance(from)) < need && apply) await chain.fund(from, need + 1000n * 10n ** 18n);
  if (!apply && (await chain.balance(from)) < need) await chain.fund(from, need + 1000n * 10n ** 18n);
  if (!apply) await chain.vm.evm.journal.checkpoint();
  try {
    const r = await chain.vm.evm.runCall({
      caller: createAddressFromString(from), to: createAddressFromString(tx.to), data: hexToBytes(tx.data ?? tx.input ?? '0x'), value,
      gasLimit: 5_000_000_000n, block: chain.block(),
    });
    return { r, from, value };
  } finally { if (!apply) await chain.vm.evm.journal.revert(); }
}
const abiFor = (to) => (to.toLowerCase() === dep.cars.address.toLowerCase() ? abis.cars : to.toLowerCase() === dep.renderer.address.toLowerCase() ? abis.renderer : []);

async function handle(m, p) {
  switch (m) {
    case 'eth_chainId': return hex(CHAIN_ID);
    case 'net_version': return String(CHAIN_ID);
    case 'eth_blockNumber': return hex(chain.number);
    case 'eth_getBlockByNumber': case 'eth_getBlockByHash': return header();
    case 'eth_gasPrice': return '0x1';
    case 'eth_maxPriorityFeePerGas': return '0x0';
    case 'eth_feeHistory': return { oldestBlock: hex(chain.number), baseFeePerGas: ['0x0', '0x0'], gasUsedRatio: [0], reward: [['0x0']] };
    case 'eth_getBalance': return hex(await chain.balance(p[0]));
    case 'eth_getTransactionCount': return '0x0';
    case 'eth_getCode': { const c = await chain.vm.stateManager.getCode(createAddressFromString(p[0])); return bytesToHex(c); }
    case 'eth_call': {
      const { r } = await run(p[0], { apply: false });
      const out = bytesToHex(r.execResult.returnValue);
      if (r.execResult.exceptionError) throw { code: 3, message: 'execution reverted: ' + decodeRevert(abiFor(p[0].to), out), data: out };
      return out;
    }
    case 'eth_estimateGas': {
      const { r } = await run(p[0], { apply: false });
      const out = bytesToHex(r.execResult.returnValue);
      if (r.execResult.exceptionError) throw { code: 3, message: 'execution reverted: ' + decodeRevert(abiFor(p[0].to), out), data: out };
      return hex(r.execResult.executionGasUsed + 60_000n);
    }
    case 'eth_sendTransaction': {
      const tx = p[0];
      const { r, from } = await run(tx, { apply: true });
      const out = bytesToHex(r.execResult.returnValue);
      chain.number += 1n;
      const hash = keccak256(toHex(`tx-${++txCount}-${Date.now()}`));
      const failed = !!r.execResult.exceptionError;
      receipts.set(hash, {
        transactionHash: hash, transactionIndex: '0x0', blockHash: header().hash, blockNumber: hex(chain.number), from, to: tx.to, cumulativeGasUsed: hex(r.execResult.executionGasUsed),
        gasUsed: hex(r.execResult.executionGasUsed), contractAddress: null, logs: [], logsBloom: '0x' + '0'.repeat(512), status: failed ? '0x0' : '0x1', effectiveGasPrice: '0x1', type: '0x2',
        _revert: failed ? decodeRevert(abiFor(tx.to), out) : undefined,
      });
      return hash;
    }
    case 'eth_getTransactionReceipt': { const r = receipts.get(p[0]); if (!r) return null; const { _revert, ...rest } = r; return rest; }
    case 'eth_getTransactionByHash': { const r = receipts.get(p[0]); return r ? { hash: p[0], from: r.from, to: r.to, blockNumber: r.blockNumber, blockHash: r.blockHash, input: '0x', value: '0x0', nonce: '0x0', gas: '0x0', gasPrice: '0x1', transactionIndex: '0x0' } : null; }
    case 'eth_getLogs': return [];
    case 'eth_accounts': return [];
    default: throw { code: -32601, message: `method not supported by the local test server: ${m}` };
  }
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
let queue = Promise.resolve(); // EVM state is not re-entrant: serialize requests
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  if (req.url === '/__info') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ cars: dep.cars.address, renderer: dep.renderer.address, chainId: CHAIN_ID, now: String(chain.now), start: String(dep.start), config: dep.config })); return; }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    queue = queue.then(async () => {
      try {
        if (req.url === '/__warp') {
          const j = JSON.parse(body);
          if (j.time !== undefined) chain.warp(BigInt(j.time)); if (j.advance !== undefined) chain.advance(BigInt(j.advance));
          chain.number += 1n;
          res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ now: String(chain.now) })); return;
        }
        const j = JSON.parse(body);
        const one = async (q) => {
          try { return { jsonrpc: '2.0', id: q.id, result: await handle(q.method, q.params ?? []) }; }
          catch (e) { return { jsonrpc: '2.0', id: q.id, error: { code: e.code ?? -32000, message: e.message ?? String(e), ...(e.data ? { data: e.data } : {}) } }; }
        };
        const out = Array.isArray(j) ? await Promise.all(j.map((q) => one(q))) : await one(j);
        res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e) { res.writeHead(400, cors).end(String(e)); }
    });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`local test chain on http://127.0.0.1:${PORT} chainId ${CHAIN_ID}\ncars ${dep.cars.address}\nrenderer ${dep.renderer.address}\nstart ${dep.start} now ${chain.now}`));
