// Real project content remains canonical; only its presentation changes in the world.
let selected=0;
export function mountProjectPreviews(root,{onDemo=()=>{}}={}) {
  if(document.body.dataset.worldNavigation==='objects')return mountWorkspace(root,{onDemo});
  const events=new AbortController(),projects=[...root.querySelectorAll('.project')];
  const tabs=document.createElement('div');tabs.className='world-project-tabs';
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Choose project');
  const heading=root.querySelector('[data-world-section="work"] .section-heading');
  const wasHidden=heading?.hidden;if(heading)heading.hidden=true;
  const original=projects.map(p=>({hidden:p.hidden,role:p.getAttribute('role'),label:p.getAttribute('aria-labelledby')}));
  function choose(i,focus=false) {
    selected=i;
    projects.forEach((p,n)=>{p.hidden=n!==i;});
    [...tabs.children].forEach((b,n)=>{b.setAttribute('aria-selected',String(n===i));b.tabIndex=n===i?0:-1;});
    root.scrollTop=0;if(focus)tabs.children[i].focus({preventScroll:true});
  }
  for(const [i,project] of projects.entries()) {
    const name=project.querySelector('h3').textContent;
    const tab=document.createElement('button');tab.type='button';tab.id=`world-project-tab-${i}`;
    tab.textContent=name;tab.dataset.projectTab=String(i);tab.setAttribute('role','tab');
    tab.setAttribute('aria-controls',`world-project-panel-${i}`);
    project.id=`world-project-panel-${i}`;project.setAttribute('role','tabpanel');
    project.setAttribute('aria-labelledby',tab.id);tabs.append(tab);
    tab.addEventListener('click',()=>choose(i),{signal:events.signal});
    tab.addEventListener('keydown',e=> {
      const key=e.key;
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;
      e.preventDefault();choose(key==='Home'?0:key==='End'?projects.length-1:
        (i+(key==='ArrowRight'?1:projects.length-1))%projects.length,true);
    },{signal:events.signal});
    if(i===2){
      const b=document.createElement('button');b.type='button';b.className='preview-launch';
      b.dataset.demoOpen='';b.textContent='Play one-sector demo';
      b.addEventListener('click',()=>onDemo(b),{signal:events.signal});project.querySelector('h3').after(b);
    }
  }
  root.querySelector('.project-grid').before(tabs);choose(Math.min(selected,projects.length-1));
  return ()=>{
    events.abort();tabs.remove();if(heading)heading.hidden=wasHidden;
    projects.forEach((p,i)=>{p.hidden=original[i].hidden;p.removeAttribute('id');
      for(const key of ['role','aria-labelledby']){const value=key==='role'?original[i].role:original[i].label;
        value===null?p.removeAttribute(key):p.setAttribute(key,value);}
    });
    root.querySelectorAll('.preview-launch').forEach(b=>b.remove());
  };
}

function mountWorkspace(root,{onDemo}) {
  const events=new AbortController(),section=root.querySelector('[data-world-section="work"]');
  const screenshots=createScreenshotViewer(events.signal);
  const projects=[...section.querySelectorAll('.project')],original=projects.map(n=>n.hidden),wasHidden=section.hidden;
  const home=document.createElement('div');home.className='workspace-home workspace-launcher';
  home.innerHTML='<p class="workspace-label">Philipp’s workspace</p><h3>My apps</h3><div class="workspace-apps"></div>';
  const back=document.createElement('button');back.type='button';back.dataset.notesHome='';back.textContent='← Apps';
  const reset=()=>{root.dataset.workspaceView='apps';section.hidden=true;back.hidden=true;home.hidden=false;root.scrollTop=0;};
  back.addEventListener('click',()=>{reset();home.querySelector('a,button').focus({preventScroll:true});},{signal:events.signal});
  section.before(home,back);
  const captures=fetch('assets/previews/previews.json',{signal:events.signal}).then(r=>{
    if(!r.ok)throw Error('Capture unavailable');return r.json();
  });
  for(const [i,project] of projects.entries()) {
    const id=['futsl','aqua','treadfront'][i],name=project.querySelector('h3').textContent;
    const card=document.createElement('article');card.className='workspace-card';card.dataset.appCard=id;
    card.setAttribute('aria-labelledby','workspace-app-heading-'+i);
    if(root.dataset.selectedApp===id)card.dataset.selected='true';
    const body=document.createElement(i===2?'button':'div');body.className='workspace-app';body.dataset.app=String(i);
    const shot=document.createElement('span');shot.className='workspace-shot';shot.textContent='Loading screenshot…';
    const title=document.createElement('strong');title.id='workspace-app-heading-'+i;title.textContent=name;title.className='workspace-card-title';
    const purpose=document.createElement('span');purpose.className='workspace-purpose';
    purpose.textContent=['Fixtures, results and teams.','Find pools and places to swim.','Defend the base in one sector.'][i];
    const gallery=document.createElement('span');gallery.className='workspace-gallery';gallery.append(shot);
    body.append(gallery,title,purpose);card.append(body);
    if(i===2){
      body.type='button';body.dataset.demoOpen='';body.setAttribute('aria-label','Play Treadfront one-sector demo');
      const action=document.createElement('span');action.className='workspace-action';action.textContent='Play demo →';body.append(action);
      body.addEventListener('click',()=>onDemo(body),{signal:events.signal});
    }
    const links=document.createElement('div');links.className='workspace-links';
    for(const source of project.querySelectorAll('.project-links a[href^="https:"]')){
      const link=source.cloneNode(true);link.target='_blank';link.rel='noopener noreferrer';
      // Explicit Tab stops include these actions in WebKit’s default keyboard mode.
      link.tabIndex=0;
      const isStore=['apps.apple.com','play.google.com'].includes(new URL(link.href).hostname);
      link.className=isStore?'workspace-store':'workspace-action';
      link.dataset[isStore?'appStore':'appWebsite']=id;links.append(link);
    }
    // Keep external links beside the demo, never nested inside its button.
    (i===2?card:body).append(links);
    const date=document.createElement('small');date.className='workspace-capture-date';card.append(date);
    const notes=document.createElement('button');notes.type='button';notes.dataset.projectNotes=String(i);
    notes.textContent='Case study';notes.setAttribute('aria-label',name+' case study');
    notes.addEventListener('click',()=>{root.dataset.workspaceView='case-study';home.hidden=true;back.hidden=false;section.hidden=false;
      projects.forEach((p,n)=>p.hidden=n!==i);root.scrollTop=0;project.querySelector('h3').tabIndex=-1;
      project.querySelector('h3').focus({preventScroll:true});},{signal:events.signal});
    card.append(notes);home.querySelector('.workspace-apps').append(card);
    const cue=i<2?document.createElement('span'):null;
    if(cue){
      cue.className='workspace-enlarge-cue';cue.hidden=true;cue.textContent='Tap a screenshot to enlarge';
      cue.id='workspace-enlarge-'+id;shot.after(cue);
    }
    const showCaptures=(screens,capturedAt)=>{
      if(events.signal.aborted)return;shot.replaceChildren();if(cue)cue.hidden=false;
      for(const capture of screens){
        const image=document.createElement('img');image.src=capture.image;image.alt=capture.alt||'Treadfront one-sector demo';
        if(capture.width){image.width=capture.width;image.height=capture.height;}
        image.loading='eager';image.addEventListener('error',()=>{
          const notice=document.createElement('span');notice.textContent='Screenshot unavailable';
          (image.closest('[data-enlarge-screenshot]')||image).replaceWith(notice);
          if(cue)cue.hidden=!shot.querySelector('[data-enlarge-screenshot]');
        },{signal:events.signal});
        if(i<2){
          const enlarge=document.createElement('button');enlarge.type='button';enlarge.className='workspace-screenshot';
          enlarge.dataset.enlargeScreenshot=capture.id;enlarge.setAttribute('aria-haspopup','dialog');
          enlarge.setAttribute('aria-label','Enlarge '+name+': '+capture.label);enlarge.title='Enlarge screenshot';
          enlarge.setAttribute('aria-describedby',cue.id);
          enlarge.append(image);shot.append(enlarge);
          enlarge.addEventListener('click',()=>screenshots.open(capture,name,date.textContent,enlarge),{signal:events.signal});
        }else shot.append(image);
      }
      date.textContent=(i===2?'Demo capture · ':'Screenshots · ')+
        new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(capturedAt));
    };
    const capture=i<2?captures.then(m=>{
      const app=m.projects[id];showCaptures(app.screens.slice(0,2),app.capturedAt);
    }):fetch('assets/previews/treadfront-card.json',{signal:events.signal}).then(r=>{
      if(!r.ok)throw Error('Demo capture unavailable');return r.json();
    }).then(m=>showCaptures([m],m.capturedAt));
    capture.catch(()=>{
      if(!events.signal.aborted){if(cue)cue.hidden=true;shot.textContent='Screenshot unavailable';date.textContent='Use the links to explore.';}
    });
  }
  reset();
  return ()=>{events.abort();delete root.dataset.workspaceView;home.remove();back.remove();section.hidden=wasHidden;
    projects.forEach((n,i)=>{n.hidden=original[i];n.querySelector('h3').removeAttribute('tabindex');});};
}

// A native top-layer dialog stays flat, independently of the photographed laptop.
function createScreenshotViewer(signal) {
  const dialog=document.createElement('dialog');dialog.className='app-screenshot-viewer';
  dialog.setAttribute('aria-labelledby','app-screenshot-title');
  dialog.innerHTML='<header><h2 id="app-screenshot-title"></h2><button type="button" autofocus>Close ✕</button></header>'+
    '<figure><div class="screenshot-image"><img alt=""></div><figcaption></figcaption></figure><p class="screenshot-error" hidden>Screenshot unavailable.</p>';
  const close=dialog.querySelector('button'),image=dialog.querySelector('img');let trigger;
  const dismiss=()=>{dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;};
  close.addEventListener('click',dismiss,{signal});
  // Stop the portfolio's Escape handler: one Escape closes only this viewer.
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}},{signal});
  dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();},{signal});
  image.addEventListener('error',()=>{image.hidden=true;dialog.querySelector('.screenshot-error').hidden=false;},{signal});
  document.body.append(dialog);
  signal.addEventListener('abort',()=>{trigger=null;dialog.close();dialog.remove();},{once:true});
  return {open(capture,name,date,source){
    trigger=source;dialog.querySelector('h2').textContent=name+' · '+capture.label;
    dialog.querySelector('figcaption').textContent=date;
    image.hidden=false;dialog.querySelector('.screenshot-error').hidden=true;
    image.alt=capture.alt;image.src=capture.image;dialog.showModal();close.focus({preventScroll:true});
  }};
}
