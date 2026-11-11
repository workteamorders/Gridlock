export interface RibbonInput {
  /** Total cars minted, read from the chain. Null when nothing was read. */
  minted: number | null;
  open: { rank: number; left: number; price: string } | null;
  next: { rank: number; at: string } | null;
  royaltyPercent: number;
}

/** Text for the ribbon. Numbers that change appear only when the input carries values read from the chain. */
export function ribbonFacts(i: RibbonInput): string[] {
  const live: string[] = [];
  if (i.minted !== null) live.push(`${i.minted} of 2,475 minted`);
  if (i.open) live.push(`Rank ${i.open.rank} open at ${i.open.price}`, `${i.open.left} left at rank ${i.open.rank}`);
  else if (i.next) live.push(`Rank ${i.next.rank} opens by ${i.next.at}`);
  const fixed = [
    '15 ranks, rank 15 first',
    'No owner, no admin functions',
    '12 hidden cars, found not bought',
    'Cards drawn by the contract',
    `${i.royaltyPercent}% creator royalty`,
    'No randomness',
  ];
  return [...live, ...fixed];
}
