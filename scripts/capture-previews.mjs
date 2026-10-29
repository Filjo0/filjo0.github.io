import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'..'),assets=resolve(root,'assets/previews');
const evidence=resolve(root,'validation-artifacts/phase02/public-captures');
await mkdir(assets,{recursive:true});await mkdir(evidence,{recursive:true});
const browser=await pw.chromium.launch({headless:true,
  ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{})});
const viewport={width:390,height:744},capturedAt=new Date().toISOString();
const projects={};
async function fresh(url) {
  const p=await browser.newPage({viewport,locale:'en-AU',timezoneId:'Australia/Perth',reducedMotion:'reduce'});
  // Public browsing only: no login, names, geolocation or server mutations.
  await p.route('**/*',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  const response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  assert(response.ok(),`Public capture page failed: ${url}`);return p;
}
async function capture(p,project,id,label,alt,actions) {
  await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(350);
  await p.evaluate(()=>document.fonts.ready);
  const hotspots=[];
  for(const action of actions) {
    const locator=action.locator,rect=await locator.boundingBox();
    assert(rect&&rect.width>0&&rect.height>0,`${id}: action is visible`);
    const x=Math.max(0,rect.x),y=Math.max(0,rect.y);
    const width=Math.min(viewport.width,rect.x+rect.width)-x;
    const height=Math.min(viewport.height,rect.y+rect.height)-y;
    assert(width>0&&height>0,`${id}: action is inside capture`);
    hotspots.push({label:action.label,target:action.target,sourceLabel:await locator.getAttribute('aria-label')||
      (await locator.innerText()).trim(),rect:{x,y,width,height}});
  }
  const png=resolve(evidence,`${project}-${id}.png`),webp=resolve(assets,`${project}-${id}.webp`);
  await p.screenshot({path:png});
  execFileSync(process.env.PYTHON||'python',['-c',
    'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=90,method=6)',png,webp]);
  const bytes=await readFile(webp);
  const screen={id,label,alt,width:viewport.width,height:viewport.height,
    image:`assets/previews/${project}-${id}.webp`,sourceUrl:p.url(),
    sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,hotspots};
  projects[project].screens.push(screen);console.log(`${project}/${id}: ${bytes.length} bytes; ${hotspots.length} measured controls`);
}
try {
 const f=await fresh('https://perth-futsal.onrender.com/');
 await f.getByRole('button',{name:'Get started',exact:true}).waitFor({timeout:60000});
 // Anonymous optional onboarding; leave name empty and skip team selection.
 await f.getByRole('button',{name:'Get started',exact:true}).click();
 await f.getByRole('button',{name:/^(Skip|Continue \(\d+\))$/}).click();
 await f.locator('.z-onboarding').waitFor({state:'hidden',timeout:15000});
 await f.getByRole('button',{name:'Not now',exact:true}).click();
 await f.getByText('Seniors',{exact:true}).first().waitFor({timeout:60000});
 projects.futsl={name:'FUTSL',capturedAt,start:'fixtures',screens:[],
   provenance:'First-party public app screens; anonymous optional onboarding, no names or player pages.'};
 const league=f.getByRole('button',{name:'League',exact:true});
 await capture(f,'futsl','fixtures','Fixtures and results','FUTSL public fixtures and results on the capture date',
   [{locator:league,label:'Open league standings',target:'league'}]);
 await league.click();await f.waitForTimeout(1000);
 await capture(f,'futsl','league','League standings','FUTSL public league standings on the capture date',
   [{locator:f.getByRole('button',{name:'All games',exact:true}).last(),label:'Back to fixtures',target:'fixtures'}]);
 await f.close();
 const a=await fresh('https://aqualocal.com.au/');
 await a.getByRole('button',{name:'No thanks',exact:true}).click();
 await a.waitForFunction(()=>/\d+\s*venues/.test(document.body.innerText)&&
   !document.body.innerText.includes('Loading nearby venues'),{timeout:60000});
 projects.aqua={name:'Aqua Local',capturedAt,start:'home',screens:[],
   provenance:'First-party public app screens; analytics declined, no location permission or saved venues.'};
 const lanes=a.getByRole('button',{name:'Find lane times',exact:true});
 await capture(a,'aqua','home','Discover swimming','Aqua Local public home screen on the capture date',
   [{locator:lanes,label:'Find lane times',target:'pools'}]);
 await lanes.click();
 const venue=a.getByRole('button',{name:'View details for Aqua Jetty',exact:true});
 await venue.waitFor();
 await capture(a,'aqua','pools','Published lane schedules','Aqua Local public pool list with published schedules',
   [{locator:venue,label:'Read Aqua Jetty details',target:'venue'},
    {locator:a.getByRole('button',{name:'Home',exact:true}).last(),label:'Back to discovery',target:'home'}]);
 await venue.click();await a.waitForFunction(()=>document.body.innerText.length>500,{timeout:30000});
 assert((await a.locator('body').innerText()).includes('Aqua Jetty'),'Actual venue details must be loaded');
 await capture(a,'aqua','venue','Aqua Jetty','Aqua Jetty public venue details as shown in Aqua Local',
   [{locator:a.getByRole('button',{name:/Back/}).first(),label:'Back to pool list',target:'pools'}]);
 await a.close();
 await writeFile(resolve(assets,'previews.json'),JSON.stringify({version:1,projects},null,2)+'\n');
 console.log('Public previews captured; no live API or third-party frame is used by the portfolio.');
}finally{await browser.close();}
