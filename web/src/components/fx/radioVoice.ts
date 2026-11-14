import type { Line } from './dispatch';

export function deliveryFor(line: Line) {
  const unit = Number(line.tag.match(/UNIT (\d+)/)?.[1] ?? 1);
  const persona = line.voice === 'drone' ? { rate: 1.01, pitch: 0.9 }

    : [{ rate: 1.04, pitch: 0.78 }, { rate: 1.12, pitch: 1.04 }, { rate: 0.98, pitch: 0.9 }][(unit - 1) % 3]!;
  const mood = line.emotion ?? 'calm';
  const emotion = {
    calm: { rate: 0, pitch: 0, volume: 0.82 },
    urgent: { rate: 0.12, pitch: 0.09, volume: 0.94 },
    panic: { rate: 0.2, pitch: 0.2, volume: 1 },
    relieved: { rate: -0.07, pitch: 0.04, volume: 0.86 },
    frustrated: { rate: -0.03, pitch: -0.08, volume: 0.96 },
  }[mood];
  return { rate: persona.rate + emotion.rate, pitch: persona.pitch + emotion.pitch, volume: emotion.volume };
}

/** Allocate identities together, so UNIT 1 cannot accidentally borrow NODE 7's voice. */
export function castVoices(voices: SpeechSynthesisVoice[]): Map<string, SpeechSynthesisVoice> {
  const english = voices.filter(v => /^en(?:-|_)/i.test(v.lang));
  const natural = english.filter(v => !/Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox/i.test(v.name));
  const pool = (natural.length ? natural : english).slice().sort((a,b) => Number(b.localService)-Number(a.localService) || a.name.localeCompare(b.name));
  const cast = new Map<string, SpeechSynthesisVoice>();
  const preferred = [
    ['drone', /Daniel|Karen/i],
    ['UNIT 1', /Alex|David|Reed.*United States|Google US English/i],
    ['UNIT 2', /Aaron|Mark|Eddy.*United States|Google UK English Male/i],
    ['UNIT 3', /Moira|Tessa|Flo.*United States|Google UK English Female/i],
  ] as const;
  for (const [key, match] of preferred) {
    const unused = pool.filter(v => ![...cast.values()].includes(v));
    const choice = unused.find(v => match.test(v.name)) ?? unused[0] ?? pool[cast.size % Math.max(1,pool.length)];
    if (choice) cast.set(key, choice);
  }
  return cast;
}

type Options = {
  synth?: SpeechSynthesis;
  utterance?: (text: string) => SpeechSynthesisUtterance;
  enabled: () => boolean;
  transmit: () => (() => void);
  status: (state: 'speaking' | 'idle' | 'unavailable') => void;
};

/** One owned transmission at a time. The feed waits here before revealing the next line. */
export class RadioVoice {
  private current: SpeechSynthesisUtterance | undefined;
  private stopCarrier: (() => void) | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private failed = false;
  private disposed = false;
  private cast = new Map<string, SpeechSynthesisVoice>();
  private voiceListKey = '';
  private options: Options;
  constructor(options: Options) { this.options = options; }

  get busy() { return this.current !== undefined; }
  get available() { return !!this.options.synth && !!this.options.utterance && !this.failed; }

  /** False holds the line in the feed; true means it may appear now. Never queues stale speech. */
  present(line: Line): boolean {
    if (this.disposed) return true;
    if (!this.options.enabled()) {
      if (this.busy) this.stop();
      return true;
    }
    if (!this.available) { this.options.status('unavailable'); return true; }
    if (this.busy) return false;
    const synth = this.options.synth!;
    // The callsign is a visual speaker label, never part of the spoken sentence.
    const utterance = this.options.utterance!(line.text);
    const profile = deliveryFor(line);
    const voices = synth.getVoices();
    const voiceListKey = voices.map(v => `${v.voiceURI ?? v.name}:${v.lang}`).sort().join('|');
    if (!this.cast.size || voiceListKey !== this.voiceListKey) {
      this.cast = castVoices(voices);
      this.voiceListKey = voiceListKey;
    }
    const selected = this.cast.get(line.voice === 'police' ? line.tag : line.voice);
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang ?? 'en-US';
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    this.current = utterance; // Keep a strong reference until the browser finishes speaking.
    const finish = (failed = false) => {
      if (this.current !== utterance) return;
      this.clear();
      this.failed = failed;
      this.options.status(failed ? 'unavailable' : 'idle');
    };
    utterance.onstart = () => {
      if (this.current !== utterance) return;
      this.stopCarrier = this.options.transmit();
      this.options.status('speaking');
    };
    utterance.onend = () => finish();
    utterance.onerror = () => finish(true);
    // Some engines never dispatch end/error. Do not leave the feed locked indefinitely.
    this.timeout = setTimeout(() => {
      if (this.current !== utterance) return;
      finish(true);
      synth.cancel();
    }, 20000);
    try { synth.speak(utterance); } catch { finish(true); }
    return true;
  }

  private clear() {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.stopCarrier?.();
    this.stopCarrier = undefined;
    this.current = undefined;
  }

  stop() {
    const owned = this.busy;
    this.clear(); // Invalidate callbacks before cancel (some engines call them synchronously).
    if (owned) this.options.synth?.cancel();
    this.options.status('idle');
  }

  retry() { this.failed = false; }
  dispose() { this.stop(); this.disposed = true; }
}
