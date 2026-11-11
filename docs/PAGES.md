# Page briefs

One line per question. Every page has: loading, empty (not deployed), error, and normal states. Every page is a thin server `page.tsx` that wraps a client body.

| Page | Purpose | The one action | Three questions it answers | Data (all read from chain) |
|---|---|---|---|---|
| Home `/` | Explain the ladder and show where it stands | Mint at the open rung | What is this? What is open and what does it cost? When does the next rank open? | `ladderState`, `START_TIME`, minted count |
| Mint `/mint/?rank=` | Buy 1–2 cars of an open rank | Review, then sign | Which exact car do I get? What do I pay and who gets it? What can go wrong? | `previewNext`, renderer `svg` (for the 2nd car), price, caps, `walletMinted`, `TREASURY` |
| Ladder `/ladder/` | Show all 15 ranks and the opening rule | Mint an open rank | What is open? What is the price and supply? When does the next rank open? | `ladderState` |
| Gallery `/gallery/` (`?id=`) | Browse minted cars; one car's rap sheet | Open a car | What does this car look like? What has it been through? Who owns it and when does its heat reach 0? | `carData`, `ownerOf`, `tokenURI` (images, lazy) |
| Garage `/garage/` | Your cars | Send a car | Which cars do I own? What is their heat? What happens if I send one? | `ownedIds`, `carData` |
| Hunt `/hunt/` | Claim a hidden car with a code, in two steps | Step 1, then step 2 | How does it work? Which cars are claimed? When can I do step 2? | `huntStatus`, `huntCommitments`, `claimCommit`, `REVEAL_MIN_DELAY` |
| Rules `/rules/` | Every rule in plain words | Read | What can the contract do and not do? What are the limits? What is heat? | Static text (the contract wins on any difference) |
| Contracts `/contracts/` | Let a reader verify | Open the explorer | Which addresses? Do the live numbers match what was published? Is it audited? | Constants, caps, prices, `deployments/<chain>.json` |
| Risk and terms `/risk/` | What can go wrong; terms of use | Read | What am I buying? What are the risks? What are the terms? | Static text, marked pending legal review |
| 404, error, Offline | Dead ends with a way out | Go back | What happened? Is my money safe? What next? | none |

Rules for every page: no leaderboards, nothing gated by heat, no "rare" or "profit" language (checked by `npm run copy:check`), no hints for the Hunt, all numbers formatted by `src/lib/format.ts`.
