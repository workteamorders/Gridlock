// Minimal in-process EVM wrapper (ethereumjs) with viem ABI coding. Test harness only, not forge.
import { createVM } from '@ethereumjs/vm';
import { Common, Mainnet, Hardfork } from '@ethereumjs/common';
import { createBlock } from '@ethereumjs/block';
import { createAddressFromString, createAccount, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { encodeFunctionData, decodeFunctionResult, decodeErrorResult, encodeDeployData } from 'viem';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const artifact = (name) => JSON.parse(readFileSync(join(here, 'build', `${name}.json`), 'utf8'));

export const ETH = 10n ** 18n;
export const addr = (n) => '0x' + BigInt(n).toString(16).padStart(40, '0');

export class Chain {
  static async create(startTime = 1_000_000n) {
    const c = new Chain();
    c.common = new Common({ chain: Mainnet, hardfork: Hardfork.Shanghai });
    c.vm = await createVM({ common: c.common });
    c.now = startTime;
    c.number = 1n;
    c.abis = new Map();
    return c;
  }
  warp(t) { this.now = BigInt(t); }
  advance(s) { this.now += BigInt(s); }
  block() {
    return createBlock(
      { header: { number: this.number, timestamp: this.now, gasLimit: 30_000_000_000n, baseFeePerGas: 0n } },
      { common: this.common, skipConsensusFormatValidation: true },
    );
  }
  async fund(a, amount = 1000n * ETH) {
    const A = createAddressFromString(a);
    const acct = (await this.vm.stateManager.getAccount(A)) ?? createAccount({ nonce: 0n, balance: 0n });
    acct.balance = amount;
    await this.vm.stateManager.putAccount(A, acct);
  }
  async balance(a) {
    const acct = await this.vm.stateManager.getAccount(createAddressFromString(a));
    return acct ? acct.balance : 0n;
  }
  async deploy(name, args = [], from = addr(0xd0), value = 0n) {
    const art = artifact(name);
    await this.fund(from, (await this.balance(from)) || 1000n * ETH);
    const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode, args });
    const r = await this.vm.evm.runCall({
      caller: createAddressFromString(from), data: hexToBytes(data), value, gasLimit: 5_000_000_000n, block: this.block(),
    });
    if (r.execResult.exceptionError) {
      throw new Error(`deploy ${name} failed: ${r.execResult.exceptionError.error} ${bytesToHex(r.execResult.returnValue)}`);
    }
    const address = r.createdAddress.toString();
    this.abis.set(address.toLowerCase(), art.abi);
    return { address, abi: art.abi, gasUsed: r.execResult.executionGasUsed };
  }
  /** Try to deploy and return the decoded revert instead of throwing. */
  async tryDeploy(name, args = [], from = addr(0xd0)) {
    const art = artifact(name);
    await this.fund(from, (await this.balance(from)) || 1000n * ETH);
    const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode, args });
    const r = await this.vm.evm.runCall({
      caller: createAddressFromString(from), data: hexToBytes(data), gasLimit: 5_000_000_000n, block: this.block(),
    });
    if (!r.execResult.exceptionError) return { ok: true, address: r.createdAddress.toString() };
    return { ok: false, error: decodeRevert(art.abi, bytesToHex(r.execResult.returnValue)) };
  }
  /** Call (and apply state if it succeeds). from must be funded by the caller of this helper if value > 0. */
  async call(contract, fn, args = [], { from = addr(0xa11ce), value = 0n } = {}) {
    const abi = contract.abi;
    const data = encodeFunctionData({ abi, functionName: fn, args });
    const bal = await this.balance(from);
    if (bal < value + ETH) await this.fund(from, value + 1000n * ETH);
    const r = await this.vm.evm.runCall({
      caller: createAddressFromString(from), to: createAddressFromString(contract.address),
      data: hexToBytes(data), value, gasLimit: 5_000_000_000n, block: this.block(),
    });
    const ret = bytesToHex(r.execResult.returnValue);
    const gasUsed = r.execResult.executionGasUsed;
    if (r.execResult.exceptionError) {
      return { ok: false, error: decodeRevert(abi, ret), gasUsed, logs: [] };
    }
    let result;
    try { result = decodeFunctionResult({ abi, functionName: fn, data: ret }); } catch { result = undefined; }
    return { ok: true, result, gasUsed, logs: r.execResult.logs ?? [] };
  }
  /** Call and throw on revert. */
  async must(contract, fn, args = [], opts = {}) {
    const r = await this.call(contract, fn, args, opts);
    if (!r.ok) throw new Error(`${fn}(${args.map(String).join(',')}) reverted: ${r.error}`);
    return r;
  }
  /** Read-only call: state changes are not applied. */
  async view(contract, fn, args = [], opts = {}) {
    await this.vm.evm.journal.checkpoint();
    try {
      const r = await this.must(contract, fn, args, opts);
      return r;
    } finally {
      await this.vm.evm.journal.revert();
    }
  }
}

export function decodeRevert(abi, data) {
  if (!data || data === '0x') return 'revert(empty)';
  try {
    const d = decodeErrorResult({ abi, data });
    return d.args && d.args.length ? `${d.errorName}(${d.args.join(',')})` : d.errorName;
  } catch {
    if (data.startsWith('0x08c379a0')) return 'Error(string)';
    return `revert(${data.slice(0, 10)})`;
  }
}
