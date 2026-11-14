# Gridlock audit packet

Status: **draft for an external auditor. These contracts must not be used on mainnet before an external audit and an explicit owner decision.**
No external audit has been done. Slither 0.11.4 was run once by the owner (section 7); aderyn has not been run.

## 1. Scope

| File | Role | Runtime size |
|---|---|---|
| `contracts/src/GridlockCars.sol` | ERC-721 + ERC-2981 + ERC-4906. Ladder, heat, hunt, withdraw, read functions. | 12,132 bytes |
| `contracts/src/GridlockRenderer.sol` | Stateless SVG and metadata renderer. | 19,361 bytes |
| `contracts/src/HeatLib.sol` | Heat constants and star thresholds (internal library, inlined). | n/a |
| `contracts/src/IGridlockRenderer.sol` | Renderer interface. | n/a |

Out of scope: Solady (vendored, pinned below), forge-std, the web app, the RPC relay function (Vercel Edge or Cloudflare).
Both contracts are immutable: no proxy, no owner, no admin function, no pause, no burn, no setter, no SELFDESTRUCT or DELEGATECALL (checked by opcode scan in the harness). `GridlockCars` has no `receive` or `fallback`.

## 2. Versions and build settings

| Item | Value |
|---|---|
| Solady | commit `258f67cc71e39cff307b726939ade17e9d8bcf5c` (vendored files: ERC721, ERC2981, ReentrancyGuard, SafeTransferLib, Base64, LibString, LibBytes under `contracts/lib/solady`) |
| forge-std | commit `dc647cc030d9d65910d8f1172a0cde48d7106e32` (tests only, vendored under `contracts/lib/forge-std`) |
| solc | 0.8.38 (pinned in `foundry.toml`; the harness used the npm `solc` 0.8.38 build) |
| EVM version | shanghai (no Cancun opcodes; see DECISIONS.md D-0 and D-3) |
| Optimizer | on, 200 runs, `via_ir` off, `bytecode_hash = none` |
| Hooks used | `_afterTokenTransfer(address from, address to, uint256 id)` read from the vendored Solady source; it runs on mint, transfer and burn with `from == 0` on mint |

## 3. Behavior summary

* Ladder: 15 ranks. `openedAt(15) = START_TIME`. `openedAt(k) = min(soldOutAt[k+1] if set, openedAt(k+1) + OPEN_TIMEOUT)`. Computed by a loop of at most 15 steps in `mint` and `ladderState`. No keeper, no trigger. An open rank stays open until sold out.
* Mint: `mint(rank, quantity, expectedSerial)` payable. Exact payment, no refunds. `quantity` 1 to 2. Wallet cap per rank: 2 for ranks 15 to 6, 1 for ranks 5 to 1. Reverts `SerialMismatch(nextSerial)` if the previewed serial changed.
  This adds a third argument to the `mint(rank, quantity)` shape in the brief, so that the card the buyer previewed is the card minted (DECISIONS.md D-10.2).
* Identity: card = f(rank, serial). Features hash `keccak256(abi.encode("gridlock/0", uint256(rank), uint256(serial)))` (the string literal encodes as a dynamic `string`). No randomness.
* Heat: +20 on transfer, `transferFrom` and `safeTransferFrom` only (not mint, not approve). Decay 1 point per `HEAT_DECAY_SECONDS` of block time, integer division from the last update. Cap 150. Stars at 1, 20, 45, 80, 120. Display only: no function branches on heat.
* Hunt: 12 commitments `keccak256(abi.encodePacked(secret))` fixed in the constructor. `commitClaim(c)` with `c = keccak256(abi.encode(secret, claimer, salt))`, then `revealClaim(index, secret, salt)` after `REVEAL_MIN_DELAY`. Secrets are `bytes32`.
* Withdraw: `withdraw()` is callable by anyone and sends the whole balance to the immutable `TREASURY`. It reverts if the send fails (a treasury that cannot receive ETH would leave funds locked).
* Time: `block.timestamp` only. `block.number` is never read.
* Royalty: ERC-2981 default royalty of 500 bps to `TREASURY`. A preference that marketplaces may ignore.

## 4. Invariants (all covered by tests)

1. `sold[rank] <= cap[rank]` and the total of ladder cars is at most 2,475. With the 12 hunt cars the maximum is 2,487.
2. `totalMinted == sum(sold) + claimed hunt cars`.
3. `address(this).balance + withdrawn == sum of payments` (ETH can only leave through `withdraw` to `TREASURY`; forced ETH from SELFDESTRUCT elsewhere would only make the balance larger).
4. `0 <= heat <= 150`, `heat <= peakHeat`, heat changes only inside the transfer hook.
5. `soldOutAt[rank] != 0` if and only if `sold[rank] == cap[rank]`.
6. Per wallet per rank minted count never exceeds the wallet cap. Hunt cars do not count.
7. A hunt index is claimed at most once, and only with a commitment at least `REVEAL_MIN_DELAY` old that matches the caller.
8. No external function other than those below changes state.

## 5. External functions

State-changing functions are exactly: `approve`, `setApprovalForAll`, `transferFrom`, `safeTransferFrom` (two overloads), `mint`, `commitClaim`, `revealClaim`, `withdraw`. The table below is generated from the compiled ABI by `contracts/harness/print-abi.mjs`, and `harness/tests/abi.test.mjs` fails if the state-changing set changes.

### GridlockCars

| Function | Mutability | Allowed caller |
|---|---|---|
| `approve(address,uint256)` | payable | token owner or approved operator |
| `balanceOf(address)` | view | anyone (read only) |
| `capOf(uint256)` | view | anyone (read only) |
| `carData(uint256)` | view | anyone (read only) |
| `claimCommit(address)` | view | anyone (read only) |
| `commitClaim(bytes32)` | nonpayable | anyone, stores a commitment for itself |
| `getApproved(uint256)` | view | anyone (read only) |
| `HEAT_DECAY_SECONDS()` | view | anyone (read only) |
| `HEAT_MAX()` | view | anyone (read only) |
| `HEAT_PER_TRANSFER()` | view | anyone (read only) |
| `HUNT_COUNT()` | view | anyone (read only) |
| `huntCommitments()` | view | anyone (read only) |
| `huntStatus()` | view | anyone (read only) |
| `isApprovedForAll(address,address)` | view | anyone (read only) |
| `ladderState()` | view | anyone (read only) |
| `mint(uint256,uint256,uint256)` | payable | anyone (payable, exact price, ladder rules) |
| `name()` | pure | anyone (read only) |
| `OPEN_TIMEOUT()` | view | anyone (read only) |
| `ownedIds(address,uint256,uint256)` | view | anyone (read only) |
| `ownerOf(uint256)` | view | anyone (read only) |
| `previewNext(uint256)` | view | anyone (read only) |
| `priceOf(uint256)` | view | anyone (read only) |
| `RANK_COUNT()` | view | anyone (read only) |
| `RENDERER()` | view | anyone (read only) |
| `REVEAL_MIN_DELAY()` | view | anyone (read only) |
| `revealClaim(uint256,bytes32,bytes32)` | nonpayable | a wallet holding an aged matching commitment |
| `ROYALTY_BPS()` | view | anyone (read only) |
| `royaltyInfo(uint256,uint256)` | view | anyone (read only) |
| `safeTransferFrom(address,address,uint256,bytes)` | payable | token owner or approved |
| `safeTransferFrom(address,address,uint256)` | payable | token owner or approved |
| `setApprovalForAll(address,bool)` | nonpayable | any holder, own approvals only |
| `soldOf(uint256)` | view | anyone (read only) |
| `START_TIME()` | view | anyone (read only) |
| `supportsInterface(bytes4)` | view | anyone (read only) |
| `symbol()` | pure | anyone (read only) |
| `tokenURI(uint256)` | view | anyone (read only) |
| `totalMinted()` | view | anyone (read only) |
| `totalSupply()` | view | anyone (read only) |
| `transferFrom(address,address,uint256)` | payable | token owner or approved |
| `TREASURY()` | view | anyone (read only) |
| `TX_CAP()` | view | anyone (read only) |
| `walletMinted(address,uint256)` | view | anyone (read only) |
| `walletRankCap(uint256)` | pure | anyone (read only) |
| `withdraw()` | nonpayable | anyone, sends the balance to the immutable TREASURY only |

### GridlockRenderer

| Function | Mutability | Allowed caller |
|---|---|---|
| `svg((uint8,uint16,uint16,uint32,uint16,uint48))` | pure | anyone (read only) |
| `tokenURI(uint256,(uint8,uint16,uint16,uint32,uint16,uint48))` | pure | anyone (read only) |

## 6. Known risks

| Risk | Detail |
|---|---|
| Timestamp | Time rules use `block.timestamp`, the sequencer clock on Arbitrum Orbit chains (DECISIONS.md D-2.1). A sequencer can shift it slightly. Do not rely on second-level precision. |
| Marketplace cache | Heat changes with time without an event. Marketplaces can show an old image. `MetadataUpdate` is emitted on every transfer. The site shows the current state. |
| Bots and visible cards | There is no randomness. Anyone can see which card comes next and can mint when it looks good. Wallet caps are per address and can be avoided with many addresses. |
| Hunt secret leaks | A secret becomes public once its car is claimed (it is in the reveal calldata). A leaked secret before the claim lets anyone with the secret claim that car. Only a minimum age of a commitment protects against copying a pending reveal, which matters on chains with a public mempool. The delay is chosen at deploy. |
| Heat can be pumped cheaply | Transfers to self or between own wallets raise heat. Heat is therefore never used for ranking, rights or rewards. |
| Treasury | `TREASURY` is immutable. If its key is lost, or it cannot receive ETH, funds are stuck or `withdraw` reverts. |
| Safe mint callbacks | `mint` and `revealClaim` use `_safeMint` with a reentrancy guard and update state before the callback. A recipient contract can revert and fail its own mint. |
| `expectedSerial` | Under high demand many mints revert with `SerialMismatch` and cost gas. The site shows the new serial and asks again. |
| Renderer limits | Image bytes and gas depend on the renderer. Marketplace SVG handling has not been verified on the target chain (DECISIONS.md D-4.1). |
| Third-party code | Solady files are vendored unmodified at the commit above. The compiler emits warnings inside Solady (deprecated virtual modifier, natspec memory-safe-assembly). They are not from this repository. |

## 7. Test results (honest status)

**Owner's second Foundry run, 2026-11-14, after the test fix: `forge test` 32 passed, 0 failed (5 suites, 9.16 s CPU); harness `node --test` 49 of 49 passed (6 suites, 170.8 s).** `test_uniqueImages_allCombinations` now passes: it renders all 2,487 images and asserts 0 duplicates (gas shows about 3,000 because metering is paused for that scan; the gas of a real render is measured in `test_tokenURI_gasBelow3M`, 22,278,743 for the 16 worst cases). Static analysis: see the next paragraph.

**Slither 0.11.4, owner's run, 2026-11-14** (`slither . --filter-paths "lib|test|script"`, macOS, Foundry build, 11 contracts, 100 detectors): **29 results, none high, none about reentrancy, ETH transfers, access control or unchecked calls.** Every result was read against the source and is classified below. No contract change was needed. Slither finds patterns, not logic errors, and says nothing about the economic design or the hunt; it does not replace the external audit.

| Detector (count) | Where | Verdict |
|---|---|---|
| encode-packed-collision (3) | `GridlockRenderer` `_attributes`, `_livery`, `_hiddenCar` | False positive. The collision risk applies when packed data is hashed or signed. Here `abi.encodePacked` only concatenates SVG and JSON text, which is never hashed. The two hashes in `GridlockCars` use `abi.encode` (commit) and `abi.encodePacked` of a single fixed-size value (hunt secret), so neither has two dynamic arguments. |
| divide-before-multiply (2) | `_livery` `bw = (w - 8) / 9`; `_hiddenCar` `(index / 4) * 4` | Intended. Integer bar width and rounding an index down to a multiple of 4. Affects drawing only. |
| incorrect-equality (2) | `carData` `heat == 0`; `claimCommit` `commitment == bytes32(0)` | Intended. Both compare against an unset sentinel value that nobody can nudge to or away from zero. |
| uninitialized-local (4) | `packed` in the constructor; `decor`, `out`, `haz` in the renderer | Intended. Zero or empty start value (`packed |= ...`, empty byte string). |
| timestamp (8) | `mint`, `revealClaim`, `claimCommit`, `ladderState`, `carData`, `_nextOpen`, `_currentHeat`, `_afterTokenTransfer` | Accepted. Windows are minutes to days (reveal delay 60 s, heat decay 1 h, opening timeout 7 d). A few seconds of timestamp skew does not change who can mint or claim. The sequencer is first come first served (docs/MAINNET-READINESS.md), so ordering inside a block is not for sale either. |
| assembly (1) | `ownedIds`: `mstore(ids, found)` | Reviewed. Shrinks a memory array to the number found. `found` never exceeds the array length (it is below `balanceOf` and the loop stops at `limit`). View function. |
| costly-loop (1) | `mint`: `_lastId = id` inside the loop | Accepted. The loop runs at most `TX_CAP` = 2 times. The write happens before `_safeMint` on purpose, so the counter is correct when the receiver callback runs. |
| cyclomatic-complexity (1) | constructor (13) | Informational. One validation block. |
| naming-convention (7) | `TREASURY`, `RENDERER`, `START_TIME`, `OPEN_TIMEOUT`, `HEAT_DECAY_SECONDS`, `REVEAL_MIN_DELAY`, `_CAPS_PACKED` | False positive. Upper case is the usual style for immutables and constants. |

Still open: aderyn has not been run. The raw Slither output file is not stored in the repository.

**Owner's first Foundry run, 2026-11-14 (macOS, forge with solc 0.8.38, evm shanghai):** `forge build` compiled (Solady warnings only). `forge test`: 31 passed, 1 failed (32 total). The fuzz and invariant suites passed (invariants: 64 runs, 4,096 calls, 0 reverts). The single failure was `RendererTest.test_uniqueImages_allCombinations`, which stopped with `EvmError: MemoryOOG` at about 1,000,000,000 gas, the `gas_limit` in `foundry.toml`. Cause: the test rendered all 2,487 images (about 6 KB each) in one call frame, so memory grew without bound and the gas ran out. It is a test problem, not a contract defect: the renderer is `pure` and every real call starts with fresh memory. Fix (in the repository, **not yet re-run with Foundry**): the image hash is computed in an external helper call so memory is freed after each image, and gas metering is paused for that one scan. The same property (2,487 unique images) passed in the harness. Harness: 46 of 49 passed; the 3 failures were the `gen-hunt` tests, which need `pnpm install` in `contracts/` (`viem`); fixed in the instructions.

Original status, kept for the record: **`forge build` and `forge test` had NOT been run when this packet was written.** Foundry was not available in the build environment and could not be installed there (access to the Foundry repository was not granted). What was done instead:

| Check | Result |
|---|---|
| Compile with solc-js 0.8.38, evm shanghai, optimizer 200, same settings as `foundry.toml` | passes. Sources and the forge tests (`contracts/test/*.t.sol`) both compile. |
| Behavior tests on an in-process EVM (`contracts/harness`, node test runner, ethereumjs) | 49 of 49 pass. Covers the opening rule with all boundary cases, mint limits, exact payment, ETH accounting, heat, stars at every threshold, hunt including copy attempts, ERC-165, ERC-2981, ERC-4906, ABI surface, renderer safety, gas, and the full ladder to 2,475 + 12. |
| Randomized sequence tests (6 seeds, 220 steps each) | Every mint outcome is predicted by an independent JavaScript model of the opening rule and caps, and invariants 1 to 6 are checked after each step. |
| Mutation checks | Four deliberate bugs (wrong wallet cap threshold, ignoring the timeout, heat on mint, no reveal delay) each made tests fail. |
| Images | 2,487 cards (2,475 ladder plus 12 hidden) rendered at heat 0: **2,487 unique images**, largest SVG 6,669 bytes. |
| tokenURI gas | worst case measured **1,469,378** (renderer call), 1,201,936 through `GridlockCars.tokenURI` for a rank 15 card. Limit used: 3,000,000. |
| Other gas (harness measurement) | mint one car about 163,700 (first mint, cold slots), transfer about 39,200, commit about 46,200, reveal about 132,000, `ladderState` view about 47,700. |
| Static analysis | slither: run by the owner on 2026-11-14 (see the slither paragraph in this section). aderyn: not run. |
| Fuzz and invariant (forge) | written in `contracts/test/*.t.sol`, not executed. The harness random tests cover the same properties. |

Before trusting any of this, the owner should run, once: `cd contracts && forge build && forge test -vv`, then record the output next to this table.

## 8. How to reproduce the harness results

```
cd contracts && pnpm install && cd harness && pnpm install && node compile.mjs && node --test tests/*.test.mjs
```
Golden images are in `contracts/harness/golden/` (SVG files plus `golden.json` with SHA-256). Set `UPDATE_GOLDEN=1` only when a renderer change is intended.
