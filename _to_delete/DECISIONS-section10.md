
## 10. Contracts phase (decisions made after the second approval)

Date of this section: 2026-11-11.

### D-10.1 Foundry was not available, so forge was not run
- Foundry (forge, anvil) was not installed in the build environment. My request to attach the `foundry-rs/foundry` repository was denied by the session's permission system, and I did not look for another way to fetch the binaries. I did not install anything on the owner's machine.
- What I did instead: compiled with the npm `solc` 0.8.38 (solc-js) using the same settings as `foundry.toml`, and ran behavior tests on an in-process EVM (ethereumjs) in `contracts/harness`. The forge tests in `contracts/test` were written and compile (type-checked by solc-js) but were **not executed**.
- Consequence: the brief's gate "forge build and forge test pass" is **not met**. Contracts are described as "compiled with solc-js and tested on a local EVM harness", not as "forge tested". The owner must run `forge build && forge test -vv` once and record the result in `docs/AUDIT-PACKET.md` section 7.
- Anvil was not available either, so `script/Deploy.s.sol` was not run. The same JSON config (`deploy/anvil.json`) was deployed in the harness EVM, which checks that the constructor accepts it.

### D-10.2 `mint` takes the previewed serial
The brief names `mint(rank, quantity)`. I implemented `mint(rank, quantity, expectedSerial)` and it reverts with `SerialMismatch(nextSerial)` if the next serial moved. Reason: the brief requires that the previewed card is the card minted, and a check on the site alone cannot guarantee it between simulation and inclusion. Cost: under heavy demand some mints revert and the buyer pays gas. The site shows the new card and asks again.

### D-10.3 Library pins
Solady commit `258f67cc71e39cff307b726939ade17e9d8bcf5c` (2026-10-20) and forge-std commit `dc647cc030d9d65910d8f1172a0cde48d7106e32` (2026-11-02), vendored as plain files with their licenses and a `COMMIT` file under `contracts/lib`. Vendored to avoid git submodules on a machine where I cannot run `forge install`. Hook names and signatures were read from the vendored source: `_beforeTokenTransfer(address,address,uint256)` and `_afterTokenTransfer(address,address,uint256)`; mint calls them with `from == address(0)`. `_ownerOf`, `_exists`, `_safeMint` exist as used. ERC-4906 events are emitted manually and `0x49064906` is added to `supportsInterface`.

### D-10.4 Parameters
Time values (start, open timeout, heat decay, reveal delay), the 15 caps, the 15 prices and the 12 commitments are constructor arguments. Defaults for caps are the brief's. Validation: prices non-zero and non-decreasing from rank 15 to rank 1 (equal neighbours allowed), caps non-zero, timeout and decay between 1 second and 3,650 days, reveal delay between 1 second and 30 days, commitments non-zero and distinct, treasury non-zero, renderer must have code. Wallet caps, TX cap, heat step, heat max, star thresholds and royalty are constants. Caps are arguments so a testnet run can sell out a small ladder; `pnpm verify:deployment` compares them with the published spec on mainnet.

### D-10.5 Hunt details
Secrets are `bytes32`. Commitment is `keccak256(abi.encodePacked(secret))`. Claim commitment is `keccak256(abi.encode(secret, claimer, salt))`. Reveal delay must be at least 1 second. Orbit chains order transactions through a sequencer and have no public mempool, so copying a pending reveal is a smaller risk there, but the delay is kept as the brief requires. A failed reveal keeps the commitment; a successful reveal deletes it; a new commit replaces the old one and restarts its clock.

### D-10.6 Withdraw
`withdraw()` sends the whole balance with `safeTransferETH` and reverts if the treasury cannot receive. Chosen over a forced send so there is no hidden path; the risk (a treasury that rejects ETH) is in the audit packet.

### D-10.7 Renderer
Standalone SVG with attributes only. No `pattern`, `clipPath`, `filter`, `style`, `text`, `use`, script or animation. Halftone is rows of plain circles (D-4.1 flat fallback). Lettering is stroked paths from a small fixed glyph table. Livery stripes stay in the rectangular lower body so no clip path is needed. `mintedAt` is metadata only, so the previewed SVG equals the minted SVG at heat 0. A serial tag (`#serial`) is drawn so two cards of the same rank never share an image. Hidden cars use a different silhouette, dashed outline, redaction bars and hazard livery. Hidden cars also show heat stars and the rap sheet because heat applies to every car.
Measured: 2,487 of 2,487 images unique, tokenURI gas worst case 1,469,378, largest SVG 6,669 bytes.
SVG rendering inside real marketplaces is still unverified (D-4.1).

### D-10.8 Heat arithmetic
Decay uses integer division from the last update time, so a transfer resets the partial hour. Heat zero time is `updatedAt + storedHeat * decay`; the site uses the same formula (tested).

### D-10.9 Deploy and hunt scripts
`contracts/script/Deploy.s.sol` reads `DEPLOY_CONFIG`, never reads a private key, and signs only through `--account` or `--ledger`. On chain 4663 it requires `CONFIRM_MAINNET=I-HAVE-AN-EXTERNAL-AUDIT-AND-I-DECIDE`. `startTime 0` is allowed only on chain 31337. `contracts/scripts/gen-hunt.mjs` lives in `contracts` (not a root `scripts` folder) because it needs viem; it refuses to write inside a git repository, has a `--test` mode with labeled worthless secrets, and tests use only that mode. No real hunt secret was created.

### D-10.10 Compiler target
`solc 0.8.38`, `evm_version = shanghai`, optimizer 200 runs. Reason: Cancun opcode support on the target chain is not verified.
