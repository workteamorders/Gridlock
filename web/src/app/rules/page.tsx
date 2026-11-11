import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { SupplyChart } from '@/components/SupplyChart';

export const metadata: Metadata = { title: 'Rules', description: 'Every rule of Gridlock in plain words: the ladder, limits, payment, heat, royalty and the Hunt. The contract enforces what this page describes.', alternates: { canonical: '/rules/' } };

export default function RulesPage() {
  return (
    <Shell current="/rules/">
      <section className="wrap section stack">
        <h1>Rules</h1>
        <p>This page describes what the contract does. If this page and the contract ever differ, the contract wins. You can check every number on the <Link href="/contracts/">Contracts</Link> page.</p>

        <h2>The ladder</h2>
        <p>There are 2,475 ladder cars across 15 ranks. Rank 15 has 400 cars and is the cheapest. Rank 1 has 10 cars and costs the most. Caps shrink and prices rise as the rank number goes down.</p>
        <SupplyChart />
        <p>Rank 15 opens at the start time. Each other rank opens when the rank above it in number sells out, or when its own time limit passes, whichever is first. Nobody can open or close a rank, and nobody can change a price or a cap.</p>

        <h2>Limits</h2>
        <ul className="stack-tight">
          <li>Up to 2 cars per transaction.</li>
          <li>Up to 2 cars per wallet in each of ranks 15 to 6, and 1 car per wallet in each of ranks 5 to 1.</li>
          <li>These limits are per wallet address. A person can use several addresses. The limits slow bulk buying, they do not stop it.</li>
        </ul>

        <h2>Paying</h2>
        <p>You pay the exact price in ETH. The contract rejects any other amount, so it never keeps change and there are no refunds. All of the price goes to one treasury address that is fixed when the contract is deployed. The treasury can be read on the Contracts page.</p>

        <h2>Seeing the car first</h2>
        <p>Each car is set by its rank and serial number, not by chance. The next serial in a rank is public, and the Mint page shows the exact card before you pay. Because everyone can see it, bots can mint a card that looks good. The mint also checks the serial you reviewed, and stops if someone else took it first.</p>

        <h2>Heat</h2>
        <p>Each transfer adds 20 heat, up to 150. Heat falls by 1 every hour. Stars show heat: 1 star at 1, 2 at 20, 3 at 45, 4 at 80 and 5 at 120. Minting and approvals add no heat.</p>
        <p>Heat is a picture only. It changes no price, no royalty, no limit and no right. Someone can add heat to a car cheaply by moving it. Marketplaces may show an older picture of a car than the contract draws now.</p>

        <h2>The rap sheet</h2>
        <p>Every car records its mint time, how often it moved, its peak heat and when it last moved. These facts are read from the contract.</p>

        <h2>The Hunt</h2>
        <p>Twelve hidden cars are not for sale. Each opens with a secret code. Claiming takes two steps with a wait between them. There is no prize beyond the car. See <Link href="/hunt/">The Hunt</Link>.</p>

        <h2>Royalty</h2>
        <p>The contract announces a 5% royalty to the treasury on resales. Marketplaces decide whether to pay it. Many do not.</p>

        <h2>No changes later</h2>
        <p>The contracts have no owner, no admin and no upgrade path. Rules, prices and caps cannot be changed after deployment. That also means mistakes cannot be fixed. Read the <Link href="/risk/">risk notice</Link>.</p>
      </section>
    </Shell>
  );
}
