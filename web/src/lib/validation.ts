// Every user input is validated on the client here. The contract validates again on-chain.
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkQuantity(raw: string | number, max: number): Checked<number> {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) return { ok: false, error: max === 1 ? 'Quantity is 1 car for this rank.' : `Quantity is 1 to ${max} cars per transaction.` };
  return { ok: true, value: n };
}

export function checkCarId(raw: string | null | undefined, totalMinted: number): Checked<number> {
  if (!raw || !/^[0-9]{1,6}$/.test(raw)) return { ok: false, error: 'A car number is whole digits, like 12.' };
  const n = Number(raw);
  if (n < 1 || n > totalMinted) return { ok: false, error: totalMinted === 0 ? 'No cars exist yet.' : `Car numbers run from 1 to ${totalMinted}.` };
  return { ok: true, value: n };
}

export function checkAddress(raw: string): Checked<`0x${string}`> {
  const v = raw.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return { ok: false, error: 'An address is 0x followed by 40 hex characters.' };
  if (/^0x0{40}$/.test(v)) return { ok: false, error: 'The zero address cannot receive a car.' };
  return { ok: true, value: v as `0x${string}` };
}

export function checkSecret(raw: string): Checked<`0x${string}`> {
  const v = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) return { ok: false, error: 'A hunt code is 0x followed by 64 hex characters.' };
  return { ok: true, value: v.toLowerCase() as `0x${string}` };
}

export function checkHuntIndex(raw: string): Checked<number> {
  if (!/^[0-9]{1,2}$/.test(raw)) return { ok: false, error: 'Pick a car from the list (0 to 11).' };
  const n = Number(raw);
  return n >= 0 && n <= 11 ? { ok: true, value: n } : { ok: false, error: 'Pick a car from the list (0 to 11).' };
}
