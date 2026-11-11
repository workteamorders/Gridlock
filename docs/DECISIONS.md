# Gridlock: DECISIONS.md

Gerbang X pass 1. Date of verification: 2026-11-11 (all "live" facts below were fetched on this date from public docs; no transaction was sent to any network, no key was touched).

Status legend: VERIFIED = read from an official or primary doc this session. REPORTED = stated by third-party pages only. UNVERIFIED = could not be confirmed; decision taken per the decision rule.

---

## 0. Environment and toolchain (task 1)

| Item | Result |
|---|---|
| Working folder | `/Users/aldy/Project/WP/Gridlock` (the prompt says lowercase `gridlock`; the connected folder is `Gridlock`; the connected one is used). It was empty at start. |
| Shell | `device_bash` runs in a Linux VM (arm64) with the folder mounted, not directly on the Mac. |
| node | v22.23.4 present |
| npm | 10.9.9 present |
| git | 2.34.1 present |
| python3 | 3.10.12 present |
| **forge / anvil / cast** | **MISSING in the shell.** `~/.foundry` exists on the Mac host but is not reachable from the shell. Per the work rules nothing was installed. |
| **pnpm** | **MISSING.** Not installed (rule: no automatic installs). |
| slither / aderyn | MISSING (static analysis will be recorded as "not run" unless installed) |
| Sibling folders (`../Afterbell`, `../dockhood-app`, `../verdigris*`) | **Not connected to this session.** Only `Gridlock` is mounted. Pattern reading needs folder access granted later (a one-time request, after the second approval). |

**Decision D-0.1:** Contracts cannot be compiled or tested in this session until `forge` is available. Per the work rules, if it stays missing: write specs and test plans in `docs/`, build the site with a labeled mock ABI, and report the contracts as NOT compiled and NOT tested. The contracts will never be called "tested" before `forge build` and `forge test` pass.

---

## 1. Gerbang X (a): chain choice

Candidate order: (1) Robinhood Chain, (2) another EVM L2 that passes.

### Robinhood Chain: facts

| Fact | Value | Status |
|---|---|---|
| Mainnet chain ID | 4663 (0x1237) | VERIFIED (docs.robinhood.com/chain/connecting) |
| Testnet chain ID | 46630 (0xb626) | VERIFIED (same page; chainid.network) |
| Gas currency | ETH | VERIFIED |
| Stack | Arbitrum Orbit / Nitro L2 settling to Ethereum (testnet settles to Sepolia) | VERIFIED via Robinhood docs wording plus third-party docs (REPORTED for Sepolia) |
| Mainnet launch | 2026-07-01 | REPORTED (several third-party pages) |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com`, `https://rpc.testnet.chain.robinhood.com` | VERIFIED. Rate-limited, **not for production**, no numbers published. |
| Provider RPC (recommended in docs) | Alchemy `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}` and testnet equivalent. Also listed: Chainstack, QuickNode, Blockdaemon, dRPC, Validation Cloud, GlobalStake, Pinax | VERIFIED |
| Archive reads / log history | Need an archive endpoint (Alchemy etc.) | VERIFIED |
| Mainnet explorer | `https://robinhoodchain.blockscout.com` (Blockscout) | VERIFIED. A third-party page claims `explorer.mainnet.chain.robinhood.com` redirects there (REPORTED). Use the first. |
| Testnet explorer | `https://explorer.testnet.chain.robinhood.com` | VERIFIED |
| Testnet faucet | `https://faucet.testnet.chain.robinhood.com`. Third parties report 1 ETH per 24h | VERIFIED (URL), REPORTED (amount) |
| Bridge | Arbitrum token bridge contracts listed on docs.robinhood.com/chain/protocol-contracts | VERIFIED (addresses in docs; not copied here, read from docs when needed) |
| Max contract code size | 96 KB (Ethereum: 24 KB); max init code 192 KB | VERIFIED (differences-from-ethereum) |
| `PUSH0` | Supported since ArbOS 11 | VERIFIED (Arbitrum docs) |
| Cancun opcodes (`TSTORE`, `MCOPY`) | Not confirmed | UNVERIFIED |
| `eth_call` gas cap on public RPC | Not stated anywhere official | UNVERIFIED |
| Multicall3 canonical address `0xcA11bde0...CA11` | Not listed by the docs. The docs list a chain-specific L2 Multicall: mainnet `0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1`, testnet `0xa432504b6F04Cafe775b09D8AA92e8dbe41Ec7a8` | VERIFIED (docs list), canonical Multicall3: UNVERIFIED |
| Foundry verify flag | `forge verify-contract <addr> <path:Name> --chain-id 46630 --rpc-url <rpc> --verifier blockscout --verifier-url <explorer>/api/` (Robinhood's own deploy tutorial uses `--verifier blockscout`; Blockscout docs say to append `/api/` to the explorer URL) | VERIFIED (flag), exact mainnet verifier-url: confirm at deploy time |

### Robinhood Chain: marketplace

| Fact | Status |
|---|---|
| OpenSea lists Robinhood Chain among supported chains | REPORTED by opensea.io/learn "blockchains compatible with OpenSea" list (page found via search; list includes "Robinhood Chain") |
| Third-party collections (Stackbots, ROBIPIXELS, others) are live on OpenSea Robinhood Chain, with creator fee shown | VERIFIED by seeing OpenSea collection pages. Shows listing is permissionless in practice. |
| Element reports integration | REPORTED (news snippet) |
| OpenSea accepts on-chain `tokenURI` as `data:application/json;base64,...` | VERIFIED (docs.opensea.io/docs/metadata-storage and metadata-standards) |
| OpenSea images: SVG is accepted and **cached as PNG** | VERIFIED (docs.opensea.io/docs/media-and-traits) |
| OpenSea ERC-4906: `MetadataUpdate(uint256)` and `BatchMetadataUpdate(uint256,uint256)` listed for ERC-721 | VERIFIED (docs.opensea.io/docs/updating-metadata) |
| OpenSea refresh-metadata API exists (`refresh_nft`) | VERIFIED (reference link). Rate limits and API key terms: not read. |
| ERC-2981 respected on Robinhood Chain collections | UNVERIFIED for this chain. OpenSea creator fees are generally optional per seller (history: OpenSea made creator fees optional in 2023). **Do not promise royalty income** (already in spec). |
| Robinhood Chain **testnet** shown on OpenSea | UNVERIFIED. Likely not. Testnet marketplace display must be checked manually by the owner. |

**Decision D-1.1:** Robinhood Chain passes (a) on documented grounds: a marketplace lists the chain, supports base64 data-URI metadata, SVG, and ERC-4906. Chain 1 of the candidate order is selected; no fallback is needed yet. The remaining UNVERIFIED items (ERC-2981 behavior, testnet marketplace display, SVG `<pattern>` rendering, eth_call cap) are carried as explicit manual checks in LAUNCH-CHECKLIST.md and do not block building to testnet readiness.

**Open risk R-1:** The chain is about four months old at verification time; its docs state public RPCs are rate-limited and the testnet settlement layer has no published migration plan (REPORTED by one third-party guide). Re-check docs.robinhood.com/chain "Notices & Upgrades" before any testnet or mainnet run.

---

## 2. Gerbang X (c): `block.timestamp` semantics

- Arbitrum-family chains (Robinhood Chain is one): block timestamps come from the **sequencer clock**, updated every L2 block, with bounds to stay near parent-chain time. Force-included transactions use a bounded fallback. (docs.arbitrum.io/time, VERIFIED.) The Robinhood docs page itself does **not** describe `block.timestamp`.
- **`block.number` is NOT the L2 block number.** On Robinhood Chain it is an estimate of the L1 (Ethereum) block number and updates only periodically (VERIFIED, docs.robinhood.com/chain/differences-from-ethereum).
- `block.prevrandao` and `block.difficulty` return a constant; not randomness (VERIFIED). Gridlock uses none.

**Decision D-2.1:** All contract timing (START_TIME, OPEN_TIMEOUT, heat decay, hunt delay) uses `block.timestamp` only. `block.number` is forbidden in contracts and in site logic that measures time. A grep check will enforce this. Copy must still not claim second-level precision (sequencer can shift time within bounds).

---

## 3. Gerbang X (d): ERC-721 library

- Solady `ERC721` is in wide use on other EVM chains with `_beforeTokenTransfer(from, to, id)` and `_afterTokenTransfer(from, to, id)` hooks (seen in verified contracts). Solady also has `tokens/ERC2981.sol`.
- OpenZeppelin v5 removed the transfer hooks in favor of a single `_update` override (VERIFIED, OZ forum and docs).
- Neither library implements ERC-4906; the contract emits `MetadataUpdate` itself.
- **Version and commit pin: NOT DONE.** It needs `forge install` or a read of installed sources, and `forge` is missing.

**Decision D-3.1 (provisional):** Use **Solady** (`ERC721` + `ERC2981`), pinned to an exact commit once forge is available. Hook names, mint/transfer safe behavior, and exact signatures must be read from the installed source before writing contract code. If Solady's installed hook signatures differ from the above, the installed source wins and the difference is logged here. Fallback: OpenZeppelin v5 with an `_update` override.

**Decision D-3.2:** `evm_version = "shanghai"` in `foundry.toml` (PUSH0 is documented as supported; Cancun opcodes are not confirmed). Revisit only after a live check.

**Decision D-3.3:** `tokenURI` gas budget stays at 3,000,000 (the conservative default in the spec) because the chain's `eth_call` cap is unknown. If exceeded, simplify the SVG; do not move logic to a server.

---

## 4. Gerbang X (e): SVG in marketplaces

- OpenSea caches SVG images as PNG (VERIFIED). So the marketplace shows a rasterized picture, which should reduce `<pattern>` risk, but whether OpenSea's rasterizer renders `<pattern>` halftone, thick strokes, and path text correctly is **UNVERIFIED**.
- I cannot test a live marketplace without a deployed collection, and nothing may be broadcast.

**Decision D-4.1:** Build the renderer with two visual levels in the same SVG design language: (A) halftone via `<pattern>`; (B) a flat fallback where halftone is drawn as plain dot paths (no `<pattern>`, no `<mask>`, no filters). Default to **B-compatible drawing** for anything that carries meaning (rank number, plate, stars, rap sheet). Halftone stays decorative only. The owner confirms on a testnet collection (if displayed) or on a mainnet-fork-free local rasterizer test; record the result here.

**Planned check (can run without a network):** render the sample SVGs in the built-in browser and through a headless rasterizer (resvg or librsvg if present) to approximate what a PNG-caching marketplace does.

---

## 5. Hosting (Cloudflare)

- Pages static assets: free and unlimited requests. Builds: 500/month on free (REPORTED by several pages).
- Pages Functions count against **Workers Free: 100,000 requests/day and 10 ms CPU per invocation**, reset at 00:00 UTC (VERIFIED, Cloudflare docs).
- Cloudflare's Developer Platform Service-Specific Terms govern Pages (VERIFIED they exist and apply). Nothing read in the portions retrieved bans commercial use on the free plan, but **I did not read the full Self-Serve Subscription Agreement or the full Service-Specific Terms**. Terms also say content may be blocked or removed for illegal or harmful content, and that project subdomains with deceptive terms or business names are prohibited.
- The Vercel Hobby non-commercial restriction is what the prompt mentions; it is not re-verified here (not needed because Cloudflare is chosen).

**Decision D-5.1:** Cloudflare Pages + one Pages Function `/api/rpc`. Because the Function budget is 100k/day, the site makes **batched reads through aggregate view functions** (`ladderState`, `carData`, `previewNext`, `huntStatus`, `ownedIds`), uses short caching, and lets wallets talk to their own RPC for writes and receipts. If traffic exceeds the budget the Function fails closed to a clear "RPC busy" state; there is no paid fallback without owner approval.

**Decision D-5.2:** The public RPC is rate-limited and not for production, so `/api/rpc` upstreams to a provider endpoint whose key lives only in Cloudflare env vars. Whether Alchemy's **free** tier covers Robinhood Chain: UNVERIFIED. If not, use another listed provider's free tier or the public RPC for read-only low-volume testing only.

**Manual item for the owner:** read the current Cloudflare terms in full before launch and record the date here.

---

## 6. Multicall

No canonical Multicall3 is confirmed. The spec already avoids needing it (aggregate views). The site will **not** depend on Multicall3. If batching is later wanted, use the chain's own documented L2 Multicall address and read-only verify it with `eth_getCode` first.

---

## 7. Unresolved items carried forward (none block Step 0)

1. forge, anvil, pnpm missing; nothing installed (D-0.1).
2. Solady commit pin and hook signatures (D-3.1).
3. Cancun opcode support (D-3.2).
4. `eth_call` gas cap (D-3.3).
5. OpenSea: ERC-2981 behavior on this chain, testnet display, `<pattern>` rendering (D-1.1, D-4.1).
6. Alchemy free-tier coverage for Robinhood Chain (D-5.2).
7. Full Cloudflare terms review (owner).
8. Name and domain availability for "Gridlock" / `GRID`: **not checked**. Owner item.
9. Mainnet Blockscout verifier URL string (D, deploy time).

## 8. Notes on process

- The disclaimers in the footer do not replace legal review (to be repeated in the final report).
- Third-party pages were treated as REPORTED only; chain parameters were taken from Robinhood's own docs.

---

## 9. Step 0 and Step 3 decisions (2026-11-11)

**D-9.1 Visual direction: A, "Poster wall".** The owner replied "gas" to a recommendation of A with a question about installing tools. Read as: approve A, approve installs. If this reading is wrong, the tokens in `web/src/styles/tokens.css` are the only place the look is defined, so a change is contained. B (sign gantry) and C (streetlight noir) were not built.

**D-9.2 Where the site is built.** The shell on the owner's machine is a Linux VM that cannot remove files and cannot run pnpm symlinks safely in the mounted folder, so the web app is built and screenshotted in the session container, and the source (no `node_modules`, `.next`, or `out`) is copied into `web/`. Run `pnpm install` in `web/` on the owner's machine.

**D-9.3 Versions pinned by the install (see `web/pnpm-lock.yaml`):** Next.js 16.4.6, React 19.3.1, TypeScript 7.0.2. Next's installed docs (`node_modules/next/dist/docs`) were read before writing Next code. Findings that change the plan: static export (`output: 'export'`) is supported; **custom `headers()`, rewrites, redirects, proxy, server actions and default image optimization are not supported in export mode.** So security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`) must go in a Cloudflare Pages `public/_headers` file, and images use `unoptimized`. `trailingSlash: true` is set so each page is `/page/index.html`.

**D-9.4 Fonts, self-hosted from npm `@fontsource` packages:** Anton (display), Barlow 400/500/700 (text), Space Mono 400/700 (numbers). All three LICENSE files ship in `web/src/fonts/licenses/` and state SIL OFL 1.1. Loaded with `next/font/local`, `font-display: swap`, size-adjusted fallback.

**D-9.5 Token rules enforced by scripts.** `pnpm lint:tokens` fails on any raw hex, `rgb()` or inline `style={{}}` outside `tokens.css`. `pnpm contrast` computes WCAG ratios straight from `tokens.css`. Result on 2026-11-11: all pairs pass. Brush red on base is 4.32:1, so it is used only for strokes, fills and large display type, never for body text. The error text color is `--bad` (7.04:1) instead of red.

**D-9.6 One elevation language, no shadows.** Flat, raised, floating are separated by outline weight and surface step only (no hard or soft shadows), to stay clear of the banned cream-panel-with-hard-shadow look. Square corners everywhere except radio buttons, the speed-limit sign and spinner.

**D-9.7 Dialogs use the native `<dialog>` element** with `showModal()`: focus enters the dialog, Esc closes it, focus returns to the trigger, and the page behind is inert. Verified in a headless Chrome run (drawer and confirm dialog).

**D-9.8 Card art in the styleguide is a mock, labeled "Example mock".** It uses an SVG `<pattern>` for halftone and live CSS variables. The real renderer must be standalone SVG with literal colors, digit and plate drawn as paths, and (per D-4.1) no `<pattern>` for anything that carries meaning.

**D-9.9 Copy:** "Wanted" is used only as a generic poster header on card art. The banned phrase is "Most Wanted". `copy:check` is not built yet (Step 4b).

**D-9.10 Not done in this step (by design):** Foundry (forge, anvil), any contract, `/api/rpc`, wallet code, Home and other pages (Home is a placeholder), `public/_headers`, `copy:check`, Lighthouse runs, end-to-end tests. Foundry is not installed; it is only needed from Step 4a.

**D-9.11 Housekeeping.** A symlink test directory created in the project root could not be deleted (the shell blocks deletion). It was moved to `_to_delete/_t_symlink_test`, together with the source archive `gridlock-step3.tar.gz`. Both can be deleted by the owner.

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

## 11. Website (step 4)

**D-11.1 viem only, no wagmi.** Wallet discovery is a small EIP-6963 layer (`src/lib/wallet.tsx`). The site needs connect, switch network and sign. Fewer dependencies means a smaller bundle and less supply-chain surface. Reads go through the site's own `/api/rpc`.

**D-11.2 Deployment file fetched at runtime.** `public/deployments/<chainId>.json` is read in the browser, so the same build works before and after deployment. `{ "deployed": false }` is the explicit "not deployed" state (a missing file also means not deployed). An optional `expected` block holds the published parameters; the site compares them with the chain and pauses minting on any difference. `pnpm verify:deployment` can fill and re-check it.

**D-11.3 Mint has three arguments.** `mint(rank, quantity, expectedSerial)` (see D-10.2). The page previews the serial, re-reads it just before signing, and warns without sending anything if it changed.

**D-11.4 Chain clock.** All countdowns use the latest block time plus the time since it was read, not the visitor's clock. Block time is the sequencer's clock.

**D-11.5 Geoblock is an interface limit.** `/api/geo` (Pages Function) reads `CF-IPCountry` and `BLOCKED_COUNTRIES`. The default list is empty. A blocked visitor sees view-only mode. The contract has no permission checks, and the site says so.

**D-11.6 Hunt salt is derived.** `salt = keccak256("gridlock-hunt-salt:{account}:{index}")`, so nothing is stored. At step 2 the visitor types the code again. The secret never leaves the browser before step 2. The page checks the code against the public commitment before step 1 to avoid wasted gas.

**D-11.7 Images come from the contract.** Gallery and Garage load `tokenURI` images lazily and use them only as `<img src>`. Mint previews the second car of a 2-car mint from the renderer's `svg`. Cards drawn from fake data are labelled EXAMPLE.

**D-11.8 CSP.** `scripts/csp-headers.mjs` hashes every inline script after the build and writes `out/_headers`. No `unsafe-inline` for scripts; `connect-src 'self'` because reads use `/api/rpc`.

**D-11.9 Layout stability.** Loading placeholders have the final size (`LoadingLadder`, `.gate-sk`, `.hero-panel`) and are keyed so React replaces them. The "not deployed" notice is inside page bodies, not a top banner, because a banner that appears late pushes the whole page down (CLS 0.98 before the change, 0 after).

**D-11.10 Local test chain.** `contracts/harness/rpc-server.mjs` serves the harness EVM over JSON-RPC (anvil substitute). It accepts `eth_sendTransaction` from any address and a `/__warp` control. It is for local tests only and must never be exposed.

**D-11.11 First-mint notice.** Shown once per browser (localStorage `gridlock.riskAck`), then every mint still shows the permanent-action dialog.

## 12. Visual live

- **Motion.** Full memakai simulasi dan animasi UI. Reduced menampilkan kota statis. Off menyembunyikan kota. Override URL mengunci kontrol pada Off untuk halaman tersebut. Preferensi sistem, saveData dan tab tersembunyi tetap menjeda animasi saat pengguna memilih Full. Timer chain tetap berjalan sebagai informasi, tanpa pengumuman tiap detik.
- **Canvas dan anggaran.** Engine diimpor saat idle sesudah event load dan kandidat LCP awal. Observer menunggu kandidat yang baru dilukis, dengan fallback waktu saat observasi tidak tersedia. Governor menurunkan jumlah mobil setiap jendela lambat 2 detik dan berhenti setelah dua jendela berturut-turut di bawah 30 fps. Opacity canvas dibatasi agar teks dim tetap memenuhi AA di atas piksel paling terang.
- **Preview dan konfirmasi.** Home membaca kartu berikutnya melalui `previewNext`. Perubahan progres dan segel ladder mengikuti snapshot chain. Efek CAUGHT dan CLAIMED menunggu receipt sukses, begitu juga animasi pengiriman. Kartu mint hasil konfirmasi memakai token ID dari log receipt. Jika RPC tidak menyediakan log, cocokkan rank dan serial pembelian dengan kepemilikan di chain. Segel di styleguide diberi label EXAMPLE.
- **Feed.** Strip aktivitas opsional dilewati. Polling ladder yang sudah ada tetap menjadi sumber data live tanpa menambah permintaan log berkala ke relay.
- **Pengujian.** Layout mengambil hasil axe dengan motion aktif, lalu membuat tangkapan layar terpisah dengan `?motion=off` dan jam browser tetap. Server e2e mengirim dokumen 404 hasil export dan respons geo lokal. Scanner mengabaikan URL template dokumentasi yang persis memakai `{API_KEY}`, serta memeriksa nama merek pada direktori aset.

- **Persimpangan Home.** Hero memakai satu canvas di dalam panel dengan ruang khusus untuk antrean, lampu, dan cone. Rute lain memakai peta lalu lintas redup. Full mengaktifkan simulasi, Reduced membekukan gambar, dan Off memakai ilustrasi SVG statis. Tombol Drop cone memberi aksi setara lewat keyboard. Tap ditempatkan pada lajur masuk terdekat supaya mobil dapat bereaksi sebelum persimpangan.

## 13. Panggung (hero, bab, scroll, suara)

- **Seni hero.** Dinding poster dibuat `web/scripts/make-hero.mjs` (seed tetap, warna dibaca dari token, tanpa teks dan bitmap). Halftone memakai `<pattern>` dan lapisan belakang tidak memakai opacity grup, karena opacity grup memaksa buffer terpisah dan menurunkan fps di compositor software dari 60 ke 35. SVG disisipkan inline saat build (`HeroArt`) agar bukan kandidat LCP. Sebagai gambar latar, estimasi LCP Lighthouse mobile naik ke 6,5 sampai 8,7 s.
- **Gerak lapisan hero.** Lapisan hanya bergerak (drift dan parallax pointer) saat mesin WebGL benar-benar berjalan di GPU dan menandai hero `data-live`. Tanpa GPU, di layar sentuh, atau saat governor menghentikan mesin, poster diam. Dengan ini fps 1440 px tetap 58 sampai 60 pada renderer software.
- **WebGL.** Shader halftone mentah (tanpa pustaka) dimuat lazy sesudah idle, hanya pada Motion Full dan perangkat dengan mouse atau trackpad. Renderer software (SwiftShader, llvmpipe) ditolak karena kompilasi shader memblokir thread utama (TBT 4,3 s pada emulasi mobile). Berhenti saat hero di luar layar, tab tersembunyi, atau governor menilai lambat. Tanpa WebGL halaman tetap utuh.
- **Pita rantai.** Fakta tetap selalu tampil. Angka berubah (jumlah terjual, rank terbuka, harga, sisa, jam buka) hanya muncul saat dibaca dari chain, dan pengujian memeriksa bahwa angka itu sama dengan "Minted so far". Saat belum ada deployment tidak ada klaim hidup. Salinan kedua untuk marquee bersifat `aria-hidden`.
- **Scroll "climb".** 15 anak tangga dari rank 15 ke rank 1 dengan kap dari `SPEC.defaultCaps` (jumlahnya 2.475, diuji). Bagian dipin 300vh hanya pada Motion Full. Selain itu berupa daftar biasa. Daftar tetap ada untuk pembaca layar.
- **Intro (gerbang lalu urutan).** Sekali per sesi (`sessionStorage`), hanya di Home dan hanya pada Motion Full. Gerbang dialog (`role=dialog`, `aria-modal`, fokus masuk, Tab terkunci di dalam, halaman di belakang `inert`) hanya punya satu tombol, "Open the case", dan tidak bertanya apa pun. Tekanan itulah yang membuat browser mengizinkan audio, jadi sesudahnya urutan 2,4 detik (pita, stempel, mobil komik lewat, sapuan `clip-path`) berjalan dengan bunyi (whoosh, gedebuk, mesin) dan suara menyala. Pengecualian: pengunjung yang pernah mematikan suara (`gridlock.sound = off`) tetap hening, dan Escape masuk tanpa suara tanpa menyimpan apa pun. Tombol Sound di header mematikannya kapan saja. Urutan berjalan dengan `pointer-events: none` dan `aria-hidden`, bisa dilewati lewat tombol, ketuk atau scroll setelah 350 ms. Gerbang hanya dipasang klien setelah hidrasi dan halaman di bawahnya sudah dimuat. Teks gerbang sengaja kecil (satu baris) supaya bukan kandidat LCP terbesar, sebab LCP yang muncul setelah hidrasi dihitung Lighthouse menunggu JavaScript (skor Home turun ke 76 sebelum ini diperbaiki). Kartu contoh di Home juga disisipkan sebagai SVG saat build (`ExampleCardArt`), bukan `<img>`, dengan alasan yang sama, dan tidak ada gerbang untuk Motion Reduced/Off. Biayanya satu klik per sesi bagi pengunjung baru. Suara menyala sejak gerbang adalah keputusan pemilik proyek; sebelumnya default-nya mati.
- **Kartu.** Flip ke rap sheet hanya di detail Gallery (data mobil tersedia), berupa tombol dengan `aria-pressed`. Sisi belakang `aria-hidden` karena mengulang data di sebelahnya. Tanpa Motion Full flip menjadi pertukaran biasa. Misregistrasi saat tilt memakai bayangan keras merah dan kuning.
- **Tombol magnetik.** Hanya mouse, hanya Motion Full, maksimal 7 px, tombol primer saja.
- **Suara.** Sintesis WebAudio tanpa berkas audio. Mati sampai pengunjung menekan gerbang di Home (lihat Intro) atau tombol "Sound" di header (layar kecil: footer), pilihan disimpan di `gridlock.sound`. `AudioContext` tidak dibuat sebelum pengguna menyalakan suara. Jika pilihan On tersimpan, konteks dibuat pada gestur pertama. Sembilan bunyi, semuanya di bawah 0,5 detik: stempel (gedebuk plus tamparan kertas), rung terbuka (tiga nada naik), rev mesin pada tombol Mint, tik pada setiap tombol dan link yang ditekan, tik halus saat kursor mouse masuk ke elemen yang bisa ditekan, kibasan saat kartu dibalik, whoosh sekali untuk tiap bab yang masuk layar, satu nada per anak tangga pada scroll climb (tangga nada pentatonik dari G3, makin tinggi makin naik, turun lagi saat scroll balik) dan arpeggio penutup di rank 1. Bunyi yang sama dibatasi jaraknya (`MIN_GAP`) supaya scroll cepat tidak jadi berisik. Pembacaan pertama climb hanya menjadi acuan, jadi membuka halaman di tengah tidak berbunyi. Bunyi climb ikut mati bila Motion bukan Full karena anak tangganya hanya dihitung pada mode itu. Volume master 0,55 lewat kompresor supaya puncak tidak pecah (puncak terukur -9 sampai -20 dBFS), dan tiap bunyi punya isi di atas 300 Hz karena speaker kecil tidak memutar nada rendah. Versi pertama terlalu pelan, terlalu rendah, dan bunyi konfirmasi saat tombol dinyalakan tidak pernah keluar karena konteks audio belum 'running' pada saat itu; sekarang `play` menunggu `resume()` dan membuang bunyi yang terlambat lebih dari 0,4 detik.
- **Persimpangan istirahat saat intro dan bisa pulih.** Mesin persimpangan dulu berhenti selamanya bila rata-rata frame lebih lambat dari 30 fps dua jendela 2 detik berturut-turut, dan animasi intro yang menutupi layar cukup untuk memicunya, sehingga mobil diam setelah intro. Sekarang `data-intro` pada `<html>` membuat mesin istirahat selama gerbang dan intro (frame intro tidak dihitung), dan bila mesin menyerah ia mencoba lagi setelah 6 detik, sampai 4 kali, dengan hitungan efek dikembalikan penuh (`governor.reset()`). Perangkat yang benar-benar lambat tetap berhenti setelah percobaan terakhir.
- **Pelacak tangga di kolom kiri.** Di Home, kolom kiri di samping Ladder yang panjang dulu kosong. Sekarang berisi panel "You are here" (`LadderTracker`): jalan kecil dengan mobil komik yang berpindah ke anak tangga yang sedang di tengah layar atau yang disentuh kursor, kartu Price/Cap/Sold atau Left, legenda dan tautan Mint ke rank yang terbuka. Nilainya dibaca dari baris Ladder di DOM, jadi tidak ada sumber data kedua. Satu nada per anak tangga ikut berbunyi (sama dengan climb) bila suara menyala. Menempel (`sticky`) di layar lebar, disembunyikan di bawah 1000 px, dan disembunyikan dari pembaca layar kecuali tautan Mint karena hanya mengulang isi Ladder.
- **Persimpangan bergaya komik (karya orisinal).** Mobil digambar ulang pada resolusi 2x dengan bayangan jatuh bertinta, bayangan halftone, kilap dan pantulan kaca; peta mendapat atap dengan unit AC dan bayangan halftone, pohon, lampu jalan berpendar dan bekas rem. Selama animasi: lampu depan, garis kecepatan, asap knalpot saat mobil berangkat dari garis henti, nyala lampu lalu lintas, dan balon kata komik (VROOM saat hijau, BEEP saat mobil mengerem dekat kursor, SCREECH saat memutar menghindari kerucut; paling sering satu per 0,8 detik dan paling banyak tiga). Semua efek tambahan hanya saat hitungan efek dari pengatur frame masih >= 8, jadi perangkat lambat tetap mendapat versi polos. Tidak ada karya pihak lain yang disalin.
- **Kejar-kejaran polisi di persimpangan (karya orisinal).** Persimpangan memainkan adegan balap liar melawan polisi, terinspirasi dari genre kejar-kejaran jalanan; tidak memakai nama, aset, atau karakter dari gim mana pun. Satu mobil balap oranye (garis balap krem, sayap besar, underglow teal, api knalpot) dikejar dua mobil polisi putih-hitam dengan lampu bar merah dan biru. Kejar-kejaran hanya mulai di awal fase hijau supaya sudah lewat sebelum lampu berganti; Pengendara biasa menepi ke bahu saat kejar-kejaran datang dari belakang, dan warna mereka dijaga tenang supaya hanya polisi yang merah-biru dan hanya racer yang oranye. Cone yang dijatuhkan (klik jalan di depannya, atau tombol "Drop cone" dari keyboard, yang kini menaruhnya di jalan kejar-kejaran) menjadi barikade: racer menyeruduknya, berputar, dan polisi berhenti di belakangnya dengan balon "BUSTED!". Racer yang lolos menaikkan bintang HEAT (maksimal 5, lalu polisi sedikit lebih cepat); tertangkap mengembalikannya ke 0. Kursor dekat racer memicu "NITRO!". Sirene (`siren`) dan stempel (`stamp`) dibunyikan lewat event `gridlock:chase`, hanya bila suara menyala. Lampu bar berganti tiap 200 ms (2,5 kali per detik, di bawah batas 3 kedipan per detik) dan hanya menerangi area kecil; tidak ada kedipan layar penuh. Semua berhenti di luar Motion Full. Indikator HEAT di sudut adalah dekorasi (`aria-hidden`) karena kanvas pun dekoratif.
- **Kamera drone polisi.** Persimpangan dilihat lewat kamera udara virtual (pan, zoom, roll) yang bukan sorotan tetap. Tanpa kejar-kejaran ia berpatroli: menyapu kota pelan-pelan dengan zoom yang bernapas. Saat kejar-kejaran, ia membidik racer dengan per (spring) yang sedikit kurang teredam, jadi tertinggal di belakang mobil cepat, melewati sasaran sedikit, lalu mengendap, seperti operator sungguhan; zoom naik di dalam persimpangan, roll mengikuti arah geser, dan setelah tabrakan kamera pindah ke bangkai mobil selama 1,5 detik lalu kembali. Getaran tangan terdiri dari tremor halus terus-menerus, hembusan angin acak tiap 5 sampai 9 detik, dan hentakan setelah tabrakan atau penangkapan. Kamera tidak pernah melihat melewati tepi peta (batas dihitung dari zoom dan roll maksimal), zoom dibatasi 1,0 sampai 1,8 dan latar peta digambar 1,5 kali lebih tajam supaya tetap jelas saat zoom. Klik dan sentuhan dipetakan balik lewat kamera (roll, zoom, lalu geser) supaya cone jatuh tepat di bawah jari. Lapisan layar berisi sudut gelap, garis pindai, kurung sudut, bidik tengah, REC berkedip 1 kali per detik, kode waktu, "AIR 7", ketinggian dan zoom, serta kotak kunci di sekitar racer; semuanya dekoratif dan fiktif. Racer drift melewati persimpangan (ekor berayun ke dua arah, asap ban, bekas ban yang memudar dalam 3,4 detik, "SKRRT!"). Pada kejar-kejaran bernomor ganjil (yang pertama, ketiga, dan seterusnya) satu mobil polisi kehilangan kendali di persimpangan, berputar ke bahu jalan, berasap, dan memudar ("CRASH!"). Suara baru: `skid` dan `crash`. Dalam mode non-Full kamera diam pada zoom 1,0 tanpa getaran.
- **Penyimpanan.** Footer dan dokumen mencantumkan pengaturan suara dan penanda intro sesi, selain dompet dan motion.
- **Persimpangan di hero.** Persimpangan hidup (bagian 12) ditempatkan di kolom kanan hero poster. Di layar sempit ia tampil di atas papan judul supaya mesinnya berjalan di layar pertama, karena mesin hanya menggambar saat terlihat. Home tidak lagi memakai kanvas lalu lintas layar penuh, jadi tidak ada dua mesin sekaligus.
- **Intro menunggu Motion.** Pengaturan Motion dipasang oleh komponen yang pertama dipasang. Intro menunggu event `gridlock:motion` bila belum ada, jadi urutan efek tidak menentukan hasilnya.
- **Pengukuran.** Lihat `docs/VISUAL-LIVE.md` bagian Panggung.
