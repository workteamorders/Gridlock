# Mainnet readiness snapshot

Date of this snapshot: 2026-11-12. It adds to `docs/LAUNCH-CHECKLIST.md` (the step-by-step list) and does not replace it.
Nothing in this file was run on a chain. No key, no deploy, no transaction.

## Verdict

**Not ready for mainnet.** Four gates are closed and only the owner can open them: the external audit, the Foundry run, the legal review and the testnet rehearsal. Everything the contracts and the site can do by themselves is finished and tested in the build environment.

## Gate status

| # | Gate | Status | Who |
|---|---|---|---|
| 1 | `forge build && forge test -vv` | **Not run.** Foundry could not be run in the build environment. The same tests were compiled with solc-js and the behaviour tests ran in an in-process EVM (49 of 49 pass, see AUDIT-PACKET section 7). | Owner |
| 2 | Static analysis (slither, aderyn) | **Not run.** | Owner or auditor |
| 3 | External audit | **None.** The audit packet (`docs/AUDIT-PACKET.md`) is ready to hand over. The site shows "No external audit yet" until `NEXT_PUBLIC_AUDIT_REPORT_URL` is set. | Owner |
| 4 | Legal review (Risk page, Terms, region limits, hunt mechanism) | **Pending.** The Risk page still says so. | Owner |
| 5 | Testnet rehearsal (46630, short clocks) | **Not done.** `deployments/46630.json` is still the `deployed: false` placeholder. | Owner |
| 6 | Permanent values decided: treasury, START_TIME, OPEN_TIMEOUT, caps, 15 prices, 12 hunt commitments | **Not decided.** `deploy/mainnet.example.json` fails on purpose until filled. | Owner |
| 7 | Hunt secrets generated offline and backed up twice | **Not done.** No real secret exists. | Owner |
| 8 | Hosting matches the code (see finding 1) | **To confirm.** | Owner |
| 9 | Production RPC provider and key | **Not set.** | Owner |
| 10 | Marketplace check: image, royalty (ERC-2981), heat refresh | **Not done.** Needs testnet. | Owner |

## Findings from this review

### 1. Hosting must be Cloudflare Pages, or the relay and headers must be ported

The code was built for Cloudflare Pages: `web/functions/api/rpc.ts` (RPC relay that hides the provider key), `web/functions/api/geo.ts` (country block for view-only mode), `out/_headers` (the CSP, written by `scripts/csp-headers.mjs`) and `wrangler.toml`. A host that ignores these files (Vercel, for example) will serve a site where `/api/rpc` and `/api/geo` do not exist, so **every on-chain read fails**, the country block does nothing and the CSP is not sent. Confirm where the live site runs before any other step. If it is not Cloudflare Pages, the relay, geo check and headers have to be ported first. Also re-read the host's terms for commercial use: a paid mint is commercial (DECISIONS.md section on hosting).

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

### 3. Some scene wording is wrong for this chain

The junction scene uses "PRIORITY FEE!", "FRONT-RUN!" and "Bots in the mempool?". On this chain fees do not buy position and there is no public mempool ordering, so a reader who knows Arbitrum will notice. Suggested wording that stays true: PRIORITY FEE! becomes GAS UP!, FRONT-RUN! becomes CUT OFF!, and "mempool" becomes "queue" in the hint and the radio lines. Not changed yet; it is a text-only edit.

### 4. Mint pressure is about speed, not fees

Because ordering is by arrival, bots win by being faster, not by paying more. The existing guards still apply (exact payment, `expectedSerial`, per-wallet caps) but wallet caps do not stop many addresses (AUDIT-PACKET section 6). Decide before launch whether that is acceptable and say so on the Risk page. The hunt commit-reveal delay is still worth keeping.

## Order of work

1. Confirm hosting (finding 1).
2. `cd contracts && forge build && forge test -vv`, then the harness, then slither. Paste results into AUDIT-PACKET section 7.
3. Decide and write down the permanent values (gate 6). Generate hunt commitments offline (gate 7).
4. Testnet rehearsal, LAUNCH-CHECKLIST section B, including the marketplace check.
5. Hand the audit packet to an external auditor. Apply fixes. Re-run steps 2 and 4.
6. Legal review of the final text.
7. Mainnet, LAUNCH-CHECKLIST section C, with a hardware wallet, simulate first.
