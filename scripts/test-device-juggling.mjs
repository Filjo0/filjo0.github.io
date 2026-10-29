import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DeviceJugglingRound} from '../world/juggling-round.js';
function reachKick(round){for(let i=0;i<500&&!round.canKick&&round.phase==='playing';i++)round.update(.005);return round.canKick;}
test('a drop loses; only an in-reach descending ball scores and mistimed spam has a recovery cost',()=>{
 const r=new DeviceJugglingRound();r.start();assert.equal(r.kick(),false);assert.equal(r.score,0);assert.ok(r.cooldown>0);
 assert.ok(reachKick(r));const y=r.y;assert.equal(r.kick(),true);assert.equal(r.y,y);assert.ok(r.velocity>0);assert.equal(r.score,1);
 assert.equal(r.kick(),false);assert.equal(r.score,1);
 for(let i=0;i<400;i++)r.update(.01);assert.equal(r.phase,'lost');assert.equal(r.kick(),false);
});
test('progressing rounds have faster flights, narrower windows and actual sideways drift requiring nudges',()=>{
 const r=new DeviceJugglingRound();r.start();let t=0,last=0;const intervals=[];
 for(let i=0;i<10000&&r.score<17;i++){
  r.update(.005);t+=.005;
  if(Math.abs(r.x-r.foot)>.11)r.nudge(Math.sign(r.x-r.foot));
  if(r.canKick){assert.equal(r.kick(),true);intervals.push(t-last);last=t;}
 }
 assert.equal(r.score,17);assert.ok(r.gravity>9.81*1.6);assert.ok(r.ceiling<.5);assert.ok(Math.abs(r.vx)>0);
 assert.ok(Math.max(...intervals.slice(1,4))>Math.min(...intervals.slice(-4))*1.3);
 assert.ok(Math.abs(r.foot)>0,'The player must move to follow the drifting ball');
});
test('nudging changes reach without moving the ball or awarding a kick',()=>{
 const r=new DeviceJugglingRound();r.start();assert.ok(reachKick(r));r.x=.25;
 assert.equal(r.canKick,false);assert.equal(r.kick(),false);r.nudge(1);
 assert.equal(r.x,.25);assert.equal(r.score,0);assert.equal(r.foot,.13);assert.equal(r.inReach,true);
});
test('new-best status compares with the previous record; retry and exit preserve best but reset round state',()=>{
 const r=new DeviceJugglingRound();r.start();reachKick(r);r.kick();assert.equal(r.record,true);assert.equal(r.best,1);
 r.start();assert.equal(r.score,0);assert.equal(r.best,1);assert.equal(r.record,false);
 reachKick(r);r.kick();assert.equal(r.record,false);reachKick(r);r.kick();assert.equal(r.record,true);
 r.cancel();assert.equal(r.best,2);assert.equal(r.phase,'ready');assert.equal(r.x,0);assert.equal(r.vx,0);assert.equal(r.foot,0);
});
