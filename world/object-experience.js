import {reducedMotion,restoreMotionPreference,setMotionPreference} from './motion.js';

// Presentation only: canonical contact facts and links are restored on exit.
export function mountObjectExperience(reader, content, id) {
  reader.dataset.experience=id;
  const additions=[],changed=[],cleanups=[];
  const add=(parent,node,prepend=false)=>{
    prepend?parent.prepend(node):parent.append(node);additions.push(node);return node;
  };
  if(id==='experience') {
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

const iconPaths={
  fibonacci:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M11 8h6M11 12h4M11 16h6"/>',
  work:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>'+
    '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  experience:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
  resume:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 12h6M9 16h6"/>',
  contact:
    '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 '+
      '8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8z"/>',
  play:'<path d="m9 4 11 8-11 8z"/>',
  gear:
    '<path d="m9.5 3-.6 2.1-2 .9-2-.5-2.4 4.1 1.5 1.5v2.2l-1.5 1.5 2.4 4.1 2-.5 2 .9.6 2.1h5l.6-2.1 2-.9 2 .5 '+
      '2.4-4.1-1.5-1.5v-2.2l1.5-1.5L19.1 5l-2 .5-2-.9L14.5 3z"/><circle cx="12" cy="12" r="3"/>'
};
function navIcon(id) {
  return '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconPaths[id]+'</svg>';
}

export function setupFocusedChrome(header,{signal,onMotionChange=()=>{}}={}) {
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
  panel.querySelector('[data-settings-light]').append(dusk);
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
  return {close,dispose(){close();menu.hidden=true;document.querySelector('[data-world-fallback]').before(dock);}};
}
