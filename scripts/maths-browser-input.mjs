// Real browser input only: shared by the maths regressions, never DOM event/value injection.
export async function integerRange(page,selector,value) {
  const input=typeof selector==='string'?page.locator(selector):selector;
  const min=Number(await input.getAttribute('min'));
  await input.focus();await page.keyboard.press('Home');
  for(let i=min;i<value;i++)await page.keyboard.press('ArrowRight');
}
export async function dragRange(page,selector,value,{touch=false,engine='chromium'}={}) {
  const input=typeof selector==='string'?page.locator(selector):selector;
  const data=await input.evaluate(n=>{const r=n.getBoundingClientRect();return {
    x:r.x,y:r.y,width:r.width,height:r.height,scale:r.width/parseFloat(getComputedStyle(n).width),
    value:Number(n.value),min:Number(n.min),max:Number(n.max)};});
  const half=22*data.scale,track=data.width-2*half;
  const point=v=>({x:data.x+half+(v-data.min)/(data.max-data.min)*track,y:data.y+data.height/2});
  const a=point(data.value),b=point(value);
  if(touch&&engine==='chromium'){
    const session=await page.context().newCDPSession(page);
    try{
      const points=p=>[{x:p.x,y:p.y,radiusX:5,radiusY:5,id:1}];
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(a)});
      for(let i=1;i<=10;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points({x:a.x+(b.x-a.x)*i/10,y:b.y})});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{await session.detach();}
  }else{
    await page.mouse.move(a.x,a.y);await page.mouse.down();
    await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();
  }
  return Number(await input.inputValue());
}
export const rendered=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));


// WebKit does not expose native range pseudo-element computed styles. Measure its paint.
export async function paintedThumb(page,selector) {
  const input=typeof selector==='string'?page.locator(selector):selector;
  await rendered(page);const rect=await input.boundingBox(),png=await page.screenshot({clip:rect});
  return page.evaluate(async data=>{
    const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const {width,height}=canvas,pixels=ctx.getImageData(0,0,width,height).data;
    const rgb=(x,y)=>{const i=(y*width+x)*4;return [pixels[i],pixels[i+1],pixels[i+2]];};
    // D2 raised-paper fill (#fbf8f1); retain the native paint/44px measurement.
    const fill=(x,y)=>{const [r,g,b]=rgb(x,y);return Math.abs(r-251)<=1&&Math.abs(g-248)<=1&&Math.abs(b-241)<=1;};
    const seen=new Uint8Array(width*height);let best=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const first=y*width+x;if(seen[first]||!fill(x,y))continue;
      const queue=[first];seen[first]=1;
      for(let i=0;i<queue.length;i++){const id=queue[i],a=id%width,b=Math.floor(id/width);
        for(const [nx,ny] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]]){
          if(nx<0||nx>=width||ny<0||ny>=height)continue;const next=ny*width+nx;
          if(!seen[next]&&fill(nx,ny)){seen[next]=1;queue.push(next);}
        }}
      if(queue.length>best.length)best=queue;
    }
    if(!best.length)return {width:0,height:0,fillPixels:0};
    const xs=best.map(n=>n%width),ys=best.map(n=>Math.floor(n/width));
    const cx=Math.round((Math.min(...xs)+Math.max(...xs))/2),cy=Math.round((Math.min(...ys)+Math.max(...ys))/2);
    const ink=(x,y)=>{const [r,g,b]=rgb(x,y);return fill(x,y)||r<120&&g<145&&b<120;};
    let left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    // An antialiased blend can sit between the fill and the dark border; inspect
    // that narrow band rather than stopping at the first blended pixel.
    for(let x=Math.max(0,left-4);x<=left;x++)if(ink(x,cy))left=Math.min(left,x);
    for(let x=right;x<=Math.min(width-1,Math.max(...xs)+4);x++)if(ink(x,cy))right=Math.max(right,x);
    for(let y=Math.max(0,top-4);y<=top;y++)if(ink(cx,y))top=Math.min(top,y);
    for(let y=bottom;y<=Math.min(height-1,Math.max(...ys)+4);y++)if(ink(cx,y))bottom=Math.max(bottom,y);
    return {width:right-left+1,height:bottom-top+1,fillPixels:best.length};
  },png.toString('base64'));
}
