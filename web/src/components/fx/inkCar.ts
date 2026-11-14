import { carBodies, carWindows } from '@/art/cars';

// Top-down companion to the three-quarter poster art. Cached by the junction;
// the background uses the same path tables, so all moving cars share the ink style.
const bodyPaths = () => carBodies.map(d => new Path2D(d));
let bodies: Path2D[] | undefined;
let glass: Path2D[] | undefined;
export function drawInkCar(g: CanvasRenderingContext2D, model: number, accent: string, ink: string, paper: string) {
  bodies ??= bodyPaths();
  glass ??= carWindows.map(d => new Path2D(d));
  const s = model % bodies.length;
  g.save();
  g.lineJoin = 'miter';
  g.fillStyle = ink;
  g.strokeStyle = paper;
  g.lineWidth = .65;
  for (const x of [-23, 15]) for (const y of [-14, 10]) {
    g.fillRect(x, y, 10, 4); g.strokeRect(x, y, 10, 4);
    g.beginPath(); g.moveTo(x + 2, y + 1); g.lineTo(x + 8, y + 1); g.stroke();
  }
  g.fillStyle = paper;
  g.fill(bodies[s]!);
  g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke(bodies[s]!);
  g.save(); g.clip(bodies[s]!);
  g.fillStyle = ink;
  g.fill(new Path2D('M-32 5L8 8L31 4V14H-32ZM14 -8L27 -5V5L14 8L17 0Z'));
  g.fill(glass![s]!);
  g.strokeStyle = paper; g.lineWidth = .7; g.stroke(glass![s]!);
  g.strokeStyle = ink; g.lineWidth = .65;
  g.stroke(new Path2D('M-22 -9L-17 -5V5L-22 9M13 -9L10 -5V5L13 9M-14 -10L-10 -11H5L9 -9M-14 10L-10 11H5L9 9'));
  g.fillStyle = paper;
  g.fill(new Path2D('M-10 -8L-7 -9L-1 7L-3 7ZM16 -7L18 -6L22 0L21 1Z'));
  g.fillStyle = accent;
  for (let n = 0; n < 6; n++) if (model & (1 << n)) g.fillRect(-12 + n * 3, -11, 1.5, 1.5);
  g.fillRect(-20, 10, 36, 1.2);
  g.fillRect(28, -8, 1, 16);
  for (let n = 0; n < 2 + model % 4; n++) g.fillRect(-26 + n * 2, -5, .8, 10);
  g.fillStyle = paper;
  g.fillRect(25, -8, 3, 2); g.fillRect(25, 6, 3, 2);
  g.restore();
  if (s === 1 || s === 5) {
    g.fillStyle = ink; g.strokeStyle = paper; g.lineWidth = .65;
    g.fillRect(-30, -13, 3, 26); g.strokeRect(-30, -13, 3, 26);
  }
  g.restore();
}
