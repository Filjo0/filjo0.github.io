// Native rendered evidence shared by regression suites whose dot checks became silhouette checks.
import assert from 'node:assert/strict';
export async function revealDesk(page){
  const control=page.locator('button[data-scene-framing]');
  if(await control.isVisible()&&await control.getAttribute('data-scene-destination')==='desk')await control.click();
  await page.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.scenePanning!=='true');
}
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pathPoints=d=>[...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
export async function outlineGeometry(page,layout,check=(v,m)=>assert.ok(v,m),pan=0) {
  const result=await page.evaluate(()=>{
    const host=document.querySelector('[data-world-render]').getBoundingClientRect(),header=document.querySelector('.world-header').getBoundingClientRect();
    const dock=document.querySelector('.world-dock').getBoundingClientRect(),box=n=>n.getBoundingClientRect().toJSON();
    return {host:host.toJSON(),header:header.toJSON(),dock:dock.toJSON(),objects:[...document.querySelectorAll('[data-scene-object]')].map(n=>{
      const id=n.dataset.sceneObject,effect=document.querySelector('[data-scene-effect="'+id+'"]');
      const path=document.querySelector('[data-scene-outline="'+id+'"]');
      return {id,hidden:n.hidden,button:box(n),plate:path?.dataset.plate,d:path?.getAttribute('d'),
        show:n.hasAttribute('data-show-name'),label:box(n.lastElementChild),fit:n.dataset.labelFit,
        connector:effect.querySelector('.scene-label-connector').getAttribute('d')};
    })};
  });
  const {host,header,dock,objects}=result;
  const fullW=Math.max(host.width,host.height*1672/941),fullH=fullW*941/1672;
  const left=Math.max(0,Math.min(fullW-host.width,fullW*(host.width<720?layout.mobile_initial_centre:.5)-host.width/2+pan));
  const top=(fullH-host.height)/2;
  for(const o of objects.filter(o=>!o.hidden)){
    const meta=layout.targets[o.id],shape=meta.outline_variants?.[o.plate]||meta;
    const points=pathPoints(o.d),expected=[shape.outline,...shape.outline_holes||[]].flat().map(([u,v])=>[u*fullW-left,v*fullH-top]);
    check(points.length===expected.length,o.id+': every approved outline vertex and hole is retained');
    points.forEach((p,i)=>check(close(p,expected[i])<1,o.id+': actual SVG vertex matches independent scene crop within 1px'));
    check(o.button.width>=44&&o.button.height>=44,o.id+': native control retains a 44px bounding target');
    check(o.button.x>=host.x-1&&o.button.right<=host.right+1,o.id+': control stays inside screen edges');
    if(!o.show)continue;
    check(o.fit==='true',o.id+': name has a valid non-overlapping position');
    const r=o.label;
    check(r.x>=8-1&&r.right<=host.right-8+1&&r.y>=header.bottom&&
      r.bottom<=(dock.top>header.bottom+1?dock.top:host.bottom)-7,o.id+': tag stays on screen and clear of navigation');
    const endpoints=pathPoints(o.connector).map(([x,y])=>[host.x+x,host.y+y]);
    check(endpoints.length===2,o.id+': a short visible connector joins the tag');
    const distance=await page.locator('[data-scene-outline="'+o.id+'"]').evaluate((path,p)=>{
      const length=path.getTotalLength();let nearest=Infinity;
      for(let i=0;i<=Math.ceil(length*4);i++){
        const a=path.getPointAtLength(length*i/Math.ceil(length*4));nearest=Math.min(nearest,Math.hypot(a.x-p[0],a.y-p[1]));
      }return nearest;
    },[endpoints[0][0]-host.x,endpoints[0][1]-host.y]);
    check(distance<1,o.id+': connector begins on its actual silhouette within 1px');
    const [x,y]=endpoints[1];
    const edgeDistance=Math.min(Math.hypot(x-Math.max(r.x,Math.min(r.right,x)),y-r.y),
      Math.hypot(x-Math.max(r.x,Math.min(r.right,x)),y-r.bottom),
      Math.hypot(x-r.x,y-Math.max(r.y,Math.min(r.bottom,y))),Math.hypot(x-r.right,y-Math.max(r.y,Math.min(r.bottom,y))));
    check(edgeDistance<1,o.id+': connector ends on the actual tag edge within 1px');
    for(const other of objects.filter(n=>!n.hidden&&n.id!==o.id)){
      const hit=await page.locator('[data-scene-hit="'+other.id+'"]').evaluate((path,{r,host})=>{
        for(let y=r.y;y<=r.bottom;y+=3)for(let x=r.x;x<=r.right;x+=3)
          if(path.isPointInFill(new DOMPoint(x-host.x,y-host.y)))return true;
        return false;
      },{r,host});
      check(!hit,o.id+': tag avoids the actual '+other.id+' silhouette');
      if(other.show)check(!(r.x<other.label.right&&r.right>other.label.x&&r.y<other.label.bottom&&r.bottom>other.label.y),
        o.id+': tag avoids '+other.id+' tag');
    }
  }
  return result;
}
export async function outlineContrast(page) {
  const result=[];
  for(const target of await page.locator('[data-scene-object]:visible').all()){
    await page.keyboard.press('Tab');await target.focus();await page.waitForTimeout(200);
    const id=await target.getAttribute('data-scene-object');
    const samples=await page.locator('[data-scene-effect="'+id+'"] .scene-object-rim').evaluate(path=>{
      const transform=path.getScreenCTM(),len=path.getTotalLength();
      return Array.from({length:40},(_,i)=>{const p=path.getPointAtLength(len*(i+.5)/40).matrixTransform(transform);return [p.x,p.y];});
    });
    const png=await page.screenshot();
    const ratio=await page.evaluate(async({data,samples})=>{
      const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
      const lum=(x,y)=>{const a=[...pixels.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+3)].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
      let best=0;
      for(const [px,py] of samples){let min=Infinity,max=0;
        for(let y=Math.round(py)-4;y<=Math.round(py)+4;y++)for(let x=Math.round(px)-4;x<=Math.round(px)+4;x++){
          if(x<0||y<0||x>=canvas.width||y>=canvas.height)continue;
          const v=lum(x,y);min=Math.min(min,v);max=Math.max(max,v);
        }if(min!==Infinity)best=Math.max(best,(max+.05)/(min+.05));
      }return best;
    },{data:png.toString('base64'),samples});
    result.push({id,ratio});
  }
  // End with native pointer input, retaining keyboard modality throughout each focus measurement.
  const r=await page.locator('[data-world-render]').boundingBox();await page.mouse.click(r.x+r.width-8,r.y+r.height*.65);
  return result;
}

export async function dragScene(page,a,b,{touch=false,engine='chromium'}={}) {
  if(touch&&engine==='chromium'){
    const session=await page.context().newCDPSession(page);
    try{
      const points=p=>[{x:p[0],y:p[1],radiusX:5,radiusY:5,id:1}];
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(a)});
      for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',
        touchPoints:points([a[0]+(b[0]-a[0])*i/12,a[1]+(b[1]-a[1])*i/12])});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{await session.detach();}
  }else{await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:12});await page.mouse.up();}
}
