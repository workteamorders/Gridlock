/** The street chase, planned as plain data: which way it goes, how many patrol cars chase, what goes wrong. Pure, so tests can check it. */
export type Route = 'straight' | 'right' | 'left' | 'uturn' | 'donut';
export type MishapKind = 'copSpin' | 'pileup' | 'wipeout' | 'pit';
export interface Mishap { kind: MishapKind; slot: number; offset: number }
export interface Plan {
  route: Route;
  /** Which way the sweep goes for a U-turn or a donut: 1 to the right of travel, -1 to the left. */
  side: 1 | -1;
  cops: 1 | 2 | 3;
  /** Cruising speed in map units per second. */
  speed: number;
  /** Where a burst of nitro fires, in path units from the apex (negative is before it), or null for none. */
  nitro: number | null;
  /** Whether a PIT manoeuvre, if there is one, stops the racer. */
  pitWins: boolean;
  /** Things that go wrong, each firing once, `offset` path units after the apex. */
  mishaps: Mishap[];
}
export interface Vec { x: number; y: number }

export const ROUTES: Route[] = ['straight', 'right', 'left', 'uturn', 'donut'];
export const MISHAPS: MishapKind[] = ['copSpin', 'pileup', 'wipeout', 'pit'];
const ROUTE_WEIGHTS: [Route, number][] = [['straight', 0.2], ['right', 0.25], ['left', 0.25], ['uturn', 0.15], ['donut', 0.15]];
/** How likely the racer is to lose it on top of the base chance: tight bends are riskier. */
const DANGER: Record<Route, number> = { straight: 0, right: 0.1, left: 0.1, uturn: 0.14, donut: 0.18 };

/** A small seeded generator (mulberry32). The page seeds it from the system generator; tests seed it to get repeatable runs. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1]![0];
}

function drawPlan(rng: () => number): Plan {
  const route = pick(rng, ROUTE_WEIGHTS);
  const cops = pick(rng, [[1, 0.2], [2, 0.5], [3, 0.3]] as const) as 1 | 2 | 3;
  const mishaps: Mishap[] = [];
  const mishap = (kind: MishapKind): Mishap => ({
    kind,
    slot: kind === 'pileup' ? 1 : kind === 'copSpin' ? 1 + Math.floor(rng() * cops) : 0,
    offset: Math.round(-20 + rng() * 60),
  });
  const primary = pick<MishapKind | null>(rng, [
    [null, 0.2],
    ['copSpin', 0.22],
    ['wipeout', 0.1 + DANGER[route]],
    ['pit', 0.12],
    [cops > 1 ? 'pileup' : 'copSpin', 0.08],
  ]);
  if (primary) mishaps.push(mishap(primary));
  // Now and then a second thing goes wrong, never two that both stop the racer.
  if (rng() < 0.25) {
    const stops = (kind: MishapKind) => kind === 'wipeout' || kind === 'pit';
    const extra = pick<MishapKind>(rng, [['copSpin', 0.5], ['pileup', cops > 1 ? 0.3 : 0], ['pit', 0.2]]);
    if (!mishaps.some((m) => m.kind === extra) && !(stops(extra) && mishaps.some((m) => stops(m.kind)))) mishaps.push(mishap(extra));
  }
  return {
    route,
    side: rng() < 0.5 ? 1 : -1,
    cops,
    speed: Math.round(150 + rng() * 45),
    nitro: rng() < 0.5 ? Math.round(-40 - rng() * 220) : null,
    pitWins: rng() < 0.55,
    mishaps,
  };
}

/** A short label for a plan. Two plans with the same label would look alike, so a chase never repeats the one before it. */
export const signature = (plan: Plan) =>
  `${plan.route}${plan.route === 'uturn' || plan.route === 'donut' ? plan.side : ''}|${plan.cops}|${plan.mishaps.map((m) => `${m.kind}${m.slot}`).sort().join('+') || 'clean'}`;

export function planChase(rng: () => number, previous?: Plan): Plan {
  for (let attempt = 0; attempt < 16; attempt++) {
    const plan = drawPlan(rng);
    if (!previous || signature(plan) !== signature(previous)) return plan;
  }
  return drawPlan(rng);
}

/** Reads a forced plan such as "uturn,wipeout" or "right,copSpin,pitwin" and lays it over a drawn one. For tests and demos only. */
export function forcePlan(text: string, rng: () => number): Plan {
  const plan = drawPlan(rng);
  const words = text.split(',').map((word) => word.trim());
  const route = words.find((word): word is Route => (ROUTES as string[]).includes(word));
  if (route) plan.route = route;
  const kinds = words.filter((word): word is MishapKind => (MISHAPS as string[]).includes(word));
  // Mishaps of the patrol cars fire early enough that a racer stopped at the apex has not already stopped them.
  if (words.includes('clean') || kinds.length) plan.mishaps = kinds.map((kind) => ({ kind, slot: kind === 'copSpin' || kind === 'pileup' ? 1 : 0, offset: kind === 'copSpin' || kind === 'pileup' ? -70 : 0 }));
  if (plan.mishaps.some((m) => m.kind === 'pileup') && plan.cops < 2) plan.cops = 2;
  if (words.includes('pitwin')) plan.pitWins = true;
  if (words.includes('pitfail')) plan.pitWins = false;
  return plan;
}

export interface Path {
  step: number;
  length: number;
  /** Distance along the path of the middle of the bend, and where it enters and leaves the junction box. */
  apex: number;
  boxIn: number;
  boxOut: number;
  x: Float32Array;
  y: Float32Array;
  /** Heading in radians. */
  h: Float32Array;
  /** Curvature: how fast the heading turns per unit of distance, signed. */
  k: Float32Array;
  at(s: number): { x: number; y: number; h: number; k: number };
}

export interface Geometry {
  mid: Vec;
  /** Distance from the centre to the far end of the arm that lies in this direction. */
  reach(direction: Vec): number;
  /** Half the width of the junction box. */
  box: number;
}

const STEP = 2;
const BEND = 54;

/** Builds the line the cars follow for a plan, entering along `direction`. Everything is in map coordinates. */
export function buildPath(plan: Plan, direction: Vec, geometry: Geometry, lead: number): Path {
  const { mid, reach, box } = geometry;
  const d = direction;
  const n: Vec = { x: -d.y, y: d.x };
  const at = (t: number, l: number): Vec => ({ x: mid.x + d.x * t + n.x * l, y: mid.y + d.y * t + n.y * l });
  const raw: Vec[] = [];
  const mark = { apex: 0, boxIn: 0, boxOut: 0 };
  const length = () => raw.length;
  const line = (from: Vec, to: Vec) => {
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
    for (let i = 0; i < count; i++) raw.push({ x: from.x + ((to.x - from.x) * i) / count, y: from.y + ((to.y - from.y) * i) / count });
  };
  const curve = (points: Vec[]) => {
    const count = 60;
    for (let i = 0; i < count; i++) {
      const u = i / count;
      let layer = points;
      while (layer.length > 1) layer = layer.slice(1).map((p, j) => ({ x: layer[j]!.x + (p.x - layer[j]!.x) * u, y: layer[j]!.y + (p.y - layer[j]!.y) * u }));
      raw.push(layer[0]!);
    }
  };
  const start = -(reach({ x: -d.x, y: -d.y }) + 100 + lead);
  const out = (dir: Vec, lateral: Vec, offset: number): Vec => ({ x: mid.x + dir.x * (reach(dir) + 70) + lateral.x * offset, y: mid.y + dir.y * (reach(dir) + 70) + lateral.y * offset });
  const sign = plan.side;
  switch (plan.route) {
    case 'straight': {
      line(at(start, 0), at(-box, 0));
      mark.boxIn = length();
      line(at(-box, 0), at(box, 0));
      mark.apex = mark.boxIn + box;
      mark.boxOut = length();
      line(at(box, 0), out(d, n, 0));
      break;
    }
    case 'right':
    case 'left': {
      const turn = plan.route === 'right' ? 1 : -1;
      const exit: Vec = { x: n.x * turn, y: n.y * turn };
      line(at(start, 0), at(-BEND, 0));
      mark.boxIn = length() - (BEND - box);
      const bendStart = length();
      curve([at(-BEND, 0), { x: mid.x, y: mid.y }, { x: mid.x + exit.x * BEND, y: mid.y + exit.y * BEND }]);
      mark.apex = bendStart + (length() - bendStart) / 2;
      mark.boxOut = length() + (BEND - box);
      line({ x: mid.x + exit.x * BEND, y: mid.y + exit.y * BEND }, out(exit, d, 0));
      break;
    }
    case 'uturn': {
      const wide = 26;
      line(at(start, 0), at(-BEND - 4, 0));
      mark.boxIn = length() - (BEND + 4 - box);
      const bendStart = length();
      curve([at(-BEND - 4, 0), at(62, 0), at(62, sign * wide), at(-BEND - 4, sign * wide)]);
      mark.apex = bendStart + (length() - bendStart) / 2;
      mark.boxOut = length() + (BEND + 4 - box);
      line(at(-BEND - 4, sign * wide), out({ x: -d.x, y: -d.y }, n, sign * wide));
      break;
    }
    case 'donut': {
      const radius = 36;
      line(at(start, sign * radius), at(0, sign * radius));
      mark.boxIn = length() - (box - 0);
      const arcStart = length();
      const steps = 220;
      for (let i = 0; i < steps; i++) {
        const phi = (i / steps) * Math.PI * 2;
        raw.push(at(radius * Math.sin(phi), sign * radius * Math.cos(phi)));
      }
      mark.apex = arcStart + steps / 2;
      mark.boxOut = length() + box;
      line(at(0, sign * radius), out(d, n, sign * radius));
      break;
    }
  }

  // Resample at an even spacing so a distance along the path is a distance on the ground.
  const cumulative = [0];
  for (let i = 1; i < raw.length; i++) cumulative.push(cumulative[i - 1]! + Math.hypot(raw[i]!.x - raw[i - 1]!.x, raw[i]!.y - raw[i - 1]!.y));
  const total = cumulative[cumulative.length - 1]!;
  const count = Math.floor(total / STEP) + 1;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  let source = 0;
  for (let i = 0; i < count; i++) {
    const target = i * STEP;
    while (source < raw.length - 2 && cumulative[source + 1]! < target) source++;
    const span = cumulative[source + 1]! - cumulative[source]! || 1;
    const u = Math.min(1, Math.max(0, (target - cumulative[source]!) / span));
    x[i] = raw[source]!.x + (raw[source + 1]!.x - raw[source]!.x) * u;
    y[i] = raw[source]!.y + (raw[source + 1]!.y - raw[source]!.y) * u;
  }
  const h = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 1);
    h[i] = Math.atan2(y[b]! - y[a]!, x[b]! - x[a]!);
  }
  const k = new Float32Array(count);
  const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 4);
    const b = Math.min(count - 1, i + 4);
    k[i] = b > a ? wrap(h[b]! - h[a]!) / ((b - a) * STEP) : 0;
  }
  const last = count - 1;
  const lookup = (s: number) => {
    const f = s / STEP;
    if (f <= 0) return { x: x[0]! + Math.cos(h[0]!) * s, y: y[0]! + Math.sin(h[0]!) * s, h: h[0]!, k: 0 };
    if (f >= last) return { x: x[last]! + Math.cos(h[last]!) * (s - last * STEP), y: y[last]! + Math.sin(h[last]!) * (s - last * STEP), h: h[last]!, k: 0 };
    const i = Math.floor(f);
    const u = f - i;
    return {
      x: x[i]! + (x[i + 1]! - x[i]!) * u,
      y: y[i]! + (y[i + 1]! - y[i]!) * u,
      h: h[i]! + wrap(h[i + 1]! - h[i]!) * u,
      k: k[i]! + (k[i + 1]! - k[i]!) * u,
    };
  };
  const toS = (index: number) => cumulative[Math.min(raw.length - 1, Math.max(0, Math.round(index)))]!;
  return { step: STEP, length: total, apex: toS(mark.apex), boxIn: toS(mark.boxIn), boxOut: toS(mark.boxOut), x, y, h, k, at: lookup };
}
