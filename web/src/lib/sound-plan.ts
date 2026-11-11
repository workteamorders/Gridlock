/** Sound recipes as plain data: a few short tones and noise bursts each. Pure, so tests can check them. */
export type SoundKind = 'stamp' | 'open' | 'rev' | 'click' | 'flip' | 'step' | 'summit' | 'hover' | 'whoosh';
export interface Filter { type: 'lowpass' | 'highpass' | 'bandpass'; freq: number; q?: number }
export interface Tone { wave: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'; from: number; to: number; at: number; length: number; gain: number; filter?: Filter }

/** Set high enough to be heard on laptop and phone speakers. A compressor after it keeps peaks from clipping. */
export const MASTER_GAIN = 0.55;

/** Notes of the climb: a major pentatonic ladder from G3, so any run of steps sounds like music and never clashes. */
const PENTATONIC = [0, 2, 4, 7, 9];
export const stepFrequency = (level: number) => {
  const n = Math.max(0, Math.round(level));
  return 196 * 2 ** ((PENTATONIC[n % 5]! + 12 * Math.floor(n / 5)) / 12);
};

/** Minimum gap in milliseconds between two plays of the same sound, so fast scrolling or hovering stays pleasant. */
export const MIN_GAP: Record<SoundKind, number> = { stamp: 150, open: 150, rev: 150, click: 40, flip: 150, step: 70, summit: 400, hover: 90, whoosh: 500 };

export function soundPlan(kind: SoundKind, level = 0): Tone[] {
  switch (kind) {
    // Rubber stamp on paper: a low thump with an upper body so small speakers carry it, then a dry slap.
    case 'stamp': return [
      { wave: 'sine', from: 170, to: 52, at: 0, length: 0.24, gain: 1 },
      { wave: 'triangle', from: 320, to: 110, at: 0, length: 0.16, gain: 0.8 },
      { wave: 'noise', from: 0, to: 0, at: 0, length: 0.09, gain: 0.9, filter: { type: 'bandpass', freq: 1800, q: 0.8 } },
    ];
    // A rung lights up: three bright rising notes, like an arcade coin.
    case 'open': return [
      { wave: 'square', from: 659, to: 659, at: 0, length: 0.1, gain: 0.45, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'square', from: 880, to: 880, at: 0.09, length: 0.1, gain: 0.45, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'square', from: 1319, to: 1319, at: 0.18, length: 0.2, gain: 0.45, filter: { type: 'lowpass', freq: 3200 } },
    ];
    // Engine rev for the mint button: two slightly apart saws climbing, with a little exhaust hiss.
    case 'rev': return [
      { wave: 'sawtooth', from: 62, to: 230, at: 0, length: 0.46, gain: 0.8, filter: { type: 'lowpass', freq: 1100, q: 4 } },
      { wave: 'sawtooth', from: 66, to: 241, at: 0, length: 0.46, gain: 0.6, filter: { type: 'lowpass', freq: 1100, q: 4 } },
      { wave: 'noise', from: 0, to: 0, at: 0.04, length: 0.4, gain: 0.25, filter: { type: 'highpass', freq: 3000 } },
    ];
    // Button press: a short comic tick.
    case 'click': return [
      { wave: 'square', from: 1500, to: 800, at: 0, length: 0.07, gain: 1, filter: { type: 'lowpass', freq: 4000 } },
      { wave: 'noise', from: 0, to: 0, at: 0, length: 0.03, gain: 0.7, filter: { type: 'highpass', freq: 4000 } },
    ];
    // One rung of the climb: a bright blip whose pitch rises with the step, plus the octave above it.
    case 'step': {
      const f = stepFrequency(level);
      return [
        { wave: 'square', from: f, to: f, at: 0, length: 0.12, gain: 0.9, filter: { type: 'lowpass', freq: 3000 } },
        { wave: 'triangle', from: f * 2, to: f * 2, at: 0, length: 0.1, gain: 0.8 },
      ];
    }
    // Top of the ladder, rank 1: a short rising arpeggio that ends on a held note.
    case 'summit': return [
      { wave: 'square', from: 523, to: 523, at: 0, length: 0.1, gain: 0.5, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'square', from: 659, to: 659, at: 0.08, length: 0.1, gain: 0.5, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'square', from: 784, to: 784, at: 0.16, length: 0.1, gain: 0.5, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'square', from: 1047, to: 1047, at: 0.24, length: 0.25, gain: 0.55, filter: { type: 'lowpass', freq: 3200 } },
      { wave: 'triangle', from: 2093, to: 2093, at: 0.24, length: 0.2, gain: 0.35 },
    ];
    // Pointer moves onto something pressable: the lightest possible tick.
    case 'hover': return [
      { wave: 'sine', from: 1200, to: 1500, at: 0, length: 0.05, gain: 0.7 },
    ];
    // A new chapter slides into view: air moving past, rising.
    case 'whoosh': return [
      { wave: 'noise', from: 0, to: 0, at: 0, length: 0.3, gain: 0.55, filter: { type: 'bandpass', freq: 900, q: 0.9 } },
      { wave: 'sine', from: 300, to: 700, at: 0.04, length: 0.22, gain: 0.3 },
    ];
    // Poster turned over: a paper swish and a soft tap.
    case 'flip': return [
      { wave: 'noise', from: 0, to: 0, at: 0, length: 0.16, gain: 0.7, filter: { type: 'bandpass', freq: 2600, q: 0.7 } },
      { wave: 'triangle', from: 520, to: 900, at: 0.1, length: 0.07, gain: 0.5 },
    ];
  }
}

export const SOUND_KINDS: SoundKind[] = ['stamp', 'open', 'rev', 'click', 'flip', 'step', 'summit', 'hover', 'whoosh'];

/** Total length in seconds, for tests and for closing nodes. */
export const planLength = (kind: SoundKind, level = 0) => Math.max(...soundPlan(kind, level).map((t) => t.at + t.length));
