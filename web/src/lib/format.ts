import { formatEther } from 'viem';

export function formatEth(wei: bigint, maxDecimals = 6): string {
  const s = formatEther(wei);
  const [i = '0', f = ''] = s.split('.');
  const frac = f.slice(0, maxDecimals).replace(/0+$/, '');
  return `${i}${frac ? `.${frac}` : ''} ETH`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Always UTC, so server and browser agree and nobody has to guess a timezone. */
export function formatUtc(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${s % 60} s`;
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
