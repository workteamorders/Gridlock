import test from 'node:test';
import assert from 'node:assert/strict';
import { lines, Feed, FEED, MAX_LINE } from '../src/components/fx/dispatch.ts';

const ROUTES = ['straight', 'right', 'left', 'uturn', 'donut'];
const REPORTS = [
  { kind: 'quiet', waiting: 4, block: 21408114, confirmed: 3, reverted: 1, gate: 'EAST-WEST', first: false },
  { kind: 'quiet', waiting: 0, block: 21408114, confirmed: 0, reverted: 0, gate: 'NORTH-SOUTH', first: true },
  { kind: 'start', cops: 1, gate: 'WEST' }, { kind: 'start', cops: 3, gate: 'NORTH' },
  ...ROUTES.map((route, i) => ({ kind: 'junction', index: i + 1, route })),
  { kind: 'telemetry', fee: 182, gap: 31 }, { kind: 'telemetry', fee: 160, gap: 74 },
  { kind: 'nitro' }, { kind: 'slide' }, { kind: 'copSpin', unit: 2, junction: 2 }, { kind: 'pileup' },
  { kind: 'pitWin' }, { kind: 'pitMiss' }, { kind: 'wipeout' }, { kind: 'block', ahead: 214 }, { kind: 'reverted' },
  { kind: 'escape', heat: 3 },
];
const picks = [0, 1, 2, 3].map((i) => (n) => i % n);

test('every report speaks in known voices, in short lines, with sensible delays, in all wordings', () => {
  const voices = new Set();
  for (const report of REPORTS) for (const pick of picks) {
    const batch = lines(report, pick);
    assert.ok(batch.length >= 1, report.kind);
    assert.equal(batch[0].delay, 0, `${report.kind}: the first line is spoken at once`);
    for (const l of batch) {
      voices.add(l.voice);
      assert.ok(['drone', 'police', 'racer'].includes(l.voice));
      assert.ok(l.delay >= 0 && l.delay <= 1200, `${report.kind}: delay ${l.delay}`);
      const full = `${l.tag}: ${l.text}`;
      assert.ok(full.length <= MAX_LINE, `"${full}" is ${full.length} characters`);
      assert.doesNotMatch(full, /\b(invest\w*|profits?|guarantee\w*|rewards?|rare\w*|hurry|official|random\w*|safe|secure[ds]?|verified|audited)\b/i);
      assert.doesNotMatch(full, /0x[0-9a-f]{6,}/i, 'no line looks like a real hash');
    }
  }
  assert.deepEqual([...voices].sort(), ['drone', 'police', 'racer']);
});

test('the lines carry the numbers they were given', () => {
  const text = (r) => lines(r, picks[0]).map((l) => l.text).join(' ');
  assert.match(text({ kind: 'escape', heat: 4 }), /Congestion 4 of 5/);
  assert.match(text({ kind: 'block', ahead: 214 }), /214 m/);
  assert.match(text({ kind: 'telemetry', fee: 182, gap: 31 }), /182 gwei.*31/);
  assert.match(text({ kind: 'copSpin', unit: 3, junction: 2 }), /unit 3.*junction 2/);
  assert.match(text({ kind: 'junction', index: 2, route: 'uturn' }), /junction 2/);
  assert.ok(lines({ kind: 'copSpin', unit: 3, junction: 2 }, picks[0])[0].tag === 'UNIT 3');
  assert.match(text({ kind: 'start', cops: 1, gate: 'WEST' }), /1 bot\b[\s\S]*1 unit\b/);
  assert.match(text({ kind: 'start', cops: 3, gate: 'WEST' }), /3 bots[\s\S]*3 units/);
});

test('the feed holds lines until they are due, types them out, fades them and keeps at most four', () => {
  const feed = new Feed();
  assert.equal(feed.push('escape', lines({ kind: 'escape', heat: 1 }, picks[0]), 1000), true);
  assert.equal(feed.visible(1000).length, 1, 'the first line is spoken at once');
  assert.equal(feed.visible(1399).length, 1);
  assert.equal(feed.visible(1400).length, 2, 'the second voice answers 400 ms later');
  assert.equal(feed.visible(1800).length, 3);
  const first = feed.visible(1000 + 5 * FEED.charMs)[0];
  assert.equal(first.chars, 5, 'typed out at a steady pace');
  assert.ok(first.alpha === 1);
  const late = feed.visible(1000 + FEED.longTtl - 300);
  assert.ok(late[0].alpha > 0 && late[0].alpha < 0.5, 'fading near the end');
  assert.equal(feed.visible(1000 + FEED.longTtl + 900).length, 0, 'everything is gone in the end');
  const crowd = new Feed();
  for (let i = 0; i < 6; i++) crowd.push(['nitro', 'slide', 'pileup', 'pitWin', 'wipeout', 'reverted'][i], [{ voice: 'drone', tag: 'NODE 7', text: `line ${i}`, delay: 0 }], 100 + i);
  assert.equal(crowd.visible(200).length, FEED.max);
  assert.equal(crowd.visible(200).at(-1).text, 'line 5', 'the newest stays and the oldest go');
});

test('a repeat of the same kind within a moment is dropped, a different kind is not, and idle chatter waits for quiet', () => {
  const feed = new Feed();
  const one = lines({ kind: 'nitro' }, picks[0]);
  assert.equal(feed.push('nitro', one, 0), true);
  assert.equal(feed.push('nitro', one, FEED.dedupe - 1), false);
  assert.equal(feed.push('slide', lines({ kind: 'slide' }, picks[0]), 10), true);
  assert.equal(feed.push('nitro', one, FEED.dedupe + 5), true);
  const idle = new Feed();
  assert.equal(idle.quiet(0), true);
  idle.push('escape', lines({ kind: 'escape', heat: 1 }, picks[0]), 100);
  assert.equal(idle.quiet(500), false, 'busy while lines are waiting or fresh');
  assert.equal(idle.quiet(100 + FEED.longTtl + 100), true);
});
