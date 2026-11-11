/** Pure helpers for the scroll story and the rolling counter. Kept free of the DOM so they can be tested. */
export const CLIMB_STEPS = 15;

/** Scroll progress 0..1 through the story, from the section box and the viewport height. */
export function climbProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, -top / travel));
}

/** Which of the 15 steps is lit for a progress value: 0 is the bottom step (rank 15), 14 is the top (rank 1). */
export function climbStep(progress: number, steps = CLIMB_STEPS): number {
  return Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
}

export const rankAtStep = (step: number, steps = CLIMB_STEPS) => steps - step;

/** Cap of a rank, from the list of caps ordered rank 1 to rank 15 (rank 1 is the smallest). */
export const capOfRank = (caps: readonly number[], rank: number) => caps[rank - 1] ?? 0;

/** Value shown while a counter rolls from one number to another. Ease-out, ends exactly on the target. */
export function rollValue(from: number, to: number, t: number): number {
  if (t >= 1) return to;
  if (t <= 0) return from;
  const eased = 1 - (1 - t) ** 3;
  return Math.round(from + (to - from) * eased);
}

/** Pull of a magnetic button: zero outside the radius, up to `max` pixels toward the pointer inside it. */
export function magnetOffset(dx: number, dy: number, radius: number, max: number): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d >= radius || d === 0) return [0, 0];
  const pull = (1 - d / radius) * max;
  return [(dx / d) * pull, (dy / d) * pull];
}
