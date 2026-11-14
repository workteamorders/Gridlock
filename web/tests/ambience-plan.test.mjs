import test from 'node:test';
import assert from 'node:assert/strict';
import { ambiencePlan } from '../src/lib/ambience-plan.ts';
import { lines } from '../src/components/fx/dispatch.ts';

test('engine follows throttle and nitro, drone remains audible at idle', () => {
 const coast=ambiencePlan(90,false,false,true), gas=ambiencePlan(90,true,false,true), nitro=ambiencePlan(90,true,true,true);
 assert.ok(gas.engineHz>coast.engineHz);
 assert.ok(gas.exhaustGain>coast.exhaustGain);
 assert.ok(nitro.engineHz>gas.engineHz && nitro.engineGain>gas.engineGain);
 const idle=ambiencePlan(0,false,false,false);
 assert.ok(idle.droneGain>0 && idle.engineGain<coast.engineGain);
 assert.ok(ambiencePlan(66,true,false,true).engineHz<ambiencePlan(64,true,false,true).engineHz,'gear shift drops RPM');
});

test('audio levels stay finite and bounded even for invalid scene speeds', () => {
 for(const speed of [-100,0,330,99999,NaN,Infinity]) {
  const p=ambiencePlan(speed,true,true,true);
  assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.engineGain<0.3 && p.droneGain<0.1);
 }
});

test('radio emotions reflect each speaker’s role in the event', () => {
 const escape=lines({kind:'escape',heat:3},()=>0);
 assert.equal(escape.find(l=>l.voice==='police').emotion,'frustrated');
 assert.equal(escape.find(l=>l.voice==='drone').emotion,'relieved');
 const wreck=lines({kind:'wipeout'},()=>0);
 assert.equal(wreck.find(l=>l.voice==='police').emotion,'panic');
 assert.equal(wreck.find(l=>l.voice==='drone').emotion,'urgent');
});
