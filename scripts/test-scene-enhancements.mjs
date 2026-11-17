import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {perthLight,sceneAsset,createSceneClock} from '../world/scene-clock.js';
import {MORNING_GRADE,createSceneLighting} from '../world/scene-lighting.js';
const uniforms=()=>Object.fromEntries(['coast','winter','oldCoast','oldWinter','morning','oldMorning','twilight','lightProgress'].map(n=>[n,{value:0}]));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const at=hour=>new Date(Date.UTC(2026,9,30,hour-8));
function clockHarness(apply){
 const doc=new EventTarget();doc.hidden=false;let current=at(14),timer=null,removed=0;
 const clock=createSceneClock({initial:{choice:'auto',phase:'day'},hostDocument:doc,apply,now:()=>current,
  timers:{setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{timer=null;removed++;}}});
 return {clock,doc,setTime:date=>{current=date;},fire:()=>timer?.(),hasTimer:()=>!!timer,removed:()=>removed};
}
test('Perth phases use UTC+8 across every boundary, independent of visitor timezone',()=>{
 for(const [hour,phase] of [[0,'night'],[5,'night'],[6,'morning'],[10,'morning'],[11,'day'],[16,'day'],[17,'sunset'],[18,'sunset'],[19,'night']])
  assert.equal(perthLight(at(hour)).phase,phase);
 assert.equal(perthLight(new Date('2026-10-30T06:35:00Z')).time,'14:35');
 assert.equal(perthLight(new Date('2026-12-31T17:00:00Z')).time,'01:00');
});
test('only approved season/phase combinations resolve to local artwork',()=>{
 assert.equal(sceneAsset('coast','day'),'concept-coast-day-v1.webp');
 assert.equal(sceneAsset('winter','morning'),'concept-winter-day-v1.webp');
 assert.equal(sceneAsset('coast','sunset'),'concept-coast-v2.webp');
 assert.equal(sceneAsset('winter','night'),'concept-winter-dusk-v2.webp');
 assert.throws(()=>sceneAsset('elsewhere','day'));assert.throws(()=>sceneAsset('coast','unknown'));
});
test('the automatic clock suspends while hidden, resyncs on return and owns its timer',async()=>{
 const applied=[],h=clockHarness(async p=>applied.push(p));assert.ok(h.hasTimer());
 h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.hasTimer(),false);
 h.setTime(at(21));h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));
 await Promise.resolve();assert.deepEqual(applied,['night']);assert.equal(h.clock.state().phase,'night');
 h.clock.dispose();assert.equal(h.hasTimer(),false);
 h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.hasTimer(),false);
});
test('manual lighting survives clock updates and Auto explicitly resumes Perth time',async()=>{
 const applied=[],h=clockHarness(async p=>applied.push(p));
 await h.clock.select('sunset');h.setTime(at(22));h.fire();assert.equal(h.clock.state().phase,'sunset');
 await h.clock.select('auto');assert.equal(h.clock.state().phase,'night');h.clock.dispose();
 assert.deepEqual(applied,['sunset','night']);
});
test('choosing the current phase cancels a slower previous lighting selection',async()=>{
 const night=deferred(),applied=[],h=clockHarness(phase=>{applied.push(phase);return phase==='night'?night.promise:Promise.resolve();});
 const old=h.clock.select('night');await h.clock.select('day');night.resolve();assert.equal(await old,false);
 assert.equal(h.clock.state().phase,'day');assert.deepEqual(applied,['night','day']);h.clock.dispose();
});
test('failed automatic or manual lighting keeps the previous choice and phase',async()=>{
 const h=clockHarness(async()=>{throw Error('offline');});assert.equal(await h.clock.select('night'),false);
 assert.equal(h.clock.state().phase,'day');assert.equal(h.clock.state().choice,'auto');assert.equal(h.clock.state().pending,null);h.clock.dispose();
});
test('lighting downloads one startup image and only the requested season later',async()=>{
 const calls=[],u=uniforms(),light=createSceneLighting({uniforms:u,initial:'day',reduced:()=>true,texture:async file=>{calls.push(file);return file;}});
 await light.ready;assert.deepEqual(calls,['concept-coast-day-v1.webp']);
 await light.setPhase('night');assert.deepEqual(calls,['concept-coast-day-v1.webp','concept-coast-dusk-v2.webp']);
 await light.prepareSeason('winter');assert.equal(calls.at(-1),'concept-winter-dusk-v2.webp');
 assert.equal(u.winter.value,'concept-winter-dusk-v2.webp');light.dispose();
});
test('latest image selection wins and a failed image is retryable without erasing the last frame',async()=>{
 const pending=deferred(),u=uniforms();let attempts=0;
 const light=createSceneLighting({uniforms:u,initial:'sunset',reduced:()=>true,texture:async file=>{
  if(file.includes('dusk'))return pending.promise;
  if(file.includes('-day-')&&attempts++===0)throw Error('missing');return file;
 }});await light.ready;
 const night=light.setPhase('night');await light.setPhase('sunset');pending.resolve('night');assert.equal(await night,false);
 assert.equal(u.coast.value,'concept-coast-v2.webp');
 await assert.rejects(light.setPhase('day'));assert.equal(u.coast.value,'concept-coast-v2.webp');
 await light.setPhase('day');assert.equal(u.coast.value,'concept-coast-day-v1.webp');light.dispose();
});
test('a delayed season rechecks the active phase rather than displaying stale lighting',async()=>{
 const old=deferred(),u=uniforms(),calls=[];
 const light=createSceneLighting({uniforms:u,initial:'sunset',reduced:()=>true,texture:file=>{
  calls.push(file);return file==='concept-winter-v2.webp'?old.promise:Promise.resolve(file);
 }});await light.ready;const winter=light.prepareSeason('winter');await light.setPhase('day');old.resolve('old winter');await winter;
 assert.equal(u.winter.value,'concept-winter-day-v1.webp');assert.ok(calls.includes('concept-winter-day-v1.webp'));light.dispose();
});
test('animated phase crossfades settle, reduced motion is immediate, disposed loads cannot apply',async()=>{
 const u=uniforms(),light=createSceneLighting({uniforms:u,initial:'sunset',reduced:()=>false,texture:async file=>file});
 await light.ready;await light.setPhase('night');assert.equal(light.running(),true);light.step(.2);
 assert.ok(light.state().progress>0&&light.state().progress<1);light.step(2);assert.equal(light.running(),false);
 const pending=deferred(),v=uniforms(),cancelled=createSceneLighting({uniforms:v,initial:'day',reduced:()=>true,
  texture:file=>file.includes('dusk')?pending.promise:Promise.resolve(file)});
 await cancelled.ready;const loading=cancelled.setPhase('night');cancelled.dispose();pending.resolve('unused');assert.equal(await loading,false);
 assert.equal(v.coast.value,'concept-coast-day-v1.webp');light.dispose();
});
test('daylight images retain the calibrated size and do not exceed the previous startup image budget',()=>{
 const data=JSON.parse(readFileSync(new URL('../art/outdoor/daylight-scenes.json',import.meta.url),'utf8'));
 for(const [season,entry] of Object.entries(data.assets)){
  assert.deepEqual(entry.size,[1672,941]);assert.ok(entry.bytes<=(season==='coast'?264996:309082));
  assert.equal(readFileSync(new URL('../'+entry.path,import.meta.url)).byteLength,entry.bytes);
 }
});

test('startup crossing a Perth phase boundary synchronizes the loaded scene before the next timer',async()=>{
 const doc=new EventTarget();doc.hidden=false;const applied=[];
 const clock=createSceneClock({initial:{choice:'auto',phase:'day'},hostDocument:doc,now:()=>at(21),
  apply:async phase=>applied.push(phase),timers:{setTimeout:()=>1,clearTimeout:()=>{}}});
 await Promise.resolve();assert.deepEqual(applied,['night']);assert.equal(clock.state().phase,'night');clock.dispose();
});

test('a region changing during a light request never receives the other season image',async()=>{
 const pending=deferred(),u=uniforms();u.season={value:0};
 const light=createSceneLighting({uniforms:u,initial:'sunset',reduced:()=>true,
  texture:file=>file==='concept-coast-dusk-v2.webp'?pending.promise:Promise.resolve(file)});
 await light.ready;const night=light.setPhase('night');light.setRegion('winter');u.season.value=1;
 pending.resolve('concept-coast-dusk-v2.webp');await night;
 assert.equal(u.winter.value,'concept-winter-dusk-v2.webp');assert.equal(light.state().files.winter,'concept-winter-dusk-v2.webp');light.dispose();
});
test('changing light mid-season prepares both visible sources before crossfading',async()=>{
 const u=uniforms();u.season={value:.3};
 const light=createSceneLighting({uniforms:u,initial:'sunset',reduced:()=>true,texture:async file=>file});
 await light.ready;await light.prepareSeason('winter');await light.setPhase('night');
 assert.equal(u.coast.value,'concept-coast-dusk-v2.webp');assert.equal(u.winter.value,'concept-winter-dusk-v2.webp');light.dispose();
});

// The former haze came from positive RGB offsets lifting a black pixel.
test('morning adds warmth without raising blacks or flattening neutral contrast',()=>{
 const grade=x=>MORNING_GRADE.scale.map((s,i)=>Math.max(0,Math.min(1,x*s+MORNING_GRADE.offset[i])));
 assert.deepEqual(grade(0),[0,0,0]);
 const mid=grade(.5);assert.ok(mid[0]>mid[1]&&mid[1]>mid[2]);
 assert.ok(grade(.75)[1]-grade(.25)[1]>=.5);
});
