// Direct diagram input shares the existing guided actions and lifecycle signal.
export function bindMathsDiagram(svg,{signal,activate,move}) {
  svg.setAttribute('role','button');svg.setAttribute('tabindex','0');svg.dataset.directMaths='';
  // SVGs can keep :focus-visible after pointer input in Chromium. Track the
  // actual input without moving focus; keyboard users retain their indicator.
  svg.addEventListener('pointerdown',()=>{svg.dataset.pointerFocus='';},{signal});
  document.addEventListener('keydown',()=>{delete svg.dataset.pointerFocus;},{signal,capture:true});
  svg.addEventListener('click',activate,{signal});
  svg.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' ') {
      event.preventDefault();event.stopPropagation();activate(event);
    } else if(move&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();event.stopPropagation();move(event.key);
    }
  },{signal});
}

// A finger can land in the small gaps between marks. Choose the nearest actual
// rendered mark within a 44px neighbourhood, using screen geometry (also in 3D CSS).
export function nearestMathsMark(svg,selector,event) {
  if(event.type!=='click'||event.detail===0)return null;
  let nearest=null,distance=22;
  for(const mark of svg.querySelectorAll(selector)) {
    const box=mark.getBoundingClientRect();
    const next=Math.hypot(event.clientX-box.x-box.width/2,event.clientY-box.y-box.height/2);
    if(next<distance){distance=next;nearest=mark;}
  }
  return nearest;
}


// Native ranges share visible labels, value output and coarse keyboard steps.
export function mathsRange(key,label,min,max,step,value) {
  return `<div class="maths-range" data-range-control="${key}">
    <label id="maths-${key}-label" for="maths-${key}">${label}</label>
    <output for="maths-${key}" data-range-output></output>
    <input id="maths-${key}" type="range" data-${key} min="${min}" max="${max}" step="${step}"
      value="${value}" aria-labelledby="maths-${key}-label"></div>`;
}
export function bindMathsRange(root,key,{signal,value,coarse,format=String,normalise=v=>v,onInput}) {
  const input=root.querySelector(`[data-${key}]`),output=input.parentElement.querySelector('output');
  let keyboard=false;
  const write=next=>{input.value=String(next);output.value=format(next);input.setAttribute('aria-valuetext',format(next));};
  const change=raw=>{const next=normalise(Math.max(Number(input.min),Math.min(Number(input.max),raw)),keyboard);
    write(next);onInput(next);};
  input.addEventListener('pointerdown',event=>{keyboard=false;event.stopPropagation();},{signal});
  input.addEventListener('input',()=>change(Number(input.value)),{signal});
  input.addEventListener('keydown',event=>{
    keyboard=true;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))
      event.stopPropagation();
    if(event.key==='PageUp'||event.key==='PageDown'){
      event.preventDefault();change(Number(input.value)+(event.key==='PageUp'?coarse:-coarse));
    }
  },{signal});
  write(value);return {set:write,input};
}
