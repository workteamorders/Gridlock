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
  const sprites = Array.from({ length: approaches.length * CARS_PER_APPROACH }, (_, i) => {
    const sprite = document.createElement('canvas');
    sprite.width = 72;
    sprite.height = 42;
    const g = sprite.getContext('2d');
    if (!g) return sprite;
    g.translate(36, 21);
    g.fillStyle = border;
    g.fillRect(-23, -15, 9, 30);
    g.fillRect(11, -15, 9, 30);
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.stroke(bodies[i % bodies.length]!);
    g.fillStyle = paint[i % paint.length]!;
    g.fill(bodies[i % bodies.length]!);
    g.fillStyle = ink;
    g.fill(glass[i % glass.length]!);
    g.fill(stripes[i % stripes.length]!);
    return sprite;
  });
  const cars = Array.from({ length: approaches.length * CARS_PER_APPROACH }, (_, i) => ({
    pos: STOP - (i % CARS_PER_APPROACH) * GAP,
    lane: LANE,
    speed: 0,
    cruise: 117 + i % 4 * 9,
  }));
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
  }

  function draw(g: CanvasRenderingContext2D, delta: number) {
    const phase = time % (SIGNAL_PHASE * 2);
    const axis = phase < SIGNAL_PHASE ? 0 : 1;
    const greenNow = phase % SIGNAL_PHASE < GREEN_TIME;
    if (debug) debug.axis = greenNow ? axis : -1;
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
        const speed = braking ? 44 : car.cruise;
        car.speed += (speed - car.speed) * Math.min(1, delta / (braking ? 75 : 270));
        if (debug && delta && braking) debug.brakes++;
        if (debug && delta && detour && car.lane > LANE + 10) debug.detours++;
        car.pos = Math.max(car.pos, Math.min(limit, car.pos + car.speed * delta / 1000));
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
        g.drawImage(sprites[j]!, -36, -21);
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
