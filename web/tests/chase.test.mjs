import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, MISHAPS, mulberry32, planChase, forcePlan, signature, buildPath } from '../src/components/fx/chase-plan.ts';

const geometry = { mid: { x: 280, y: 180 }, box: 49, reach: (d) => (Math.abs(d.x) > 0 ? 312 : 212), spacing: (d) => (Math.abs(d.x) > 0 ? 560 : 360) };
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
    assert.ok(plan.then.length <= 2);
    for (const leg of plan.then) assert.ok(ROUTES.includes(leg.route) && [1, -1].includes(leg.side));
    assert.equal(new Set(plan.mishaps.map((m) => m.kind)).size, plan.mishaps.length, 'no mishap twice');
    assert.ok(plan.mishaps.filter((m) => m.kind === 'wipeout' || m.kind === 'pit').length <= 1, 'at most one thing stops the racer');
    for (const m of plan.mishaps) {
      assert.ok(m.offset >= -20 && m.offset <= 40);
      assert.ok(m.slot >= 0 && m.slot <= plan.cops);
      assert.ok(Number.isInteger(m.leg) && m.leg >= 0 && m.leg <= plan.then.length, 'mishap on a real junction');
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
        const plan = { route, side, then: [], cops: 2, speed: 170, nitro: null, pitWins: true, mishaps: [] };
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
  const turn = (route, side = 1) => buildPath({ route, side, then: [], cops: 1, speed: 170, nitro: null, pitWins: true, mishaps: [] }, d, geometry, 130);
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

test('a chase goes on through the next junctions and every bend is a real one', () => {
  const d = { x: 1, y: 0 };
  const plan = { route: 'right', side: 1, then: [{ route: 'left', side: 1 }, { route: 'uturn', side: -1 }], cops: 2, speed: 170, nitro: null, pitWins: true, mishaps: [] };
  const path = buildPath(plan, d, geometry, 150);
  assert.equal(path.legs.length, 3);
  // The right turn at home sends the chase down the screen, to the next junction 360 units below; the left turn there sends it east, 560 further.
  assert.deepEqual(path.legs[0].center, { x: 280, y: 180 });
  assert.deepEqual(path.legs[1].center, { x: 280, y: 540 });
  assert.deepEqual(path.legs[2].center, { x: 840, y: 540 });
  for (const leg of path.legs) {
    const apex = path.at(leg.apex);
    assert.ok(Math.hypot(apex.x - leg.center.x, apex.y - leg.center.y) < 60, 'apex is at its junction');
    assert.ok(leg.boxIn < leg.apex && leg.apex < leg.boxOut);
  }
  assert.ok(path.legs[1].boxIn > path.legs[0].boxOut + 150, 'real road between junctions');
  assert.ok(path.length > 1500 && path.length < 4000, `three junctions long ${path.length}`);
  const headings = path.legs.map((leg) => path.at(leg.apex + 60).h);
  assert.ok(headings[0] > 1.2 && headings[0] < 1.9, 'now heading down the screen');
  assert.ok(Math.abs(headings[1]) < 0.4, 'then east');
  assert.ok(Math.abs(Math.abs(headings[2]) - Math.PI) < 0.4, 'then back west after the U-turn');
  for (let s = 0; s < path.length - 2; s += 2) {
    const a = path.at(s), b = path.at(s + 2);
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(gap > 1.5 && gap < 2.5, `even spacing ${gap} at ${s}`);
  }
});

test('forced plans can name several junctions and the junction a mishap happens at', () => {
  const plan = forcePlan('right,left,copSpin,leg1', mulberry32(9));
  assert.equal(plan.route, 'right');
  assert.deepEqual(plan.then.map((leg) => leg.route), ['left']);
  assert.deepEqual(plan.mishaps.map((m) => [m.kind, m.leg]), [['copSpin', 1]]);
  assert.equal(forcePlan('uturn,wipeout', mulberry32(9)).then.length, 0);
});
