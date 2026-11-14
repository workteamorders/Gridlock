/**
 * The radio traffic of the drone feed: short exchanges between the police drone operator and patrol units that report what is happening in the junction, in blockchain terms. Pure data and logic, so tests can check it.
 * Everything here is fiction written for a picture: the numbers come from the animation, not from any chain.
 */
import type { Route } from './chase-plan';

export type Voice = 'drone' | 'police';

/** One line of radio. `delay` staggers the voices of one report so they answer each other, a few hundred milliseconds apart. */
export type Emotion = 'calm' | 'urgent' | 'panic' | 'relieved' | 'frustrated';
export interface Line { emotion?: Emotion; voice: Voice; tag: string; text: string; delay: number }

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

const drone = (text: string, delay = 0): Line => ({ voice: 'drone', tag: DRONE, text, delay });
const police = (text: string, delay = 0, unit = UNIT): Line => ({ voice: 'police', tag: unit, text, delay });
const observer = (text: string, delay = 0): Line => police(text, delay, 'UNIT 2');

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
const PURSUIT_TURN: Record<Route, string[]> = {
  straight: ['Suspect straight ahead. Accelerating.'],
  right: ['He is taking a tight right.', 'Right turn! He is not slowing down.'],
  left: ['He is taking a tight left.', 'Left turn! He is not slowing down.'],
  uturn: ['Handbrake turn. He is coming back!', 'Suspect has reversed direction.'],
  donut: ['He is circling. Keep eyes on him.', 'Suspect circling the same block.'],
};

/** The lines for one report. The first line is spoken at once; the rest answer it. */
function reportLines(report: Report, pick: Pick): Line[] {
  switch (report.kind) {
    case 'quiet': {
      if (report.first) return [drone('on station. Watching the junction.')];
      const queue = report.waiting < 3 ? 'Queue quiet.' : 'Queue filling.';
      return [one([
        drone(`${report.waiting} pending at the lights. ${report.gate} open.`),
        drone(`block ${report.block.toLocaleString('en-US')} sealed. ${queue}`),
        drone(`${report.confirmed} confirmed, ${report.reverted} reverted so far.`),
        drone(`${report.gate} gate open. ${report.waiting} tx waiting.`),
      ], pick)];
    }
    case 'start': return [
      drone(`pending tx, ${report.gate} gate. ${report.cops} ${report.cops === 1 ? 'bot' : 'bots'} on it.`),
      police(`Rolling. ${report.cops} ${report.cops === 1 ? 'unit' : 'units'} in the queue.`, 500),
      observer(one(['Suspect accelerating. Staying with him.', 'He is speeding up. Maintaining visual.'], pick), 1100),
    ];
    case 'junction': {
      const pursuitLine = one(PURSUIT_TURN[report.route], pick);
      return [drone(one(TURN[report.route](report.index), pick)), observer(pursuitLine, 600)];
    }
    case 'telemetry': return [
      drone(`fee ${report.fee} gwei, gap ${report.gap} m.`),
      police(report.gap < 40 ? `Gap ${report.gap}. Closing in.` : `Gap ${report.gap}. Push, push.`, 450),
    ];
    case 'nitro': return [observer(one(['He has hit the gas. Rapid acceleration!', 'Suspect using boost. Speed increasing.'], pick)), police('Gas spike. He is pulling away.', 350)];
    case 'slide': return [police(one(['He is sliding wide. Slippage!', 'Slippage! He is all over the road.'], pick), 0, 'UNIT 2'), police('Copy. Suspect losing traction.', 350)];
    case 'copSpin': return [
      police(one(['Lost grip. Out of the queue.', 'Spinning! Dropping out.'], pick), 0, `UNIT ${report.unit}`),
      drone(`unit ${report.unit} down. Reorg at junction ${report.junction}.`, 500),
    ];
    case 'pileup': return [police('Contact! Units 1 and 2 are down.'), drone('deep reorg. Two units out.', 400), observer('Suspect clear of the wreckage.', 900)];
    case 'pitWin': return [police('Cut-off landed. Suspect stopped.'), observer('His car is spinning. He is stopped.', 400), drone('tx stopped by a cut-off.', 700)];
    case 'pitMiss': return [police('Cut-off missed. Losing the car.'), observer('He avoided contact. Still moving.', 300), drone('cut-off failed. Reorg, unit down.', 600)];
    case 'wipeout': return [observer('Suspect rolling over! Vehicle down!'), drone('suspect out of gas, rolled over.', 400), police('Suspect down. Moving in.', 900)];
    case 'block': return [
      drone(`block on the route, ${report.ahead} m ahead.`),
      observer('Suspect approaching the roadblock.', 400),
      police('Block is set. Squeeze him.', 700),
    ];
    case 'reverted': return [police('Hit the block. Tx reverted!'), observer('Vehicle stopped against the block.', 300), drone('tx reverted at the block.', 600)];
    case 'escape': return [
      observer(one(['Suspect has cleared the perimeter.', 'He is through. We have lost visual.'], pick)),
      police(`Lost him. Congestion ${report.heat} of 5.`, 400),
      drone(`tx confirmed. Congestion ${report.heat} of 5.`, 800),
    ];
  }
}

/** Delivery follows the event, while the displayed/spoken wording stays identical. */
export function lines(report: Report, pick: Pick): Line[] {
  return reportLines(report, pick).map(line => {
    let emotion: Emotion = 'calm';
    if (['start', 'junction', 'telemetry', 'nitro', 'block', 'pitMiss'].includes(report.kind)) emotion = 'urgent';
    if (['slide', 'copSpin', 'pileup', 'wipeout'].includes(report.kind)) emotion = line.voice === 'drone' ? 'urgent' : 'panic';
    if (report.kind === 'pitWin' || report.kind === 'reverted') emotion = 'relieved';
    if (report.kind === 'escape') emotion = line.voice === 'police' ? 'frustrated' : 'relieved';
    return { ...line, emotion };
  });
}

/** Kinds that matter more stay on screen longer. */
const LONG_LIVED: ReportKind[] = ['start', 'pileup', 'pitWin', 'pitMiss', 'wipeout', 'reverted', 'escape', 'block'];

export interface Shown { voice: Voice; tag: string; text: string; age: number; chars: number; alpha: number }

interface Slot { line: Line; at: number; ttl: number }

/** Timing and limits of the on-screen log. */
export const FEED = { max: 4, ttl: 7500, longTtl: 10000, fade: 1200, charMs: 22, dedupe: 1400, queue: 8 } as const;

/** The log itself: lines wait for their turn, appear one by one, and fade out. A repeat of the same kind within a moment is dropped. */
export class Feed {
  private present?: (line: Line) => boolean;
  private holding?: () => boolean;
  constructor(present?: (line: Line) => boolean, holding?: () => boolean) {
    this.present = present;
    this.holding = holding;
  }

  clearPending() { this.queue = []; }

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
    while (this.queue.length && this.queue[0]!.at <= now) {
      const next = this.queue[0]!;
      if (this.present && !this.present(next.line)) break;
      this.queue.shift();
      // Speech may have delayed this line: its reading time starts when it actually appears.
      this.shown.push(this.present ? { ...next, at: now } : next);
    }
    const speaking = this.holding?.() ? this.shown.at(-1) : undefined;
    this.shown = this.shown.filter((s) => s === speaking || now - s.at < s.ttl);
    while (this.shown.length > FEED.max) this.shown.shift();
  }

  /** What to draw now, oldest first. `chars` is how much of the line is typed so far. */
  visible(now: number): Shown[] {
    this.tick(now);
    return this.shown.map((s) => {
      const age = now - s.at;
      return {
        voice: s.line.voice, tag: s.line.tag, text: s.line.text, age,
        chars: this.holding?.() && s === this.shown.at(-1) ? s.line.text.length : Math.min(s.line.text.length, Math.floor(age / FEED.charMs)),
        alpha: this.holding?.() && s === this.shown.at(-1) ? 1 : Math.max(0, Math.min(1, (s.ttl - age) / FEED.fade)),
      };
    });
  }

  /** True when nothing is showing or waiting, so idle chatter may start. */
  quiet(now: number): boolean {
    this.tick(now);
    return this.queue.length === 0 && this.shown.every((s) => now - s.at > 2500);
  }
}
