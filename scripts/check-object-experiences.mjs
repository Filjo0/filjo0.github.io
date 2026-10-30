import {revealDesk} from './outline-browser-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const art=resolve(import.meta.dirname,'../validation-artifacts/ux-rebuild',name);await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]) {
  const p=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  console.log(name+': checking object experiences at '+viewport.width+'px');
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
  await p.waitForFunction(()=>document.querySelector('canvas')&&JSON.parse(document.querySelector('canvas').dataset.worldState).ready);
  const go=async id=>{
    if(await p.locator('[data-world-reader]').isVisible())await p.locator('[data-world-close]').click();
    if(id==='books')await revealDesk(p);
    const link=id==='books'?p.locator('[data-scene-object="books"]'):p.locator('.world-dock [data-world-route="'+id+'"]');
    await link.click();
    await p.locator('[data-world-reader]').waitFor();
    await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  };
  await go('work');
  for(const id of ['futsl','aqua']) {
    const app=p.locator('[data-app-website="'+id+'"]');await app.scrollIntoViewIfNeeded();
    const rect=await app.boundingBox(),reader=await p.locator('[data-world-reader]').boundingBox();
    check(rect.width>=44&&rect.height>=44&&rect.y>=reader.y&&rect.y+rect.height<=reader.y+reader.height,
      id+': website action is reachable in the single outer scroll');
    check(await app.getAttribute('target')==='_blank'&&(await app.getAttribute('rel')).includes('noopener'),id+': real website opens safely in a new tab');
    check(await p.locator('[data-app-store="'+id+'"]').count()===(id==='futsl'?2:1),id+': all published stores are available beside the website');
    check(await p.locator('[data-app-card="'+id+'"] .workspace-capture-date').innerText().then(t=>/Screenshots/.test(t)),id+': dated screenshots replace the preview');
    check(await p.locator('.captured-preview,[data-preview-back]').count()===0,'No retired preview or return control');
  }
  await p.screenshot({path:art+'/'+viewport.width+'-apps.png'});
  await p.locator('.workspace-app[data-demo-open]').click();
  check(await p.locator('iframe[src*="demo/treadfront"]').isVisible(),'Treadfront app launches the approved game directly');
  await p.locator(viewport.width<720||viewport.height<500?'[data-world-close]':'[data-demo-close]').click();
  await p.locator('[data-world-close]').click();await go('contact');
  check(await p.getByRole('link',{name:'Email Philipp Alimov'}).isVisible(),'Phone opens with an explicit email action');
  check(await p.locator('.phone-address').innerText()==='philalimov.apps@gmail.com','Phone shows the real business address');
  await p.locator('[data-copy-email]').click();
  await p.waitForFunction(()=>document.querySelector('[data-copy-email]').textContent!=='Copy email');
  check(['Email copied','Use the email link above'].includes(await p.locator('[data-copy-email]').textContent()),
    'Email copy reports its actual outcome');
  await p.screenshot({path:art+'/'+viewport.width+'-contact.png'});
  await p.locator('[data-world-close]').click();await go('books');
  check(await p.locator('[data-reading-id]').count()===0,'Book asks for a reading choice before opening an article');
  await p.locator('[data-book-topic="maths"]').click();await p.locator('[data-book-open="nature-book"]').click();
  check(await p.locator('.book-notes h3').innerText()==='The Nature of Code','Specific chosen book opens');
  check(await p.locator('.book-source').getAttribute('href')==='https://natureofcode.com/','Full reading uses its actual source');
  await p.screenshot({path:art+'/'+viewport.width+'-book-open.png'});
  if(viewport.width<=720||viewport.height<500){
    await p.locator('[data-book-turn]').click();await p.locator('[data-book-turn]').click();
  }
  await p.locator('[data-reading-next]').click();
  check(await p.locator('[data-reading-id]').getAttribute('data-reading-id')!=='nature-book','Suggestion avoids repeating the chosen book');
  await p.locator('[data-book-shelf]').click();check(await p.locator('.book-titles').isVisible(),'Back to shelf restores reading choices');
  await p.locator('[data-world-close]').click();await go('contact');
  await p.locator('[data-world-close]').click();await p.locator('[data-settings-toggle]').click();
  await p.locator('[data-world-text]').click();
  check(await p.locator('#contact a[href^="mailto:"]').innerText()==='philalimov.apps@gmail.com',
    'Text mode restores the original canonical email link');
  check(await p.locator('.phone-profile').count()===0,'Text mode removes object-only presentation');
  check(errors.length===0,'No browser errors: '+errors.join('; '));await p.close();
 }
 console.log(name+': '+checks+' object-experience checks passed.');
} finally {await browser.close();}
