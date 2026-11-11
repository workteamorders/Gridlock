import type { Metadata } from 'next';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = { title: 'Risk and terms', description: 'What can go wrong with Gridlock Cars and the terms of using this site. Pending legal review.', alternates: { canonical: '/risk/' } };

export default function RiskPage() {
  return (
    <Shell current="/risk/">
      <section className="wrap section stack">
        <h1>Risk and terms</h1>
        <div className="alert alert--warn" role="note"><p><strong>Draft, pending legal review.</strong> This page is written in plain words so you can understand the risks. It has not been reviewed by a lawyer and may change.</p></div>

        <h2>What you are buying</h2>
        <p>A Gridlock Car is a digital collectible: an invented comic card drawn by a smart contract. It is not an investment, a security or a promise of anything. Nobody promises it will keep or gain value, or that anyone will buy it from you.</p>

        <h2>Risks</h2>
        <ul className="stack-tight">
          <li><strong>Code risk.</strong> The contracts have no external audit yet. A bug could lock or lose cars and ETH. Because the contracts are immutable, nobody can fix a bug or reverse a loss.</li>
          <li><strong>No refunds.</strong> Payments are exact and final. Mints and sends cannot be undone.</li>
          <li><strong>Bots and visible cards.</strong> The next card is public, so bots can mint the cards that look best before you.</li>
          <li><strong>Heat is cosmetic and cheap to change.</strong> Anyone can raise a car&apos;s heat by moving it. Marketplaces may show an older image.</li>
          <li><strong>Royalty is a preference.</strong> Marketplaces may ignore the 5% royalty.</li>
          <li><strong>Network risk.</strong> The chain can be slow, stop, or change its rules. The chain&apos;s clock is the block time and is set by its sequencer.</li>
          <li><strong>Wallet risk.</strong> If you lose your keys or send to a wrong address, nobody can help you.</li>
          <li><strong>Limits are per address.</strong> A person can use many addresses.</li>
          <li><strong>Regional limits.</strong> This site may turn off minting in some regions. That is a limit of this interface only. The contract cannot tell where you are.</li>
        </ul>

        <h2>Terms of use</h2>
        <ul className="stack-tight">
          <li>You use this site and the contracts at your own risk. They are provided as they are, without warranties.</li>
          <li>You are responsible for following the laws that apply to you, including where you may use this site and any tax duties.</li>
          <li>You must be old enough to enter contracts where you live.</li>
          <li>Cars, plates and names in the artwork are invented. They are not related to any real vehicle, person, brand, chain or marketplace.</li>
          <li>This site collects no personal data and sets no tracking cookies. It remembers your wallet choice and that you read the first-mint notice, in your browser only.</li>
        </ul>
      </section>
    </Shell>
  );
}
