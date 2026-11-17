import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {qualityDigest} from './build-quality-evidence.mjs';
import {qualityStats} from '../world/quality-record.js';
const example=JSON.parse(readFileSync(new URL('../assets/quality-evidence.json',import.meta.url),'utf8'));
const fixture=()=>structuredClone(example),digest=example.sourceDigest;
test('verified figures are calculated directly from the complete record',()=>{
 const result=qualityStats(fixture(),digest);
 assert.equal(result.suites,example.checks.find(c=>c.label==='Portfolio browser suites · Chromium').passed);
 assert.equal(result.viewports,Math.max(...Object.values(example.objects).map(o=>o.viewports)));assert.equal(result.engines,2);
});
test('empty or partial summaries cannot create zero or infinite figures',()=>{
 for(const changes of [{checks:[]},{objects:{}},{checks:example.checks.slice(1)},{recordedAt:'invalid'}])
  assert.throws(()=>qualityStats({...fixture(),...changes},digest));
});
test('stale source records and baseline records are rejected',()=>{
 assert.throws(()=>qualityStats({...fixture(),sourceDigest:'0'.repeat(64)},digest));
 assert.throws(()=>qualityStats({...fixture(),scope:'Marker baseline before scene enhancements'},digest));
});
test('invalid, duplicated or unrecognised check counts cannot be displayed',()=>{
 for(const bad of [0,-1,NaN,Infinity,1.5,'20']){const value=fixture();value.checks[0].passed=bad;assert.throws(()=>qualityStats(value,digest));}
 const duplicate=fixture();duplicate.checks[1]=duplicate.checks[0];assert.throws(()=>qualityStats(duplicate,digest));
});
test('missing or unrecognised objects cannot create a misleading screen-size figure',()=>{
 const missing=fixture();delete missing.objects.work;assert.throws(()=>qualityStats(missing,digest));
 const extra=fixture();extra.objects.extra={viewports:8};assert.throws(()=>qualityStats(extra,digest));
 const bad=fixture();bad.objects.work.viewports=0;assert.throws(()=>qualityStats(bad,digest));
});

function sourceFixture(t){
 const temp=realpathSync(tmpdir()),folder=mkdtempSync(join(temp,'portfolio-quality-'));
 for(const dir of ['world','assets','demo'])mkdirSync(join(folder,dir));
 t.after(()=>{
  assert.equal(dirname(realpathSync(folder)),temp);assert.ok(basename(folder).startsWith('portfolio-quality-'));
  rmSync(folder,{recursive:true});
 });
 return folder;
}
test('the release fingerprint changes with runtime, geometry, demo, icon and artwork edits',t=>{
 const folder=sourceFixture(t);
 for(const name of ['index.html','concept.css','world-controller.js','world/scene.js',
  'assets/hotspot-layout.json','assets/view.webp','assets/icon.svg','demo/game.js','favicon.ico']){
  const before=qualityDigest(folder);writeFileSync(join(folder,name),'first source');
  assert.notEqual(qualityDigest(folder),before,name+' must invalidate old evidence');
  const added=qualityDigest(folder);writeFileSync(join(folder,name),'changed source');
  assert.notEqual(qualityDigest(folder),added,name+' content must invalidate old evidence');
 }
});
test('generated evidence has no hash cycle and Windows text endings preserve the same source',t=>{
 const folder=sourceFixture(t);writeFileSync(join(folder,'index.html'),'one\ntwo\n');const before=qualityDigest(folder);
 writeFileSync(join(folder,'index.html'),'one\r\ntwo\r\n');assert.equal(qualityDigest(folder),before);
 writeFileSync(join(folder,'world/quality-build.js'),'generated fingerprint');
 writeFileSync(join(folder,'assets/quality-evidence.json'),'generated evidence');assert.equal(qualityDigest(folder),before);
});
