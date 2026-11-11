import { carBodies, carWindows, liveries } from '@/art/cars';
import { frameGovernor } from './governor';
import { buildPath, forcePlan, mulberry32, planChase, signature, type Mishap, type Path, type Plan, type Vec } from './chase-plan';

const WIDTH = 560;
const HEIGHT = 360;
const MID_X = WIDTH / 2;
const MID_Y = HEIGHT / 2;
const ROAD_EDGE = 62;
const STOP = -78;
const GAP = 35;
const LANE = 17;
const DETOUR = 44;
const CARS_PER_APPROACH = 4;
const GREEN_TIME = 4500;
const CLEAR_TIME = 1700;
const SIGNAL_PHASE = GREEN_TIME + CLEAR_TIME;
const CONE_LIFE = 4600;
/** A slow stretch stops the animation, but not for good: it tries again after this long, up to RETRIES times. */
const RETRY_AFTER = 6000;
const RETRIES = 4;
/** The street chase: a racer in front, two patrol cars behind, all in the middle of the road. */
const CRUISE_REFERENCE = 165;
const CHASE_GAP = 46;
/** How far ahead of the racer's start the path begins, so the patrol cars have road under them too. */
const CHASE_LEAD = 150;
const BUST_SHOW = 2600;
const FLASH_MS = 200;
/** The drone camera: how far in it may zoom, how much it may roll, and how sharp the backdrop is kept for zooming. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 1.8;
const PATROL_ZOOM = 1.2;
const ROLL_MAX = 0.045;
const MAP_OVERSAMPLE = 1.5;
const MAP_MAX_PIXELS = 3200;
const SKID_LIFE = 3400;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const approaches = [
  { x: 1, y: 0, angle: 0, end: MID_X + 32 },
  { x: 0, y: 1, angle: Math.PI / 2, end: MID_Y + 32 },
  { x: -1, y: 0, angle: Math.PI, end: MID_X + 32 },
  { x: 0, y: -1, angle: -Math.PI / 2, end: MID_Y + 32 },
];

export function startJunction(canvas: HTMLCanvasElement) {
  const stage = canvas.parentElement;
  const ctx = canvas.getContext('2d', { alpha: false });
  const map = document.createElement('canvas');
  const backdrop = map.getContext('2d');
  if (!stage || !ctx || !backdrop) return;
  const figure = stage.parentElement;

  const css = getComputedStyle(document.documentElement);
  const color = (token: string) => css.getPropertyValue(token).trim();
  const ink = color('--surface');
  const paper = color('--surface-2');
  const roof = color('--surface-3');
  const cream = color('--text');
  const border = color('--line-dim');
  const yellow = color('--action');
  const red = color('--brush');
  const green = color('--ok');
  const blue = color('--info');
  const orange = color('--car-orange');
  const teal = color('--car-teal');
  // Civilians keep to calm colours so nothing but the patrol cars is red and blue, and nothing but the racer is orange.
  const civilPaint = ['--action', '--text', '--ok', '--text-dim', '--car-teal'].map(color);
  const bodies = carBodies.map((path) => new Path2D(path));
  const glass = carWindows.map((path) => new Path2D(path));
  const stripes = liveries.map((path) => new Path2D(path));
  const dots = new Path2D();
  for (let row = 5; row < HEIGHT; row += 9) {
    for (let col = 5; col < WIDTH; col += 9) {
      dots.moveTo(col + 1.4, row);
      dots.arc(col, row, 1.4, 0, Math.PI * 2);
    }
  }
  // Cache the spotlight texture and the detailed silhouettes outside the frame loop.
  const spotlight = document.createElement('canvas');
  spotlight.width = WIDTH;
  spotlight.height = HEIGHT;
  const texture = spotlight.getContext('2d');
  if (texture) {
    texture.fillStyle = yellow;
    texture.globalAlpha = 0.35;
    texture.fill(dots);
  }
  const display = color('--font-display');
  /** A soft round glow, built from stacked faint discs so no colour with transparency is needed. */
  const glowSprite = (tint: string) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = tint;
      g.globalAlpha = 0.07;
      for (let r = 30; r >= 6; r -= 4) { g.beginPath(); g.arc(32, 32, r, 0, Math.PI * 2); g.fill(); }
    }
    return c;
  };
  const glows = { yellow: glowSprite(yellow), red: glowSprite(red), green: glowSprite(green), blue: glowSprite(blue), teal: glowSprite(teal) };
  /** Headlight cone, drawn in front of a car. Fades out along its length in slices. */
  const beam = document.createElement('canvas');
  beam.width = 96;
  beam.height = 64;
  const beamContext = beam.getContext('2d');
  if (beamContext) {
    beamContext.fillStyle = yellow;
    for (let k = 0; k < 16; k++) {
      const x0 = k * 6;
      const x1 = x0 + 6.5;
      const half0 = 4 + (x0 / 96) * 14;
      const half1 = 4 + (x1 / 96) * 14;
      beamContext.globalAlpha = 0.3 * (1 - k / 16) ** 1.4;
      beamContext.beginPath();
      beamContext.moveTo(x0, 32 - half0);
      beamContext.lineTo(x1, 32 - half1);
      beamContext.lineTo(x1, 32 + half1);
      beamContext.lineTo(x0, 32 + half0);
      beamContext.fill();
    }
  }
  /** Comic shading: a field of small dots, laid over the lower half of each car. */
  const shade = new Path2D();
  for (let row = 1; row < 15; row += 3) {
    for (let col = -32; col < 32; col += 3) {
      const offset = (row / 3) % 2 ? 1.5 : 0;
      shade.moveTo(col + offset + 0.8, row);
      shade.arc(col + offset, row, 0.8, 0, Math.PI * 2);
    }
  }
  const SPRITE_SCALE = 2;
  const buildSprite = (i: number, fill: string, extra?: (g: CanvasRenderingContext2D) => void) => {
    const sprite = document.createElement('canvas');
    sprite.width = 72 * SPRITE_SCALE;
    sprite.height = 42 * SPRITE_SCALE;
    const g = sprite.getContext('2d');
    if (!g) return sprite;
    g.scale(SPRITE_SCALE, SPRITE_SCALE);
    g.translate(36, 21);
    const body = bodies[i % bodies.length]!;
    const glassShape = glass[i % glass.length]!;
    // Ink drop shadow, offset like a printed second plate.
    g.save();
    g.translate(2.5, 3);
    g.fillStyle = ink;
    g.fill(body);
    g.restore();
    // Wheels poke out above and below the body.
    g.fillStyle = ink;
    g.strokeStyle = border;
    g.lineWidth = 1.2;
    for (const wheel of [-25, 10]) {
      for (const top of [-16, 8]) {
        g.fillRect(wheel, top, 13, 8);
        g.strokeRect(wheel, top, 13, 8);
      }
    }
    g.fillStyle = fill;
    g.fill(body);
    extra?.(g);
    // Halftone shade on the lower half, clipped to the body.
    g.save();
    g.clip(body);
    g.fillStyle = ink;
    g.globalAlpha = 0.42;
    g.fill(shade);
    g.restore();
    g.strokeStyle = ink;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.stroke(body);
    // Glass with two glare strokes, then the livery.
    g.fillStyle = ink;
    g.fill(glassShape);
    g.save();
    g.clip(glassShape);
    g.strokeStyle = cream;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-14, 10); g.lineTo(-2, -10);
    g.moveTo(-8, 10); g.lineTo(4, -10);
    g.stroke();
    g.restore();
    g.fillStyle = ink;
    g.fill(stripes[i % stripes.length]!);
    // Specular streak along the roof edge, and two warm headlights at the nose.
    g.strokeStyle = cream;
    g.globalAlpha = 0.85;
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-16, -11); g.lineTo(6, -11);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = yellow;
    g.fillRect(27, -9, 3, 4);
    g.fillRect(27, 5, 3, 4);
    return sprite;
  };
  const sprites = Array.from({ length: approaches.length * CARS_PER_APPROACH }, (_, i) => buildSprite(i, civilPaint[i % civilPaint.length]!));
  // The racer: the low wedge body in orange, a cream racing stripe and a big rear wing.
  const racerSprite = buildSprite(5, orange, (g) => {
    g.save();
    g.clip(bodies[5]!);
    g.fillStyle = cream;
    g.fillRect(-32, -3.4, 64, 2.4);
    g.fillRect(-32, 1, 64, 2.4);
    g.restore();
    g.fillStyle = ink;
    g.fillRect(-37, -12, 7, 24);
    g.fillStyle = yellow;
    g.fillRect(-37, -12, 2.4, 24);
  });
  // The patrol car: a white saloon with black hood and boot, and a dark housing for the light bar.
  const copSprite = buildSprite(4, cream, (g) => {
    g.save();
    g.clip(bodies[4]!);
    g.fillStyle = ink;
    g.fillRect(14, -14, 20, 28);
    g.fillRect(-32, -14, 11, 28);
    g.restore();
    g.fillStyle = ink;
    g.fillRect(-10, -12, 11, 24);
  });
  const cars = Array.from({ length: approaches.length * CARS_PER_APPROACH }, (_, i) => ({
    pos: STOP - (i % CARS_PER_APPROACH) * GAP,
    lane: LANE,
    speed: 0,
    cruise: 117 + i % 4 * 9,
    puffAt: 0,
    honked: false,
  }));
  const puffs: { x: number; y: number; vx: number; vy: number; born: number }[] = [];
  const bursts: { x: number; y: number; word: string; born: number; rot: number }[] = [];
  let lastBurst = -1e9;
  let lastGreen = -1;
  const cones = approaches.map(() => ({ pos: 0, until: 0 }));
  const debug = /^(debug|off)$/.test(new URLSearchParams(location.search).get('motion') ?? '')
    ? { frames: 0, times: [] as number[], interactions: 0, brakes: 0, cones: 0, detours: 0, axis: 0, chases: 0, busted: 0, escaped: 0, heat: 0, plans: [] as string[], outcomes: [] as string[], crashes: 0, drifts: 0, blocks: 0, chasing: 0, racerX: 0, racerY: 0, zoom: 1, camX: 280, camY: 180, roll: 0 }
    : undefined;
  const host = window as Window & { __fx?: typeof debug };
  if (debug) host.__fx = debug;
  let x = -1;
  let y = -1;
  let pressX = -1;
  let pressY = -1;
  let time = 0;
  let lastFrame = 0;
  let frameId = 0;
  let visible = true;
  let active = false;
  let exhausted = false;
  let retries = 0;
  let retryTimer = 0;
  let effects = cars.length;
  let nextApproach = 0;
  let sized = false;
  // Screen-space layer for the camera look (vignette and scan lines), painted once per size.
  const overlay = document.createElement('canvas');
  let base = { scale: 1, ox: 0, oy: 0 };
  const cam = { x: MID_X, y: MID_Y, zoom: 1, roll: 0, vx: 0, vy: 0, vzoom: 0, vroll: 0 };
  /** The camera as drawn this frame: the steady camera plus hand-held shake. */
  const shot = { x: MID_X, y: MID_Y, cx: MID_X, cy: MID_Y, zoom: 1, roll: 0 };
  let kick = 0;
  let kickAt = -1e9;
  let gustAt = 3200;
  let gustStart = -1e9;
  const skids: { x1: number; y1: number; x2: number; y2: number; born: number }[] = [];
  const governor = frameGovernor(cars.length);

  /** Roadblocks put on the racer's route by the pointer or the Drop cone button, anywhere along it. */
  const blocks: { x: number; y: number; s: number; heading: number; until: number }[] = [];
  /** Ordinary traffic on the roads around the home junction, so the town does not go quiet when the camera follows a chase away. */
  const ambient = Array.from({ length: 18 }, (_, i) => ({
    horizontal: i % 2 === 0,
    dir: (i >> 1) % 2 ? 1 : -1,
    u: (i * 331) % 1680,
    speed: 62 + ((i * 13) % 40),
    offset: (i % 3) - 1,
    sprite: (i * 5) % (approaches.length * CARS_PER_APPROACH),
  }));
  type Outcome = 'escaped' | 'cone' | 'wipeout' | 'pit';
  interface Actor {
    slot: number; s: number; lane: number; speed: number; spin: number; spinDir: number;
    x: number; y: number; heading: number;
    crashed: boolean; crashAt: number; rollAt: number;
    skid: ([number, number] | undefined)[];
  }
  interface Chase {
    plan: Plan; path: Path; approach: number; state: 'run' | 'busted'; cause: Outcome;
    since: number; bustedAt: number; nitroUntil: number; nitroDone: boolean; sirenAgain: boolean; smokeAt: number; slid: boolean;
    fired: boolean[]; focus?: { actor: Actor; until: number }; zoomBase: number; actors: Actor[];
  }
  const params = new URLSearchParams(location.search);
  // Every chase is drawn from a random generator seeded by the system, so no two sessions play alike. Debug pages may fix the seed or the plan for tests.
  const seedText = debug ? params.get('seed') : null;
  const rng = mulberry32(seedText ? Number(seedText) : (globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now()));
  const forced = debug ? (params.get('plan') ?? '').split(';').filter(Boolean) : [];
  const geometry = { mid: { x: MID_X, y: MID_Y }, box: 49, reach: (d: Vec) => (d.x !== 0 ? MID_X + 32 : MID_Y + 32), spacing: (d: Vec) => (d.x !== 0 ? WIDTH : HEIGHT) };
  let chase: Chase | undefined;
  let lastPlan: Plan | undefined;
  let chaseCount = 0;
  let nextChase = 500 + rng() * 1800;
  let heat = 0;
  /** Time spent holding the traffic lights while a chase crosses the junction, so the crossing traffic never meets it. */
  let held = 0;
  const at = (a: (typeof approaches)[number], pos: number, lane: number): [number, number] => [MID_X + a.x * pos - a.y * lane, MID_Y + a.y * pos + a.x * lane];
  const mark = (name: string, value: string) => { if (value) figure?.setAttribute(name, value); else figure?.removeAttribute(name); };
  const announce = (phase: 'siren' | 'busted' | 'crash' | 'skid') => window.dispatchEvent(new CustomEvent('gridlock:chase', { detail: phase }));
  mark('data-heat', '0');

  /** Puts a car on the path: its place along it, sideways by `lane`, nose turned by `spin` (a drift). */
  function settle(actor: Actor, path: Path) {
    const p = path.at(actor.s);
    actor.x = p.x - Math.sin(p.h) * actor.lane;
    actor.y = p.y + Math.cos(p.h) * actor.lane;
    actor.heading = p.h + actor.spin;
  }

  function startChase(approach: number) {
    const a = approaches[approach]!;
    const forcedText = forced[chaseCount];
    const plan = forcedText ? forcePlan(forcedText, rng) : planChase(rng, lastPlan);
    lastPlan = plan;
    const path = buildPath(plan, { x: a.x, y: a.y }, geometry, CHASE_LEAD);
    const actors = Array.from({ length: plan.cops + 1 }, (_, slot): Actor => ({
      slot, s: CHASE_LEAD - slot * CHASE_GAP, lane: [0, -5, 5, 0][slot]!, speed: plan.speed, spin: 0, spinDir: slot % 2 ? 1 : -1,
      x: 0, y: 0, heading: 0, crashed: false, crashAt: 0, rollAt: 0, skid: [undefined, undefined],
    }));
    for (const actor of actors) settle(actor, path);
    chase = {
      plan, path, approach, state: 'run', cause: 'escaped', since: time, bustedAt: 0, nitroUntil: 0, nitroDone: false, sirenAgain: true, smokeAt: 0, slid: false,
      fired: plan.mishaps.map(() => false), zoomBase: 1.3 + rng() * 0.25, actors,
    };
    chaseCount++;
    if (debug) { debug.chases++; debug.plans.push(signature(plan)); }
    mark('data-chase', 'run');
    announce('siren');
    const [bx, by] = at(a, -64, -46);
    say('WEEOOO!', bx, by - 18, true);
  }

  /** A hard knock: the camera jolts and settles. */
  function bump(power: number) { kick = power; kickAt = time; }

  /** Rear tyre marks and smoke from a sliding car. */
  function slide(actor: Actor, smoke: boolean) {
    const cos = Math.cos(actor.heading);
    const sin = Math.sin(actor.heading);
    [-1, 1].forEach((side, index) => {
      const px = actor.x - 13 * cos - sin * side * 6.5;
      const py = actor.y - 13 * sin + cos * side * 6.5;
      const last = actor.skid[index];
      if (last && Math.hypot(px - last[0], py - last[1]) > 2) {
        skids.push({ x1: last[0], y1: last[1], x2: px, y2: py, born: time });
        if (skids.length > 160) skids.shift();
        actor.skid[index] = [px, py];
      } else if (!last) actor.skid[index] = [px, py];
      if (smoke && effects >= 8 && index === 0 && puffs.length < 24) puffs.push({ x: px, y: py, vx: -cos * 8, vy: -sin * 8 - 8, born: time });
    });
  }

  function endChase(outcome: Outcome) {
    chase = undefined;
    blocks.length = 0;
    if (debug) debug.chasing = 0;
    mark('data-chase', '');
    nextChase = time + (outcome === 'escaped' ? 4500 + rng() * 4500 : 6000 + rng() * 5000);
    if (debug) debug.outcomes.push(outcome);
  }

  /** The racer is stopped: by a roadblock, by losing it in a bend or by a PIT manoeuvre. */
  function arrest(c: Chase, cause: Outcome) {
    const racer = c.actors[0]!;
    c.state = 'busted';
    c.bustedAt = time;
    c.cause = cause;
    c.focus = { actor: racer, until: time + 1800 };
    heat = 0;
    mark('data-heat', '0');
    mark('data-chase', 'busted');
    if (debug) { debug.busted++; debug.heat = 0; }
    bump(1);
    if (cause === 'wipeout') {
      racer.rollAt = time;
      announce('crash');
      say('WIPEOUT!', racer.x, racer.y - 28, true);
    } else if (cause === 'pit') {
      announce('crash');
      say('P.I.T.!', racer.x, racer.y - 28, true);
    } else {
      announce('busted');
      say('BUSTED!', racer.x, racer.y - 28, true);
    }
  }

  /** A patrol car loses control: it spins, slides to the kerb, smokes and fades. */
  function wreck(c: Chase, cop: Actor, word: string) {
    if (cop.crashed) return;
    cop.crashed = true;
    cop.crashAt = time;
    c.focus = { actor: cop, until: time + 1500 };
    if (debug) debug.crashes++;
    announce('crash');
    bump(0.9);
    say(word, cop.x, cop.y - 30, true);
  }

  function fire(c: Chase, mishap: Mishap) {
    const racer = c.actors[0]!;
    if (mishap.kind === 'copSpin') {
      const cop = c.actors[mishap.slot];
      if (cop) wreck(c, cop, 'CRASH!');
    } else if (mishap.kind === 'pileup') {
      const first = c.actors[1];
      const second = c.actors[2];
      if (first) wreck(c, first, 'PILE-UP!');
      if (second) { second.spinDir = -(first?.spinDir ?? 1); wreck(c, second, 'PILE-UP!'); }
    } else if (mishap.kind === 'wipeout') arrest(c, 'wipeout');
    else if (mishap.kind === 'pit') {
      const cop = c.actors[1];
      if (c.plan.pitWins) arrest(c, 'pit');
      else {
        // The racer shrugs it off, wobbles and goes on; the patrol car that tried it is the one that spins out.
        racer.spin += 1.2 * (cop?.spinDir ?? 1);
        bump(0.7);
        say('P.I.T.!', racer.x, racer.y - 28, true);
        if (cop) wreck(c, cop, 'CRASH!');
      }
    }
  }

  /** Does anything in the chase still need the junction clear? Then the lights hold. */
  function holding(c: Chase) {
    if (c.cause === 'cone') return false;
    return c.actors.some((actor) => (actor.crashed ? time - actor.crashAt < 2600 && actor.s < c.path.boxOut : actor.s < c.path.boxOut + 20));
  }

  /** Moves the racer and the patrol cars along their path. A cone on the road is a roadblock the racer swerves into. */
  function moveChase(c: Chase, delta: number) {
    const { plan, path } = c;
    const seconds = delta / 1000;
    const racer = c.actors[0]!;
    if (holding(c)) held += delta;
    if (c.sirenAgain && time - c.since > 650) { c.sirenAgain = false; announce('siren'); }
    if (c.state === 'run') {
      const here = path.at(racer.s);
      const bendiness = Math.min(1, Math.abs(here.k) * 28);
      const cruise = plan.speed * (1 + heat * 0.05) * (1 - 0.38 * bendiness);
      const fireNitro = () => { c.nitroDone = true; c.nitroUntil = time + 900; say('NITRO!', racer.x, racer.y - 26, true); };
      if (!c.nitroDone && plan.nitro !== null && racer.s >= path.apex + plan.nitro) fireNitro();
      else if (x >= 0 && time > c.nitroUntil + 600 && Math.hypot(x - racer.x, y - racer.y) < 46) fireNitro();
      racer.speed += ((time < c.nitroUntil ? cruise * 1.4 : cruise) - racer.speed) * Math.min(1, delta / 200);
      // Through a bend the nose points further into the turn than the car travels: a drift. On a straight the tail swings both ways instead.
      const legIndex = path.legs.findIndex((leg) => racer.s > leg.boxIn && racer.s < leg.boxOut);
      const inLeg = path.legs[legIndex];
      const u = inLeg ? (racer.s - inLeg.boxIn) / (inLeg.boxOut - inLeg.boxIn) : 0;
      const side = (c.approach + Math.max(0, legIndex)) % 2 ? -1 : 1;
      const fishtail = legIndex >= 0 && (legIndex === 0 ? plan.route : plan.then[legIndex - 1]!.route) === 'straight';
      racer.spin += (clamp(here.k * 24, -0.8, 0.8) + (fishtail ? side * 0.55 * Math.sin(u * 2 * Math.PI) : 0) - racer.spin) * Math.min(1, delta / 90);
      let want = fishtail ? side * 9 * Math.sin(u * Math.PI) : 0;
      // A cone on the arm the racer is driving along is a roadblock.
      for (let i = 0; i < approaches.length; i++) {
        const cone = cones[i]!;
        const arm = approaches[i]!;
        if (cone.until <= time) continue;
        const dx = racer.x - MID_X;
        const dy = racer.y - MID_Y;
        const along = dx * arm.x + dy * arm.y;
        const across = -dx * arm.y + dy * arm.x;
        if (Math.abs(along - cone.pos) >= 90 || along > -geometry.box || Math.abs(across - LANE) >= 30) continue;
        const outward = Math.cos(here.h) * arm.x + Math.sin(here.h) * arm.y < 0;
        want = (outward ? -1 : 1) * (LANE - 5);
        if (Math.abs(along - cone.pos) < 22) { arrest(c, 'cone'); break; }
      }
      for (const block of blocks) {
        if (block.until > time && racer.s > block.s - 14 && racer.s < block.s + 40) { arrest(c, 'cone'); break; }
      }
      racer.lane += (want - racer.lane) * Math.min(1, delta / 130);
      if (Math.abs(racer.spin) > 0.2 || fishtail) {
        if (!c.slid) {
          c.slid = true;
          if (debug) debug.drifts++;
          announce('skid');
          say('SKRRT!', racer.x, racer.y - 30, true);
        }
        const puff = time - c.smokeAt > 55;
        if (puff) c.smokeAt = time;
        slide(racer, puff);
      } else racer.skid = [undefined, undefined];
    }
    if (c.state === 'busted') {
      racer.speed *= Math.exp(-delta / 220);
      racer.spin += 11 * Math.exp(-(time - c.bustedAt) / 650) * seconds * (c.cause === 'wipeout' ? 1.4 : 1);
      racer.lane += ((c.cause === 'cone' ? LANE - 2 : racer.lane) - racer.lane) * Math.min(1, delta / 300);
      if (effects >= 8 && time - c.smokeAt > 70 && time - c.bustedAt < 1300 && puffs.length < 24) {
        c.smokeAt = time;
        puffs.push({ x: racer.x, y: racer.y, vx: Math.cos(time / 90) * 12, vy: -9 - Math.abs(Math.sin(time / 70)) * 6, born: time });
      }
    }
    plan.mishaps.forEach((mishap, index) => {
      const stopsRacer = mishap.kind === 'wipeout' || mishap.kind === 'pit';
      if (c.fired[index] || (stopsRacer && c.state !== 'run')) return;
      const owner = stopsRacer ? racer : mishap.kind === 'pileup' ? c.actors[1] : c.actors[mishap.slot];
      if (owner && owner.s >= (path.legs[mishap.leg] ?? path.legs[0]!).apex + mishap.offset) { c.fired[index] = true; fire(c, mishap); }
    });
    racer.s += racer.speed * seconds;
    settle(racer, path);
    if (debug) { debug.chasing = 1; debug.racerX = racer.x; debug.racerY = racer.y; }
    for (const cop of c.actors) {
      if (cop.slot === 0) continue;
      if (cop.crashed) {
        const wreckAge = time - cop.crashAt;
        cop.speed *= Math.exp(-delta / 330);
        cop.spin += 9 * Math.exp(-wreckAge / 620) * seconds * cop.spinDir;
        cop.lane += (cop.spinDir * 24 - cop.lane) * Math.min(1, delta / 420);
        cop.s += cop.speed * seconds;
        if (effects >= 8 && time - c.smokeAt > 90 && wreckAge < 1800 && puffs.length < 24) {
          c.smokeAt = time;
          puffs.push({ x: cop.x, y: cop.y, vx: Math.cos(time / 80) * 10, vy: -10, born: time });
        }
        settle(cop, path);
        continue;
      }
      const gap = c.state === 'busted' ? 40 : CHASE_GAP;
      cop.speed = clamp(racer.speed + (racer.s - gap * cop.slot - cop.s) * 2.4, 0, 330);
      cop.s += cop.speed * seconds;
      cop.spin += (clamp(path.at(cop.s).k * 20, -0.7, 0.7) - cop.spin) * Math.min(1, delta / 110);
      const sideways = cop.slot % 2 ? -1 : 1;
      const wantLane = c.state === 'busted' ? sideways * 9 : [0, -5, 5, 0][cop.slot]! + Math.sin(time / 260 + cop.slot * 2) * 2.5;
      cop.lane += (wantLane - cop.lane) * Math.min(1, delta / 140);
      settle(cop, path);
    }
    const gone = (actor: Actor) => (actor.crashed ? time - actor.crashAt > 2600 : actor.s > path.length - 10);
    if (c.state === 'run' && c.actors.every(gone)) {
      heat = Math.min(5, heat + 1);
      mark('data-heat', String(heat));
      if (debug) { debug.escaped++; debug.heat = heat; }
      endChase('escaped');
    } else if (c.state === 'busted' && time - c.bustedAt > BUST_SHOW) endChase(c.cause);
  }

  /** Draws the chase in map coordinates. */
  function drawChase(g: CanvasRenderingContext2D, c: Chase) {
    const busted = c.state === 'busted';
    const age = time - c.bustedAt;
    const fade = busted && age > BUST_SHOW - 700 ? Math.max(0, (BUST_SHOW - age) / 700) : 1;
    const flash = Math.floor(time / FLASH_MS) % 2;
    const flicker = 0.5 + 0.5 * Math.sin(time / 35);
    for (const actor of [...c.actors].reverse()) {
      g.save();
      g.globalAlpha = fade;
      g.translate(actor.x, actor.y);
      g.rotate(actor.heading);
      if (actor.rollAt) {
        // Rolled over: the car squashes flat and wide again twice as it tumbles, then lies still.
        const roll = (time - actor.rollAt) / 900;
        if (roll < 1) g.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(roll * Math.PI * 4)));
      }
      g.scale(0.49, 0.49);
      if (actor.crashed) g.globalAlpha *= clamp(1 - (time - actor.crashAt - 2000) / 600, 0, 1);
      const cop = actor.slot > 0;
      if (!cop) {
        if (effects >= 8) {
          // Neon underglow, a flame from the exhaust (longer on a nitro burst) and speed lines.
          g.globalAlpha *= 0.9;
          g.drawImage(glows.teal, -64, -44, 128, 88);
          g.globalAlpha /= 0.9;
          const power = Math.min(1.4, actor.speed / CRUISE_REFERENCE);
          const len = (10 + 9 * flicker) * power + (time < c.nitroUntil ? 26 : 0);
          if (len > 4) {
            for (const [tint, scale, spread] of [[red, 1, 7], [orange, 0.78, 5], [yellow, 0.55, 3.2], [cream, 0.3, 1.6]] as const) {
              g.fillStyle = tint;
              g.beginPath();
              g.moveTo(-34, -spread);
              g.lineTo(-34 - len * scale, 0);
              g.lineTo(-34, spread);
              g.fill();
            }
          }
          if (actor.speed > 100) {
            g.fillStyle = cream;
            g.globalAlpha *= 0.55;
            const reach = 20 + (actor.speed - 100) * 0.9;
            g.fillRect(-46 - reach - 18, -9, reach, 2);
            g.fillRect(-46 - reach * 0.7 - 18, 0, reach * 0.7, 2);
            g.fillRect(-46 - reach * 0.85 - 18, 8, reach * 0.85, 2);
            g.globalAlpha /= 0.55;
          }
        }
      } else if (effects >= 8 && !actor.crashed) {
        // A coloured wash on the road around a lit light bar.
        const lit = (flash + actor.slot) % 2;
        g.globalAlpha *= 0.95;
        g.drawImage(lit ? glows.blue : glows.red, -4 - 50, (lit ? 9 : -9) - 50, 100, 100);
        g.globalAlpha /= 0.95;
      }
      g.drawImage(cop ? copSprite : racerSprite, -36, -21, 72, 42);
      g.fillStyle = busted || actor.speed < 8 ? red : cream;
      g.fillRect(-29, -7, 4, 4);
      g.fillRect(-29, 3, 4, 4);
      if (cop) {
        const lit = (flash + actor.slot) % 2;
        g.fillStyle = lit ? border : red;
        g.fillRect(-7, -10, 5, 9);
        g.fillStyle = lit ? blue : border;
        g.fillRect(-7, 1, 5, 9);
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  /** Where the operator wants the camera: a slow sweep over the town, or the racer wherever he goes, or a car that just crashed. */
  function aim() {
    const c = chase;
    if (!c) return { x: MID_X + Math.sin(time / 7300) * 46, y: MID_Y + Math.sin(time / 5100 + 1) * 24, zoom: PATROL_ZOOM + 0.08 * Math.sin(time / 6100) };
    if (c.focus && time < c.focus.until) return { x: c.focus.actor.x, y: c.focus.actor.y, zoom: 1.85 };
    const racer = c.actors[0]!;
    const heading = c.path.at(racer.s).h;
    const lead = racer.speed * 0.28;
    let tx = racer.x + Math.cos(heading) * lead;
    let ty = racer.y + Math.sin(heading) * lead;
    // Until the racer reaches the home junction the camera waits near it, so his arrival is seen; after that it never lets go of him.
    if (racer.s < c.path.boxIn) {
      const dx = tx - MID_X;
      const dy = ty - MID_Y;
      const dist = Math.hypot(dx, dy);
      if (dist > 260) { tx = MID_X + (dx / dist) * 260; ty = MID_Y + (dy / dist) * 260; }
    }
    let inBox = 0;
    for (const leg of c.path.legs) {
      const p = c.path.at(leg.apex);
      inBox = Math.max(inBox, 1 - Math.hypot(racer.x - p.x, racer.y - p.y) / 140);
    }
    const zoom = c.state === 'busted' ? (time - c.bustedAt < 1800 ? 1.85 : 1.6) : c.zoomBase + 0.3 * Math.max(0, inBox);
    return { x: tx, y: ty, zoom };
  }

  /** The camera follows with a spring, so it lags behind a fast car, overshoots a little and settles, like a person at the controls. */
  function moveCamera(delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const goal = aim();
    const tx = goal.x;
    const ty = goal.y;
    const follow = chase ? 16 : 5;
    const damp = chase ? 5.2 : 3.2;
    cam.vx += ((tx - cam.x) * follow - cam.vx * damp) * dt;
    cam.vy += ((ty - cam.y) * follow - cam.vy * damp) * dt;
    cam.x += cam.vx * dt;
    cam.y += cam.vy * dt;
    cam.vzoom += ((goal.zoom - cam.zoom) * 7 - cam.vzoom * 3.4) * dt;
    cam.zoom = clamp(cam.zoom + cam.vzoom * dt, ZOOM_MIN, ZOOM_MAX);
    const bank = -clamp(cam.vx / 260, -1, 1) * 0.03 + 0.012 * Math.sin(time / 2300);
    cam.vroll += ((bank - cam.roll) * 10 - cam.vroll * 4) * dt;
    cam.roll = clamp(cam.roll + cam.vroll * dt, -ROLL_MAX + 0.005, ROLL_MAX - 0.005);
  }

  /** The steady camera plus hand-held shake: a constant tremor, a gust now and then, and a jolt after every hit. */
  function framing() {
    if (time > gustAt) { gustStart = time; gustAt = time + 5200 + 3800 * Math.abs(Math.sin(time)); }
    const gust = clamp(1 - (time - gustStart) / 1100, 0, 1);
    const amp = (0.5 + 1.7 * gust + kick * 9 * Math.exp(-(time - kickAt) / 380)) * (cam.zoom > 1 ? 1 : 0);
    const wobble = (f: number, p: number) => Math.sin(time * f + p);
    shot.x = cam.x;
    shot.y = cam.y;
    shot.zoom = cam.zoom;
    shot.cx = MID_X + amp * (wobble(0.021, 0) + 0.6 * wobble(0.047, 1.7) + 0.3 * wobble(0.11, 3));
    shot.cy = MID_Y + amp * (wobble(0.017, 2) + 0.6 * wobble(0.053, 0.4) + 0.3 * wobble(0.13, 5));
    shot.roll = cam.roll + 0.0035 * amp * wobble(0.037, 2);
    if (debug) { debug.zoom = cam.zoom; debug.camX = cam.x; debug.camY = cam.y; debug.roll = shot.roll; }
  }

  function applyCamera(g: CanvasRenderingContext2D) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = ink;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.setTransform(base.scale, 0, 0, base.scale, base.ox, base.oy);
    g.translate(shot.cx, shot.cy);
    g.rotate(shot.roll);
    g.scale(shot.zoom, shot.zoom);
    g.translate(-shot.x, -shot.y);
  }

  function drawMap(g: CanvasRenderingContext2D) {
    g.fillStyle = paper;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle = yellow;
    g.globalAlpha = 0.14;
    g.fill(dots);
    g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const left = i % 2 ? 374 : 22;
      const top = i < 2 ? 16 : 267;
      g.fillStyle = ink;
      g.fillRect(left + 5, top + 5, 164, 64);
      g.fillStyle = roof;
      g.fillRect(left, top, 164, 64);
      g.strokeStyle = border;
      g.lineWidth = 2;
      g.strokeRect(left, top, 164, 64);
      g.fillStyle = paper;
      g.fillRect(left + 8, top + 8, 99, 42);
      g.fillRect(left + 117, top + 8, 38, 42);
      g.fillStyle = i % 2 ? red : yellow;
      g.fillRect(left + 8, top + 52, 74, 5);
      g.strokeStyle = border;
      g.strokeRect(left + 24, top + 18, 43, 23);
      g.strokeRect(left + 126, top + 15, 20, 19);
    }

    g.fillStyle = border;
    g.fillRect(0, MID_Y - ROAD_EDGE - 3, WIDTH, (ROAD_EDGE + 3) * 2);
    g.fillRect(MID_X - ROAD_EDGE - 3, 0, (ROAD_EDGE + 3) * 2, HEIGHT);
    g.fillStyle = ink;
    g.fillRect(0, MID_Y - ROAD_EDGE, WIDTH, ROAD_EDGE * 2);
    g.fillRect(MID_X - ROAD_EDGE, 0, ROAD_EDGE * 2, HEIGHT);
    g.fillStyle = paper;
    g.fillRect(MID_X - 49, MID_Y - 49, 98, 98);

    for (const approach of approaches) {
      g.save();
      g.translate(MID_X, MID_Y);
      g.rotate(approach.angle);
      g.fillStyle = yellow;
      for (let pos = -approach.end; pos < -94; pos += 24) g.fillRect(pos, -1, 12, 2);
      g.fillRect(-65, 3, 3, 56);
      g.fillStyle = cream;
      g.globalAlpha = 0.64;
      for (let lane = -54; lane < 55; lane += 14) g.fillRect(-56, lane, 10, 6);
      g.restore();
    }
    drawScenery(g);
  }

  /** Details that never move, painted once into the map: rooftops, trees, lamps, skid marks. */
  function drawScenery(g: CanvasRenderingContext2D) {
    // Rooftops: an air-conditioning unit and a halftone shadow on the right half of each roof.
    for (let i = 0; i < 4; i++) {
      const left = i % 2 ? 374 : 22;
      const top = i < 2 ? 16 : 267;
      g.save();
      g.beginPath();
      g.rect(left + 83, top, 81, 64);
      g.clip();
      g.fillStyle = ink;
      g.globalAlpha = 0.34;
      for (let row = top + 3; row < top + 64; row += 6) for (let col = left + 85 + (row % 12 ? 3 : 0); col < left + 164; col += 6) g.fillRect(col, row, 2, 2);
      g.restore();
      g.fillStyle = ink;
      g.fillRect(left + 133, top + 40, 22, 17);
      g.fillStyle = border;
      g.fillRect(left + 131, top + 38, 22, 17);
      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.strokeRect(left + 131, top + 38, 22, 17);
      g.beginPath();
      g.arc(left + 142, top + 46.5, 5.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(left + 137, top + 46.5); g.lineTo(left + 147, top + 46.5);
      g.moveTo(left + 142, top + 41.5); g.lineTo(left + 142, top + 51.5);
      g.stroke();
    }
    // Round comic trees with an ink shadow, halftone shade and a highlight.
    const trees: [number, number, number][] = [[44, 99, 11], [112, 101, 9], [488, 99, 11], [420, 101, 9], [60, 342, 11], [150, 344, 9], [500, 342, 11], [412, 344, 9]];
    for (const [tx, ty, r] of trees) {
      g.fillStyle = ink;
      g.beginPath(); g.arc(tx + 3, ty + 3, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = green;
      g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.fill();
      g.save();
      g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = ink;
      g.globalAlpha = 0.4;
      for (let row = -r; row <= r; row += 3) for (let col = -r + (row % 2 ? 1.5 : 0); col <= r; col += 3) if (col + row > 1) g.fillRect(tx + col, ty + row, 1.4, 1.4);
      g.restore();
      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = cream;
      g.globalAlpha = 0.7;
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(tx, ty, r - 3, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
      g.globalAlpha = 1;
    }
    // Street lamps at the four corners, each with a warm pool of light on the road.
    for (const [lx, ly] of [[210, 108], [350, 108], [210, 252], [350, 252]] as const) {
      g.globalAlpha = 0.9;
      g.drawImage(glows.yellow, lx - 32, ly - 32, 64, 64);
      g.globalAlpha = 1;
      g.fillStyle = ink;
      g.beginPath(); g.arc(lx, ly, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = yellow;
      g.beginPath(); g.arc(lx, ly, 2.6, 0, Math.PI * 2); g.fill();
    }
    // Skid marks before each stop line.
    g.strokeStyle = ink;
    g.globalAlpha = 0.7;
    g.lineWidth = 2;
    for (const approach of approaches) {
      g.save();
      g.translate(MID_X, MID_Y);
      g.rotate(approach.angle);
      for (const lane of [LANE - 4, LANE + 4, -LANE - 6]) {
        g.beginPath();
        g.moveTo(STOP - 34, lane); g.lineTo(STOP - 6, lane + 0.6);
        g.stroke();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  /** Roadblocks on the racer's route: a cone between two striped barriers, across the road. */
  function drawBlocks(g: CanvasRenderingContext2D) {
    for (let k = blocks.length - 1; k >= 0; k--) {
      const block = blocks[k]!;
      if (block.until <= time) { blocks.splice(k, 1); continue; }
      g.save();
      g.translate(block.x, block.y);
      g.rotate(block.heading);
      g.globalAlpha = Math.min(1, (block.until - time) / 350);
      for (const sy of [-1, 1]) {
        g.fillStyle = ink;
        g.fillRect(-3, sy * 17 - 5, 6, 10);
        g.fillStyle = sy > 0 ? red : yellow;
        g.fillRect(-2, sy * 17 - 4, 4, 8);
      }
      g.fillStyle = yellow;
      g.fillRect(-2, -12, 4, 24);
      g.fillStyle = red;
      for (let n = -2; n <= 2; n += 2) g.fillRect(-2, n * 5 - 2.5, 4, 5);
      g.fillStyle = red;
      g.beginPath();
      g.moveTo(-9, -7);
      g.lineTo(7, 0);
      g.lineTo(-9, 7);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  /** Quiet traffic on the roads around the home junction, drawn wherever the camera is. */
  function drawAmbient(g: CanvasRenderingContext2D) {
    const halfW = canvas.width / base.scale / (2 * shot.zoom) + 70;
    const halfH = canvas.height / base.scale / (2 * shot.zoom) + 70;
    for (const car of ambient) {
      let px: number;
      let py: number;
      if (car.horizontal) {
        py = MID_Y + (Math.round((shot.y - MID_Y) / HEIGHT) + car.offset) * HEIGHT + car.dir * LANE;
        const span = WIDTH * 3;
        px = shot.x + ((((car.u + car.dir * car.speed * time / 1000 - shot.x + span / 2) % span) + span) % span) - span / 2;
      } else {
        px = MID_X + (Math.round((shot.x - MID_X) / WIDTH) + car.offset) * WIDTH - car.dir * LANE;
        const span = HEIGHT * 3;
        py = shot.y + ((((car.u + car.dir * car.speed * time / 1000 - shot.y + span / 2) % span) + span) % span) - span / 2;
      }
      if (Math.abs(px - shot.x) > halfW || Math.abs(py - shot.y) > halfH) continue;
      // The home junction has its own traffic and lights.
      if (Math.abs(px - MID_X) < 340 && Math.abs(py - MID_Y) < 220) continue;
      g.save();
      g.translate(px, py);
      g.rotate(car.horizontal ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.scale(0.49, 0.49);
      g.globalAlpha = 0.92;
      g.drawImage(sprites[car.sprite]!, -36, -21, 72, 42);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  /** Tyre marks, drawn on the road before the cars and fading away. */
  function drawSkids(g: CanvasRenderingContext2D) {
    while (skids.length && time - skids[0]!.born > SKID_LIFE) skids.shift();
    if (!skids.length) return;
    g.strokeStyle = cream;
    g.lineWidth = 2;
    g.lineCap = 'butt';
    for (const mark of skids) {
      g.globalAlpha = 0.42 * (1 - (time - mark.born) / SKID_LIFE);
      g.beginPath();
      g.moveTo(mark.x1, mark.y1);
      g.lineTo(mark.x2, mark.y2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** The look of a drone feed, in screen space: soft dark corners, scan lines, corner brackets, a crosshair and a read-out. */
  function drawHud(g: CanvasRenderingContext2D) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (overlay.width) g.drawImage(overlay, 0, 0);
    const px = canvas.width / Math.max(1, canvas.clientWidth);
    const inset = 12 * px;
    const len = 20 * px;
    const w = canvas.width;
    const h = canvas.height;
    g.strokeStyle = cream;
    g.globalAlpha = 0.8;
    g.lineWidth = 2 * px;
    g.lineCap = 'butt';
    g.beginPath();
    for (const [cx, cy, sx, sy] of [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]] as const) {
      g.moveTo(cx + sx * len, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * len);
    }
    g.stroke();
    g.globalAlpha = 0.5;
    g.lineWidth = 1.5 * px;
    g.beginPath();
    const mx = w / 2;
    const my = h / 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      g.moveTo(mx + dx * 7 * px, my + dy * 7 * px);
      g.lineTo(mx + dx * 15 * px, my + dy * 15 * px);
    }
    g.stroke();
    g.globalAlpha = 1;
    if (effects < 8) return;
    g.font = `700 ${11 * px}px ${display}`;
    g.textBaseline = 'top';
    const label = (text: string, tx: number, ty: number, align: CanvasTextAlign, tint: string) => {
      g.textAlign = align;
      g.fillStyle = ink;
      g.fillText(text, tx + px, ty + px);
      g.fillStyle = tint;
      g.fillText(text, tx, ty);
    };
    const frames = Math.floor(time / 33) % 30;
    const seconds = Math.floor(time / 1000);
    const clock = `${String(Math.floor(seconds / 60) % 100).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    label(clock, w - inset - 8 * px, inset + 8 * px, 'right', cream);
    if (Math.floor(time / 500) % 2 === 0) {
      g.fillStyle = red;
      g.beginPath();
      g.arc(w - inset - 8 * px - g.measureText(clock).width - 14 * px, inset + 14 * px, 4.5 * px, 0, Math.PI * 2);
      g.fill();
    }
    label(`AIR 7  ALT ${Math.round(190 / cam.zoom)} M  ${cam.zoom.toFixed(1)}X`, inset + 8 * px, h - inset - 20 * px, 'left', cream);
    if (chase) label(chase.state === 'busted' ? 'SUSPECT STOPPED' : 'TRACKING SUSPECT', inset + 8 * px, h - inset - 36 * px, 'left', chase.state === 'busted' ? green : red);
  }

  /** Lock-on brackets around the racer, in map coordinates. */
  function drawLock(g: CanvasRenderingContext2D) {
    const c = chase;
    if (!c) return;
    const racer = c.actors[0]!;
    const rx = racer.x;
    const ry = racer.y;
    const r = 24 + 2 * Math.sin(time / 110);
    g.strokeStyle = c.state === 'busted' ? green : red;
    g.lineWidth = 1.8;
    g.beginPath();
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        g.moveTo(rx + sx * r, ry + sy * (r - 8));
        g.lineTo(rx + sx * r, ry + sy * r);
        g.lineTo(rx + sx * (r - 8), ry + sy * r);
      }
    }
    g.stroke();
  }

  const widths = new Map<string, number>();
  function say(word: string, wx: number, wy: number, force = false) {
    if (effects < 8 || (force ? bursts.length >= 6 : bursts.length >= 3 || time - lastBurst < 800)) return;
    lastBurst = time;
    bursts.push({ x: wx, y: wy, word, born: time, rot: ((bursts.length + Math.floor(time / 100)) % 3 - 1) * 0.12 });
  }

  /** Comic word balloons and exhaust clouds are drawn in map coordinates, over the cars. */
  function drawEffects(g: CanvasRenderingContext2D) {
    for (let k = puffs.length - 1; k >= 0; k--) {
      const puff = puffs[k]!;
      const age = (time - puff.born) / 650;
      if (age >= 1) { puffs.splice(k, 1); continue; }
      const r = 2.5 + age * 7;
      const px = puff.x + puff.vx * age;
      const py = puff.y + puff.vy * age;
      g.globalAlpha = 0.85 * (1 - age);
      g.fillStyle = cream;
      g.strokeStyle = ink;
      g.lineWidth = 1.4;
      for (const [dx, dy, scale] of [[-r * 0.6, 0, 0.75], [r * 0.5, -r * 0.2, 0.85], [0, r * 0.5, 0.7]] as const) {
        g.beginPath();
        g.arc(px + dx, py + dy, r * scale, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.font = `700 13px ${display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = bursts.length - 1; k >= 0; k--) {
      const b = bursts[k]!;
      const age = (time - b.born) / 900;
      if (age >= 1) { bursts.splice(k, 1); continue; }
      let width = widths.get(b.word);
      if (width === undefined) { width = g.measureText(b.word).width; widths.set(b.word, width); }
      const pop = age < 0.18 ? 0.5 + age * 2.8 : 1;
      const rx = width / 2 + 11;
      const ry = 17;
      g.save();
      g.translate(b.x, b.y - age * 10);
      g.rotate(b.rot);
      g.scale(pop, pop);
      g.globalAlpha = age > 0.7 ? (1 - age) / 0.3 : 1;
      g.beginPath();
      for (let n = 0; n < 20; n++) {
        const angle = (n / 20) * Math.PI * 2;
        const spike = n % 2 ? 0.74 : 1;
        g.lineTo(Math.cos(angle) * rx * spike, Math.sin(angle) * ry * spike);
      }
      g.closePath();
      g.fillStyle = ink;
      g.save(); g.translate(2, 2.5); g.fill(); g.restore();
      g.fillStyle = yellow;
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.stroke();
      g.fillStyle = ink;
      g.fillText(b.word, 0, 1);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function draw(g: CanvasRenderingContext2D, delta: number) {
    const phase = (time - held) % (SIGNAL_PHASE * 2);
    const axis = phase < SIGNAL_PHASE ? 0 : 1;
    const greenNow = phase % SIGNAL_PHASE < GREEN_TIME;
    if (debug) debug.axis = greenNow ? axis : -1;
    const greenAxis = greenNow ? axis : -1;
    if (delta && greenAxis !== lastGreen) {
      lastGreen = greenAxis;
      if (greenAxis >= 0) { const lead = approaches[greenAxis]!; say('VROOM!', MID_X + lead.x * (STOP + 22), MID_Y + lead.y * (STOP + 22) + lead.x * 40); }
    }
    if (delta) {
      if (chase) moveChase(chase, delta);
      else if (greenNow && time >= nextChase) startChase(axis + 2 * Math.floor(rng() * 2));
      moveCamera(delta);
    }
    framing();
    applyCamera(g);
    // The town is the one junction repeated in every direction, so the camera can follow a car as far as it goes.
    const halfW = canvas.width / base.scale / (2 * shot.zoom);
    const halfH = canvas.height / base.scale / (2 * shot.zoom);
    const slack = (halfW + halfH) * 0.06 + 14;
    for (let tj = Math.floor((shot.y - halfH - slack) / HEIGHT); tj <= Math.floor((shot.y + halfH + slack) / HEIGHT); tj++) {
      for (let ti = Math.floor((shot.x - halfW - slack) / WIDTH); ti <= Math.floor((shot.x + halfW + slack) / WIDTH); ti++) g.drawImage(map, ti * WIDTH - 0.3, tj * HEIGHT - 0.3, WIDTH + 0.6, HEIGHT + 0.6);
    }
    drawSkids(g);
    drawBlocks(g);
    drawAmbient(g);

    if (x >= 0 && effects >= 8) {
      g.save();
      g.beginPath();
      g.arc(x, y, 87, 0, Math.PI * 2);
      g.clip();
      g.drawImage(spotlight, Math.floor(x / WIDTH) * WIDTH, Math.floor(y / HEIGHT) * HEIGHT);
      g.globalAlpha = 0.62;
      g.lineWidth = 1.5;
      g.strokeStyle = yellow;
      g.stroke();
      g.restore();
    }

    // Where the chase is on its entry road, so ordinary drivers ahead of it can pull over.
    let yieldFront = -Infinity;
    let yieldRear = Infinity;
    if (chase && chase.state === 'run') {
      const entry = approaches[chase.approach]!;
      for (const actor of chase.actors) {
        if (actor.crashed || actor.s > chase.path.boxIn + 20) continue;
        const along = (actor.x - MID_X) * entry.x + (actor.y - MID_Y) * entry.y;
        yieldFront = Math.max(yieldFront, along);
        yieldRear = Math.min(yieldRear, along);
      }
    }
    for (let i = 0; i < approaches.length; i++) {
      const approach = approaches[i]!;
      const cone = cones[i]!;
      const open = greenNow && axis === i % 2;
      g.save();
      g.translate(MID_X, MID_Y);
      g.rotate(approach.angle);

      g.fillStyle = ink;
      g.fillRect(-84, 64, 33, 15);
      g.fillStyle = open ? roof : red;
      g.fillRect(-80, 67, 10, 9);
      g.fillStyle = open ? green : roof;
      g.fillRect(-65, 67, 10, 9);
      if (effects >= 8) {
        g.globalAlpha = 0.85;
        g.drawImage(open ? glows.green : glows.red, open ? -80 : -95, 51, 40, 40);
        g.globalAlpha = 1;
      }

      const first = i * CARS_PER_APPROACH;
      const end = first + CARS_PER_APPROACH;
      for (let j = first; j < end; j++) {
        const car = cars[j]!;
        let limit = open || car.pos > STOP ? Infinity : STOP;
        for (let k = first; k < end; k++) {
          const ahead = cars[k]!;
          if (ahead.pos > car.pos) limit = Math.min(limit, ahead.pos - GAP);
        }
        const detour = cone.until > time && car.pos > cone.pos - 86 && car.pos < cone.pos + 32;
        const nearPointer = x >= 0 && car.pos <= STOP && Math.hypot(
          x - (MID_X + approach.x * car.pos - approach.y * car.lane),
          y - (MID_Y + approach.y * car.pos + approach.x * car.lane),
        ) < 32;
        // Ordinary drivers pull over towards the kerb as a chase comes up behind them.
        const yielding = chase !== undefined && chase.approach === i && yieldFront > -Infinity && car.pos > yieldRear - 12 && car.pos < yieldFront + 120;
        const targetLane = detour || nearPointer ? DETOUR : yielding ? LANE + 9 : LANE;
        car.lane += (targetLane - car.lane) * Math.min(1, delta / 155);
        const braking = nearPointer || (detour && Math.abs(targetLane - car.lane) > 5);
        if (nearPointer || detour) {
          if (!car.honked) {
            car.honked = true;
            const wx = MID_X + approach.x * car.pos - approach.y * car.lane;
            const wy = MID_Y + approach.y * car.pos + approach.x * car.lane;
            say(nearPointer ? 'BEEP!' : 'SCREECH!', wx - approach.y * 6, wy - 26);
          }
        } else car.honked = false;
        const speed = braking ? 44 : car.cruise;
        car.speed += (speed - car.speed) * Math.min(1, delta / (braking ? 75 : 270));
        if (debug && delta && braking) debug.brakes++;
        if (debug && delta && detour && car.lane > LANE + 10) debug.detours++;
        car.pos = Math.max(car.pos, Math.min(limit, car.pos + car.speed * delta / 1000));
        // Pulling away from the stop line: a puff of exhaust behind the car.
        if (effects >= 8 && delta && open && car.speed > 12 && car.speed < 85 && car.pos < -20 && time - car.puffAt > 130 && puffs.length < 24) {
          car.puffAt = time;
          puffs.push({
            x: MID_X + approach.x * (car.pos - 24) - approach.y * car.lane,
            y: MID_Y + approach.y * (car.pos - 24) + approach.x * car.lane,
            vx: -approach.x * 10 + approach.y * 4,
            vy: -approach.y * 10 - 7,
            born: time,
          });
        }
        if (car.pos > approach.end) {
          // Re-enter behind the last car on the same approach.
          car.pos = -approach.end;
          for (let k = first; k < end; k++) if (k !== j) car.pos = Math.min(car.pos, cars[k]!.pos - GAP);
          car.lane = LANE;
        }
        g.save();
        g.translate(car.pos, car.lane);
        g.scale(0.49, 0.49);
        if (braking && effects >= 8 && car.pos < limit) {
          g.fillStyle = border;
          g.fillRect(-44, -10, 14, 3);
          g.fillRect(-44, 7, 14, 3);
        }
        if (effects >= 8 && car.speed > 25) {
          // Headlight cone in front and, when fast, a few speed lines behind.
          g.globalAlpha = Math.min(0.9, car.speed / 80);
          g.drawImage(beam, 30, -32, 96, 64);
          g.globalAlpha = 1;
          if (car.speed > 100) {
            g.fillStyle = cream;
            g.globalAlpha = 0.55;
            const reach = 14 + (car.speed - 100) * 0.9;
            g.fillRect(-46 - reach, -9, reach, 2);
            g.fillRect(-46 - reach * 0.7, 0, reach * 0.7, 2);
            g.fillRect(-46 - reach * 0.85, 8, reach * 0.85, 2);
            g.globalAlpha = 1;
          }
        }
        g.drawImage(sprites[j]!, -36, -21, 72, 42);
        g.fillStyle = braking || car.pos >= limit ? red : cream;
        g.fillRect(-29, -7, 4, 4);
        g.fillRect(-29, 3, 4, 4);
        g.restore();
      }

      if (cone.until > time) {
        g.globalAlpha = Math.min(1, (cone.until - time) / 350);
        g.fillStyle = red;
        g.beginPath();
        g.moveTo(cone.pos, LANE - 10);
        g.lineTo(cone.pos + 8, LANE + 7);
        g.lineTo(cone.pos - 8, LANE + 7);
        g.fill();
        g.fillStyle = yellow;
        g.fillRect(cone.pos - 9, LANE + 6, 18, 3);
        g.fillRect(cone.pos - 4, LANE, 8, 3);
      }
      g.restore();
    }
    if (chase) drawChase(g, chase);
    if (effects >= 8) { drawLock(g); drawEffects(g); }
    drawHud(g);
    if (debug) debug.frames++;
  }

  function frame(now: number) {
    const elapsed = lastFrame ? now - lastFrame : 0;
    lastFrame = now;
    if (elapsed) {
      if (debug && debug.times.length < 900) debug.times.push(elapsed);
      effects = governor.sample(elapsed);
      if (!effects) {
        exhausted = true;
        sync();
        draw(ctx!, 0);
        // The slow stretch may have been a one-off (a tab in the background, another page busy), so look again later.
        if (retries < RETRIES) retryTimer = window.setTimeout(() => { retries++; exhausted = false; governor.reset(); effects = cars.length; sync(); }, RETRY_AFTER);
        return;
      }
    }
    const delta = Math.min(elapsed, 50);
    time += delta;
    draw(ctx!, delta);
    frameId = requestAnimationFrame(frame);
  }

  function sync() {
    const mode = document.documentElement.dataset.motion;
    // The entry intro covers the page, so nothing underneath is drawn while it runs and its frames are never counted against this scene.
    const run = visible && mode === 'full' && !exhausted && !document.documentElement.dataset.intro;
    if (run && !active) frameId = requestAnimationFrame(frame);
    if (!run && active) {
      cancelAnimationFrame(frameId);
      lastFrame = 0;
      clear();
      governor.pause();
      if (!document.hidden && visible && mode === 'reduced') draw(ctx!, 0);
    }
    if (run !== active) figure?.toggleAttribute('data-running', run);
    active = run;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio, canvas.clientWidth <= 768 ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === width && canvas.height === height && sized) return;
    const scale = Math.max(width / WIDTH, height / HEIGHT);
    canvas.width = width;
    canvas.height = height;
    // The backdrop is painted sharper than the screen needs so the camera can zoom in without it going soft.
    const sharp = Math.min(scale * MAP_OVERSAMPLE, MAP_MAX_PIXELS / WIDTH);
    map.width = Math.ceil(WIDTH * sharp);
    map.height = Math.ceil(HEIGHT * sharp);
    sized = true;
    base = { scale, ox: (width - WIDTH * scale) / 2, oy: (height - HEIGHT * scale) / 2 };
    backdrop!.setTransform(map.width / WIDTH, 0, 0, map.height / HEIGHT, 0, 0);
    drawMap(backdrop!);
    paintOverlay(width, height, dpr);
    draw(ctx!, 0);
  }

  function paintOverlay(width: number, height: number, px: number) {
    overlay.width = width;
    overlay.height = height;
    const o = overlay.getContext('2d');
    if (!o) return;
    o.fillStyle = ink;
    o.globalAlpha = 0.1;
    for (let line = 0; line < height; line += 4 * px) o.fillRect(0, line, width, px);
    // Dark corners: frames of ink laid one inside the other, each fainter than the last.
    const band = Math.min(width, height) * 0.03;
    o.strokeStyle = ink;
    o.lineWidth = band;
    for (let k = 0; k < 12; k++) {
      o.globalAlpha = 0.05 * ((12 - k) / 12) ** 1.5;
      const inset = band / 2 + k * band * 0.55;
      o.strokeRect(inset, inset, width - 2 * inset, height - 2 * inset);
    }
  }

  function move(event: PointerEvent) {
    if (!active || !event.isPrimary) return;
    const box = stage!.getBoundingClientRect();
    const scale = Math.max(box.width / WIDTH, box.height / HEIGHT);
    // From the screen back to the map, through the camera: undo the roll and the zoom, then the pan.
    const sx = (event.clientX - box.left - box.width / 2) / scale + MID_X - shot.cx;
    const sy = (event.clientY - box.top - box.height / 2) / scale + MID_Y - shot.cy;
    const cos = Math.cos(shot.roll);
    const sin = Math.sin(shot.roll);
    x = shot.x + (sx * cos + sy * sin) / shot.zoom;
    y = shot.y + (-sx * sin + sy * cos) / shot.zoom;
    if (debug) debug.interactions++;
  }

  function place(i: number, pos: number) {
    if (!active) return;
    const cone = cones[i]!;
    cone.pos = Math.max(-approaches[i]!.end + 40, Math.min(-104, pos));
    cone.until = time + CONE_LIFE;
    if (debug) debug.cones++;
  }

  function press(event: PointerEvent) {
    if (!active || !event.isPrimary || event.button !== 0) return;
    move(event);
    pressX = x;
    pressY = y;
  }

  function release(event: PointerEvent) {
    if (!active || !event.isPrimary) return;
    move(event);
    if (pressX >= 0 && Math.hypot(x - pressX, y - pressY) < 18) {
      const dx = x - MID_X, dy = y - MID_Y;
      // At home the press puts a cone on the nearest road, as before; with a chase on, it also blocks the racer's route if it lands near it.
      if (Math.abs(dx) < 300 && Math.abs(dy) < 210) {
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const index = horizontal ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3);
        place(index, -Math.abs(horizontal ? dx : dy));
      }
      blockRoute(x, y);
    }
    pressX = -1;
    if (event.pointerType === 'touch') clear();
  }

  /** Puts a roadblock on the racer's route, ahead of him, at the point nearest to (px, py) if that is within reach. */
  function blockRoute(px: number, py: number, ahead = 0) {
    const c = chase;
    if (!c || c.state !== 'run' || !active) return;
    const racer = c.actors[0]!;
    const from = racer.s + 70;
    const to = Math.min(c.path.length - 30, racer.s + 760);
    let best = -1;
    let bestDistance = ahead ? 0 : 70;
    if (ahead) best = Math.min(to, racer.s + ahead);
    else {
      for (let s = from; s <= to; s += 6) {
        const p = c.path.at(s);
        const distance = Math.hypot(p.x - px, p.y - py);
        if (distance < bestDistance) { bestDistance = distance; best = s; }
      }
    }
    if (best < 0 || best < from - 1) return;
    const p = c.path.at(best);
    blocks.push({ x: p.x, y: p.y, s: best, heading: p.h, until: time + CONE_LIFE });
    if (debug) debug.blocks++;
  }

  function drop() {
    // With a chase under way, the cone goes on its road, so the keyboard can stop it too: at the entry arm while he is still coming, then on his route ahead of him wherever he is.
    if (chase && chase.state === 'run') {
      if (chase.actors[0]!.s < chase.path.boxIn - 100) place(chase.approach, -137);
      else blockRoute(0, 0, 160);
      return;
    }
    // Otherwise pick a currently green approach so the effect is also visible from the keyboard.
    const phase = (time - held) % (SIGNAL_PHASE * 2);
    const axis = phase < SIGNAL_PHASE ? 0 : 1;
    place(axis + nextApproach * 2, -137);
    nextApproach = 1 - nextApproach;
  }

  function clear() { x = -1; pressX = -1; }
  const intersection = typeof IntersectionObserver === 'undefined' ? undefined :
    new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; sync(); });
  const size = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  intersection?.observe(canvas);
  size?.observe(canvas);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerdown', press);
  stage.addEventListener('pointerleave', clear);
  stage.addEventListener('pointercancel', clear);
  stage.addEventListener('pointerup', release);
  canvas.addEventListener('gridlock:cone', drop);
  window.addEventListener('resize', resize);
  window.addEventListener('gridlock:motion', sync);
  window.addEventListener('gridlock:intro', sync);
  resize();
  sync();

  return () => {
    cancelAnimationFrame(frameId);
    intersection?.disconnect();
    size?.disconnect();
    stage.removeEventListener('pointermove', move);
    stage.removeEventListener('pointerdown', press);
    stage.removeEventListener('pointerleave', clear);
    stage.removeEventListener('pointercancel', clear);
    stage.removeEventListener('pointerup', release);
    figure?.removeAttribute('data-running');
    figure?.removeAttribute('data-chase');
    figure?.removeAttribute('data-heat');
    canvas.removeEventListener('gridlock:cone', drop);
    window.removeEventListener('resize', resize);
    window.removeEventListener('gridlock:motion', sync);
    window.removeEventListener('gridlock:intro', sync);
    window.clearTimeout(retryTimer);
    if (host.__fx === debug) delete host.__fx;
  };
}
