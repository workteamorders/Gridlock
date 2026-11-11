export function frameGovernor(initial: number) {
  let count = initial;
  let elapsed = 0;
  let frames = 0;
  let slowWindows = 0;
  return {
    sample(ms: number) {
      elapsed += ms;
      frames += 1;
      if (elapsed < 2000) return count;
      const average = elapsed / frames;
      elapsed = 0;
      frames = 0;
      slowWindows = average > 1000 / 30 ? slowWindows + 1 : 0;
      if (slowWindows >= 2) count = 0;
      else if (average > 20) count = Math.max(4, Math.floor(count * 0.7));
      return count;
    },
    pause() { elapsed = 0; frames = 0; slowWindows = 0; },
    /** Back to the full effect count, for a second try after the scene gave up. */
    reset() { count = initial; elapsed = 0; frames = 0; slowWindows = 0; },
  };
}
