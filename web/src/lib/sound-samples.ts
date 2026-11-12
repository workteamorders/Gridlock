import type { SoundKind } from './sound-plan';

/** One recorded clip played as part of a sound. `rateTo` glides the playback speed (and so the pitch) over the clip. */
export interface Layer { file: string; gain: number; at: number; rate: number; rateTo?: number }

/**
 * Recorded sounds (CC0, see public/audio/CREDITS.md) that replace the synthesised recipe of a kind.
 * Kinds that are missing here stay synthesised. A recording that has not loaded yet, or failed to load, falls back to the recipe.
 * Files are fetched only after the visitor turns sound on.
 */
export const SAMPLES: Partial<Record<SoundKind, Layer[]>> = {
  stamp: [{ file: 'thud', gain: 1, at: 0, rate: 0.8 }],
  open: [{ file: 'coin', gain: 0.8, at: 0, rate: 1 }],
  // The engine clip speeds up as it plays, so one steady recording becomes a rev.
  rev: [{ file: 'engine', gain: 0.9, at: 0, rate: 0.8, rateTo: 1.7 }],
  click: [{ file: 'tick', gain: 0.7, at: 0, rate: 1.15 }],
  hover: [{ file: 'tick', gain: 0.3, at: 0, rate: 1.6 }],
  flip: [{ file: 'swish', gain: 0.8, at: 0, rate: 1 }],
  whoosh: [{ file: 'whoosh', gain: 0.75, at: 0, rate: 1 }],
  crash: [{ file: 'impact', gain: 1, at: 0, rate: 1 }],
  skid: [{ file: 'skid', gain: 0.8, at: 0, rate: 1 }],
  // Top of the ladder: the coin four times, a major arpeggio up an octave.
  summit: [1, 1.2599, 1.4983, 2].map((rate, i) => ({ file: 'coin', gain: 0.7, at: i * 0.08, rate })),
};

/** Every file the recordings use, once each. */
export const sampleFiles = (): string[] => [...new Set(Object.values(SAMPLES).flatMap((layers) => layers!.map((l) => l.file)))];
