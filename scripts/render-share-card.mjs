import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await pw.chromium.launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},reducedMotion:'reduce'});
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8765/');
 await page.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
 await page.addStyleTag({content:`
 .scene-hotspots,.scene-settings,.world-dock,.world-intro,.world-brand {display:none!important;}
 body[data-world-navigation="objects"]:not([data-object-open="true"]) .world-header {height:88px;padding:16px 28px;}
 .world-identity h1 {font-size:30px;}
 body[data-world-navigation="objects"] .world-header .world-identity p {font-size:18px;}
 `});
 await page.waitForTimeout(100);
 await mkdir(resolve(import.meta.dirname,'../assets'),{recursive:true});
 await page.screenshot({path:resolve(import.meta.dirname,'../assets/portfolio-preview.jpg'),type:'jpeg',quality:86});
 console.log('Rendered real 1200×630 portfolio preview: assets/portfolio-preview.jpg');
}finally{await browser.close();}
