import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {readingSurfaceEdges} from './reading-surface-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
// Audit every approved reading surface; physical paper measurements are tied to hashed artwork.
const targets=process.argv.slice(2);if(!targets.length)targets.push('work','experience','resume','contact','books','fibonacci');
const manifest=JSON.parse(await readFile(new URL('../assets/outdoor/object-views.json',import.meta.url),'utf8'));
const deviation=q=>Math.max(...q.map((a,i)=>{const b=q[(i+1)%4],angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
 return Math.abs((angle-[0,90,180,-90][i]+540)%360-180);}));
for(const id of ['books','resume']){
 const asset=manifest.views[id];assert.ok(asset.physical_corners,'Native paper measurement is recorded for '+id);
 assert.ok(deviation(asset.physical_corners)<=1,id+': photographed paper is within 1 degree');
 for(const q of [asset.corners,...(asset.mobile_corners?[asset.mobile_corners]:[])])for(const p of q){
  const cross=asset.physical_corners.map((a,i)=>{const b=asset.physical_corners[(i+1)%4];
   return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});
  assert.ok(cross.every(v=>v>=0)||cross.every(v=>v<=0),id+': reading rectangle stays inside the physical paper');
 }
 const skewed=structuredClone(asset.physical_corners);skewed[0][0]+=50;
 assert.ok(deviation(skewed)>1,'Negative control rejects visibly skewed paper');
}
const out='validation-artifacts/straight-and-simple-24oct/straightness/'+engine;await mkdir(out,{recursive:true});
const b=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const results=[];try{for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]){
 const p=await b.newPage({viewport,reducedMotion:'reduce'});
 for(const id of targets){await p.goto((process.env.STUDIO_URL||'http://127.0.0.1:8765/')+'#'+id);
  await p.waitForFunction(id=>document.querySelector('[data-world-reader]')?.dataset.object===id&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
  const edges=await readingSurfaceEdges(p.locator('[data-world-reader]'));results.push({viewport,id,...edges});
  assert.ok(edges.maxDeviation<=1,`${id} at ${viewport.width}: reading edges deviate ${edges.maxDeviation.toFixed(3)}°, limit 1°`);
 }await p.close();}console.log(engine+': '+results.length+' straight reading surfaces passed (≤1°).');}
 finally{await writeFile(out+'/'+targets.join('-')+'.json',JSON.stringify(results,null,2));await b.close();}
