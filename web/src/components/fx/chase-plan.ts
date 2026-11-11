/** The street chase, planned as plain data: which way it goes, how many patrol cars chase, what goes wrong. Pure, so tests can check it. */
export type Route = 'straight' | 'right' | 'left' | 'uturn' | 'donut';
export type MishapKind = 'copSpin' | 'pileup' | 'wipeout' | 'pit';
export interface Mishap { kind: MishapKind; slot: number; offset: number; /** Which junction of the chase it happens at: 0 is the first. */ leg: number }
export interface Leg { route: Route; side: 1 | -1 }
export interface Plan {
  route: Route;
  /** Which way the sweep goes for a U-turn or a donut: 1 to the right of travel, -1 to the left. */
  side: 1 | -1;
  /** What happens at the junctions after the first, one entry each. */
  then: Leg[];
  cops: 1 | 2 | 3;
  /** Cruising speed in map units per second. */
  speed: number;
  /** Where a burst of nitro fires, in path units from the apex of the first junction (negative is before it), or null for none. */
  nitro: number | null;
  /** Whether a PIT manoeuvre, if there is one, stops the racer. */
  pitWins: boolean;
  /** Things that go wrong, each firing once, `offset` path units after the apex of its junction. */
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

const LATER_ROUTES: [Route, number][] = [['straight', 0.3], ['right', 0.25], ['left', 0.25], ['uturn', 0.1], ['donut', 0.1]];

function drawPlan(rng: () => number): Plan {
  const route = pick(rng, ROUTE_WEIGHTS);
  const cops = pick(rng, [[1, 0.2], [2, 0.5], [3, 0.3]] as const) as 1 | 2 | 3;
  const later = pick(rng, [[0, 0.15], [1, 0.55], [2, 0.3]] as const);
  const then: Leg[] = Array.from({ length: later }, () => ({ route: pick(rng, LATER_ROUTES), side: rng() < 0.5 ? 1 : -1 }));
  const routes = [route, ...then.map((leg) => leg.route)];
  const mishaps: Mishap[] = [];
  const mishap = (kind: MishapKind, leg: number): Mishap => ({
    kind,
    slot: kind === 'pileup' ? 1 : kind === 'copSpin' ? 1 + Math.floor(rng() * cops) : 0,
    offset: Math.round(-20 + rng() * 60),
    leg,
  });
  const leg = Math.floor(rng() * routes.length);
  const primary = pick<MishapKind | null>(rng, [
    [null, 0.2],
    ['copSpin', 0.22],
    ['wipeout', 0.1 + DANGER[routes[leg]!]],
    ['pit', 0.12],
    [cops > 1 ? 'pileup' : 'copSpin', 0.08],
  ]);
  if (primary) mishaps.push(mishap(primary, leg));
  // Now and then a second thing goes wrong, never two that both stop the racer.
  if (rng() < 0.25) {
    const stops = (kind: MishapKind) => kind === 'wipeout' || kind === 'pit';
    const extra = pick<MishapKind>(rng, [['copSpin', 0.5], ['pileup', cops > 1 ? 0.3 : 0], ['pit', 0.2]]);
    if (!mishaps.some((m) => m.kind === extra) && !(stops(extra) && mishaps.some((m) => stops(m.kind)))) mishaps.push(mishap(extra, Math.floor(rng() * routes.length)));
  }
  return {
    route,
    side: rng() < 0.5 ? 1 : -1,
    then,
    cops,
    speed: Math.round(150 + rng() * 45),
    nitro: rng() < 0.5 ? Math.round(-40 - rng() * 220) : null,
    pitWins: rng() < 0.55,
    mishaps,
  };
}

/** A short label for a plan. Two plans with the same label would look alike, so a chase never repeats the one before it. */
const legLabel = (leg: Leg) => `${leg.route}${leg.route === 'uturn' || leg.route === 'donut' ? leg.side : ''}`;
export const signature = (plan: Plan) =>
  `${[{ route: plan.route, side: plan.side }, ...plan.then].map(legLabel).join('>')}|${plan.cops}|${plan.mishaps.map((m) => `${m.kind}${m.slot}@${m.leg}`).sort().join('+') || 'clean'}`;

export function planChase(rng: () => number, previous?: Plan): Plan {
  for (let attempt = 0; attempt < 16; attempt++) {
    const plan = drawPlan(rng);
    if (!previous || signature(plan) !== signature(previous)) return plan;
  }
  return drawPlan(rng);
}

/** Reads a forced plan such as "uturn,wipeout" or "right,left,copSpin,pitwin" and lays it over a drawn one. The first route is the home junction, any more are the junctions after it. For tests and demos only. */
export function forcePlan(text: string, rng: () => number): Plan {
  const plan = drawPlan(rng);
  const words = text.split(',').map((word) => word.trim());
  const routes = words.filter((word): word is Route => (ROUTES as string[]).includes(word));
  if (routes.length) {
    plan.route = routes[0]!;
    plan.then = routes.slice(1).map((route, index) => ({ route, side: plan.then[index]?.side ?? 1 }));
  }
  const kinds = words.filter((word): word is MishapKind => (MISHAPS as string[]).includes(word));
  // Mishaps of the patrol cars fire early enough that a racer stopped at the apex has not already stopped them.
  const copKind = (kind: MishapKind) => kind === 'copSpin' || kind === 'pileup';
  if (words.includes('clean') || kinds.length) plan.mishaps = kinds.map((kind) => ({ kind, slot: copKind(kind) ? 1 : 0, offset: copKind(kind) ? -70 : 0, leg: 0 }));
  const late = words.find((word) => /^leg\d$/.test(word));
  if (late) for (const m of plan.mishaps) m.leg = Math.min(Number(late.slice(3)), plan.then.length);
  if (plan.mishaps.some((m) => m.kind === 'pileup') && plan.cops < 2) plan.cops = 2;
  if (words.includes('pitwin')) plan.pitWins = true;
  if (words.includes('pitfail')) plan.pitWins = false;
  return plan;
}

export interface Path {
  step: number;
  length: number;
  /** The first junction: where the bend is in the middle, and where the path enters and leaves its box. */
  apex: number;
  boxIn: number;
  boxOut: number;
  /** Every junction the path goes through, in order. */
  legs: { center: Vec; apex: number; boxIn: number; boxOut: number }[];
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
  /** Distance between one junction and the next along this direction. */
  spacing(direction: Vec): number;
  /** Half the width of the junction box. */
  box: number;
}

const STEP = 2;
const BEND = 54;
const ENTRY = 90;
const TAIL = 300;
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Builds the line the cars follow for a plan: in along `direction`, through the first junction and on to the next ones. Everything is in map coordinates. */
export function buildPath(plan: Plan, direction: Vec, geometry: Geometry, lead: number): Path {
  const { mid, reach, spacing, box } = geometry;
  const raw: Vec[] = [];
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
  const legsSpec: Leg[] = [{ route: plan.route, side: plan.side }, ...plan.then];
  const marks: { center: Vec; apex: number; boxIn: number; boxOut: number }[] = [];
  let d = direction;
  let centre = mid;
  const radius = 36;
  const wide = 26;
  const entryLane = (leg: Leg) => (leg.route === 'donut' ? leg.side * radius : 0);
  const first = entryLane(legsSpec[0]!);
  {
    const n: Vec = { x: -d.y, y: d.x };
    const t = -(reach({ x: -d.x, y: -d.y }) + 100 + lead);
    line({ x: centre.x + d.x * t + n.x * first, y: centre.y + d.y * t + n.y * first }, { x: centre.x - d.x * ENTRY + n.x * first, y: centre.y - d.y * ENTRY + n.y * first });
  }
  for (let k = 0; k < legsSpec.length; k++) {
    const leg = legsSpec[k]!;
    const n: Vec = { x: -d.y, y: d.x };
    const J = centre;
    const dir = d;
    const at = (t: number, l: number): Vec => ({ x: J.x + dir.x * t + n.x * l, y: J.y + dir.y * t + n.y * l });
    const mark = { center: J, apex: 0, boxIn: 0, boxOut: 0 };
    let exitDir = dir;
    let exitPoint = at(ENTRY, 0);
    switch (leg.route) {
      case 'straight': {
        line(at(-ENTRY, 0), at(-box, 0));
        mark.boxIn = length();
        line(at(-box, 0), at(box, 0));
        mark.apex = mark.boxIn + box;
        mark.boxOut = length();
        line(at(box, 0), at(ENTRY, 0));
        break;
      }
      case 'right':
      case 'left': {
        const turn = leg.route === 'right' ? 1 : -1;
        const out: Vec = { x: n.x * turn, y: n.y * turn };
        line(at(-ENTRY, 0), at(-BEND, 0));
        mark.boxIn = length() - (BEND - box);
        const bendStart = length();
        curve([at(-BEND, 0), J, { x: J.x + out.x * BEND, y: J.y + out.y * BEND }]);
        mark.apex = bendStart + (length() - bendStart) / 2;
        mark.boxOut = length() + (BEND - box);
        line({ x: J.x + out.x * BEND, y: J.y + out.y * BEND }, { x: J.x + out.x * ENTRY, y: J.y + out.y * ENTRY });
        exitDir = out;
        exitPoint = { x: J.x + out.x * ENTRY, y: J.y + out.y * ENTRY };
        break;
      }
      case 'uturn': {
        line(at(-ENTRY, 0), at(-BEND - 4, 0));
        mark.boxIn = length() - (BEND + 4 - box);
        const bendStart = length();
        curve([at(-BEND - 4, 0), at(62, 0), at(62, leg.side * wide), at(-BEND - 4, leg.side * wide)]);
        mark.apex = bendStart + (length() - bendStart) / 2;
        mark.boxOut = length() + (BEND + 4 - box);
        line(at(-BEND - 4, leg.side * wide), at(-ENTRY, leg.side * wide));
        exitDir = { x: -dir.x, y: -dir.y };
        exitPoint = at(-ENTRY, leg.side * wide);
        break;
      }
      case 'donut': {
        const lane = leg.side * radius;
        line(at(-ENTRY, lane), at(0, lane));
        mark.boxIn = length() - box;
        const arcStart = length();
        const steps = 220;
        for (let i = 0; i < steps; i++) {
          const phi = (i / steps) * Math.PI * 2;
          raw.push(at(radius * Math.sin(phi), leg.side * radius * Math.cos(phi)));
        }
        mark.apex = arcStart + steps / 2;
        mark.boxOut = length() + box;
        line(at(0, lane), at(ENTRY, lane));
        exitPoint = at(ENTRY, lane);
        break;
      }
    }
    marks.push(mark);
    if (k < legsSpec.length - 1) {
      // On to the next junction: a straight run that eases sideways to the lane the next bend starts in.
      const next = legsSpec[k + 1]!;
      const d2 = exitDir;
      const n2: Vec = { x: -d2.y, y: d2.x };
      const gap = spacing(d2);
      const offset = (p: Vec) => (p.x - J.x) * n2.x + (p.y - J.y) * n2.y;
      const along = (p: Vec) => (p.x - J.x) * d2.x + (p.y - J.y) * d2.y;
      const l0 = offset(exitPoint);
      const l1 = entryLane(next);
      const t0 = along(exitPoint);
      const t1 = gap - ENTRY;
      const steps = Math.ceil(t1 - t0);
      for (let i = 0; i < steps; i++) {
        const u = i / steps;
        const t = t0 + (t1 - t0) * u;
        const l = l0 + (l1 - l0) * smooth(u);
        raw.push({ x: J.x + d2.x * t + n2.x * l, y: J.y + d2.y * t + n2.y * l });
      }
      centre = { x: J.x + d2.x * gap, y: J.y + d2.y * gap };
      d = d2;
    } else {
      line(exitPoint, { x: exitPoint.x + exitDir.x * TAIL, y: exitPoint.y + exitDir.y * TAIL });
      raw.push({ x: exitPoint.x + exitDir.x * TAIL, y: exitPoint.y + exitDir.y * TAIL });
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
  const legs = marks.map((m) => ({ center: m.center, apex: toS(m.apex), boxIn: toS(m.boxIn), boxOut: toS(m.boxOut) }));
  return { step: STEP, length: total, apex: legs[0]!.apex, boxIn: legs[0]!.boxIn, boxOut: legs[0]!.boxOut, legs, x, y, h, k, at: lookup };
}
