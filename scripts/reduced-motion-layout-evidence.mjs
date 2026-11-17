import {writeFile} from 'node:fs/promises';
import {markerEvidence} from './marker-browser-evidence.mjs';

// Reduced motion must remove transitions, not turn default transition-property:all
// into a short geometry animation. Measure synchronously after the style change.
export async function reducedMotionLayoutEvidence(browser,{base,out,check,watch=()=>{}}){
 const results=[];
 for(const preference of ['system','manual']){
  const p=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,
   reducedMotion:preference==='system'?'reduce':'no-preference'});watch(p);
  let probe;
  try{
   const url=new URL(base);url.searchParams.set('light','day');url.hash='';await p.goto(url.href);
   await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true'&&
    document.querySelector('.scene-hotspots')?.dataset.markerLayout==='ready');
   if(preference==='manual'){
    await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-reduce-motion]').click();
    check(await p.locator('body').getAttribute('data-motion')==='reduce','The real Settings switch enables reduced motion');
    await p.keyboard.press('Escape');
   }
   probe=await p.evaluate(async()=>{
    const button=document.createElement('button');button.textContent='Position regression probe';
    button.style.cssText='position:fixed;left:10px;top:100px;width:100px;height:44px';document.body.append(button);
    try{
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     button.style.left='210px';button.style.width='180px';
     const box=button.getBoundingClientRect().toJSON(),style=getComputedStyle(button);
     return{box,inline:button.style.cssText,computed:{left:style.left,width:style.width,transition:style.transition},
      transitions:button.getAnimations().filter(a=>a.constructor.name==='CSSTransition').map(a=>a.transitionProperty)};
    }finally{button.remove();}
   });
   check(Math.abs(probe.box.left-210)<1&&Math.abs(probe.box.width-180)<1,
    preference+': reduced-motion geometry applies immediately within 1px: '+JSON.stringify(probe));
   check(!probe.transitions.some(s=>['left','top','width','height','transform'].includes(s)),
    preference+': reduced motion cannot create geometry transitions');
   for(let turn=0;turn<4;turn++){
    // No wait or screenshot before the assertion: exercise the actual immediate
    // pan handler, where the old rule retained the previous frame's hit regions.
    const transition=await p.evaluate(()=>{
     document.querySelector('[data-scene-framing]').click();
     return{area:document.querySelector('[data-world-render]').dataset.sceneFrameMode,
      properties:document.querySelector('.scene-hotspots').getAnimations({subtree:true})
       .filter(a=>a.constructor.name==='CSSTransition').map(a=>a.transitionProperty)};
    });
    check(transition.area===(turn%2?'desk':'coast'),preference+': the actual pan reaches its requested view');
    check(!transition.properties.some(s=>['left','top','width','height','transform'].includes(s)),
     preference+': real scene hit regions do not animate from the previous view');
    await markerEvidence(p,check);
   }
   results.push({preference,probe,turns:4});
  }catch(error){
   await writeFile(out+'/reduced-motion-failure-'+preference+'.json',JSON.stringify({message:error.message,probe,...error.markerEvidence},null,2));
   throw error;
  }finally{await p.close();}
 }
 await writeFile(out+'/reduced-motion-layout.json',JSON.stringify(results,null,2));
}
