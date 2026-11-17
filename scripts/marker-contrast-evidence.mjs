// Native three-pass contrast: actual text, its background including the tab surface, and an opaque glyph mask.
// Temporary capture styles are removed; no DOM geometry or production placement is changed.
export async function markerContrast(page){
 const boxes=await page.locator('[data-scene-object]:not([hidden]) .scene-marker-text').evaluateAll(nodes=>nodes.map(n=>{
  const range=document.createRange();range.selectNodeContents(n);
  return {id:n.closest('[data-scene-object]').dataset.sceneObject,box:range.getBoundingClientRect().toJSON()};
 }));
 const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 let freeze,ghost,mask;
 try{
  freeze=await page.addStyleTag({content:'.scene-hotspots *, .scene-hotspots *::after{animation:none!important;transition:none!important}.scene-atmosphere{visibility:hidden!important}'});
  await paint();const actual=await page.screenshot();
  ghost=await page.addStyleTag({content:'.scene-marker-text{-webkit-text-fill-color:transparent!important}'});
  await paint();const background=await page.screenshot();await ghost.evaluate(n=>n.remove());ghost=null;
  mask=await page.addStyleTag({content:'.scene-marker-text{background:rgb(0,0,0)!important;color:rgb(255,255,255)!important;-webkit-text-fill-color:rgb(255,255,255)!important;text-shadow:none!important;box-shadow:none!important}'});
  await paint();const glyphs=await page.screenshot();
  return await page.evaluate(async({actual,background,glyphs,boxes})=>{
   const load=async value=>{const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);};
   const [a,b,g]=await Promise.all([load(actual),load(background),load(glyphs)]),scale=a.width/innerWidth;
   const luminance=(data,i)=>[0,1,2].map(c=>{const n=data[i+c]/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;})
    .reduce((sum,n,c)=>sum+n*[.2126,.7152,.0722][c],0);
   return boxes.map(({id,box})=>{
    let minimum=Infinity,samples=0,worst=null;
    for(let y=Math.ceil(box.y*scale);y<Math.floor(box.bottom*scale);y++)
     for(let x=Math.ceil(box.x*scale);x<Math.floor(box.right*scale);x++){
      const i=(y*a.width+x)*4;
      // Fully painted native glyph interiors, excluding antialiased edges and background.
      if([0,1,2].every(c=>g.data[i+c]>=250)){
       const foreground=luminance(a.data,i),backdrop=luminance(b.data,i),ratio=(Math.max(foreground,backdrop)+.05)/(Math.min(foreground,backdrop)+.05);
       samples++;if(ratio<minimum){minimum=ratio;worst={x:x/scale,y:y/scale,foreground:[...a.data.slice(i,i+3)],background:[...b.data.slice(i,i+3)]};}
      }
     }
    return {id,minimum,samples,worst};
   });
  },{actual:actual.toString('base64'),background:background.toString('base64'),glyphs:glyphs.toString('base64'),boxes});
 }finally{
  for(const style of [mask,ghost,freeze])if(style)await style.evaluate(n=>n.remove());
  // WebKit can retain the last mask frame after its style is removed. Flush paint before returning.
  await paint();
 }
}
