# Gridlock launch checklist

Everything here is done by the owner, by hand. Nothing in this list was run by the build agent.
Permanent means it cannot be changed after the step. Check each item before the step, not after.

## A. Before any deploy

0. Read `docs/MAINNET-READINESS.md` first: it lists which gates are open and confirms the hosting.

1. Run `cd contracts && forge build && forge test -vv`. Record the result in `docs/AUDIT-PACKET.md` section 7. Do not continue if anything fails or warns without an explanation.
2. Run the harness once. Install both folders first, because `scripts/gen-hunt.mjs` imports `viem` from `contracts/node_modules`: `cd contracts && pnpm install && cd harness && pnpm install && node compile.mjs && node --test tests/*.test.mjs`. Without the first `pnpm install`, the test "gen-hunt --check detects a mismatch" fails with `Cannot find package 'viem'`.
3. Check the name, symbol (GRID) and domain are free. Read the Vercel terms and plan limits that apply today and record the date in `docs/DECISIONS.md` (D-5.3). A paid mint needs the Pro plan; the Hobby plan is non-commercial only.
4. Create free RPC and explorer keys. Put them in the Vercel project's environment variables, never in the repo (see section A2 below).
5. Prepare a hardware wallet or multisig for the deployer, and a separate treasury address you control. **Treasury is permanent.** Send a small test amount to it first and confirm you can move it.
6. Offline, on a trusted machine, run `node contracts/scripts/gen-hunt.mjs --out <folder outside the repo>`. Back up `hunt-secrets.txt` in two places. Only `hunt-commitments.json` may be committed. Decide how to spread the clues outside the site (posters, images, social media). **The 12 commitments are permanent.**
7. Decide START_TIME, OPEN_TIMEOUT, prices (rank 15 lowest, rising to rank 1) and caps. **All are permanent.** Announce them before START_TIME.
8. Legal review of the Risk and Terms text, region limits and the hunt mechanism.

## A2. Vercel project setup (once)

1. Create a Vercel project from the GitHub repository. **Root Directory: `web`.** Framework Preset: Other (`web/vercel.json` already sets this, and the build command `npm run build:vercel`). Do not set an Output Directory: the build writes `.vercel/output` itself. Node.js version: 22.x.
2. Environment variables (Project Settings, Environment Variables). Build time, not secret: `NEXT_PUBLIC_CHAIN_ID` (46630 for the testnet site, 4663 for mainnet), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_INDEXABLE` (1 only on the real production site), `NEXT_PUBLIC_AUDIT_REPORT_URL`, `NEXT_PUBLIC_CONTACT_URL`. Runtime, **secret**: `UPSTREAM_RPC_URL` (the provider URL with its key), `CONTRACT_ADDRESSES` (comma separated: the cars contract and the renderer), optional `ALLOWED_ORIGINS`, `BLOCKED_COUNTRIES`, `RATE_LIMIT_PER_MIN`, `MAX_LOG_RANGE`, `CACHE_SECONDS`. Changing a `NEXT_PUBLIC_` value needs a new build.
3. Deploy a **preview** first and check, on the preview URL: the home page and `/mint/` load; `https://<preview>/api/geo` returns `{"blocked":false}`; the browser shows live ladder data (a read through `/api/rpc` works); the page response carries `Content-Security-Policy` and `X-Frame-Options` (browser dev tools, Network tab); `/risk` redirects to `/risk/`; a wrong path shows the 404 page; the sound files under `/audio/` load after turning sound on.
4. If the preview shows none of the headers and no `/api/*`, Vercel did not use `.vercel/output`. Stop and use the fallback in DECISIONS.md D-5.3 (`npx vercel build` then `npx vercel deploy --prebuilt` from `web/`).
5. Add a rate-limit rule in the Vercel Firewall for `/api/rpc` if your plan allows it. The in-code limit is per function instance and only best effort.
6. Custom domain, then set `NEXT_PUBLIC_SITE_URL` to it and rebuild.

## B. Testnet (46630) with short clocks

Use `deploy/testnet.example.json` as a template: copy it to `deploy/testnet.json` and fill in real addresses. Short clocks: OPEN_TIMEOUT 120 s, HEAT_DECAY_SECONDS 60 s, REVEAL_MIN_DELAY 10 s. Small caps are allowed on testnet (for example 3 per rank) so the whole ladder can sell out.

1. Simulate first (no `--broadcast`): `DEPLOY_CONFIG=deploy/testnet.json forge script script/Deploy.s.sol --account <keystore> --sender <addr> --rpc-url <testnet rpc>`.
2. Then broadcast the same command with `--broadcast` and `WRITE_DEPLOYMENT=1`. This writes `deployments/46630.json`.
3. Run `pnpm verify:deployment` from `web`. Every line must pass.
4. Walk the whole ladder: rank 15 opens at START_TIME, sell it out, confirm rank 14 opens at the sell-out time. Let one rank open by timeout. Confirm the site shows "TEST CLOCK".
5. Transfer cars and watch heat, stars and "Heat reaches 0 at" on the site. Check one transfer on the explorer.
6. Run the hunt with a test commitment set (`gen-hunt.mjs --test`): commit, wait the delay, reveal. Try a reveal that is too early and a second claim.
7. Open the collection on the target marketplace. Check that the image shows, that the royalty is read, and that heat updates after a refresh. Record what you saw in `docs/DECISIONS.md` (unresolved items: ERC-2981 on the marketplace, SVG rendering, testnet display).
8. Test the site with a country block (`BLOCKED_COUNTRIES`) and a wrong network.

## C. Mainnet (4663). Do not start before an external audit and your own decision.

1. External audit finished. Fixes applied and re-tested. Put the report link in `AUDIT_REPORT_URL`. Until then the site shows "No external audit yet".
2. Re-check the chain facts in `docs/DECISIONS.md` (chain id, RPC, explorer, EVM version, contract size limit) against the official docs on the day. The snapshot in `docs/MAINNET-READINESS.md` lists what was checked on 2026-11-12, including the sequencer ordering rule.
3. Production values in `deploy/mainnet.json`: OPEN_TIMEOUT 604800, HEAT_DECAY_SECONDS 3600, REVEAL_MIN_DELAY 60, the real commitments, the real treasury. Read the file aloud against your notes.
4. Simulate. Read the printed addresses and parameters. Then broadcast with a hardware wallet (`--ledger`) and `CONFIRM_MAINNET=I-HAVE-AN-EXTERNAL-AUDIT-AND-I-DECIDE`. Gas is paid by you.
5. Verify the contracts on the explorer using the explorer's verifier and the build settings in `AUDIT-PACKET.md` section 2.
6. Run `pnpm verify:deployment` against mainnet. Publish `deployments/4663.json` and rebuild the site.
7. Announce the parameters again, then wait for START_TIME. Do not move START_TIME: it cannot be moved.
8. After launch: call `withdraw()` when you want funds moved (anyone can call it, it only pays the treasury).

## What is permanent

Treasury, renderer address, START_TIME, OPEN_TIMEOUT, caps, prices, heat decay, reveal delay, the 12 hunt commitments, royalty basis points (500), and all contract code. There is no pause, no fix and no refund.
