import { MASTER_GAIN, MIN_GAP, soundPlan, type SoundKind } from './sound-plan';
import { SAMPLES, sampleFiles, type Layer } from './sound-samples';

const key = 'gridlock.sound';
let enabled = false;
let loaded = false;
let ctx: AudioContext | undefined;
let noise: AudioBuffer | undefined;
const recordings = new Map<string, AudioBuffer>();
let fetching = false;

function load() {
  if (loaded) return;
  loaded = true;
  try { enabled = localStorage.getItem(key) === 'on'; } catch {}
}

export const soundOn = () => { load(); return enabled; };
/** What the visitor chose last time: null when they never chose, so "off" can be told apart from "never asked". */
export const soundChoice = (): 'on' | 'off' | null => { try { const v = localStorage.getItem(key); return v === 'on' || v === 'off' ? v : null; } catch { return null; } };
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
  fetchRecordings(ctx);
  return ctx;
}

/** Recorded sounds are fetched once, right after the visitor first allows sound. Any that fail stay synthesised. */
function fetchRecordings(c: AudioContext) {
  if (fetching) return;
  fetching = true;
  for (const file of sampleFiles()) {
    fetch(`/audio/${file}.wav`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => { recordings.set(file, buffer); })
      .catch(() => undefined);
  }
}

/** `quiet` skips the confirmation sound, for callers that play their own. */
export function setSound(on: boolean, quiet = false) {
  load();
  enabled = on;
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch {}
  if (on) { void context()?.resume(); if (!quiet) play('open'); }
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

/** Pending resumes older than this are dropped, so a sound never plays late at some unrelated gesture. */
const STALE_MS = 400;

const lastAt: Partial<Record<SoundKind, number>> = {};

/** `level` only matters for sounds that vary, such as the climb step (0 is the bottom rung). */
export function play(kind: SoundKind, level = 0) {
  load();
  if (!enabled || !ctx) return;
  const asked = performance.now();
  if (asked - (lastAt[kind] ?? -1e9) < MIN_GAP[kind]) return;
  lastAt[kind] = asked;
  const c = ctx;
  if (c.state === 'running') { schedule(c, kind, level); return; }
  void c.resume().then(() => { if (c.state === 'running' && performance.now() - asked < STALE_MS) schedule(c, kind, level); }).catch(() => undefined);
}

let bus: { ctx: AudioContext; input: GainNode } | undefined;
/** One master gain into a compressor, so the louder sounds cannot clip. */
function output(c: AudioContext): GainNode {
  if (bus && bus.ctx === c) return bus.input;
  const input = c.createGain();
  input.gain.value = MASTER_GAIN;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
  input.connect(comp); comp.connect(c.destination);
  bus = { ctx: c, input };
  return input;
}

function playRecordings(c: AudioContext, layers: Layer[]) {
  const now = c.currentTime;
  const master = output(c);
  for (const layer of layers) {
    const buffer = recordings.get(layer.file)!;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = layer.rate;
    if (layer.rateTo) src.playbackRate.linearRampToValueAtTime(layer.rateTo, now + layer.at + buffer.duration / ((layer.rate + layer.rateTo) / 2));
    const gain = c.createGain();
    gain.gain.value = layer.gain;
    src.connect(gain); gain.connect(master);
    src.start(now + layer.at);
  }
}

function schedule(c: AudioContext, kind: SoundKind, level: number) {
  const layers = SAMPLES[kind];
  if (layers && layers.every((l) => recordings.has(l.file))) { playRecordings(c, layers); return; }
  const now = c.currentTime;
  const master = output(c);
  for (const t of soundPlan(kind, level)) {
    const gain = c.createGain();
    gain.gain.setValueAtTime(t.gain, now + t.at);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t.at + t.length);
    let head: AudioNode = gain;
    if (t.filter) {
      const f = c.createBiquadFilter();
      f.type = t.filter.type; f.frequency.value = t.filter.freq; f.Q.value = t.filter.q ?? 1;
      f.connect(gain); head = f;
    }
    gain.connect(master);
    if (t.wave === 'noise') {
      noise ??= (() => {
        const b = c.createBuffer(1, Math.ceil(c.sampleRate * 0.5), c.sampleRate);
        const d = b.getChannelData(0);
        let s = 1;
        for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823 - 1; }
        return b;
      })();
      const src = c.createBufferSource();
      src.buffer = noise;
      src.connect(head);
      src.start(now + t.at);
      src.stop(now + t.at + t.length);
    } else {
      const osc = c.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from, now + t.at);
      if (t.to !== t.from) osc.frequency.exponentialRampToValueAtTime(t.to, now + t.at + t.length);
      osc.connect(head);
      osc.start(now + t.at);
      osc.stop(now + t.at + t.length);
    }
  }
}
