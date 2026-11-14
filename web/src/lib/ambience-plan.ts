/** All levels are bounded; speed comes from the visual chase, never wallet/chain data. */
export function ambiencePlan(speed: number, accelerating: boolean, nitro: boolean, chasing: boolean) {
  const v = Math.max(0, Math.min(330, Number.isFinite(speed) ? speed : 0));
  const gear = Math.min(4, Math.floor(v / 65));
  const rpm = 45 + (v - gear * 65) * 1.25 + (accelerating ? 22 : 0) + (nitro ? 32 : 0);
  return {
    engineHz: chasing ? rpm : 36,
    engineGain: chasing ? 0.07 + v / 330 * 0.12 + (nitro ? 0.04 : 0) : 0.018,
    exhaustHz: 350 + v * 5 + (nitro ? 600 : 0),
    exhaustGain: chasing && accelerating ? 0.045 : 0.008,
    rotorHz: 86 + (chasing ? 12 : 0) + v * 0.025,
    droneGain: chasing ? 0.085 : 0.065,
  };
}
