import {createSunflowerPage} from './sunflower.js';
import {createSequencePage} from './maths-sequence.js';
import {createPascalPage} from './maths-pascal.js';
import {fibonacciTiling} from '../maths-patterns.js';

// Preserve the existing #fibonacci station interface while each page owns its animation.
export function createSeedsPage(content) {
  const shell=document.createElement('section');shell.className='maths-notebook-shell';shell.setAttribute('aria-label','Maths notebook');
  const body=document.createElement('div');body.className='maths-page-body';body.dataset.mathsPageBody='';
  const nav=document.createElement('nav');nav.className='maths-page-nav';nav.setAttribute('aria-label','Maths notebook pages');
  nav.innerHTML=`<div class="maths-nav-left"><button type="button" data-maths-previous>← Previous</button>
    <button type="button" data-maths-contents>Contents</button></div>
    <div class="maths-nav-right"><button type="button" data-maths-next-page>Next →</button></div>`;
  shell.append(body,nav);
  const titles=['Why sunflowers spiral','The Fibonacci sequence','Pascal’s triangle'];
  const notes=['Watch two sets of spirals cross.','Build a spiral, one square at a time.','Find a pattern inside a triangle.'];
  const pages=[createSunflowerPage(body),createSequencePage(body),createPascalPage(body)];
  let page=-1,active=null,events=null;
  function contents() {
    const {squares,bounds}=fibonacciTiling(8);
    body.innerHTML=`<section class="creative-notebook maths-notebook maths-contents">
      <header class="creative-title"><span>MATHS NOTEBOOK</span><h3>Small patterns, big ideas</h3></header>
      <div class="maths-spread"><nav class="maths-chapters" aria-label="Maths notebook contents">
        ${titles.map((title,i)=>`<button type="button" class="maths-chapter" data-maths-chapter="${i}">
          <span>0${i+1}</span><strong>${title}</strong><small>${notes[i]}</small></button>`).join('')}</nav>
        <figure class="maths-contents-sketch" aria-hidden="true">
          <svg viewBox="${bounds.x-2} ${bounds.y-2} ${bounds.width+4} ${bounds.height+4}">
          ${squares.map(s=>`<rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}"
            fill="${s.index%2?'#d8c08c':'#b6c5a4'}" stroke="#82714e" stroke-width=".12"/>
            <path d="${s.path}" fill="none" stroke="#365b40" stroke-width=".5"/>`).join('')}</svg>
          <figcaption>Take one idea at a time.</figcaption>
        </figure></div></section>`;
  }
  function show(next,focus=false) {
    active?.exit();page=next;active=page<0?null:pages[page];shell.dataset.mathsPage=page<0?'contents':String(page+1);
    page<0?contents():active.enter();
    nav.dataset.contents=String(page<0);
    nav.querySelector('[data-maths-previous]').hidden=page<=0;
    nav.querySelector('[data-maths-contents]').hidden=page<0;
    const nextButton=nav.querySelector('[data-maths-next-page]');nextButton.hidden=page===2;
    nextButton.textContent=page<0?'Open notebook →':'Next →';nextButton.title=titles[page+1]||'';
    nav.querySelector('[data-maths-previous]').title=titles[page-1]||'';
    if(focus){const heading=body.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  return {enter(){
    events=new AbortController();const {signal}=events;content.replaceChildren(shell);
    body.addEventListener('click',e=>{const chapter=e.target.closest('[data-maths-chapter]');
      if(chapter)show(Number(chapter.dataset.mathsChapter),true);},{signal});
    nav.addEventListener('click',e=>{
      if(e.target.closest('[data-maths-previous]'))show(page-1,true);
      if(e.target.closest('[data-maths-contents]'))show(-1,true);
      if(e.target.closest('[data-maths-next-page]'))show(page+1,true);
    },{signal});show(page);
  },exit(){active?.exit();active=null;events?.abort();events=null;content.replaceChildren();},
    update(){active?.update?.();},setPaused(value){active?.setPaused?.(value);},
    state:()=>({...active?.state(),type:'fibonacci',page:page<0?'contents':titles[page]})};
}
