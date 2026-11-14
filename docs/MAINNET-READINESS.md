# Mainnet readiness snapshot

Date of this snapshot: 2026-11-12. It adds to `docs/LAUNCH-CHECKLIST.md` (the step-by-step list) and does not replace it.
Nothing in this file was run on a chain. No key, no deploy, no transaction.

## Verdict

**Not ready for mainnet.** Four gates are closed and only the owner can open them: the external audit, the Foundry run, the legal review and the testnet rehearsal. Everything the contracts and the site can do by themselves is finished and tested in the build environment.

## Gate status

| # | Gate | Status | Who |
|---|---|---|---|
| 1 | `forge build && forge test -vv` | **Done (2026-11-14, owner's machine).** `forge test`: 32 of 32 passed. Harness: 49 of 49 passed. See AUDIT-PACKET section 7. Re-run after any contract change. | Owner |
| 2 | Static analysis (slither, aderyn) | **Slither done (2026-11-14, owner's machine):** 29 results, none high, none about reentrancy, ETH transfers or access control; all classified in AUDIT-PACKET section 7, no contract change needed. **aderyn not run** (optional second tool). Re-run after any contract change. | Owner |
| 3 | External audit | **None.** The audit packet (`docs/AUDIT-PACKET.md`) is ready to hand over. The site shows "No external audit yet" until `NEXT_PUBLIC_AUDIT_REPORT_URL` is set. | Owner |
| 4 | Legal review (Risk page, Terms, region limits, hunt mechanism) | **Pending.** The Risk page still says so. | Owner |
| 5 | Testnet rehearsal (46630, short clocks) | **Not done.** `deployments/46630.json` is still the `deployed: false` placeholder. | Owner |
| 6 | Permanent values decided: treasury, START_TIME, OPEN_TIMEOUT, caps, 15 prices, 12 hunt commitments | **Not decided.** `deploy/mainnet.example.json` fails on purpose until filled. | Owner |
| 7 | Hunt secrets generated offline and backed up twice | **Not done.** No real secret exists. | Owner |
| 8 | Hosting matches the code (see finding 1) | **Vercel chosen by the owner (2026-11-14) and the code is ported and tested locally.** Open: the first preview deploy must show `/api/rpc` and `/api/geo` working and the CSP header present; the Vercel **Pro** plan is needed for a paid mint. | Owner |
| 9 | Production RPC provider and key | **Not set.** | Owner |
| 10 | Marketplace check: image, royalty (ERC-2981), heat refresh | **Not done.** Needs testnet. | Owner |

## Findings from this review

### 1. Hosting: ported to Vercel (2026-11-14). Two things still need the owner

**Update 2026-11-14.** The owner chose Vercel. The port is done: `web/scripts/vercel-output.mjs` builds a Build Output API deployment (`.vercel/output`) from the static export. It turns `out/_headers` (the CSP with the inline-script hashes) into response headers on every path, adds the trailing-slash and 404 handling, and generates two Edge Functions, `/api/rpc` and `/api/geo`, from the same tested cores (`functions/_lib`). On Vercel the rate limit counts by `x-real-ip` and the country comes from `x-vercel-ip-country`; the Cloudflare headers are ignored because a visitor could send them. `tests/vercel-output.test.mjs` runs the generated functions. What was **not** done: no deploy to Vercel was made from here, so the behaviour on Vercel itself is untested. Do a preview deploy first and check: the page loads, `/api/geo` answers, a read through `/api/rpc` works, the response has the `Content-Security-Policy` header, `/risk` redirects to `/risk/`, and a bad path shows the 404 page. Setup steps are in `docs/LAUNCH-CHECKLIST.md` section A.

**Plan.** Vercel's Hobby plan is for personal, non-commercial use only (Vercel fair use guidelines and Terms, read 2026-11-14). A site that sells NFTs is commercial, so the project needs the Pro plan. Record the date you read the current terms in DECISIONS.md D-5.3.

Original finding, kept for the record: the code was built for Cloudflare Pages: `web/functions/api/rpc.ts` (RPC relay that hides the provider key), `web/functions/api/geo.ts` (country block for view-only mode), `out/_headers` (the CSP, written by `scripts/csp-headers.mjs`) and `wrangler.toml`. A host that ignores these files (Vercel, for example) will serve a site where `/api/rpc` and `/api/geo` do not exist, so **every on-chain read fails**, the country block does nothing and the CSP is not sent. Confirm where the live site runs before any other step. If it is not Cloudflare Pages, the relay, geo check and headers have to be ported first. Also re-read the host's terms for commercial use: a paid mint is commercial (DECISIONS.md section on hosting).

### 2. Chain facts, re-checked today against docs.robinhood.com

| Fact | Result |
|---|---|
| Mainnet chain ID 4663, testnet 46630 | Matches `web/src/lib/config.ts`. |
| Public RPC | Rate-limited and not recommended for production. Use a provider (Alchemy is the one the docs recommend) behind the relay: `UPSTREAM_RPC_URL`. |
| Mainnet verifier | Blockscout. Foundry: `--verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/`. Closes the "confirm at deploy time" item. |
| Max contract code size | 96 KB (our largest runtime: 19,361 bytes). |
| EVM version | The docs name none. Keep `shanghai` (nothing here needs Cancun). |
| Sequencer ordering | **First come, first served by arrival time. A higher fee does not move a transaction ahead.** See finding 3. |
| `block.number` | Returns an estimate of the L1 block number, updated only periodically. The contracts never read it (AUDIT-PACKET section 3), so no change is needed. Keep it that way. |
| Sanctions | The sequencer excludes transactions tied to sanctioned addresses. Say so on the Risk page and let the lawyer word it. |

### 3. Scene wording was wrong for this chain (fixed 2026-11-14)

The junction scene uses "PRIORITY FEE!", "FRONT-RUN!" and "Bots in the mempool?". On this chain fees do not buy position and there is no public mempool ordering, so a reader who knows Arbitrum will notice. Suggested wording that stays true: PRIORITY FEE! becomes GAS UP!, FRONT-RUN! becomes CUT OFF!, and "mempool" becomes "queue" in the hint and the radio lines. **Done:** the scene and the radio now say GAS UP!, CUT OFF!, "queue" and "QUEUE CAM" (`junction.ts`, `dispatch.ts`, `LiveJunction.tsx`); the radio lines that said fee, pool or front-run follow. REORG!, SLIPPAGE! and the gas price in the telemetry line were left, because they are still fair pictures of what the scene shows.

### 4. Mint pressure is about speed, not fees

Because ordering is by arrival, bots win by being faster, not by paying more. The existing guards still apply (exact payment, `expectedSerial`, per-wallet caps) but wallet caps do not stop many addresses (AUDIT-PACKET section 6). Decide before launch whether that is acceptable and say so on the Risk page. The hunt commit-reveal delay is still worth keeping.

## Order of work

1. Confirm hosting (finding 1).
2. Done: `forge build && forge test -vv`, the harness, and slither (AUDIT-PACKET section 7). Repeat all three after any contract change.
3. Decide and write down the permanent values (gate 6). Generate hunt commitments offline (gate 7).
4. Testnet rehearsal, LAUNCH-CHECKLIST section B, including the marketplace check.
5. Hand the audit packet to an external auditor. Apply fixes. Re-run steps 2 and 4.
6. Legal review of the final text.
7. Mainnet, LAUNCH-CHECKLIST section C, with a hardware wallet, simulate first.
