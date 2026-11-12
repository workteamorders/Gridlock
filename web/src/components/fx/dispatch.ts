/**
 * The radio traffic of the drone feed: short text lines in three voices (the drone, the patrol units and the racer's own
 * radio) that report what is happening in the junction, in blockchain terms. Pure data and logic, so tests can check it.
 * Everything here is fiction written for a picture: the numbers come from the animation, not from any chain.
 */
import type { Route } from './chase-plan';

export type Voice = 'drone' | 'police' | 'racer';

/** One line of radio. `delay` staggers the voices of one report so they answer each other, a few hundred milliseconds apart. */
export interface Line { voice: Voice; tag: string; text: string; delay: number }

export type Report =
  | { kind: 'quiet'; waiting: number; block: number; confirmed: number; reverted: number; gate: string; first: boolean }
  | { kind: 'start'; cops: number; gate: string }
  | { kind: 'junction'; index: number; route: Route }
  | { kind: 'telemetry'; fee: number; gap: number }
  | { kind: 'nitro' }
  | { kind: 'slide' }
  | { kind: 'copSpin'; unit: number; junction: number }
  | { kind: 'pileup' }
  | { kind: 'pitWin' }
  | { kind: 'pitMiss' }
  | { kind: 'wipeout' }
  | { kind: 'block'; ahead: number }
  | { kind: 'reverted' }
  | { kind: 'escape'; heat: number };

export type ReportKind = Report['kind'];

/** Longest line, tag included, in characters. Longer ones would be cut off on a phone. */
export const MAX_LINE = 50;

const DRONE = 'NODE 7';
const UNIT = 'UNIT 1';
const RACER = 'RACER';

const drone = (text: string, delay = 0): Line => ({ voice: 'drone', tag: DRONE, text, delay });
const police = (text: string, delay = 0, unit = UNIT): Line => ({ voice: 'police', tag: unit, text, delay });
const racer = (text: string, delay = 0): Line => ({ voice: 'racer', tag: RACER, text, delay });

/** `pick(n)` returns a whole number from 0 to n - 1; passing it in keeps the wording varied while tests stay exact. */
export type Pick = (n: number) => number;
const one = <T,>(options: T[], pick: Pick): T => options[pick(options.length)]!;

const TURN: Record<Route, (index: number) => string[]> = {
  straight: (i) => [`junction ${i}, straight through.`, `junction ${i}, no turn, just speed.`],
  right: (i) => [`junction ${i}, hard right. Slippage ahead.`, `junction ${i}, sharp right coming.`],
  left: (i) => [`junction ${i}, hard left. Slippage ahead.`, `junction ${i}, sharp left coming.`],
  uturn: (i) => [`junction ${i}, he is turning back!`, `junction ${i}, U-turn. Tx going back.`],
  donut: (i) => [`junction ${i}, circling the block.`, `junction ${i}, going round and round.`],
};
const RACER_TURN: Record<Route, string[]> = {
  straight: ['Straight on. Keep the fee up.'],
  right: ['Tight right. Hold the line.', 'Right! Do not lift.'],
  left: ['Tight left. Hold the line.', 'Left! Do not lift.'],
  uturn: ['Hand brake. Turn it around.', 'Back the way I came!'],
  donut: ['Round the block. Make them dizzy.', 'Circle. Let the bots chase.'],
};

/** The lines for one report. The first line is spoken at once; the rest answer it. */
export function lines(report: Report, pick: Pick): Line[] {
  switch (report.kind) {
    case 'quiet': {
      if (report.first) return [drone('on station. Watching the junction.')];
      const mempool = report.waiting < 3 ? 'Mempool quiet.' : 'Mempool filling.';
      return [one([
        drone(`${report.waiting} pending at the lights. ${report.gate} open.`),
        drone(`block ${report.block.toLocaleString('en-US')} sealed. ${mempool}`),
        drone(`${report.confirmed} confirmed, ${report.reverted} reverted so far.`),
        drone(`${report.gate} gate open. ${report.waiting} tx waiting.`),
      ], pick)];
    }
    case 'start': return [
      drone(`pending tx, ${report.gate} gate. ${report.cops} ${report.cops === 1 ? 'bot' : 'bots'} on it.`),
      police(`Rolling. ${report.cops} ${report.cops === 1 ? 'unit' : 'units'} in the pool.`, 500),
      racer(one(['Bots behind me. Fee up, go go.', 'They found me. Fee up!'], pick), 1100),
    ];
    case 'junction': {
      const racerLine = one(RACER_TURN[report.route], pick);
      return [drone(one(TURN[report.route](report.index), pick)), racer(racerLine, 600)];
    }
    case 'telemetry': return [
      drone(`fee ${report.fee} gwei, gap ${report.gap} m.`),
      police(report.gap < 40 ? `Gap ${report.gap}. Closing in.` : `Gap ${report.gap}. Push, push.`, 450),
    ];
    case 'nitro': return [racer(one(['Priority fee up. Floor it.', 'Tipping the validators. Go!'], pick)), police('Fee spike. He is pulling away.', 350)];
    case 'slide': return [police(one(['He is sliding wide. Slippage!', 'Slippage! He is all over the road.'], pick), 0, 'UNIT 2'), racer('Slippage! Hold it, hold it.', 350)];
    case 'copSpin': return [
      police(one(['Lost grip. Out of the pool.', 'Spinning! Dropping out.'], pick), 0, `UNIT ${report.unit}`),
      drone(`unit ${report.unit} down. Reorg at junction ${report.junction}.`, 500),
    ];
    case 'pileup': return [police('Contact! Units 1 and 2 are down.'), drone('deep reorg. Two units out.', 400), racer('Both gone. Free road.', 900)];
    case 'pitWin': return [police('Front-run landed. Suspect stopped.'), racer('Front-run! I am spinning...', 400), drone('tx stopped by a front-run.', 700)];
    case 'pitMiss': return [police('Front-run missed. Losing the car.'), racer('Nice try. Still pending.', 300), drone('front-run failed. Reorg, unit down.', 600)];
    case 'wipeout': return [racer('Out of gas! I am rolling!'), drone('suspect out of gas, rolled over.', 400), police('Suspect down. Moving in.', 900)];
    case 'block': return [
      drone(`block on the route, ${report.ahead} m ahead.`),
      racer('Block ahead! Brake! Brake!', 400),
      police('Block is set. Squeeze him.', 700),
    ];
    case 'reverted': return [police('Hit the block. Tx reverted!'), racer('Reverted... it is over.', 300), drone('tx reverted at the block.', 600)];
    case 'escape': return [
      racer(one(['Confirmed! See you next block.', 'In the next block. Bye, bots.'], pick)),
      police(`Lost him. Congestion ${report.heat} of 5.`, 400),
      drone(`tx confirmed. Congestion ${report.heat} of 5.`, 800),
    ];
  }
}

/** Kinds that matter more stay on screen longer. */
const LONG_LIVED: ReportKind[] = ['start', 'pileup', 'pitWin', 'pitMiss', 'wipeout', 'reverted', 'escape', 'block'];

export interface Shown { voice: Voice; tag: string; text: string; age: number; chars: number; alpha: number }

interface Slot { line: Line; at: number; ttl: number }

/** Timing and limits of the on-screen log. */
export const FEED = { max: 4, ttl: 7500, longTtl: 10000, fade: 1200, charMs: 22, dedupe: 1400, queue: 8 } as const;

/** The log itself: lines wait for their turn, appear one by one, and fade out. A repeat of the same kind within a moment is dropped. */
export class Feed {
  private queue: Slot[] = [];
  private shown: Slot[] = [];
  private lastKind = new Map<ReportKind, number>();

  /** Returns false when the report was dropped as a repeat. */
  push(kind: ReportKind, batch: Line[], now: number): boolean {
    const last = this.lastKind.get(kind);
    if (last !== undefined && now - last < FEED.dedupe) return false;
    this.lastKind.set(kind, now);
    const ttl = LONG_LIVED.includes(kind) ? FEED.longTtl : FEED.ttl;
    for (const line of batch) this.queue.push({ line, at: now + line.delay, ttl });
    this.queue.sort((a, b) => a.at - b.at);
    while (this.queue.length > FEED.queue) this.queue.shift();
    return true;
  }

  /** Lines that are due move onto the screen; the oldest are pushed off when there are too many. */
  tick(now: number) {
    while (this.queue.length && this.queue[0]!.at <= now) this.shown.push(this.queue.shift()!);
    this.shown = this.shown.filter((s) => now - s.at < s.ttl);
    while (this.shown.length > FEED.max) this.shown.shift();
  }

  /** What to draw now, oldest first. `chars` is how much of the line is typed so far. */
  visible(now: number): Shown[] {
    this.tick(now);
    return this.shown.map((s) => {
      const age = now - s.at;
      return {
        voice: s.line.voice, tag: s.line.tag, text: s.line.text, age,
        chars: Math.min(s.line.text.length, Math.floor(age / FEED.charMs)),
        alpha: Math.max(0, Math.min(1, (s.ttl - age) / FEED.fade)),
      };
    });
  }

  /** True when nothing is showing or waiting, so idle chatter may start. */
  quiet(now: number): boolean {
    this.tick(now);
    return this.queue.length === 0 && this.shown.every((s) => now - s.at > 2500);
  }
}
