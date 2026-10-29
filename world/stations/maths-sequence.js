import {bindMathsDiagram,mathsRange,bindMathsRange} from './maths-interaction.js';
import {fibonacciTiling} from '../maths-patterns.js';

export function createSequencePage(content) {
  let count=1,events=null,slider=null,mapping={scale:280,x:6,y:6,width:292,height:292};
  function diagram() {
    const {squares}=fibonacciTiling(count),preview=count<12?fibonacciTiling(count+1):null;
    const bounds=(preview||fibonacciTiling(count)).bounds,scale=280/Math.max(bounds.width,bounds.height);
    mapping={scale,x:6-bounds.x*scale,y:6-bounds.y*scale,
      width:bounds.width*scale+12,height:bounds.height*scale+12};
    const point=p=>[p[0]*scale+mapping.x,p[1]*scale+mapping.y];
    const colours=['#e8c77c','#a4c2ac','#dba580','#c6cda1'];
    // Keep normal SVG coordinates and font sizes even when the mathematical squares are tiny.
    content.querySelector('[data-fibonacci-art]').innerHTML='<g data-tiling>'+squares.map((s,i)=>{
      const [x,y]=point([s.x,s.y]),size=s.size*scale;
      return `<g data-fibonacci-square="${i}" data-square-value="${s.value}">
        <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${colours[i%4]}"
          stroke="#927d58" stroke-width="1"/>
        <title>Square ${i+1}: ${s.value} by ${s.value}</title>
        ${size>=34?`<text x="${x+size/2}" y="${y+size/2}" dominant-baseline="central"
          text-anchor="middle" font-size="${size*.3}" fill="#293e32">${s.value}</text>`:''}</g>`;
    }).join('')+(preview?(()=>{const s=preview.squares.at(-1),[x,y]=point([s.x,s.y]),size=s.size*scale;
      return `<g data-fibonacci-preview><rect x="${x}" y="${y}" width="${size}" height="${size}"
        fill="#f2e6c7" stroke="#365b40" stroke-width="2" stroke-dasharray="7 5"/>
        <text x="${x+size/2}" y="${y+size/2}" text-anchor="middle" dominant-baseline="central"
          font-size="${Math.min(25,size*.2)}" fill="#365b40">Place ${s.value}</text></g>`;})():'')+squares.map((s,i)=>`<path data-fibonacci-arc="${i}"
      d="M${point(s.start).join(' ')}A${s.size*scale} ${s.size*scale} 0 0 1 ${point(s.end).join(' ')}"
      fill="none" stroke="#365b40" stroke-width="3"/>`).join('')+'</g>';
    content.querySelector('[data-fibonacci-art]').setAttribute('aria-label',
      count?`Spiral through ${count} Fibonacci squares, ending with a ${squares.at(-1).value} by ${squares.at(-1).value} square`:
        'Place the outlined square to start the Fibonacci spiral');
    content.querySelector('[data-fibonacci-numbers]').textContent=squares.map(s=>s.value).join(' · ')||'1, then 1…';
    const ratio=content.querySelector('[data-fibonacci-ratio]');ratio.style.visibility=count>=5?'visible':'hidden';
    ratio.textContent=count>=5?`${squares.at(-1).value} ÷ ${squares.at(-2).value} = ${(squares.at(-1).value/squares.at(-2).value).toFixed(5)}`:'';
    content.querySelector('[data-ratio-target]').style.visibility=count>=5?'visible':'hidden';
  }
  function selectSquare(index) {
    const squares=fibonacciTiling(count).squares,square=squares[index];if(!square)return;
    content.querySelectorAll('[data-fibonacci-square] rect').forEach(n=>{n.style.strokeWidth='1';});
    content.querySelector(`[data-fibonacci-square="${index}"] rect`).style.strokeWidth='3';
    content.querySelector('[data-sequence-caption]').textContent=index<2?'Start with two squares of side 1.':
      `${squares[index-2].value} + ${squares[index-1].value} = ${square.value}: the next square’s side.`;
  }
  function sync() {
    content.querySelector('[data-sequence-caption]').textContent=count===12?'The ratio gets closer to the golden ratio.':
      count>1?'The next number is the last two added together.':'Each new square turns the spiral a little further.';
    content.querySelector('[data-sequence-page]').dataset.animating='false';
  }
  function setCount(value) {
    count=Math.max(1,Math.min(12,Math.round(value)));diagram();
    content.querySelector('[data-fibonacci-art]').setAttribute('viewBox',`0 0 ${mapping.width} ${mapping.height}`);
    sync();slider?.set(count);
  }
  function next(){setCount(count===12?1:count+1);}
  return {enter(){
    events=new AbortController();
    content.innerHTML=`<section class="creative-notebook maths-notebook" data-sequence-page data-animating="false">
      <header class="creative-title"><span>MATHS NOTEBOOK · 02</span><h3>The Fibonacci sequence</h3></header>
      <div class="maths-spread"><figure class="maths-diagram">
        <svg data-fibonacci-art role="img" viewBox="-.1 -.1 1.2 1.2"></svg></figure>
        <div class="maths-story">
          <p class="maths-number-line" data-fibonacci-numbers aria-label="Fibonacci numbers"></p>
          <p data-sequence-caption role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="maths-ratio-block"><span data-ratio-target>Each number ÷ the one before → 1.618…</span>
            <output data-fibonacci-ratio></output></div>
          ${mathsRange('sequence-count','Squares',1,12,1,count)}
        </div></div></section>`;
    slider=bindMathsRange(content,'sequence-count',{signal:events.signal,value:count,coarse:3,onInput:setCount});
    bindMathsDiagram(content.querySelector('[data-fibonacci-art]'),{signal:events.signal,activate:event=>{
      const square=event.target.closest('[data-fibonacci-square]');
      if(square)selectSquare(Number(square.dataset.fibonacciSquare));else next();
    }});
    setCount(count);
  },exit(){events?.abort();events=null;slider=null;content.replaceChildren();},update(){},
    setPaused(){},state:()=>({count,numbers:fibonacciTiling(count).squares.map(s=>s.value)})};
}
