import {reducedMotion} from './world/motion.js';
import {mountObjectExperience, setupObjectMenu, setupFocusedChrome} from './world/object-experience.js';
import { discoveries, mountDiscovery } from './world/discoveries.js';
import {
  projectSurface
} from './world/surfaces.js';
import {
  mountResume
} from './world/resume.js';
import {
  createBooksPage
} from './world/stations/books.js';
import {
  createSeedsPage
} from './world/stations/seeds.js';
import {
  createDemo
} from './world/demo.js';
import {createWorld as createConceptWorld} from './world/concept-world.js';
import {
  places
} from './world-state.js';
import {
  mountProjectPreviews
} from './world-projects.js';

const stage = document.querySelector('[data-world-stage]'),
  host = document.querySelector('[data-world-render]'),
  reader = document.querySelector('[data-world-reader]'),
  content = document.querySelector('[data-world-content]'),
  heading = document.getElementById('world-reader-title'),
  fallback = document.querySelector('[data-world-fallback]'),
  status = document.querySelector('[data-world-status]');
const events = new AbortController(),
  signal = events.signal,
  records = new Map();
let world, active = 'overview',
  version = 0,
  textMode = false,
  paused = false,
  previewDispose = () => {},
  readerStation = null,
  mountEvents = new AbortController(),
  surfaceFocus = false,
  objectAnimation = null,
  objectDispose = () => {},
  pendingDemo = false,
  initializing = true,
  focusIntent = false,
  initialTabStart = Boolean(location.hash),
  returnFocus = null,
  sceneChrome = null;
const reduced = {get matches(){return reducedMotion();}};
const announce = text => {
  status.textContent = text;
};
// Fragment navigation can retain a moved section as the sequential Tab start.
// Reset only an untouched initial document, after its close-up is ready.
const cancelInitialTabStart=()=>{initialTabStart=false;};
for(const type of ['pointerdown','keydown'])
  document.addEventListener(type,cancelInitialTabStart,{capture:true,once:true,signal});
function resetInitialTabStart() {
  if(!initialTabStart)return;
  initialTabStart=false;
  const body=document.body;
  if(document.activeElement!==body)return;
  const previous=body.getAttribute('tabindex');
  body.tabIndex=-1;body.focus({preventScroll:true});body.blur();
  if(previous===null)body.removeAttribute('tabindex');else body.setAttribute('tabindex',previous);
}
const reading = createBooksPage(content);
const fibPage = createSeedsPage(content);
let demoBack=null;
function updateDemoBack() {
  if(!demoBack)return;
  const full=reader.classList.contains('world-demo-surface')&&reader.dataset.fullscreen==='true';
  const back=document.querySelector('[data-world-close]');
  back.textContent=full?'← Apps':demoBack.text;
  back.setAttribute('aria-label',full?'Return to My apps':demoBack.label);
  demo.setHandheld(full);
}
const demo = createDemo({
  onScreen(value) {
    const back=document.querySelector('[data-world-close]');
    if(value)demoBack={text:back.textContent,label:back.getAttribute('aria-label')||back.textContent};
    reader.classList.toggle('world-demo-surface',value);
    world?.setScreenExpanded?.(value);updateDemoBack();
    if(!value)demoBack=null;
    return value&&reader.dataset.fullscreen==='true';
  },
  onPause(value) {
    world?.setPaused(value);
  },
  onClose() {
    world?.setPaused(paused);
  }
});

const restore = () => {
  objectAnimation?.cancel();objectAnimation=null;
  objectDispose();objectDispose=()=>{};
  sceneChrome?.close();
  delete reader.dataset.playState;
  mountEvents.abort();
  mountEvents = new AbortController();
  surfaceFocus = false;
  const back=document.querySelector('[data-world-close]');
  if(back.classList.contains('scene-back'))back.hidden=true;
  reader.classList.remove('world-object', 'world-object-opening');
  reader.style.removeProperty('width');
  reader.style.removeProperty('height');
  reader.style.removeProperty('transform');
  delete reader.dataset.surface;
  delete reader.dataset.fullscreen;
  delete reader.dataset.object;
  delete reader.dataset.surfaceCorners;
  demo.close();
  readerStation?.exit();
  readerStation = null;
  previewDispose();
  previewDispose = () => {};
  for (const [id, r] of records) {
    r.node.querySelectorAll('[data-copy-email]').forEach(button=>button.remove());
    r.node.id = id;
    delete r.node.dataset.worldSection;
    r.anchor.removeAttribute('id');
    r.anchor.after(r.node);
  }
  content.replaceChildren();
};

function fail(cause={}) {
  if (textMode) return;
  const error=cause.error||cause;
  console.info('[portfolio:fallback]',{
    reason:cause.reason||(cause.type==='click'?'visitor-request':'scene-error'),
    renderer:document.body.dataset.worldRenderer,route:active,ready:document.body.dataset.worldReady==='true',
    asset:error.asset||null,error:error instanceof Error?{name:error.name,message:error.message.slice(0,400)}:null,
    time:new Date().toISOString()
  });
  textMode = true;
  ++version;
  world?.dispose();
  restore();
  stage.hidden = true;
  document.querySelector('[data-world-map]').hidden=true;
  fallback.hidden = false;
  document.querySelector('[data-world-settings]').hidden = true;
  sceneChrome?.dispose();
  delete document.body.dataset.worldReady;
  delete document.body.dataset.worldRegion;
  delete document.body.dataset.objectOpen;
  document.querySelector('[data-world-regions]').hidden = true;
  document.querySelector('[data-world-globe]').hidden = true;
  document.querySelectorAll('[data-world-route]').forEach(a => a.removeAttribute('aria-current'));
  history.scrollRestoration = 'auto';
}

function updateRegion(region) {
  document.body.dataset.worldRegion = region;
  document.querySelectorAll('[data-world-regions] a').forEach(a => {
    if (a.dataset.worldRoute === region) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
  const intro = document.querySelector('[data-world-intro]');
  intro.querySelector('p').textContent = region === 'winter' ? 'Snowy winter' : 'Warm coast';
  intro.querySelector('h2').textContent = region === 'winter' ? 'A different kind of playground.' :
    'Explore. Play. Make something.';
}

function exploreCurrent() {
  go(world.state().region === 'winter' ? 'winter' : 'overview');
}

function mount(id) {
  if (textMode) return;
  restore();
  reader.dataset.activity = '';
  reader.dataset.sport = id;
  document.querySelector('[data-world-leave]').hidden = true;
  const exploring = ['overview', 'coast', 'winter'].includes(id);
  if(document.body.dataset.worldNavigation==='objects')document.body.dataset.objectOpen=String(!exploring);
  reader.hidden = exploring;
  document.querySelector('[data-world-close]').hidden=exploring;
  const intro=document.querySelector('[data-world-intro]');
  intro.hidden = !exploring || intro.dataset.dismissed==='true';
  document.querySelector('[data-world-map]').hidden = !exploring || document.body.dataset.worldNavigation==='objects';
  document.querySelector('[data-world-touch]').hidden = document.body.dataset.worldNavigation==='objects' ||
    !matchMedia('(pointer: coarse)').matches || !(
    (exploring && document.body.dataset.worldNavigation !== 'objects') || [
      'surf', 'skate'
    ].includes(id));
  if (exploring) {
    if(focusIntent) {
      const opener=returnFocus,token=version;returnFocus=null;
      // A short viewport can briefly crop a dot while the overview resizes back from paper.
      const deadline=performance.now()+500;
      const focusOverview=()=>{
        if(token!==version||textMode)return;
        const available=opener?.isConnected&&opener.getClientRects().length&&!opener.disabled;
        if(!available&&opener?.isConnected&&opener.matches('[data-scene-object]')&&performance.now()<deadline){
          requestAnimationFrame(focusOverview);return;
        }
        (available?opener:host).focus({preventScroll:true});
      };
      requestAnimationFrame(focusOverview);
    }
    return;
  }
  heading.textContent = places[id].label;
  const returning=document.querySelector('[data-world-close]');
  returning.textContent=document.body.dataset.worldNavigation==='objects'?`← ${world.state().region==='winter'?'Winter':'Coast'}`:'Back to scene';
  returning.setAttribute('aria-label','Return to the scene');
  const sections = id === 'work' ? ['work'] : id === 'experience' ? ['experience', 'capabilities', 'resume'] :
    id ===
    'contact' ? ['contact'] : [];
  for (const key of sections) {
    const r = records.get(key);
    r.node.id = `world-section-${key}`;
    r.node.dataset.worldSection = key;
    r.anchor.id = key;
    content.append(r.node);
  }
  if (id === 'work') previewDispose = mountProjectPreviews(content, {
    onDemo: b => demo.open(b, document.body.dataset.worldNavigation==='objects'?content:null)
  });
  if (id === 'books') {
    readerStation = reading;
    readerStation.enter();
  }
  if (id === 'fibonacci') {
    readerStation = fibPage;
    readerStation.enter();
  }
  if (discoveries[id]) mountDiscovery(content, id);
  if (id === 'resume') mountResume(content, mountEvents.signal);
  if(id==='contact'&&document.body.dataset.worldNavigation==='objects') {
    const mail=content.querySelector('a[href^="mailto:"]'),copy=document.createElement('button');
    copy.type='button';copy.dataset.copyEmail='';copy.textContent='Copy email';
    copy.addEventListener('click',async()=>{
      try {await navigator.clipboard.writeText(mail.href.slice(7));copy.textContent='Email copied';announce('Email copied.');}
      catch {copy.textContent='Use the email link above';announce('Copy is unavailable. Use the email link.');}
    },{signal:mountEvents.signal});mail?.parentElement.append(copy);
  }
  const conceptPage=document.body.dataset.worldRenderer==='concept'&&['books','fibonacci'].includes(id);
  if (conceptPage || discoveries[id] || ['work', 'experience', 'resume', 'contact', 'futsl', 'aqua', 'tank'].includes(id)) {
    reader.classList.add('world-object', 'world-object-opening');
    Promise.resolve(world.inspect(id,{immediate:reduced.matches})).catch(()=>{
      if(active!==id||textMode)return;
      reader.classList.remove('world-object','world-object-opening');
      content.innerHTML='<p>This close-up could not load.</p><button type="button" data-view-retry>Retry view</button>';
      content.querySelector('[data-view-retry]').addEventListener('click',()=>go(id,{historyChange:false}),{signal:mountEvents.signal});
      announce('Close-up unavailable. Retry the view or go back to the scene.');
    });
  } else if(focusIntent)heading.focus({
    preventScroll: true
  });
  else resetInitialTabStart();
  content.scrollTop = 0;
  if(document.body.dataset.worldNavigation==='objects') {
    objectDispose=mountObjectExperience(reader,content,id);
    reader.dataset.objectAction=id==='contact'?'wake':id==='work'?'screen':'page';

  }
  announce(`${places[id].label} opened.`);
}

function go(id, {
  historyChange = true,
  opener = null
} = {}) {
  if(['swim','ball','surf','skate','plants'].includes(id)){id='overview';history.replaceState({},'', '#top');}
  focusIntent=!initializing;
  if(historyChange){const intro=document.querySelector('[data-world-intro]');intro.dataset.dismissed='true';intro.hidden=true;}
  pendingDemo = id==='tank' && document.body.dataset.worldNavigation==='objects';
  if(pendingDemo)id='work';
  if(id==='coaching')id='experience';
  if(['tennis','receipts'].includes(id))id='work';
  if(['futsl','aqua'].includes(id)){id='work';history.replaceState({},'', '#work');historyChange=false;}
  if (id === 'globe' && !textMode && world.globe) {
    ++version; active = 'overview'; restore(); reader.hidden = true;
    document.querySelector('[data-world-map]').open = false;
    document.querySelectorAll('.world-dock a').forEach(a=>a.removeAttribute('aria-current'));
    if(historyChange)history.pushState({},'', '#top');
    world.globe();
    announce('The snow globe changes this coast into a Siberian winter.');
    return;
  }
  if (textMode || !places[id]) return;
  if(['overview','coast','winter'].includes(active)&&!['overview','coast','winter'].includes(id))
    returnFocus=opener;
  const token = ++version;
  active = id;
  restore();
  reader.hidden = true;
  document.querySelector('[data-world-leave]').hidden = true;
  document.querySelector('[data-world-map]').open = false;
  document.querySelector('[data-world-intro]').hidden = true;
  if (historyChange) history.pushState({}, '', id === 'overview' ? '#top' : `#${id}`);
  document.querySelectorAll('.world-dock a').forEach(a => {
    if (a.dataset.worldRoute === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelector('.scene-play > summary')?.setAttribute('aria-current',
    !['overview','coast','winter','work','experience','resume','contact'].includes(id)?'page':'false');
  announce(`${document.body.dataset.worldNavigation==='objects'?'Opening':'Walking to'} ${places[id].label}.`);
  if (paused) {
    paused = false;
    world.setPaused(false);
    document.querySelector('[data-world-pause]').setAttribute('aria-pressed', 'false');
    document.querySelector('[data-world-pause]').textContent = 'Pause';
  }
  world.travel(id, {
    immediate: reduced.matches
  });
  return token;
}

function hold(button, name) {
  const clear = () => world?.move(name, false);
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    world.move(name, true);
  }, {
    signal
  });
  button.addEventListener('pointerup', clear, {
    signal
  });
  button.addEventListener('pointercancel', clear, {
    signal
  });
  button.addEventListener('lostpointercapture', clear, {
    signal
  });
  button.addEventListener('keydown', e => {
    if (['Space', 'Enter'].includes(e.code)) {
      e.preventDefault();
      world.move(name, true);
    }
  }, {
    signal
  });
  button.addEventListener('keyup', clear, {
    signal
  });
  button.addEventListener('blur', clear, {
    signal
  });
}
try {
  for (const id of ['work', 'experience', 'capabilities', 'resume', 'contact']) {
    const node = document.getElementById(id),
      anchor = document.createElement('span');
    anchor.hidden = true;
    node.before(anchor);
    records.set(id, {
      node,
      anchor
    });
  }
  if (matchMedia('(pointer: coarse)').matches) document.querySelector('[data-world-intro] > span')
    .textContent =
    'Tap the boardwalk to walk. Hold the arrows to move; drag to pan. Open Explore for activities.';
  document.addEventListener('click',()=>{
    const intro=document.querySelector('[data-world-intro]');intro.dataset.dismissed='true';intro.hidden=true;
  },{once:true,signal});
  stage.hidden = false;
  document.body.dataset.worldRenderer = new URLSearchParams(location.search).get('world') === 'legacy' ? 'legacy' : 'concept';
  document.body.dataset.worldNavigation = document.body.dataset.worldRenderer === 'concept' &&
    new URLSearchParams(location.search).get('navigation') !== 'walk' ? 'objects' : 'walk';
  if(document.body.dataset.worldNavigation==='objects') {
    setupObjectMenu(document.querySelector('[data-world-map]'));
    sceneChrome=setupFocusedChrome(document.querySelector('.world-header'),{signal,onMotionChange:()=>world?.refreshMotion?.()});
    const back=document.querySelector('[data-world-close]');back.classList.add('scene-back');back.hidden=true;
    document.querySelector('.world-header').prepend(back);
    document.querySelector('[data-world-text]').textContent='Simple page view';
    host.setAttribute('aria-label','Interactive coastal scene. Select an object to open it. Drag to pan the view.');
    const intro=document.querySelector('[data-world-intro]');intro.dataset.dismissed='true';intro.hidden=true;
    intro.querySelector('span').textContent='';
  }
  const buildWorld = document.body.dataset.worldRenderer === 'legacy'
    ? (await import('./world.js')).createWorld : createConceptWorld;
  world = buildWorld({
    host,
    onFailure: fail,
    onSeasonLoading: region => {
      const options=document.querySelector('[data-world-regions]');
      options.setAttribute('aria-busy',String(!!region));
      for(const link of options.querySelectorAll('a')) {
        const name=link.dataset.worldRoute==='winter'?'Winter':'Coast';
        link.textContent=link.dataset.worldRoute===region?name+' · loading…':name;
      }
    },
    onNear: id => {
      const n = document.querySelector('[data-world-nearby]');
      n.hidden = document.body.dataset.worldNavigation==='objects' || !id || !['overview', 'coast', 'winter'].includes(active);
      document.querySelector('[data-world-nearby-label]').textContent = id === 'globe' ? 'Shake the snow globe' : id ? places[id].label : '';
    },
    onArrive: id => {
      if (id === active) mount(id);
    },
    onObject: (id,opener) => go(id,{opener}),
    onSurface(object, camera, settled) {
      if (!reader.classList.contains('world-object') || reader.hidden) return;
      const fits = projectSurface(reader, object, camera, host);
      updateDemoBack();
      if (fits && settled) {
        reader.classList.remove('world-object-opening');
        if(pendingDemo&&object?.id==='work'){
          pendingDemo=false;const token=version;
          queueMicrotask(()=>{
            if(textMode||active!=='work'||token!==version)return;
            const launch=content.querySelector('[data-demo-open]');
            launch.closest('.workspace-card').scrollIntoView({block:'nearest'});demo.open(launch,content);
          });return;
        }
        if (!surfaceFocus) {
          // Hidden close-ups have no scroll box: reset once after projection reveals it.
          content.scrollTop = 0;
          surfaceFocus = true;
          if(document.body.dataset.worldNavigation==='objects'&&!reduced.matches)
            objectAnimation=content.animate([{opacity:0},{opacity:1}],350);
          if(focusIntent)(reader.dataset.activity==='device'?content.querySelector('[data-game-start]'):heading).focus({
            preventScroll: true
          });
          else resetInitialTabStart();
        }
      }
    },
    onGame() {},
    onRegion: updateRegion
  });
  document.body.dataset.worldReady = 'true';
  fallback.hidden = true;
  document.querySelector('[data-world-settings]').hidden = document.body.dataset.worldNavigation==='objects';
  document.querySelector('[data-world-regions]').hidden = false;
  document.querySelector('[data-world-globe]').hidden = document.body.dataset.worldRenderer !== 'concept'||
    document.body.dataset.worldNavigation==='objects';
  document.querySelector('[data-world-globe]').addEventListener('click', () => go('globe'), {signal});
  history.scrollRestoration = 'manual';
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-world-route]');
    if (a && !textMode) {
      e.preventDefault();
      go(a.dataset.worldRoute,{opener:a});
    }
  }, {
    signal
  });
  document.querySelector('[data-world-interact]').addEventListener('click', () => go(world.nearby()), {
    signal
  });
  document.querySelector('[data-world-leave]').addEventListener('click', exploreCurrent, {
    signal
  });
  document.querySelector('[data-world-close]').addEventListener('click', () => {
    if(reader.classList.contains('world-demo-surface')&&reader.dataset.fullscreen==='true'){demo.close();return;}
    exploreCurrent();
  }, {
    signal
  });
  document.querySelector('[data-world-text]').addEventListener('click', fail, {
    signal
  });
  document.querySelectorAll('[data-move]').forEach(b => hold(b, b.dataset.move));
  document.querySelector('[data-world-pause]').addEventListener('click', e => {
    paused = !paused;
    world.setPaused(paused);
    readerStation?.setPaused?.(paused);
    if(paused&&objectAnimation?.playState==='running')objectAnimation.pause();
    else if(!paused&&objectAnimation?.playState==='paused')objectAnimation.play();
    demo.pause(paused);
    e.currentTarget.setAttribute('aria-pressed', String(paused));
    e.currentTarget.textContent = paused ? 'Resume' : 'Pause';
  }, {
    signal
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&objectAnimation?.playState==='running')objectAnimation.pause();
    else if(!document.hidden&&!paused&&objectAnimation?.playState==='paused')objectAnimation.play();
  },{signal});
  const day=document.querySelector('[data-world-day]'),dusk=document.querySelector('[data-world-night]');
  const setLight=night=>{
    const objectMode=document.body.dataset.worldNavigation==='objects';
    dusk.disabled=true;if(day)day.disabled=true;
    if(!objectMode)dusk.textContent=night?'Loading…':'Daylight';
    dusk.closest('[data-settings-light]')?.setAttribute('aria-busy','true');
    Promise.resolve(world.setNight(night)).then(()=>{
      dusk.setAttribute('aria-pressed',String(night));day?.setAttribute('aria-pressed',String(!night));
      document.body.dataset.worldLight=night?'night':'sunset';
      if(!objectMode)dusk.textContent=night?'Daylight':'Dusk';
      announce(night?'Evening lights on.':'Daylight restored.');
    }).catch(()=>{
      dusk.setAttribute('aria-pressed','false');day?.setAttribute('aria-pressed','true');
      if(!objectMode)dusk.textContent='Dusk';
      announce('Evening artwork could not load. The daylight scene remains available.');
    }).finally(()=>{
      dusk.disabled=false;if(day)day.disabled=false;dusk.closest('[data-settings-light]')?.removeAttribute('aria-busy');
    });
  };
  dusk.addEventListener('click',()=>setLight(document.body.dataset.worldNavigation==='objects'||
    dusk.getAttribute('aria-pressed')!=='true'),{signal});
  day?.addEventListener('click',()=>setLight(false),{signal});
  document.addEventListener('keydown', e => {
    const play=document.querySelector('[data-world-map]');
    if(e.key==='Escape'&&play.open&&document.body.dataset.worldNavigation==='objects'){
      e.preventDefault();play.open=false;play.querySelector('summary').focus();return;
    }
    if (e.key === 'Escape' && demo.handlesEscape()) {
      e.preventDefault();
      demo.close();
      return;
    }
    if (textMode) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      exploreCurrent();
      return;
    }
    if (e.target.closest('input,select,textarea,iframe')) return;
    if(e.code==='KeyP'&&!e.repeat){e.preventDefault();document.querySelector('[data-world-pause]').click();}
    if (e.code === 'KeyE' && e.target === host && world.nearby()) go(world.nearby());
  }, {
    signal
  });
  const hash = () => {
    const id = location.hash.slice(1);
    go(places[id] || id==='swim' ? id : 'overview', {
      historyChange: false
    });
  };
  window.addEventListener('popstate', hash, {
    signal
  });
  window.addEventListener('hashchange', hash, {
    signal
  });
  hash();initializing=false;
} catch (error) {
  console.warn('Interactive scene unavailable; showing the complete portfolio.', error);
  fail({reason:'startup-error',error});
}
document.querySelectorAll('[data-current-year]').forEach(n => n.textContent = new Date().getFullYear());
