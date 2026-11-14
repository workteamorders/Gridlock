import test from 'node:test';
import assert from 'node:assert/strict';
import { RadioVoice, castVoices, deliveryFor } from '../src/components/fx/radioVoice.ts';
import { Feed } from '../src/components/fx/dispatch.ts';

const line = { voice: 'police', tag: 'UNIT 3', text: 'Gap 37. Closing in.', delay: 0 };
function fixture() {
 let enabled=true, carriers=0, stopped=0, canceled=0;
 const spoken=[], states=[];
 const voice=new RadioVoice({
  synth:{ getVoices:()=>[{lang:'en-US',name:'Local',localService:true}], speak:u=>spoken.push(u), cancel:()=>{canceled++;} },
  utterance:text=>({text}), enabled:()=>enabled,
  transmit:()=>{carriers++;return()=>{stopped++;};}, status:s=>states.push(s),
 });
 return {voice,spoken,states,mute:()=>{enabled=false;voice.stop();},stats:()=>({carriers,stopped,canceled})};
}

test('reads only the message and changing numbers, never the speaker label, in one transmission', () => {
 const f=fixture();
 assert.equal(f.voice.present(line),true);
 assert.equal(f.spoken[0].text,'Gap 37. Closing in.');
 assert.equal(f.spoken[0].lang,'en-US');
 assert.equal(f.voice.present({...line,text:'Next message.'}),false);
 assert.equal(f.spoken.length,1);
 f.spoken[0].onstart();assert.equal(f.stats().carriers,1);
 f.spoken[0].onend();assert.equal(f.stats().stopped,1);
 assert.equal(f.voice.busy,false);
 f.voice.dispose();
});

test('feed waits to reveal the next caption until the previous voice finishes', () => {
 const f=fixture();
 const feed=new Feed(l=>f.voice.present(l),()=>f.voice.busy);
 feed.push('start',[line,{...line,text:'Rolling.',delay:100}],0);
 assert.deepEqual(feed.visible(0).map(r=>r.text),[line.text]);
 assert.equal(feed.visible(1000).length,1);
 assert.equal(feed.visible(15000)[0].alpha,1,'current caption cannot fade during speech');
 assert.equal(feed.visible(15000)[0].chars,line.text.length);
 f.spoken[0].onend();
 const next=feed.visible(15001).at(-1);
 assert.equal(next.text,'Rolling.');assert.equal(next.age,0);
 assert.equal(f.spoken[1].text,'Rolling.');
 f.voice.dispose();
});

test('mute and disposal cancel owned speech, stop the carrier and ignore late callbacks', () => {
 const f=fixture();f.voice.present(line);const old=f.spoken[0];old.onstart();f.mute();
 assert.deepEqual(f.stats(),{carriers:1,stopped:1,canceled:1});
 old.onstart();old.onend();assert.equal(f.stats().carriers,1);
 assert.equal(f.voice.present(line),true);assert.equal(f.spoken.length,1);
 f.voice.dispose();assert.equal(f.stats().canceled,1);
});

test('unavailable speech and engine errors preserve readable text without an endless queue', () => {
 const f=fixture();f.voice.present(line);f.spoken[0].onerror();
 assert.equal(f.voice.busy,false);assert.equal(f.states.at(-1),'unavailable');
 assert.equal(f.voice.present(line),true);assert.equal(f.spoken.length,1);
 f.voice.retry();f.voice.present(line);assert.equal(f.spoken.length,2);f.voice.dispose();
 const voice=new RadioVoice({enabled:()=>true,transmit:()=>()=>{},status:()=>{}});
 assert.equal(voice.present(line),true);assert.equal(voice.busy,false);voice.dispose();
});

test('clearing pending radio messages does not replay old chatter on resume', () => {
 const f=fixture();const feed=new Feed(l=>f.voice.present(l),()=>f.voice.busy);
 feed.push('start',[line,{...line,text:'Stale.',delay:100}],0);feed.visible(0);
 f.voice.stop();feed.clearPending();feed.visible(10000);
 assert.equal(f.spoken.length,1);f.voice.dispose();
});


test('operator and all three police units keep distinct voice identities', () => {
 const voices=['Daniel','Samantha','Reed (English (United States))','Eddy (English (United States))','Moira'].map(name=>({name,lang:'en-US',localService:true}));
 const cast=castVoices(voices);
 assert.equal(new Set([...cast.values()].map(v=>v.name)).size,4);
 assert.equal(cast.get('drone').name,'Daniel');
 assert.equal(cast.has('racer'),false);
 assert.notEqual(cast.get('UNIT 1'),cast.get('UNIT 2'));
 assert.notEqual(cast.get('UNIT 2'),cast.get('UNIT 3'));
 assert.deepEqual([...castVoices([...voices].reverse()).values()].map(v=>v.name),[...cast.values()].map(v=>v.name),'voice list order does not change identities');
});

test('limited voice devices still get distinct police delivery and no invalid voice', () => {
 assert.equal(castVoices([]).size,0);
 const only={name:'Local',lang:'en-US',localService:true};
 assert.equal(castVoices([only]).get('UNIT 3'),only);
 const profiles=[1,2,3].map(n=>deliveryFor({...line,tag:`UNIT ${n}`}));
 assert.equal(new Set(profiles.map(p=>p.pitch)).size,3);
});

test('emotion changes urgency and intensity without rewriting the spoken message', () => {
 const calm=deliveryFor({...line,emotion:'calm'});
 const panic=deliveryFor({...line,emotion:'panic'});
 const relieved=deliveryFor({...line,emotion:'relieved'});
 assert.ok(panic.rate>calm.rate && panic.pitch>calm.pitch && panic.volume>calm.volume);
 assert.ok(relieved.rate<calm.rate);
 const f=fixture();f.voice.present({...line,emotion:'panic'});
 assert.equal(f.spoken[0].text,line.text);
 assert.equal(f.spoken[0].rate,panic.rate);f.voice.dispose();
});
