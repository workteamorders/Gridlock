/** Sound recipes as plain data: a few short tones and one noise burst each. Pure, so tests can check them. */
export type SoundKind = 'stamp' | 'open' | 'rev';
export interface Tone { wave: 'sine' | 'square' | 'sawtooth' | 'noise'; from: number; to: number; at: number; length: number; gain: number }

export const MASTER_GAIN = 0.18;

export function soundPlan(kind: SoundKind): Tone[] {
  switch (kind) {
    case 'stamp': return [
      { wave: 'sine', from: 140, to: 48, at: 0, length: 0.16, gain: 0.9 },
      { wave: 'noise', from: 0, to: 0, at: 0, length: 0.05, gain: 0.5 },
    ];
    case 'open': return [
      { wave: 'square', from: 523, to: 523, at: 0, length: 0.08, gain: 0.35 },
      { wave: 'square', from: 784, to: 784, at: 0.09, length: 0.12, gain: 0.35 },
    ];
    case 'rev': return [
      { wave: 'sawtooth', from: 70, to: 190, at: 0, length: 0.28, gain: 0.4 },
    ];
  }
}

/** Total length in seconds, for tests and for closing nodes. */
export const planLength = (kind: SoundKind) => Math.max(...soundPlan(kind).map((t) => t.at + t.length));
