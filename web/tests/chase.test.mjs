import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, MISHAPS, mulberry32, planChase, forcePlan, signature, buildPath } from '../src/components/fx/chase-plan.ts';

const geometry = { mid: { x: 280, y: 180 }, box: 49, reach: (d) => (Math.abs(d.x) > 0 ? 312 : 212) };
const DIRECTIONS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

test('the same seed gives the same chases and different seeds give different ones', () => {
  const run = (seed) => { const rng = mulberry32(seed); let prev; return Array.from({ length: 12 }, () => (prev = planChase(rng, prev))).map(signature).join(' ; '); };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('a chase never repeats the one before it, and every route and mishap turns up', () => {
  const rng = mulberry32(2026);
  const routes = new Set();
  const kinds = new Set();
  const cops = new Set();
  let prev;
  for (let i = 0; i < 600; i++) {
    const plan = planChase(rng, prev);
    if (prev) assert.notEqual(signature(plan), signature(prev));
    routes.add(plan.route);
    cops.add(plan.cops);
    for (const m of plan.mishaps) kinds.add(m.kind);
    prev = plan;
  }
  assert.deepEqual([...routes].sort(), [...ROUTES].sort());
  assert.deepEqual([...kinds].sort(), [...MISHAPS].sort());
  assert.deepEqual([...cops].sort(), [1, 2, 3]);
});

test('plans stay inside sane bounds', () => {
  const rng = mulberry32(99);
  let clean = 0;
  for (let i = 0; i < 800; i++) {
    const plan = planChase(rng);
    assert.ok(plan.speed >= 150 && plan.speed <= 195);
    assert.ok([1, -1].includes(plan.side));
    assert.ok(plan.mishaps.length <= 2);
    assert.equal(new Set(plan.mishaps.map((m) => m.kind)).size, plan.mishaps.length, 'no mishap twice');
    assert.ok(plan.mishaps.filter((m) => m.kind === 'wipeout' || m.kind === 'pit').length <= 1, 'at most one thing stops the racer');
    for (const m of plan.mishaps) {
      assert.ok(m.offset >= -20 && m.offset <= 40);
      assert.ok(m.slot >= 0 && m.slot <= plan.cops);
      if (m.kind === 'pileup') assert.ok(plan.cops >= 2);
      if (m.kind === 'copSpin') assert.ok(m.slot >= 1);
    }
    if (plan.nitro !== null) assert.ok(plan.nitro < 0 && plan.nitro >= -260);
    if (!plan.mishaps.length) clean++;
  }
  assert.ok(clean > 80 && clean < 400, `plain chases are a fair share (${clean} of 800)`);
});

test('forced plans for tests lay routes and mishaps over a drawn plan', () => {
  const plan = forcePlan('uturn,wipeout', mulberry32(1));
  assert.equal(plan.route, 'uturn');
  assert.deepEqual(plan.mishaps.map((m) => m.kind), ['wipeout']);
  assert.deepEqual(forcePlan('right,clean', mulberry32(1)).mishaps, []);
  assert.equal(forcePlan('pileup', mulberry32(3)).cops >= 2, true);
  assert.equal(forcePlan('pitwin,pit', mulberry32(3)).pitWins, true);
});

test('every route is a continuous line from beyond the screen, through the junction and out again', () => {
  for (const route of ROUTES) {
    for (const side of [1, -1]) {
      for (const d of DIRECTIONS) {
        const plan = { route, side, cops: 2, speed: 170, nitro: null, pitWins: true, mishaps: [] };
        const path = buildPath(plan, d, geometry, 130);
        assert.ok(path.length > 500 && path.length < 1400, `${route} length ${path.length}`);
        assert.ok(path.boxIn > 0 && path.boxIn < path.apex && path.apex < path.boxOut && path.boxOut < path.length, `${route} marks ${path.boxIn} ${path.apex} ${path.boxOut} ${path.length}`);
        // Starts and ends off the map, apex in the middle of the junction.
        const first = path.at(0);
        const end = path.at(path.length);
        const off = (p) => p.x < -10 || p.x > 570 || p.y < -10 || p.y > 370;
        assert.ok(off(first) && off(end), `${route} runs on and off the map`);
        const apex = path.at(path.apex);
        assert.ok(Math.hypot(apex.x - 280, apex.y - 180) < 60, `${route} apex near the middle`);
        for (let s = 0; s < path.length - 2; s += 2) {
          const a = path.at(s), b = path.at(s + 2);
          const gap = Math.hypot(b.x - a.x, b.y - a.y);
          assert.ok(gap > 1.6 && gap < 2.4, `${route} even spacing ${gap}`);
        }
      }
    }
  }
});

test('turns are sharp and a U-turn comes back the way it came', () => {
  const d = { x: 1, y: 0 };
  const turn = (route, side = 1) => buildPath({ route, side, cops: 1, speed: 170, nitro: null, pitWins: true, mishaps: [] }, d, geometry, 130);
  const turned = (path) => { const a = path.at(path.apex - 60).h, b = path.at(path.apex + 60).h; return Math.atan2(Math.sin(b - a), Math.cos(b - a)); };
  assert.ok(Math.abs(turned(turn('straight'))) < 0.01);
  // Heading turns clockwise (positive) for a right turn on a screen where y points down.
  assert.ok(turned(turn('right')) > 1.0, 'right bends right');
  assert.ok(turned(turn('left')) < -1.0, 'left bends left');
  const u = turn('uturn', 1);
  const exitHeading = u.at(u.length).h;
  assert.ok(Math.abs(Math.abs(exitHeading) - Math.PI) < 0.05, 'U-turn leaves the opposite way');
  const exitPoint = u.at(u.length);
  assert.ok(exitPoint.x < 0, 'and goes back off the left edge');
  const peak = Math.max(...Array.from(turn('right').k, Math.abs));
  assert.ok(peak > 0.02, `a turn has real curvature (${peak})`);
  const donut = turn('donut', 1);
  const around = [...Array(80)].map((_, i) => donut.at(donut.apex - 100 + i * 2.5));
  assert.ok(around.every((p) => Math.hypot(p.x - 280, p.y - 180) < 45), 'donut circles the junction');
});
