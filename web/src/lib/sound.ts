import { MASTER_GAIN, soundPlan, type SoundKind } from './sound-plan';

const key = 'gridlock.sound';
let enabled = false;
let loaded = false;
let ctx: AudioContext | undefined;
let noise: AudioBuffer | undefined;

function load() {
  if (loaded) return;
  loaded = true;
  try { enabled = localStorage.getItem(key) === 'on'; } catch {}
}

export const soundOn = () => { load(); return enabled; };
export const subscribeSound = (listener: () => void) => {
  window.addEventListener('gridlock:sound', listener);
  return () => window.removeEventListener('gridlock:sound', listener);
};

/** Creating the context happens only here, from a user action. Until then no audio object exists. */
function context(): AudioContext | undefined {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  ctx = new Ctor();
  return ctx;
}

export function setSound(on: boolean) {
  load();
  enabled = on;
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch {}
  if (on) { void context()?.resume(); play('open'); }
  window.dispatchEvent(new Event('gridlock:sound'));
}

/** When sound was left on in an earlier visit, the browser still needs one gesture before it allows audio. */
export function armOnGesture() {
  if (!soundOn() || ctx) return () => undefined;
  const start = () => { void context()?.resume(); };
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  return () => { window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start); };
}

export function play(kind: SoundKind) {
  load();
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(ctx.destination);
  for (const t of soundPlan(kind)) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(t.gain, now + t.at);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t.at + t.length);
    gain.connect(master);
    if (t.wave === 'noise') {
      noise ??= (() => {
        const b = ctx!.createBuffer(1, ctx!.sampleRate * 0.1, ctx!.sampleRate);
        const d = b.getChannelData(0);
        let s = 1;
        for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823 - 1; }
        return b;
      })();
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.connect(gain);
      src.start(now + t.at);
      src.stop(now + t.at + t.length);
    } else {
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from, now + t.at);
      if (t.to !== t.from) osc.frequency.exponentialRampToValueAtTime(t.to, now + t.at + t.length);
      osc.connect(gain);
      osc.start(now + t.at);
      osc.stop(now + t.at + t.length);
    }
  }
}
