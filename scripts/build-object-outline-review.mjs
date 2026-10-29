// B1 evidence only. No runtime imports or live hotspot behaviour are installed.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),out=new URL('validation-artifacts/object-outlines-20oct/',root);
const layout=JSON.parse(await readFile(new URL('art/outdoor/hotspot-layout.json',root),'utf8'));
const names={work:'My apps',contact:'Contact',globe:'Snow globe',resume:'Résumé',experience:'About me',books:'Book',fibonacci:'Maths notebook'};
const palette=['#68edc3','#ffc069','#83ceff','#e9a6ff','#ff9d9d','#fff195','#bfc4ff'];
const plates=layout.outline_schema.plates;
const path=ring=>'M'+ring.map(([u,v])=>`${(u*1672).toFixed(3)},${(v*941).toFixed(3)}`).join('L')+'Z';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
await mkdir(new URL('scenes/',out),{recursive:true});
const manifest=[];
for(const plate of plates){
 const bytes=await readFile(new URL('assets/outdoor/'+plate,root));
 manifest.push({plate,sha256:createHash('sha256').update(bytes).digest('hex')});
 for(const [width,height] of [[1440,900],[390,844]]){
  const scale=Math.max(width,height*1672/941)/1672;
  const left=Math.max(0,Math.min(1672*scale-width,1672*scale*(width<720?.18:.5)-width/2));
  const top=(941*scale-height)/2;
  const frames=[{view:'scene',x:left/scale,y:top/scale,w:width/scale,h:height/scale,scale}];
  if(width<720)frames.push({view:'bag',x:Math.max(0,Math.min(1672-width/scale,650-width/scale/2)),y:top/scale,w:width/scale,h:height/scale,scale});
  else frames.push({view:'detail',x:0,y:495,w:720,h:450,scale:2});
  for(const f of frames)for(const state of (f.view==='scene'?['outlines','hover','tap','focus']:['outlines'])){
   const id=state==='hover'?'work':state==='tap'?'contact':'books';
   const selected=layout.targets[id],rings=selected.outline_variants?.[plate]||selected;
   const outline=path(rings.outline)+(rings.outline_holes||[]).map(path).join('');
   const toScreen=(u,v)=>[(u*1672-f.x)*f.scale,(v*941-f.y)*f.scale];
   const label=names[id]+(state==='tap'?' · Open ›':'');
   const pixels=rings.outline.map(([u,v])=>toScreen(u,v));
   const xs=pixels.map(p=>p[0]),ys=pixels.map(p=>p[1]);
   // Mock tags touch the selected object's edge, clear of the neighbouring objects.
   const lx=state==='tap'?Math.max(12,Math.min(width-162,Math.max(...xs)+8)):
    Math.max(12,Math.min(width-162,(Math.min(...xs)+Math.max(...xs))/2-45));
   const ly=state==='tap'?Math.max(...ys)+8:Math.max(64,Math.min(...ys)-44);
   const night=plate.includes('dusk'),cool=night||plate.includes('winter'),rim=cool?'#cff4ff':'#ffedb6';
   const marks=Object.entries(layout.targets).map(([key,t],i)=>{
    const a=t.outline_variants?.[plate]||t;
    return `<path data-outline="${key}" d="${path(a.outline)+(a.outline_holes||[]).map(path).join('')}" fill="none" fill-rule="evenodd" stroke="${palette[i]}" stroke-width="${1.35/f.scale}"/>`;
   }).join('');
   const svg=`<svg aria-label="${esc(plate+' '+state+' silhouette review')}" viewBox="${f.x} ${f.y} ${f.w} ${f.h}" preserveAspectRatio="none">
    <defs><clipPath id="object"><path d="${outline}" clip-rule="evenodd"/></clipPath>
    <filter id="lift" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1.08"/><feFuncG type="linear" slope="1.08"/><feFuncB type="linear" slope="1.08"/></feComponentTransfer></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${1.6/f.scale}"/></filter></defs>
    <image data-source-plate href="../../../assets/outdoor/${plate}" width="1672" height="941"/>
    ${state==='outlines'?marks:`<g clip-path="url(#object)"><image href="../../../assets/outdoor/${plate}" width="1672" height="941" filter="url(#lift)"/></g>
    <path d="${outline}" fill="none" stroke="${rim}" stroke-width="${3/f.scale}" opacity=".65" filter="url(#glow)"/>
    ${state==='focus'?`<path d="${outline}" fill="none" stroke="#142e28" stroke-width="${4/f.scale}"/>`:''}
    <path d="${outline}" fill="none" stroke="${rim}" stroke-width="${(state==='focus'?2:1)/f.scale}"/>`}</svg>`;
   const title=plate.replace('concept-','').replace('-v2.webp','').replace('dusk','night')+' · '+width+' × '+height+' · '+f.view+' · '+state;
   const file=plate.replace('.webp','')+'-'+width+'x'+height+'-'+f.view+'-'+state+'.html';
   const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;overflow:hidden;background:#172b28;color:#fff;font:14px/1.4 system-ui,Arial,sans-serif}svg{position:absolute;inset:0;width:100%;height:100%;display:block}
    .note{position:absolute;top:12px;left:12px;right:12px;pointer-events:none}.note span,.tag{display:inline-block;background:#112a26ed;padding:7px 11px;border-radius:8px;box-shadow:0 1px 9px #0003}
    .legend{display:flex;flex-wrap:wrap;gap:4px 12px;max-width:600px;margin-top:6px;background:#112a26ed;padding:7px 11px;border-radius:8px;font-size:12px}.tag{position:absolute;left:${lx}px;top:${ly}px;border:1px solid ${rim};font-weight:600}
    .back{position:absolute;right:12px;bottom:12px;color:white;background:#112a26ed;padding:8px;border-radius:6px}</style>
    ${svg}<div class="note" ${f.view==='detail'?'style="top:auto;bottom:12px"':''}><span>${esc(f.view==='detail'?'Detail · 2× source pixels':state==='outlines'?'Outline registration':state+' mock · '+names[id])}</span>
    ${state==='outlines'?'<div class="legend">'+Object.values(names).map((n,i)=>`<b style="color:${palette[i]}">${esc(n)}</b>`).join('')+'</div>':''}</div>
    ${state==='outlines'?'':`<div class="tag">${esc(label)}</div>`}<a class="back" href="../review.html">Back to B1 review</a></html>`;
   await writeFile(new URL('scenes/'+file,out),html);
   manifest.at(-1).frames??=[];manifest.at(-1).frames.push({file,width,height,view:f.view,state});
  }
 }
}
const all=manifest.flatMap(m=>m.frames.map(f=>({...f,plate:m.plate})));
const gallery=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Object outlines · Gate B1</title><style>
 body{margin:0;padding:28px;background:#f1eee6;color:#203b32;font:16px/1.5 system-ui,Arial,sans-serif}main{max-width:1440px;margin:auto}h1{font:36px Georgia,serif;margin:0}h2{margin-top:40px}p{max-width:850px}a{color:#294f40}nav{display:flex;flex-wrap:wrap;gap:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;background:#fff;padding:12px;border-radius:12px}figure.phone img{max-height:620px;width:auto;max-width:100%;margin:auto}img{width:100%;display:block;border-radius:6px}figcaption{padding:10px 0}small{display:block} @media(max-width:650px){body{padding:16px}.grid{grid-template-columns:1fr}h1{font-size:30px}}</style><main>
 <h1>Object outlines · Gate B1</h1><p>Seven hand-traced objects on the four approved pictures. The coloured outlines are for checking their edges. Hover, first-tap and keyboard-focus examples below are still pictures; they do not open objects.</p>
 <p>The live portfolio keeps its current dots until this outline review is approved. These files are local review evidence. No artwork has been moved or regenerated.</p>
 <nav>${manifest.map(m=>`<a href="#${m.plate}">${m.plate.includes('winter')?'Winter':'Coast'} · ${m.plate.includes('dusk')?'Night':'Sunset'}</a>`).join('')}<a href="../../#fibonacci">Open maths sliders</a></nav>
 <p>The winter bag has a different handle; the clipboard has separate coast/night/winter edges. Phone and desk crops use the initial scene framing; a second phone crop shows the bag. The detail view shows all seven objects at twice their source size.</p>
 ${manifest.map(m=>`<section id="${m.plate}"><h2>${m.plate.includes('winter')?'Winter':'Coast'} · ${m.plate.includes('dusk')?'Night':'Sunset'}</h2><div class="grid">${m.frames.map(f=>`<figure class="${f.width<720?'phone':''}"><a href="screenshots/${f.file.replace('.html','.png')}"><img loading="lazy" src="screenshots/${f.file.replace('.html','.png')}" alt="${f.view} ${f.state} at ${f.width} by ${f.height}"></a><figcaption>${f.width} × ${f.height} · ${f.view} · ${f.state}<small><a href="scenes/${f.file}">Open full-size mock</a>${f.view==='detail'?'':` · <a href="screenshots/webkit-${f.file.replace('.html','.png')}">WebKit capture</a>`}</small></figcaption></figure>`).join('')}</div></section>`).join('')}
 <h2>Slider fixes</h2><p>Pointer snapping now covers ±1.2°; fine keyboard arrows remain 0.01°. The Pascal instruction already appears on desktop before any tap and now has a regression check.</p><div class="grid"><figure><img src="pascal-desktop.png" alt="Desktop Pascal instruction"><figcaption>Desktop · instruction before selecting a number</figcaption></figure><figure class="phone"><img src="pascal-phone.png" alt="Phone Pascal instruction"><figcaption>320px phone · instruction before selecting a number</figcaption></figure></div>
 <p>Review the object edges, especially the bag handle, clipboard clip and the open notebook. Implementation stops at B1; live hover, tap, focus and arrival effects are B2.</p></main></html>`;
await writeFile(new URL('review.html',out),gallery);
await writeFile(new URL('manifest.json',out),JSON.stringify({stage:'B1',width:1672,height:941,layoutSha256:createHash('sha256').update(await readFile(new URL('art/outdoor/hotspot-layout.json',root))).digest('hex'),plates:manifest,frames:all.length},null,2)+'\n');
console.log('B1 static review generated: '+all.length+' frames; no runtime changes.');
