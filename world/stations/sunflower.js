import {GOLDEN_ANGLE,seedPattern} from '../../world-state.js';
import {sunflowerDrawing} from '../botanical-art.js';
import {spiralFamilies} from '../seed-spirals.js';
import {bindMathsDiagram,nearestMathsMark,mathsRange,bindMathsRange} from './maths-interaction.js';
import {reducedMotion} from '../motion.js';

// Angles redraw immediately; only the optional spiral tracing requests frames.
export function createSunflowerPage(content) {
  const capacity=400,familySeconds=3.2,goldenPoints=seedPattern(capacity,GOLDEN_ANGLE);
  const families=spiralFamilies(goldenPoints),colours=['#f5a33c','#39d8c9'];
  let turn=GOLDEN_ANGLE,selectedSeed=-1,counted=false,busy=false,paused=false,events=null,slider=null;
  let frame=0,last=0,elapsed=0,drawnArms=[0,0];
  const golden=()=>turn===GOLDEN_ANGLE;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;last=0;};
  const request=()=>{if(events&&busy&&!paused&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);};
  const caption=text=>{content.querySelector('[data-maths-caption]').textContent=text;};
  function angleCaption() {
    if(golden())return 'No spokes, no large gaps.';
    const spokes=new Map([[90,4],[120,3],[144,5]]).get(turn);
    return spokes?`${spokes} straight spokes leave gaps.`:`Turn ${turn.toFixed(2)}° between seeds.`;
  }
  function drawSeeds() {
    content.querySelector('[data-seed-layer]').innerHTML=seedPattern(capacity,turn).map(p=>{
      const radius=Math.hypot(p.x-130,p.y-130)/110,size=(1.3+radius*1.95)*Math.sqrt(800/capacity);
      return `<ellipse data-sunflower-seed data-seed-index="${p.index}" cx="${p.x}" cy="${p.y}" rx="${size}" ry="${size*.65}"
        transform="rotate(${p.index*turn} ${p.x} ${p.y})" fill="${p.index%3?'#362d20':'#57452c'}" stroke="#b89a61" stroke-width=".45"/>`;
    }).join('');
  }
  function paintArms(time) {
    const layer=content.querySelector('[data-spiral-layer]');
    for(let i=0;i<families.length;i++) {
      const count=Math.min(families[i].count,Math.floor(Math.max(0,time-i*familySeconds)/familySeconds*families[i].count));
      for(let j=drawnArms[i];j<count;j++) {
        const arm=families[i].arms[j],end=arm.at(-1),path='M'+arm.map(p=>`${p.x} ${p.y}`).join('L');
        layer.insertAdjacentHTML('beforeend',`<path data-spiral-family="${i}" data-spiral-index="${j}"
          data-arm-count="${families[i].count}" d="${path}" fill="none" stroke="${colours[i]}" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round"/><circle data-spiral-end="${i}" cx="${end.x}" cy="${end.y}" r="2.5" fill="${colours[i]}"/>`);
      }
      drawnArms[i]=count;
    }
    const second=time>=familySeconds;
    for(const path of layer.querySelectorAll('[data-spiral-family="0"],[data-spiral-end="0"]'))
      path.style.opacity=second&&time<familySeconds*families.length?'.65':'.95';
    content.querySelector('[data-maths-count]').textContent=`${drawnArms[0]} one way · ${drawnArms[1]} the other`;
  }
  function selectSeed(index) {
    if(!golden()||busy||!counted)return;
    selectedSeed=(index+capacity)%capacity;
    const layer=content.querySelector('[data-spiral-layer]');
    families.forEach((family,i)=>{
      const arm=family.arms.findIndex(points=>points.some(p=>p.index===selectedSeed));
      layer.querySelectorAll(`[data-spiral-family="${i}"]`).forEach(path=>{
        const chosen=Number(path.dataset.spiralIndex)===arm;
        path.dataset.traced=String(chosen);path.style.strokeWidth=chosen?'4.5':'2.2';path.style.opacity=chosen?'1':'.35';
      });
    });
    layer.querySelector('[data-selected-seed]')?.remove();const point=goldenPoints[selectedSeed];
    layer.insertAdjacentHTML('beforeend',`<circle data-selected-seed="${selectedSeed}" cx="${point.x}" cy="${point.y}"
      r="6" fill="none" stroke="#fff8da" stroke-width="2"/>`);
    caption(`Seed ${selectedSeed+1}: two crossing spirals.`);
  }
  function sync() {
    const page=content.querySelector('[data-sunflower-page]');page.dataset.mathsStep=counted?'3':golden()?'2':'1';
    page.dataset.animating=String(busy);page.dataset.angleValue=String(turn);
    const button=content.querySelector('[data-maths-next]');
    button.textContent=busy?'Counting…':!golden()?'Set 137.5° & count':counted?'Count the spirals again':'Count the spirals';
    button.disabled=busy;button.setAttribute('aria-disabled',String(button.disabled));
    content.querySelector('[data-seed-art]').setAttribute('aria-disabled',String(busy));
    content.querySelector('[data-seed-art]').setAttribute('aria-label',
      `${capacity} sunflower seeds at ${turn.toFixed(2)} degrees${counted?', with crossing spiral families':''}`);
    for(const preset of content.querySelectorAll('[data-angle-preset]'))preset.setAttribute('aria-pressed',String(
      preset.dataset.anglePreset==='golden'?golden():Number(preset.dataset.anglePreset)===turn));
  }
  function setAngle(value) {
    stop();turn=value;selectedSeed=-1;counted=false;busy=false;elapsed=0;drawnArms=[0,0];
    content.querySelector('[data-spiral-layer]').replaceChildren();content.querySelector('[data-maths-count]').textContent='';
    drawSeeds();caption(angleCaption());slider?.set(Number(turn.toFixed(2)));sync();
  }
  function finish() {
    paintArms(familySeconds*families.length);busy=false;stop();sync();
    caption(families.every(f=>f.fibonacci)?'Both counts are Fibonacci numbers.':'Two opposite sets of spirals cross.');
    if(selectedSeed>=0)selectSeed(selectedSeed);
  }
  function tick(now) {
    frame=0;if(!events||!busy||paused||document.hidden){last=0;return;}
    if(reducedMotion()){finish();return;}
    elapsed+=last?Math.min((now-last)/1000,.1):0;last=now;paintArms(elapsed);
    if(elapsed>=familySeconds*families.length){finish();return;}request();
  }
  function countArms() {
    if(busy)return;
    if(!golden())setAngle(GOLDEN_ANGLE);
    counted=true;busy=true;elapsed=0;drawnArms=[0,0];content.querySelector('[data-spiral-layer]').replaceChildren();
    sync();caption('Orange spirals, then teal spirals.');if(reducedMotion())finish();else request();
  }
  return {enter(){
    events=new AbortController();paused=false;const {signal}=events;
    content.innerHTML=`<section class="creative-notebook maths-notebook" data-sunflower-page data-animating="false">
      <header class="creative-title"><span>MATHS NOTEBOOK · 01</span><h3>Why sunflowers spiral</h3></header>
      <div class="maths-spread"><figure class="maths-flower">${sunflowerDrawing()}<figcaption data-maths-count aria-hidden="true"></figcaption></figure>
        <div class="maths-story"><span class="maths-margin-note" aria-hidden="true">Drag the angle to rearrange the seeds.</span>
          ${mathsRange('turn-angle','Turn angle',1,180,.01,turn.toFixed(2))}
          <div class="maths-angle-picks" role="group" aria-label="Try a turn angle">
            <button type="button" data-angle-preset="90">90°</button><button type="button" data-angle-preset="120">120°</button>
            <button type="button" data-angle-preset="golden">137.5°<small>Golden</small></button>
            <button type="button" data-angle-preset="144">144°</button></div>
          <p data-maths-caption role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="maths-payoff"><button type="button" data-maths-next>Count the spirals</button>
            <a class="maths-source" href="https://mathworld.wolfram.com/Phyllotaxis.html"
              target="_blank" rel="noopener noreferrer">About the pattern ↗</a></div>
        </div></div></section>`;
    slider=bindMathsRange(content,'turn-angle',{signal,value:turn.toFixed(2),coarse:5,format:v=>`${Number(v).toFixed(2)}°`,
      normalise:(v,keyboard)=>Math.abs(v-GOLDEN_ANGLE)<=(keyboard ? .005 : 1.2)?GOLDEN_ANGLE:v,onInput:setAngle});
    for(const preset of content.querySelectorAll('[data-angle-preset]'))preset.addEventListener('click',()=>
      setAngle(preset.dataset.anglePreset==='golden'?GOLDEN_ANGLE:Number(preset.dataset.anglePreset)),{signal});
    content.querySelector('[data-maths-next]').addEventListener('click',()=>{selectedSeed=-1;countArms();},{signal});
    bindMathsDiagram(content.querySelector('[data-seed-art]'),{signal,activate:event=>{
      if(!golden())return;
      const seed=event.target.closest('[data-seed-index]')||nearestMathsMark(event.currentTarget,'[data-seed-index]',event);
      const index=seed?Number(seed.dataset.seedIndex):selectedSeed<0?300:selectedSeed+1;
      if(!counted){selectedSeed=index;countArms();}else selectSeed(index);
    },move:key=>selectSeed((selectedSeed<0?300:selectedSeed)+(key==='ArrowLeft'||key==='ArrowUp'?-1:1))});
    document.addEventListener('visibilitychange',()=>{stop();request();},{signal});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{if(busy&&reducedMotion())finish();},{signal});
    drawSeeds();caption(angleCaption());drawnArms=[0,0];
    if(counted){paintArms(familySeconds*families.length);caption('Both counts are Fibonacci numbers.');}
    sync();if(selectedSeed>=0)selectSeed(selectedSeed);
  },update(){if(busy&&reducedMotion())finish();},setPaused(value){paused=value;stop();request();},
    exit(){stop();events?.abort();events=null;slider=null;busy=false;drawnArms=[0,0];content.replaceChildren();},
    state:()=>({type:'fibonacci',step:counted?3:golden()?2:1,angle:turn,seeds:capacity,growing:busy,paused})};
}
