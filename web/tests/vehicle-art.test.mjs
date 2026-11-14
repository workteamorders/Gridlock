import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vehicleSvg, models } from '../scripts/vehicle-art.mjs';

test('each ladder car and hunt car has a distinct vehicle drawing, without its card labels', () => {
 const caps=[10,20,30,45,65,85,110,140,170,200,240,280,320,360,400];
 const drawings=new Set();
 for(let rank=1;rank<=15;rank++) for(let serial=1;serial<=caps[rank-1];serial++) {
  // Even fixing body and accent cannot erase the individual livery identity.
  drawings.add(vehicleSvg(0,'#e4262b',rank*512+serial));
 }
 for(let i=0;i<12;i++) drawings.add(vehicleSvg(0,'#e4262b',8192+i));
 assert.equal(drawings.size,2487);
});

test('all six body families are original standalone vectors with no external assets', () => {
 assert.equal(new Set(models.map(m=>m.roof)).size,6);
 for(let i=0;i<6;i++) {
  const drawing=vehicleSvg(i);
  assert.doesNotMatch(drawing, /<image|href|<script|<filter|<animate|ACCENT/);
  assert.match(drawing, /#ffffff/);
  assert.match(drawing, /#0b0b0c/);
 }
});
