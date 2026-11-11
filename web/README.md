# Gridlock web

Static Next.js export for Cloudflare Pages, plus two read-only Pages Functions (`/api/rpc`, `/api/geo`).

```
pnpm install            # or npm install
pnpm sync:abi           # regenerate src/lib/gridlock-abi.ts after compiling the contracts
pnpm dev                # local dev server
pnpm build              # next build + CSP headers (out/)
pnpm check              # typecheck, token lint, copy check, unit tests, secret scan
pnpm verify:deployment  # compare a deployed pair with this repo (reads only)
pnpm e2e                # needs a build with NEXT_PUBLIC_CHAIN_ID=31337 in out-e2e (see e2e/run.mjs)
```

Environment variables: see `.env.example`. Nothing in `NEXT_PUBLIC_*` is secret. `UPSTREAM_RPC_URL` is set only in the Cloudflare dashboard.

Local end-to-end run (no network, no keys):

```
NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 npx next build && mv out out-e2e
node e2e/run.mjs        # starts the local chain and a static server, drives a mock wallet
node e2e/layout.mjs live
```

For the visual checks, make Playwright, axe-core and Lighthouse available in a local
`node_modules` directory and set `GRIDLOCK_E2E_TOOLS` to that directory. Set
`CHROME_PATH` if Chrome is installed in a custom location. Set `GRIDLOCK_E2E_PORT`
to an unused port if the default 4173 is occupied.

```sh
NEXT_PUBLIC_INDEXABLE=1 npm run build
node e2e/layout.mjs undeployed
node e2e/fps.mjs
node e2e/js-budget.mjs /path/to/baseline/out
e2e/lighthouse.sh out / /mint/ /ladder/ /gallery/ /garage/ /hunt/ /rules/ /contracts/ /risk/
```

The layout sweep runs axe with motion enabled and writes motion-off screenshots
and a 1440 px grayscale pass to `e2e/shots/`. JSON measurements are saved there
and in `e2e/lh/`. The local chain's generated artifacts are built with
`npm run compile` from `../contracts/harness/` before testing the live export.
