import {writeFile} from 'node:fs/promises';
import {markerEvidence} from './marker-browser-evidence.mjs';
import {markerContrast} from './marker-contrast-evidence.mjs';

// Both seasons and both portrait crops are required: winter glare is the worst case.
export async function brightMarkerEvidence(browser,{base,out,check,watch,capture}){
 const results=[];
 for(const [width,height] of [[1440,900],[390,664],[320,568],[844,390],[375,553],[320,844]])for(const phase of ['day','morning']){
  const portrait=width<720&&height>width;
  const p=await browser.newPage({viewport:{width,height},hasTouch:width<960,reducedMotion:'reduce'});watch(p);
  try{
   const url=new URL(base);url.searchParams.set('light',phase);url.hash='';await p.goto(url.href);
   await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true'&&
    document.querySelector('.scene-hotspots')?.dataset.markerLayout==='ready');
   for(const season of ['coast','winter']){
    if(season==='winter'){
     await p.locator('[data-settings-toggle]').click();
     await p.locator('[data-world-regions] [data-world-route="winter"]').click();
     await p.waitForFunction(()=>document.body.dataset.worldRegion==='winter');await p.keyboard.press('Escape');
    }
    for(const area of (portrait?['desk','coast']:['desk'])){
     if(portrait&&(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode'))!==area){
      await p.locator('[data-scene-framing]').click();
      await p.waitForFunction(area=>document.querySelector('[data-world-render]').dataset.sceneFrameMode===area,area);
     }
     const evidence=await markerEvidence(p,check);
     results.push({width,height,phase,season,area,names:evidence.objects.map(({id,font,contrast,contrastSamples})=>
      ({id,font,contrast,contrastSamples}))});
     for(const name of evidence.objects.filter(n=>n.contrast<5||n.id==='fibonacci')){
      await p.locator('[data-scene-object="'+name.id+'"] .scene-object-label').hover();
      const active=(await markerContrast(p)).find(n=>n.id===name.id);
      check(active.samples>=15&&active.minimum>=4.5,name.id+': bright hover contrast '+active.minimum);
      results.at(-1).names.find(n=>n.id===name.id).hoverContrast=active.minimum;
      await p.mouse.move(1,1);
     }
     await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     await capture(p,'bright-'+width+'x'+height+'-'+season+'-'+phase+'-'+area);
    }
   }
   if(width===1440&&phase==='day'){
    const style=await p.addStyleTag({content:'.scene-marker-text{color:var(--object-label-surface)!important;-webkit-text-fill-color:var(--object-label-surface)!important}'});
    let failed;
    try{failed=await markerContrast(p);}finally{await style.evaluate(n=>n.remove());}
    check(failed.some(n=>n.minimum<4.5),'The native contrast check detects tab text made unreadable by matching its surface');
    await writeFile(out+'/bright-negative-control.json',JSON.stringify(failed,null,2));
   }
  }catch(error){
   const name='bright-failure-'+width+'x'+height+'-'+phase;
   await writeFile(out+'/'+name+'.json',JSON.stringify({message:error.message,...error.markerEvidence},null,2));
   await capture(p,name);throw error;
  }
  finally{await p.close();}
 }
 await writeFile(out+'/bright-label-results.json',JSON.stringify(results,null,2));
}
