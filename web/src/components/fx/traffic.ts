import { carBodies, carWindows, liveries, carPaint } from '@/art/cars';
import { frameGovernor } from './governor';

const ROAD = 108;
const LANE = 8;
const RADIUS = 160;

export function startTraffic(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const palette = getComputedStyle(document.documentElement);
  const color = (name: string) => palette.getPropertyValue(name).trim();
  const road = color('--fx-road');
  const pointer = document.createElement('span');
  pointer.className = 'fx-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  canvas.after(pointer);
  const ink = color('--surface');
  const brake = color('--brush');
  const green = color('--ok');
  const colors = carPaint.map(color);
  const bodies = carBodies.map((d) => new Path2D(d));
  const windows = carWindows.map((d) => new Path2D(d));
  const stripes = liveries.map((d) => new Path2D(d));
  const cars = Array.from({ length: 36 }, (_, i) => ({ pos: 0, lane: 0, speed: 35 + i % 9 * 4 }));
  const marks = Array.from({ length: 12 }, () => ({ x: 0, y: 0, dx: 0, dy: 0, at: -Infinity }));
  const cones = Array.from({ length: 6 }, () => ({ x: 0, y: 0, at: -Infinity }));
  const diagnostic = /^(debug|off)$/.test(new URLSearchParams(location.search).get('motion') ?? '')
    ? { frames: 0, interactions: 0, brakes: 0, times: [] as number[] } : undefined;
  const host = window as Window & { __fx?: typeof diagnostic };
  if (diagnostic) host.__fx = diagnostic;

  let width = 0, height = 0, count = 0, staticCount = 0, mark = 0, cone = 0;
  let x = -999, y = -999, down = false, lastPointer = 0, offset = 0;
  let last = 0, time = 0, raf = 0, visible = true, active = false, exhausted = false;
  let governor = frameGovernor(36);

  function grid(g: CanvasRenderingContext2D, alpha: number, step: number, left = 0, top = 0, right = width, bottom = height) {
    g.strokeStyle = road;
    g.globalAlpha = alpha;
    g.lineWidth = 1;
    g.beginPath();
    for (let p = 36; p < width; p += ROAD) {
      g.moveTo(p - 14, 0); g.lineTo(p - 14, height);
      g.moveTo(p + 14, 0); g.lineTo(p + 14, height);
    }
    for (let p = 36; p < height; p += ROAD) {
      g.moveTo(0, p - 14); g.lineTo(width, p - 14);
      g.moveTo(0, p + 14); g.lineTo(width, p + 14);
    }
    g.stroke();
    g.fillStyle = road;
    g.globalAlpha = alpha * 0.65;
    g.beginPath();
    for (let row = Math.floor(top / step) * step; row < bottom; row += step) {
      for (let col = Math.floor(left / step) * step; col < right; col += step) {
        g.moveTo(col + 1, row); g.arc(col, row, 1, 0, Math.PI * 2);
      }
    }
    g.fill();
  }

  // Cache the unchanging roads and dots in a detached bitmap surface.
  const backdrop = document.createElement('canvas');
  const roads = backdrop.getContext('2d');
  function paint(g: CanvasRenderingContext2D, delta: number) {
    g.clearRect(0, 0, width, height);
    g.globalAlpha = 1;
    g.drawImage(backdrop, 0, 0, width, height);
    if (x >= 0) {
      g.save();
      g.beginPath(); g.arc(x, y, RADIUS, 0, Math.PI * 2); g.clip();
      grid(g, 0.94, 9, x - RADIUS, y - RADIUS, x + RADIUS, y + RADIUS);
      g.restore();
    }

    for (let row = 36; row < height; row += ROAD) {
      for (let col = 36; col < width; col += ROAD) {
        g.fillStyle = (time / 2800 + (row + col) / ROAD) % 2 < 1 ? brake : green;
        g.globalAlpha = 0.52;
        g.fillRect(col + 15, row + 15, 4, 8);
      }
    }
    for (let i = 0; i < count; i++) {
      const car = cars[i]!;
      const vertical = i % 2 === 0;
      const span = vertical ? height : width;
      const cross = vertical ? width : height;
      const direction = i % 4 < 2 ? 1 : -1;
      const roadIndex = Math.floor(i / 2) % Math.max(1, Math.ceil((cross - 36) / ROAD));
      const roadCenter = 36 + roadIndex * ROAD;
      const cx = vertical ? roadCenter + car.lane : car.pos;
      const cy = vertical ? car.pos : roadCenter + car.lane;
      const dx = cx - x, dy = cy - y;
      let obstacle = dx * dx + dy * dy < 64 * 64;
      for (let j = 0; j < cones.length; j++) {
        const item = cones[j]!;
        if (time - item.at < 4200 && Math.abs(cx - item.x) < 52 && Math.abs(cy - item.y) < 52) obstacle = true;
      }
      const signal = (time / 2800 + roadIndex + Math.round((car.pos - 36) / ROAD)) % 2 < 1;
      const approach = ((36 - car.pos) * direction + ROAD * 10000) % ROAD;
      const waiting = signal && approach >= 14 && approach < 28;
      const target = (obstacle ? -1 : 1) * direction * LANE;
      car.lane += (target - car.lane) * Math.min(1, delta / 250);
      const speed = waiting ? 0 : obstacle && Math.abs(target - car.lane) > 4 ? 0.25 : 1;
      if (diagnostic && obstacle && speed < 1 && delta) diagnostic.brakes++;
      car.pos += car.speed * speed * delta / 1000 * direction;
      if (car.pos > span + 16) car.pos = -16;
      if (car.pos < -16) car.pos = span + 16;
      g.save();
      g.translate(cx, cy);
      g.rotate(vertical ? direction * Math.PI / 2 : direction < 0 ? Math.PI : 0);
      g.scale(0.33, 0.33);
      g.globalAlpha = 0.95;
      g.fillStyle = colors[i % colors.length]!;
      g.fill(bodies[i % bodies.length]!);
      g.fillStyle = ink;
      g.fill(windows[i % windows.length]!);
      g.fill(stripes[i % stripes.length]!);
      g.restore();
    }

    for (let i = 0; i < marks.length; i++) {
      const m = marks[i]!;
      const life = 1 - (time - m.at) / 1500;
      if (life <= 0) continue;
      g.globalAlpha = life * 0.8;
      g.lineWidth = 3;
      g.strokeStyle = road;
      g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x + m.dx, m.y + m.dy); g.stroke();
    }
    for (let i = 0; i < cones.length; i++) {
      const c = cones[i]!;
      const life = Math.min(1, (4200 - (time - c.at)) / 600);
      if (life <= 0) continue;
      g.globalAlpha = life;
      g.fillStyle = brake;
      g.beginPath(); g.moveTo(c.x, c.y - 10); g.lineTo(c.x + 6, c.y + 5); g.lineTo(c.x - 6, c.y + 5); g.fill();
      g.fillStyle = road;
      g.fillRect(c.x - 8, c.y + 5, 16, 3);
    }
    if (diagnostic) diagnostic.frames++;
  }

  function frame(now: number) {
    if (!ctx) return;
    raf = 0;
    const delta = last ? now - last : 0;
    last = now;
    if (delta) {
      if (diagnostic && diagnostic.times.length < 900) diagnostic.times.push(delta);
      const next = governor.sample(delta);
      if (next === 0) { exhausted = true; sync(); paint(ctx, 0); return; }
      count = next;
    }
    time += Math.min(50, delta);
    paint(ctx, Math.min(50, delta));
    raf = requestAnimationFrame(frame);
  }

  function scroll() {
    offset = active ? Math.min(40, window.scrollY * 0.08) : 0;
    canvas.style.transform = `translateY(${-offset}px)`;
  }

  function sync() {
    const mode = document.documentElement.dataset.motion;
    const animate = visible && mode === 'full' && !exhausted;
    const settle = active && !animate && visible && !document.hidden && mode === 'reduced';
    if (animate && !raf) raf = requestAnimationFrame(frame);
    if (!animate) {
      cancelAnimationFrame(raf);
      raf = 0; last = 0; clearPointer();
      governor.pause();
    }
    active = animate;
    scroll();
    if (settle && ctx) paint(ctx, 0);
  }

  function resize() {
    if (!ctx || !roads) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const compact = width <= 768;
    const dpr = Math.min(devicePixelRatio, compact ? 1.5 : 2);
    canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
    backdrop.width = Math.ceil(width * dpr); backdrop.height = Math.ceil(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roads.setTransform(dpr, 0, 0, dpr, 0, 0);
    grid(roads, 0.33, 18);
    count = compact ? 14 : 36;
    if (staticCount !== count) {
      governor = frameGovernor(count);
      staticCount = count;
    }
    for (let i = 0; i < cars.length; i++) {
      cars[i]!.pos = ((i * 137 + 31) % 997) / 997 * (i % 2 === 0 ? height : width);
      cars[i]!.lane = i % 4 < 2 ? LANE : -LANE;
    }
    paint(ctx, 0);
    sync();
  }

  function move(event: PointerEvent) {
    if (!active || (event.pointerType === 'touch' && !down)) return;
    const nextY = event.clientY + offset;
    const dx = event.clientX - x, dy = nextY - y;
    const elapsed = event.timeStamp - lastPointer;
    if (x >= 0 && elapsed < 80 && dx * dx + dy * dy > 24 * 24) {
      const length = Math.hypot(dx, dy);
      Object.assign(marks[mark]!, { x, y, dx: dx / length * 23, dy: dy / length * 23, at: time });
      mark = (mark + 1) % marks.length;
    }
    x = event.clientX; y = nextY; lastPointer = event.timeStamp;
    const showRing = event.pointerType === 'mouse' && event.target instanceof Element &&
      (event.target.closest('.card-tilt') !== null || document.documentElement.dataset.fxRoute === 'mint');
    pointer.toggleAttribute('data-visible', showRing);
    if (showRing) pointer.style.transform = `translate(${x}px, ${event.clientY}px)`;
    if (diagnostic) diagnostic.interactions++;
  }

  function place(event: PointerEvent) {
    if (!active || !event.isPrimary || event.button !== 0) return;
    down = true;
    move(event);
    Object.assign(cones[cone]!, { x, y, at: time });
    cone = (cone + 1) % cones.length;
  }

  function release(event: PointerEvent) {
    if (event.pointerType === 'touch') clearPointer();
  }

  function clearPointer() { x = -999; y = -999; down = false; pointer.removeAttribute('data-visible'); }
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; sync(); });
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', place, { passive: true });
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', clearPointer);
  document.documentElement.addEventListener('pointerleave', clearPointer);
  window.addEventListener('gridlock:motion', sync);
  resize();
  return () => {
    observer?.disconnect();
    pointer.remove();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', scroll);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerdown', place);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', clearPointer);
    document.documentElement.removeEventListener('pointerleave', clearPointer);
    window.removeEventListener('gridlock:motion', sync);
    if (host.__fx === diagnostic) delete host.__fx;
  };
}
