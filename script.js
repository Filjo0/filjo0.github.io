(async () => {
  document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
  document.querySelector('[data-print-resume]')?.addEventListener('click', () => window.print());
  if (window.parent !== window && new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.dataset.resumeEmbedded = 'true';
    document.querySelectorAll('a[href^="https:"]').forEach(link => { link.target = '_blank'; link.rel = 'noopener'; });
  }
  const studio = document.querySelector('[data-studio]');
  if (!studio) return;
  const find = name => document.querySelector(`[data-${name}]`);
  const host = find('room-world');
  const surface = find('object-surface');
  const reader = find('scene-reader');
  const readerBody = find('reader-body');
  const content = find('scene-content');
  const title = find('scene-title');
  const wake = find('phone-wake');
  const fallback = find('studio-fallback');
  const motionButton = find('studio-motion');
  const toggle = find('reader-toggle');
  const resumeView = find('resume-view');
  const resumeFrame = find('resume-frame');
  const resumeStatus = find('resume-status');
  const resumeRetry = find('resume-retry');
  if (![host,surface,reader,readerBody,content,title,wake,fallback,motionButton,toggle,resumeView,resumeFrame,resumeStatus,resumeRetry].every(Boolean) || !window.ResizeObserver) return;
  const routes = {
    work:{title:'Work',object:'The monitor',sections:['work']},
    experience:{title:'Experience',object:'The notebook',sections:['experience','capabilities','resume']},
    resume:{title:'Resume',object:'The desk folio',sections:[]},
    contact:{title:'Contacts',object:'Philipp Alimov',sections:['contact']},
  };
  const order=['overview',...Object.keys(routes)];
  const labels={overview:'Room',work:'Work',experience:'Experience',resume:'Resume',contact:'Contact'};
  const records=new Map();
  for(const route of Object.values(routes)) for(const id of route.sections){
    const node=document.getElementById(id);if(!node)return;
    const placeholder=document.createElement('span');placeholder.hidden=true;
    records.set(id,{node,placeholder});
  }
  const links=[...document.querySelectorAll('[data-studio-route]')];
  const points=[...document.querySelectorAll('.studio-point')];
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  const scrollPositions=new Map();
  const priorRestoration=history.scrollRestoration;
  let engine;
  let ready=false;
  let active='overview';
  let version=0;
  let opener;
  let paused=false;
  let looking=false;
  let phoneAwake=false;
  let resumeRequested=false;
  let resumeTimer=0;
  const isPaused=()=>paused || reducedMotion.matches;
  const restoreSections=()=>{
    for(const [id,{node,placeholder}] of records){
      placeholder.removeAttribute('id');node.id=id;delete node.dataset.studioSection;
      if(placeholder.parentNode)placeholder.after(node);
    }
  };
  const recover=()=>{
    ++version;ready=false;engine?.dispose();restoreSections();fallback.hidden=false;
    surface.hidden=true;host.hidden=true;find('scene-tools').hidden=true;
    find('scene-arrows').hidden=true;find('scene-caption').hidden=true;motionButton.hidden=true;
    delete document.body.dataset.studioReady;delete document.body.dataset.walkthrough;
    history.scrollRestoration=priorRestoration;
    links.forEach(link=>link.removeAttribute('aria-current'));
    requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
  };
  const updateControls=()=>{
    const index=order.indexOf(active);
    for(const [key,offset] of [['previous',-1],['next',1]]){
      const destination=order[(index+offset+order.length)%order.length];
      find(`scene-${key}`).setAttribute('aria-label',`${key==='previous'?'Previous':'Next'} view: ${labels[destination]}`);
      find(`${key}-label`).textContent=labels[destination];
    }
    links.forEach(link=>{if(link.dataset.studioRoute===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    find('scene-tools').hidden=active==='overview';
    find('scene-caption').hidden=active!=='overview';
    find('scene-number').textContent=`0${index} / 04`;
    find('scene-caption-title').textContent='The studio';
    find('scene-caption-text').textContent='Choose an object. Walk over and explore.';
    toggle.setAttribute('aria-expanded',String(!looking));
    toggle.innerHTML=looking?`Read ${labels[active].toLowerCase()} <span aria-hidden="true">↙</span>`:'Look around <span aria-hidden="true">↗</span>';
  };
  const failResume=()=>{
    clearTimeout(resumeTimer);resumeFrame.hidden=true;resumeStatus.hidden=false;resumeRetry.hidden=false;
    resumeStatus.textContent='The resume could not load. You can download the PDF or open the standalone resume.';
    resumeView.dataset.state='error';
  };
  const loadResume=()=>{
    resumeRequested=true;resumeView.dataset.state='loading';resumeStatus.hidden=false;
    resumeStatus.textContent='Loading resume…';resumeFrame.hidden=true;resumeRetry.hidden=true;
    clearTimeout(resumeTimer);resumeTimer=setTimeout(failResume,12000);
    resumeFrame.contentWindow.location.replace(new URL('resume.html?embed=1',location.href).href);
  };
  resumeFrame.addEventListener('load',()=>{
    if(!resumeRequested)return;
    try{
      if(!resumeFrame.contentDocument?.querySelector('.page'))return failResume();
      clearTimeout(resumeTimer);resumeFrame.hidden=false;resumeStatus.hidden=true;resumeRetry.hidden=true;
      resumeView.dataset.state='ready';
      resumeFrame.contentDocument.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();navigate('overview',resumeFrame);}
      });
    }catch{failResume();}
  });
  resumeFrame.addEventListener('error',failResume);resumeRetry.addEventListener('click',loadResume);
  const mount=destination=>{
    restoreSections();content.replaceChildren();resumeView.hidden=destination!=='resume';
    readerBody.dataset.resume=String(destination==='resume');
    if(destination==='overview')return;
    const route=routes[destination];title.textContent=route.title;find('scene-kicker').textContent=route.object;
    for(const id of route.sections){
      const {node,placeholder}=records.get(id);node.id=`scene-section-${id}`;
      node.dataset.studioSection=id;placeholder.id=id;content.append(node);
    }
    if(destination==='resume' && !resumeRequested)loadResume();
  };
  const showObject=()=>{
    surface.hidden=false;wake.hidden=active!=='contact' || phoneAwake;
    reader.hidden=active==='contact' && !phoneAwake;
    surface.dataset.awake=String(active==='contact' && phoneAwake);
    studio.dataset.reading='true';looking=false;updateControls();
    readerBody.scrollTop=scrollPositions.get(active)||0;
  };
  const go=async(destination,trigger,immediate=false,force=false)=>{
    if(!ready || !order.includes(destination) || (destination===active && !force))return;
    const id=++version;
    const focusBefore=document.activeElement;
    if(active!=='overview')scrollPositions.set(active,readerBody.scrollTop);
    if(active==='overview' && trigger)opener=trigger;
    active=destination;looking=false;phoneAwake=false;surface.hidden=true;
    studio.dataset.destination=destination;studio.dataset.travelling='true';studio.dataset.phase='walking';
    studio.dataset.reading='false';updateControls();mount(destination);
    try{
      if(!await engine.travel(destination,{immediate}) || id!==version)return;
      if(destination!=='overview'){
        studio.dataset.phase='picking-up';
        if(!await engine.inspect(destination,{immediate}) || id!==version)return;
        showObject();
      }else {surface.hidden=true;reader.hidden=true;wake.hidden=true;}
      await new Promise(resolve=>requestAnimationFrame(resolve));if(id!==version)return;
      readerBody.scrollTop=scrollPositions.get(destination)||0;
      studio.dataset.travelling='false';studio.dataset.phase=destination==='contact'?'phone-asleep':'ready';
      find('scene-announcement').textContent=destination==='overview'?'Room overview. Choose an object.':destination==='contact'?'Phone picked up. Tap the screen to open contacts.':`${labels[destination]} open on ${routes[destination].object.toLowerCase()}.`;
      if(trigger && (document.activeElement===trigger || document.activeElement===focusBefore || document.activeElement===document.body)){
        if(destination==='overview'){
          const target=opener?.isConnected && getComputedStyle(opener).visibility!=='hidden'?opener:find('studio-home');
          target?.focus({preventScroll:true});
        }else (destination==='contact'?wake:title).focus({preventScroll:true});
      }
    }catch{recover();}
  };
  const fromHash=()=>{
    const value=location.hash.slice(1);return value==='capabilities'?'experience':Object.hasOwn(routes,value)?value:'overview';
  };
  const navigate=(destination,trigger)=>{
    if(!ready || !order.includes(destination))return;
    if(destination===active){if(looking)toggle.click();return;}
    const hash=destination==='overview'?'':`#${destination}`;
    if(location.hash!==hash)history.pushState(null,'',`${location.pathname}${location.search}${hash}`);
    go(destination,trigger);
  };
  wake.addEventListener('click',()=>{
    if(active!=='contact' || !ready)return;phoneAwake=true;wake.hidden=true;reader.hidden=false;
    surface.dataset.awake='true';studio.dataset.phase='phone-awake';
    readerBody.scrollTop=scrollPositions.get('contact')||0;
    find('scene-announcement').textContent='Contacts open on the phone screen.';
    title.focus({preventScroll:true});
  });
  toggle.addEventListener('click',async()=>{
    if(!ready || active==='overview' || studio.dataset.travelling==='true')return;
    const id=++version;scrollPositions.set(active,readerBody.scrollTop);
    if(!looking){
      surface.hidden=true;looking=true;studio.dataset.reading='false';studio.dataset.phase='looking-around';
      updateControls();await engine.look();
    }else {
      studio.dataset.travelling='true';
      if(await engine.inspect(active,{immediate:isPaused()}) && id===version){showObject();studio.dataset.travelling='false';studio.dataset.phase=active==='contact'?(phoneAwake?'phone-awake':'phone-asleep'):'ready';}
    }
  });
  const updateMotion=()=>{
    if(!ready)return;
    document.body.dataset.motionPaused=String(isPaused());motionButton.hidden=false;
    motionButton.disabled=reducedMotion.matches;motionButton.setAttribute('aria-pressed',String(isPaused()));
    const label=reducedMotion.matches?'Motion off: system preference':isPaused()?'Resume motion':'Pause motion';
    motionButton.setAttribute('aria-label',label);motionButton.title=label;
    find('motion-label').textContent=isPaused()?'Motion off':'Pause motion';find('motion-icon').textContent=isPaused()?'▷':'Ⅱ';
    engine?.setMotion(!isPaused());
  };
  document.addEventListener('click',event=>{
    if(!ready || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    const link=event.target.closest('a[data-studio-route],a[data-studio-home]');if(!link)return;
    event.preventDefault();navigate(link.hasAttribute('data-studio-home')?'overview':link.dataset.studioRoute,link);
  });
  for(const [name,offset] of [['scene-previous',-1],['scene-next',1]])find(name).addEventListener('click',event=>navigate(order[(order.indexOf(active)+offset+order.length)%order.length],event.currentTarget));
  document.addEventListener('keydown',event=>{
    if(!ready || event.ctrlKey || event.metaKey || event.altKey)return;
    if(event.key==='Escape' && active!=='overview'){event.preventDefault();navigate('overview',document.activeElement);}
    if(!['ArrowLeft','ArrowRight'].includes(event.key) || event.target.closest('a,button,summary,input,textarea,select,[data-object-surface]'))return;
    event.preventDefault();navigate(order[(order.indexOf(active)+(event.key==='ArrowLeft'?-1:1)+order.length)%order.length]);
  });
  window.addEventListener('popstate',()=>go(fromHash()));window.addEventListener('hashchange',()=>go(fromHash()));
  motionButton.addEventListener('click',()=>{paused=!paused;updateMotion();});reducedMotion.addEventListener('change',updateMotion);
  try{
    const {createWalkthrough}=await import('./room.js');
    host.hidden=false;
    engine=createWalkthrough({host,surface,points,onContextLost:recover});
    for(const {node,placeholder} of records.values())node.before(placeholder);
    ready=true;history.scrollRestoration='manual';fallback.hidden=true;
    document.body.dataset.studioReady='true';document.body.dataset.walkthrough='true';
    find('scene-arrows').hidden=false;find('scene-caption').hidden=false;
    updateMotion();updateControls();
    // Entry is a short walk; deep links go straight to the requested object.
    const destination=fromHash();go(destination,null,destination!=='overview' || isPaused(),true);
    window.scrollTo(0,0);
  }catch{recover();}
})();
