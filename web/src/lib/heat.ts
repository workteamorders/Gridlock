// Heat math. Must match GridlockCars exactly; tests/heat.test.mjs checks it against vectors produced by the contract.
export const HEAT_PER_TRANSFER = 20;
export const HEAT_MAX = 150;
export const STAR_THRESHOLDS = [1, 20, 45, 80, 120] as const;

export type Stars = 0 | 1 | 2 | 3 | 4 | 5;

export function starsFor(heat: number): Stars {
  let s = 0;
  for (const t of STAR_THRESHOLDS) if (heat >= t) s += 1;
  return s as Stars;
}

/** heat now = max(0, stored - floor((now - updatedAt) / decay)) */
export function heatNow(stored: number, updatedAt: number, now: number, decaySeconds: number): number {
  if (stored <= 0) return 0;
  const drop = Math.floor(Math.max(0, now - updatedAt) / decaySeconds);
  return drop >= stored ? 0 : stored - drop;
}

/** Time heat reaches 0 if the car is not moved, or 0 when it is already 0. */
export function heatZeroAt(stored: number, updatedAt: number, now: number, decaySeconds: number): number {
  return heatNow(stored, updatedAt, now, decaySeconds) === 0 ? 0 : updatedAt + stored * decaySeconds;
}

/** Heat after one more transfer at `now`. */
export function heatAfterTransfer(stored: number, updatedAt: number, now: number, decaySeconds: number): number {
  return Math.min(HEAT_MAX, heatNow(stored, updatedAt, now, decaySeconds) + HEAT_PER_TRANSFER);
}
