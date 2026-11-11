// Compile contracts with solc-js using the same settings as foundry.toml.
// Usage: node compile.mjs [--tests]   (--tests also compiles ../test and ../script to type-check them)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const solc = require('solc');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const withTests = process.argv.includes('--tests');

const remaps = [
  ['solady/', 'lib/solady/src/'],
  ['forge-std/', 'lib/forge-std/src/'],
];

function resolveImport(path) {
  for (const [from, to] of remaps) if (path.startsWith(from)) return to + path.slice(from.length);
  return path;
}

const sources = {};
function addDir(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return;
  for (const f of readdirSync(abs)) if (f.endsWith('.sol')) sources[`${dir}/${f}`] = { content: readFileSync(join(abs, f), 'utf8') };
}
addDir('src');
if (withTests) {
  addDir('test');
  addDir('script');
}

function findImports(path) {
  const real = resolveImport(path);
  const file = join(root, real);
  if (existsSync(file)) return { contents: readFileSync(file, 'utf8') };
  return { error: `not found: ${path}` };
}

// Rewrite relative and remapped import paths inside project sources so solc resolves them consistently.
for (const [k, v] of Object.entries(sources)) {
  v.content = v.content.replace(/import\s+(\{[^}]*\}\s+from\s+)?"([^"]+)";/g, (m, names, p) => {
    let np = p;
    if (p.startsWith('./') || p.startsWith('../')) np = join(dirname(k), p).replace(/\\/g, '/');
    else np = resolveImport(p);
    return `import ${names ?? ''}"${np}";`;
  });
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai',
    metadata: { bytecodeHash: 'none' },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
let errors = 0;
for (const e of out.errors ?? []) {
  if (e.severity === 'error') errors++;
  console.log(`${e.severity.toUpperCase()}: ${e.formattedMessage.trim()}`);
}
if (errors) {
  console.log(`\n${errors} error(s). Build failed.`);
  process.exit(1);
}
mkdirSync(join(here, 'build'), { recursive: true });
const summary = [];
for (const [file, contracts] of Object.entries(out.contracts)) {
  if (!file.startsWith('src/')) continue;
  for (const [name, c] of Object.entries(contracts)) {
    const bytecode = '0x' + c.evm.bytecode.object;
    const deployed = '0x' + c.evm.deployedBytecode.object;
    writeFileSync(join(here, 'build', `${name}.json`), JSON.stringify({ abi: c.abi, bytecode, deployedBytecode: deployed, immutableReferences: c.evm.deployedBytecode.immutableReferences ?? {} }, null, 1));
    summary.push(`${name}: runtime ${(deployed.length - 2) / 2} bytes, init ${(bytecode.length - 2) / 2} bytes`);
  }
}
console.log(summary.join('\n'));
console.log(`solc ${solc.version()}  evm=shanghai  optimizer runs=200  ${withTests ? '(with tests)' : ''}`);
