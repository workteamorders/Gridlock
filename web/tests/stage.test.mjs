// The new stage code keeps its logic in pure helpers so these checks cover what the motion depends on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLIMB_STEPS, capOfRank, climbProgress, climbStep, magnetOffset, rankAtStep, rollValue } from '../src/lib/stage.ts';
import { nearestToMiddle, trackerPosition } from '../src/lib/stage.ts';
import { planLength, soundPlan, stepFrequency, MIN_GAP, MASTER_GAIN, SOUND_KINDS } from '../src/lib/sound-plan.ts';
import { ribbonFacts } from '../src/components/stage/ribbon.ts';
import { makeHero } from '../scripts/make-hero.mjs';

const caps = [10, 20, 30, 45, 65, 85, 110, 140, 170, 200, 240, 280, 320, 360, 400];

test('climb: progress is clamped and maps to 15 steps from rank 15 down to rank 1', () => {
  assert.equal(climbProgress(100, 2400, 800), 0);
  assert.equal(climbProgress(-1600, 2400, 800), 1);
  assert.equal(climbProgress(-800, 2400, 800), 0.5);
  assert.equal(climbProgress(0, 700, 800), 0, 'a section shorter than the screen never divides by zero');
  assert.equal(climbStep(0), 0);
  assert.equal(climbStep(1), CLIMB_STEPS - 1);
  assert.equal(rankAtStep(climbStep(0)), 15);
  assert.equal(rankAtStep(climbStep(1)), 1);
  const seen = new Set();
  for (let i = 0; i <= 1000; i++) seen.add(climbStep(i / 1000));
  assert.equal(seen.size, 15);
  let last = -1;
  for (let i = 0; i <= 1000; i++) { const s = climbStep(i / 1000); assert.ok(s >= last); last = s; }
});

test('climb: caps shown for the ranks add up to the 2,475 ladder cars', () => {
  assert.equal(capOfRank(caps, 15), 400);
  assert.equal(capOfRank(caps, 1), 10);
  let total = 0;
  for (let i = 0; i < CLIMB_STEPS; i++) total += capOfRank(caps, rankAtStep(i));
  assert.equal(total, 2475);
});

test('rolling counter starts at the old value, ends exactly on the new one and never overshoots', () => {
  assert.equal(rollValue(10, 50, 0), 10);
  assert.equal(rollValue(10, 50, 1), 50);
  assert.equal(rollValue(10, 50, 2), 50);
  let last = 10;
  for (let t = 0; t <= 1; t += 0.05) { const v = rollValue(10, 50, t); assert.ok(v >= last && v <= 50); last = v; }
  let down = 50;
  for (let t = 0; t <= 1; t += 0.05) { const v = rollValue(50, 10, t); assert.ok(v <= down && v >= 10); down = v; }
});

test('magnetic pull is zero outside the radius and never above the maximum', () => {
  assert.deepEqual(magnetOffset(200, 0, 90, 7), [0, 0]);
  assert.deepEqual(magnetOffset(0, 0, 90, 7), [0, 0]);
  for (const [dx, dy] of [[10, 0], [0, -40], [30, 30], [-60, 20]]) {
    const [x, y] = magnetOffset(dx, dy, 90, 7);
    assert.ok(Math.hypot(x, y) <= 7);
    assert.ok(x * dx >= 0 && y * dy >= 0, 'leans toward the pointer');
  }
});

test('sound recipes are short, bounded and finite, and loud enough to hear', () => {
  assert.ok(MASTER_GAIN >= 0.4 && MASTER_GAIN <= 0.7);
  assert.deepEqual([...SOUND_KINDS].sort(), ['click', 'flip', 'hover', 'open', 'rev', 'siren', 'stamp', 'step', 'summit', 'whoosh']);
  assert.deepEqual(Object.keys(MIN_GAP).sort(), [...SOUND_KINDS].sort());
  for (const kind of SOUND_KINDS) {
    const plan = soundPlan(kind);
    assert.ok(plan.length >= 1);
    assert.ok(planLength(kind) <= 0.5, `${kind} is under half a second`);
    for (const t of plan) { assert.ok(t.gain > 0 && t.gain <= 1); assert.ok(t.length > 0 && t.at >= 0); if (t.wave !== 'noise') assert.ok(t.from >= 40 && t.to >= 40 && t.from <= 4000 && t.to <= 4000); }
    // Small speakers do not reproduce much below 150 Hz, so every recipe needs a tone above it.
    assert.ok(plan.some((t) => t.wave === 'noise' || Math.max(t.from, t.to) >= 300), `${kind} has audible content on small speakers`);
  }
});

test('climb notes rise with every step, stay in range and are not all the same', () => {
  const notes = Array.from({ length: 15 }, (_, i) => stepFrequency(i));
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i] > notes[i - 1], `step ${i} is higher than step ${i - 1}`);
  assert.ok(notes[0] >= 190 && notes[14] <= 1500);
  for (let i = 0; i < 15; i++) {
    const plan = soundPlan('step', i);
    assert.ok(plan.every((t) => t.from <= 4000 && t.to <= 4000), 'the octave above the top note stays in range');
    assert.ok(planLength('step', i) <= 0.2);
  }
});

test('ribbon shows fixed facts alone when nothing was read from the chain, and live numbers only from real input', () => {
  const none = ribbonFacts({ minted: null, open: null, next: null, royaltyPercent: 5 });
  assert.ok(none.length >= 5);
  assert.ok(!none.some((t) => /minted|left|opens by|open at/i.test(t)), 'no live claim without chain data');
  const live = ribbonFacts({ minted: 37, open: { rank: 13, left: 108, price: '0.005 ETH' }, next: null, royaltyPercent: 5 });
  assert.ok(live.includes('37 of 2,475 minted'));
  assert.ok(live.includes('Rank 13 open at 0.005 ETH'));
  assert.ok(live.includes('108 left at rank 13'));
  const banned = /\b(invest\w*|profits?|guarantee\w*|rewards?|rare\w*|hurry|last chance|fomo|moon)\b/i;
  for (const t of [...none, ...live]) assert.doesNotMatch(t, banned);
});

test('hero art generation is deterministic and checked-in files match', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gridlock-hero-'));
  try {
    const target = pathToFileURL(dir + '/');
    const source = new URL('../', import.meta.url);
    makeHero(target);
    makeHero(target);
    const hash = (root, name) => createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex');
    for (const name of ['public/art/hero-back.svg', 'public/art/hero-front.svg', 'public/art/climb-car.svg', 'public/art/example-card.svg']) {
      assert.equal(hash(target, name), hash(source, name), `${name} equals the checked-in file`);
      assert.doesNotMatch(readFileSync(new URL(name, source), 'utf8'), /<text|<image|href=/, 'hero art has no text or bitmaps');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the tracker picks the rung nearest the middle of the screen and maps ranks onto the road', () => {
  assert.equal(nearestToMiddle([], 400), -1);
  assert.equal(nearestToMiddle([100, 300, 520, 800], 400), 1);
  assert.equal(nearestToMiddle([-900, -200, 1200], 400), 1);
  assert.equal(trackerPosition(1), 0);
  assert.equal(trackerPosition(15), 1);
  assert.ok(trackerPosition(8) > 0.49 && trackerPosition(8) < 0.51);
  assert.equal(trackerPosition(99), 1);
});
