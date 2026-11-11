import { carBodies, carPaint, carWindows, liveries } from '@/art/cars';
import { frameGovernor } from './governor';

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
  const paint = carPaint.map(color);
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
  const glows = { yellow: glowSprite(yellow), red: glowSprite(red), green: glowSprite(green) };
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
  const sprites = Array.from({ length: approaches.length * CARS_PER_APPROACH }, (_, i) => {
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
    g.fillStyle = paint[i % paint.length]!;
    g.fill(body);
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
    ? { frames: 0, times: [] as number[], interactions: 0, brakes: 0, cones: 0, detours: 0, axis: 0 }
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
  const governor = frameGovernor(cars.length);

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

  const widths = new Map<string, number>();
  function say(word: string, wx: number, wy: number) {
    if (effects < 8 || bursts.length >= 3 || time - lastBurst < 800) return;
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
    const phase = time % (SIGNAL_PHASE * 2);
    const axis = phase < SIGNAL_PHASE ? 0 : 1;
    const greenNow = phase % SIGNAL_PHASE < GREEN_TIME;
    if (debug) debug.axis = greenNow ? axis : -1;
    const greenAxis = greenNow ? axis : -1;
    if (delta && greenAxis !== lastGreen) {
      lastGreen = greenAxis;
      if (greenAxis >= 0) { const lead = approaches[greenAxis]!; say('VROOM!', MID_X + lead.x * (STOP + 22), MID_Y + lead.y * (STOP + 22) + lead.x * 40); }
    }
    g.drawImage(map, 0, 0, WIDTH, HEIGHT);

    if (x >= 0 && effects >= 8) {
      g.save();
      g.beginPath();
      g.arc(x, y, 87, 0, Math.PI * 2);
      g.clip();
      g.drawImage(spotlight, 0, 0);
      g.globalAlpha = 0.62;
      g.lineWidth = 1.5;
      g.strokeStyle = yellow;
      g.stroke();
      g.restore();
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
        const targetLane = detour || nearPointer ? DETOUR : LANE;
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
    if (effects >= 8) drawEffects(g);
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
    map.width = Math.ceil(WIDTH * scale);
    map.height = Math.ceil(HEIGHT * scale);
    sized = true;
    backdrop!.setTransform(map.width / WIDTH, 0, 0, map.height / HEIGHT, 0, 0);
    drawMap(backdrop!);
    ctx!.setTransform(scale, 0, 0, scale, (width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2);
    draw(ctx!, 0);
  }

  function move(event: PointerEvent) {
    if (!active || !event.isPrimary) return;
    const box = stage!.getBoundingClientRect();
    const scale = Math.max(box.width / WIDTH, box.height / HEIGHT);
    x = (event.clientX - box.left - box.width / 2) / scale + MID_X;
    y = (event.clientY - box.top - box.height / 2) / scale + MID_Y;
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
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const index = horizontal ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3);
      place(index, -Math.abs(horizontal ? dx : dy));
    }
    pressX = -1;
    if (event.pointerType === 'touch') clear();
  }

  function drop() {
    // Pick a currently green approach so the effect is also visible from the keyboard.
    const phase = time % (SIGNAL_PHASE * 2);
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
    canvas.removeEventListener('gridlock:cone', drop);
    window.removeEventListener('resize', resize);
    window.removeEventListener('gridlock:motion', sync);
    window.removeEventListener('gridlock:intro', sync);
    window.clearTimeout(retryTimer);
    if (host.__fx === debug) delete host.__fx;
  };
}
