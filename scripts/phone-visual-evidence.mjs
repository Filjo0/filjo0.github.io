// Native-image evidence for the real-phone regressions. These assertions compare
// the HTML with measured photographic glass and with its actual painted pixels.
export async function contactGlass(page,check) {
 const geometry=await page.locator('[data-world-reader]').evaluate(async n=>{
  const host=document.querySelector('[data-world-render]'),{plateMetrics}=await import('/world/plate-views.js');
  const manifest=await (await fetch('assets/outdoor/object-views.json')).json(),asset=manifest.views.contact;
  const metrics=plateMetrics({...asset,corners:asset.mobile_corners},host,false);
  const width=host.clientWidth,height=host.clientHeight,scale=metrics.scale;
  const left=Math.max(0,Math.min(asset.width*scale-width,metrics.centre[0]*scale-width/2));
  const top=Math.max(0,Math.min(asset.height*scale-height,metrics.centre[1]*scale-(height/2+16)));
  const origin=host.getBoundingClientRect(),project=([x,y])=>[origin.x+x*scale-left,origin.y+y*scale-top];
  // Independently measured screen inset, below the one camera in the artwork.
  const glass=[[638,110],[1020,110],[1030,837],[635,837]].map(project);
  const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
   const dot=document.createElement('span');
   dot.style.cssText='position:absolute;left:'+x*100+'%;top:'+y*100+'%;width:0;height:0';
   n.append(dot);const r=dot.getBoundingClientRect();dot.remove();return [r.x,r.y];
  });
  // Use matte wood and the camera strip, not metallic highlights: WebGL
  // samples the latter in linear colour while Canvas 2D resamples in sRGB.
  const hardware=[[600,400],[600,550],[1060,400],[1060,500],[800,850],[780,90],[830,90],[880,90]]
   .map(source=>({source,screen:project(source)}))
   .filter(({screen:[x,y]})=>x>=4&&x<width-4&&y>=68&&y<height-4);
  return {glass,corners,hardware,scale,left,top,image:asset.image};
 });
 for(const [x,y] of geometry.corners)for(let i=0;i<4;i++){
  const [ax,ay]=geometry.glass[i],[bx,by]=geometry.glass[(i+1)%4];
  const distance=((bx-ax)*(y-ay)-(by-ay)*(x-ax))/Math.hypot(bx-ax,by-ay);
  check(distance>=-2,'Contact HTML corner stays inside the independently measured photographed glass (2px tolerance)');
 }
 const png=await page.screenshot();
 const painted=await page.evaluate(async({data,geometry})=>{
  const load=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
  const native=await load('data:image/png;base64,'+data),photo=await load('assets/outdoor/'+geometry.image);
  const canvas=()=>{const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;return c;};
  const actual=canvas().getContext('2d'),expected=canvas().getContext('2d');
  actual.drawImage(native,0,0);expected.drawImage(photo,-geometry.left,-geometry.top,photo.width*geometry.scale,photo.height*geometry.scale);
  return geometry.hardware.map(({screen:[x,y]})=>{
   // A 9px patch avoids single-texel noise without relaxing the glass-boundary tolerance.
   const mean=ctx=>{
    const data=ctx.getImageData(Math.floor(x)-4,Math.floor(y)-4,9,9).data;
    return [0,1,2].map(i=>{let sum=0;for(let j=i;j<data.length;j+=4)sum+=data[j];return sum/81;});
   };
   const a=mean(actual),b=mean(expected);
   return {x,y,difference:Math.max(...a.map((value,i)=>Math.abs(value-b[i])))};
  });
 },{data:png.toString('base64'),geometry});
 check(painted.length>=3&&painted.every(p=>p.difference<=8),
  'Native pixels locate the real photographed bezel/wood at the calibrated screen: '+JSON.stringify(painted));
 check(await page.locator('.phone-status,.phone-camera').count()===0,'No synthetic camera or second status bar is drawn');
 return {...geometry,painted};
}

async function linkInk(page,link,check,label){
 const box=await link.boundingBox(),before=await page.screenshot();
 const style=await page.addStyleTag({content:'.world-reader[data-experience="experience"] .world-reader-body {mask-image:none!important;-webkit-mask-image:none!important;}'});
 let reference;
 try{reference=await page.screenshot();}finally{await style.evaluate(n=>n.remove());}
 const result=await page.evaluate(async({before,reference,box})=>{
  const decode=async data=>{
   const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();
   const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);
   return ctx.getImageData(0,0,c.width,c.height);
  };
  const a=await decode(before),b=await decode(reference);let changed=0,ink=0;
  for(let y=Math.max(0,Math.ceil(box.y));y<Math.min(a.height,Math.floor(box.y+box.height));y++)
   for(let x=Math.max(0,Math.ceil(box.x));x<Math.min(a.width,Math.floor(box.x+box.width));x++){
    const j=(y*a.width+x)*4,diff=Math.max(...[0,1,2].map(i=>Math.abs(a.data[j+i]-b.data[j+i])));
    if(diff>2)changed++;
    if(b.data[j]<120&&b.data[j+1]<150&&b.data[j+2]<130)ink++;
   }
  return {changed,ink};
 },{before:before.toString('base64'),reference:reference.toString('base64'),box});
 check(result.ink>=20,label+': native capture includes readable link ink');
 check(result.changed===0,label+': painted link is identical to the unmasked reference: '+JSON.stringify(result));
 check(await link.evaluate(n=>{
  const r=n.getBoundingClientRect(),b=n.closest('[data-world-content]').getBoundingClientRect();
  return r.top>=b.top-1&&r.bottom<=b.bottom+1&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
 }),label+': the complete link and its hit area are visible');
 return result;
}
export async function aboutLinkInk(page,check){
 const body=page.locator('[data-world-content]'),resume=body.locator('a').filter({hasText:'Open full résumé'}).first();
 // Place the real link near the lower edge while more content remains. Testing
 // only at the final scroll position would miss the original fade entirely.
 await resume.evaluate(n=>{
  const b=n.closest('[data-world-content]'),r=n.getBoundingClientRect(),v=b.getBoundingClientRect();
  b.scrollTop+=r.bottom-v.bottom+4;
 });
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const nearEdge=await linkInk(page,resume,check,'About résumé near the scroll edge');
 await body.evaluate(n=>n.scrollTop=n.scrollHeight);
 await page.waitForFunction(()=>!document.querySelector('[data-world-reader]').hasAttribute('data-about-more'));
 check(await page.locator('.about-scroll-cue').isHidden(),'About cue leaves when the actual end is reached');
 // The only résumé link belongs to the introductory section, above the job
 // history. At the actual end, education is visible rather than another link.
 const last=body.locator('.education-list strong').last(),end=await linkInk(page,last,check,'About final education entry');
 return {nearEdge,end};
}
export async function screenshotCues(page,check){
 const shots=page.locator('[data-enlarge-screenshot]');await shots.first().waitFor();
 await page.locator('.workspace-shot img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
 const evidence=await page.locator('.workspace-card').evaluateAll(cards=>cards.filter(n=>n.dataset.appCard!=='treadfront').map(card=>{
  const cue=card.querySelector('.workspace-enlarge-cue'),r=cue?.getBoundingClientRect();
  return {id:card.dataset.appCard,cue:cue?.textContent,rect:r?.toJSON(),screens:[...card.querySelectorAll('[data-enlarge-screenshot]')].map(button=>{
   const image=button.querySelector('img').getBoundingClientRect(),b=button.getBoundingClientRect();
   const area=r?Math.max(0,Math.min(r.right,image.right)-Math.max(r.left,image.left))*Math.max(0,Math.min(r.bottom,image.bottom)-Math.max(r.top,image.top)):-1;
   return {width:b.width,height:b.height,area,bottom:image.bottom,described:button.getAttribute('aria-describedby')===cue?.id};
  })};
 }));
 check(evidence.length===2,'Both public apps retain their screenshot pair and separate caption');
 for(const app of evidence){
  check(app.cue==='Tap a screenshot to enlarge'&&app.screens.length===2,app.id+': one clear enlargement cue per pair');
  for(const image of app.screens){
   check(image.area===0&&app.rect.top>=image.bottom,app.id+': caption has zero overlap with the screenshot');
   check(image.width>=44&&image.height>=44&&image.described,app.id+': screenshot is a named touch/keyboard control');
  }
 }
 return evidence;
}
