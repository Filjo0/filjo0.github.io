import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
// Preserve the original complete About expectation when the owner shortens only the CV.
const approved=JSON.parse(await readFile(new URL('./fixtures/resume-approved.json',import.meta.url),'utf8'));
const source=approved.roles.slice(0,5).map(r=>({role:r.role,date:r.date,employer:r.employer_or_project,bullets:r.before}));
const out='validation-artifacts/final-recheck-implementation/'+name;await mkdir(out,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const mode of ['scene','page','no-js']){
  const p=await browser.newPage({viewport,reducedMotion:'reduce',javaScriptEnabled:mode!=='no-js'}),errors=[];current=p;
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/#experience');
  if(mode!=='no-js')await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='experience'&&
   !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  if(mode==='page'){
   await p.locator('[data-world-close]').click();await p.locator('[data-settings-toggle]').click();
   await p.locator('[data-world-text]').click();await p.locator('#experience').waitFor();
  }
  const scope=p.locator(mode==='scene'?'[data-world-section="experience"]':'#experience');
  const actual=await scope.locator('.timeline-entry').evaluateAll(nodes=>{
   const clean=s=>s.replace(/\s+/g,' ').trim();
   return nodes.map(n=>({role:clean(n.querySelector('h3').textContent),date:clean(n.querySelector('.timeline-meta span').textContent),
    employer:clean(n.querySelector('.timeline-meta span:last-child').textContent),
    bullets:[...n.querySelectorAll('li')].map(b=>clean(b.textContent))}));
  });
  assert.deepEqual(actual,source,'Every role, date, employer and bullet must retain the approved full About copy exactly');checks++;
  check(await scope.locator('a.text-action').innerText()==='Open full résumé','The résumé link keeps its accents');
  check(await scope.locator('li').count()===source.reduce((n,r)=>n+r.bullets.length,0),'All approved experience bullets are present');
  const last=scope.locator('.timeline-entry').last();await last.scrollIntoViewIfNeeded();
  check(await last.locator('li').isVisible(),'The final job remains reachable');
  await p.screenshot({path:out+'/'+viewport.width+'-about-'+mode+'.png'});
  check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
 }
 console.log(name+': '+checks+' exact résumé/About copy checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/about-failure.png'});throw e;}
finally {await browser.close();}
