import {navIcon} from './scene-icons.js';
import {reducedMotion,restoreMotionPreference,setMotionPreference} from './motion.js';
import {LIGHT_NAMES,initialLight,perthLight} from './scene-clock.js';

// Presentation only: canonical contact facts and links are restored on exit.
export function mountObjectExperience(reader, content, id) {
  reader.dataset.experience=id;
  const additions=[],changed=[],cleanups=[];
  const add=(parent,node,prepend=false)=>{
    prepend?parent.prepend(node):parent.append(node);additions.push(node);return node;
  };
  if(id==='experience') {
    const reading=document.createElement('a');reading.href='#books';reading.className='text-action about-reading';
    reading.dataset.aboutReading='';reading.dataset.worldRoute='books';reading.textContent='Find a reading';
    add(content.querySelector('.resume-heading')||content,reading);

    const events=new AbortController(),cue=document.createElement('button');
    cue.type='button';cue.className='about-scroll-cue';cue.textContent='Scroll for more ↓';
    const update=()=>{
      const more=content.scrollHeight-content.clientHeight-content.scrollTop>8;
      cue.hidden=!more;reader.toggleAttribute('data-about-more',more);
    };
    add(reader,cue);
    content.addEventListener('scroll',update,{signal:events.signal,passive:true});
    cue.addEventListener('click',()=>content.scrollBy({top:content.clientHeight*.75,
      behavior:reducedMotion()?'instant':'smooth'}),{signal:events.signal});
    const resize=new ResizeObserver(update);resize.observe(content);
    for(const child of content.children)resize.observe(child);
    cleanups.push(()=>{events.abort();resize.disconnect();reader.removeAttribute('data-about-more');});update();
  }
  if(id==='contact') {
    const profile=document.createElement('div');profile.className='phone-profile';
    profile.innerHTML='<span class="phone-monogram" aria-hidden="true">PA</span>'+
      '<h3>Philipp Alimov</h3><p>Quality engineer &amp; product builder</p><span class="phone-location">Perth, Western Australia</span>';
    add(content.querySelector('.contact-inner'),profile,true);
    const heading=reader.querySelector('header h2');changed.push([heading,heading.textContent]);heading.textContent='Contacts';
    const mail=content.querySelector('a[href^="mailto:"]');
    if(mail) {
      const address=document.createElement('p');address.className='phone-address';address.textContent=mail.textContent;
      add(profile,address);changed.push([mail,mail.textContent]);mail.textContent='Email';
      mail.setAttribute('aria-label','Email Philipp Alimov');
    }
    const footer=document.createElement('p');footer.className='phone-footnote';
    footer.textContent='Email opens your mail app. Profile links open their websites.';add(content,footer);
  }
  return ()=>{
    cleanups.forEach(cleanup=>cleanup());
    delete reader.dataset.experience;
    additions.forEach(n=>n.remove());changed.forEach(([n,text])=>{n.textContent=text;n.removeAttribute('aria-label');});
  };
}

export function setupObjectMenu(menu) {
  // Main navigation leads straight to maths; there is no activity catalogue.
  menu.hidden=true;
}


export function setupFocusedChrome(header,{signal,onMotionChange=()=>{},onLightChoice=()=>{}}={}) {
  const dock=document.querySelector('.world-dock'),play=document.querySelector('[data-world-map]');
  for(const a of dock.querySelectorAll(':scope > a')){
    const id=a.dataset.worldRoute,label=id==='experience'?'About':a.textContent;
    a.innerHTML=navIcon(id)+'<span>'+label+'</span>';
  }
  header.append(dock);
  const menu=document.createElement('div');menu.className='scene-settings';
  menu.innerHTML=`<button type="button" class="scene-settings-toggle" data-settings-toggle
    aria-label="Settings" aria-controls="scene-settings-panel" aria-expanded="false" aria-haspopup="dialog">${navIcon('gear')}</button>
    <div class="scene-settings-body" id="scene-settings-panel" data-settings-panel role="dialog" aria-label="Scene settings" hidden>
      <fieldset><legend>Season</legend><div data-settings-season></div></fieldset>
      <fieldset><legend>Light</legend><div class="settings-segment" data-settings-light>
        <button type="button" data-world-day aria-pressed="true">Sunset</button></div></fieldset>
      <div class="settings-motion"><span id="scene-motion-label">Reduce motion</span>
        <button type="button" role="switch" aria-labelledby="scene-motion-label" aria-checked="false" data-world-reduce-motion>
          <span aria-hidden="true"></span></button></div>
    </div>`;
  header.append(menu);
  const button=menu.querySelector('[data-settings-toggle]'),panel=menu.querySelector('[data-settings-panel]');
  const regions=document.querySelector('[data-world-regions]');regions.classList.add('settings-segment');
  regions.setAttribute('aria-label','Season');
  for(const a of regions.querySelectorAll('a'))a.textContent=a.dataset.worldRoute==='coast'?'Coast':'Winter';
  panel.querySelector('[data-settings-season]').append(regions);
  const dusk=document.querySelector('[data-world-night]');dusk.textContent='Night';
  const lights=panel.querySelector('[data-settings-light]');lights.append(dusk);
  lights.querySelector('[data-world-day]').dataset.sceneLight='sunset';dusk.dataset.sceneLight='night';
  for(const choice of ['auto','morning','day']){
    const control=document.createElement('button');control.type='button';control.dataset.sceneLight=choice;
    control.textContent=LIGHT_NAMES[choice];lights.insertBefore(control,lights.querySelector('[data-world-day]'));
  }
  const clock=document.createElement('p');clock.className='settings-perth-time';clock.dataset.perthTime='';lights.after(clock);
  const syncLight=state=>{
    lights.setAttribute('aria-busy',String(!!state.pending));
    for(const control of lights.querySelectorAll('[data-scene-light]'))control.setAttribute('aria-pressed',String(control.dataset.sceneLight===state.choice));
    clock.textContent='Perth · '+state.time+' · '+LIGHT_NAMES[state.phase];
  };
  const initial=initialLight();syncLight({...initial,time:perthLight().time});
  lights.addEventListener('click',e=>{const control=e.target.closest('[data-scene-light]');if(control)onLightChoice(control.dataset.sceneLight);},{signal});
  const simple=document.querySelector('[data-world-text]');simple.textContent='Simple page view';
  simple.classList.add('scene-simple-page');panel.append(simple);
  const motion=panel.querySelector('[data-world-reduce-motion]');restoreMotionPreference();
  const syncMotion=()=>{motion.setAttribute('aria-checked',String(reducedMotion()));onMotionChange();};
  motion.addEventListener('click',()=>{setMotionPreference(!reducedMotion());syncMotion();},{signal});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',syncMotion,{signal});syncMotion();
  const close=(restoreFocus=false)=>{
    if(panel.hidden)return;
    panel.hidden=true;button.setAttribute('aria-expanded','false');
    if(restoreFocus)button.focus({preventScroll:true});
  };
  button.addEventListener('click',()=>{
    if(!panel.hidden){close(true);return;}
    play.open=false;panel.hidden=false;button.setAttribute('aria-expanded','true');
    (regions.querySelector('[aria-current]')||regions.querySelector('a')).focus({preventScroll:true});
  },{signal});
  play.addEventListener('toggle',()=>{if(play.open)close();},{signal});
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close(true);},{signal});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||panel.hidden)return;
    e.preventDefault();e.stopImmediatePropagation();close(true);
  },{capture:true,signal});
  return {close,syncLight,dispose(){close();menu.hidden=true;document.querySelector('[data-world-fallback]').before(dock);}};
}
