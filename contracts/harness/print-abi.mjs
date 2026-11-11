// Prints the external function table for docs/AUDIT-PACKET.md from the compiled ABI.
import { artifact } from './evm.mjs';
const callers = {
  approve: 'token owner or approved operator', setApprovalForAll: 'any holder, own approvals only', transferFrom: 'token owner or approved',
  safeTransferFrom: 'token owner or approved', mint: 'anyone (payable, exact price, ladder rules)', commitClaim: 'anyone, stores a commitment for itself',
  revealClaim: 'a wallet holding an aged matching commitment', withdraw: 'anyone, sends the balance to the immutable TREASURY only',
};
const sig = (f) => `${f.name}(${f.inputs.map((i) => i.type === 'tuple' ? `(${i.components.map((c) => c.type).join(',')})` : i.type).join(',')})`;
for (const name of ['GridlockCars', 'GridlockRenderer']) {
  const abi = artifact(name).abi.filter((x) => x.type === 'function');
  console.log(`\n### ${name}\n`);
  console.log('| Function | Mutability | Allowed caller |\n|---|---|---|');
  for (const f of abi.sort((a, b) => sig(a).localeCompare(sig(b)))) {
    const write = !['view', 'pure'].includes(f.stateMutability);
    console.log(`| \`${sig(f)}\` | ${f.stateMutability} | ${write ? callers[f.name] ?? '?' : 'anyone (read only)'} |`);
  }
}
