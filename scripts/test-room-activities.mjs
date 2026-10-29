import test from 'node:test';
import assert from 'node:assert/strict';
import {JugglingRound,FibonacciSketch} from '../room-activities.js';

test('a ball falls under gravity and ends an unattended round',()=>{
 const g=new JugglingRound();g.start();for(let i=0;i<200;i++)g.update(1/120);
 assert.equal(g.phase,'lost');assert.equal(g.y,.115);assert.equal(g.score,0);assert.equal(g.kick(),false);
});
test('only a descending ball in reach scores; spam cannot count extra returns',()=>{
 const g=new JugglingRound();g.start();assert.equal(g.kick(),false);
 while(!g.canKick&&g.phase==='playing')g.update(1/120);
 assert.equal(g.kick(),true);assert.equal(g.score,1);assert.equal(g.kick(),false);assert.equal(g.score,1);
 for(let i=0;i<300;i++)g.update(1/120);assert.equal(g.phase,'lost');assert.equal(g.best,1);
});
test('retry resets the round and retains its local best',()=>{
 const g=new JugglingRound();g.start();while(!g.canKick)g.update(1/120);g.kick();
 g.start();assert.equal(g.score,0);assert.equal(g.best,1);assert.equal(g.phase,'playing');
 g.cancel();assert.equal(g.phase,'ready');assert.equal(g.best,1);
});
test('Fibonacci values remain exact beyond Number precision and ten terms',()=>{
 const s=new FibonacciSketch();for(let i=0;i<100;i++)s.append();
 assert.equal(s.previous,354224848179261915075n);assert.equal(s.count,100);assert.equal(s.tiles.length,12);
 for(const t of s.drawing().tiles)assert.ok([t.x,t.y,t.w,t.h].every(Number.isFinite));
});
test('a thousand extensions keep drawing work bounded without stopping the sequence',()=>{
 const s=new FibonacciSketch();for(let i=0;i<1000;i++)s.append();
 assert.equal(s.count,1000);assert.equal(String(s.previous).length,209);assert.equal(s.drawing().tiles.length,12);
 assert.ok(s.drawing().aspect>1&&s.drawing().aspect<2);
});

import {ReadingShelf,readingCategories,readings} from '../room-reading.js';
test('reading choices stay in their category without consecutive repeats',()=>{
 const shelf=new ReadingShelf(()=>0);
 for(const [category] of readingCategories){let previous='';for(let i=0;i<20;i++){const article=shelf.pick(category);assert.equal(article.category,category);assert.notEqual(article.id,previous);assert.ok(article.source.startsWith('https://'));previous=article.id;}}
 assert.equal(shelf.pick('unknown').category,'apps');
});

test('the expanded shelf contains six complete, attributed chapters',()=>{
 assert.equal(readingCategories.length,6);assert.equal(readings.length,30);
 assert.equal(new Set(readings.map(r=>r.id)).size,30);
 for(const [category] of readingCategories)assert.equal(readings.filter(r=>r.category===category).length,5);
 for(const r of readings){
  assert.equal(r.keyIdeas.length,3);assert.equal(new Set(r.keyIdeas).size,3);
  assert.ok(r.keyIdeas.every(idea=>idea.length>30));
  assert.ok(r.author&&r.publisher&&r.intro&&r.prompt&&r.access);
  assert.ok(r.source.startsWith('https://')&&r.basis.url.startsWith('https://'));
  assert.equal(r.sourceChecked.httpStatus,200);assert.equal(r.basis.httpStatus,200);
  assert.ok(r.exerciseMinutes>0);
  assert.equal(Object.hasOwn(r,'detail'),false,'Repeated generic advice was removed');
  assert.doesNotMatch([r.intro,...r.keyIdeas,r.prompt].join(' '),/publisher.s overview|supports these themes/i);
  assert.ok(r.displayTitle.length<=r.title.length);
  const words=r.intro.split(/\s+/).length;
  assert.ok(words>=30&&words<=40,r.catalogueId+': a substantial why-read-it introduction');
  const sentences=(r.intro.match(/[.!?](?:\s|$)/g)||[]).length;
  assert.ok(sentences>=2&&sentences<=3,r.catalogueId+': two or three sentences');
  if(r.paid)assert.match(r.access,/Paid book/);
 }
});
test('chapter stepping visits all five readings and wraps within the chapter',()=>{
 const shelf=new ReadingShelf();
 for(const [category] of readingCategories){
  const first=readings.find(r=>r.category===category);shelf.select(first.id);const seen=new Set();
  for(let i=0;i<5;i++){seen.add(shelf.current);assert.equal(shelf.next().category,category);}
  assert.equal(seen.size,5);assert.equal(shelf.current,first.id);
 }
});
test('global suggestions reach every chapter and never immediately repeat a selection',()=>{
 let seed=17;const shelf=new ReadingShelf(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
 const seen=new Set();shelf.select('apps-3');let previous=shelf.current;
 for(let i=0;i<500;i++){
  const r=shelf.suggest();assert.notEqual(r.id,previous);assert.equal(shelf.category,r.category);
  seen.add(r.id);previous=r.id;
 }
 assert.equal(seen.size,30);
});
test('article-only consumers remain usable after adding explicit reading kinds',()=>{
 const shelf=new ReadingShelf(()=>0,{books:false});
 for(const [category] of readingCategories){assert.notEqual(shelf.pick(category).kind,'Book');}
 const before=shelf.current;assert.equal(shelf.select('not-a-reading'),null);assert.equal(shelf.current,before);
});
