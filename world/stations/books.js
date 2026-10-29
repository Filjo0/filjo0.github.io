import {reducedMotion} from '../motion.js';
import {
  ReadingShelf,
  readingCategories,
  readings
} from '../../room-reading.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createBooksPage(content) {
  const shelf = new ReadingShelf();

  function reading() {
    const article = shelf.pick(),
      render = () => {
        content.innerHTML =
          `<p class="world-note">Choose a topic, then a specific reading or a suggestion.</p>
<label>Topic<select data-reading-topic>${
readingCategories.map(([id, label]) =>
  `<option value="${id}" ${id===shelf.category?'selected':''}>${label}</option>`).join('')
}</select>
</label>
<label>Book or article<select data-reading-choice>${
readings.filter(r => r.category === shelf.category).map(r =>
  `<option value="${r.id}" ${r.id===selected.id?'selected':''}>${r.title}</option>`).join('')
}</select>
</label>
<article data-reading-id="${selected.id}">
<p class="world-note">${selected.kind||'Article'} · ${selected.author||selected.publisher}</p>
<h3>${selected.title}</h3>
<p>${selected.intro}</p>
<ol>${selected.keyIdeas.map(idea=>`<li>${escape(idea)}</li>`).join('')}</ol>
<p>${selected.prompt}</p>
<a href="${selected.source}" target="_blank" rel="noopener noreferrer">${selected.sourceLabel} · ${selected.publisher}
↗</a>
</article>
<div class="world-button-row">
<button type="button" data-reading-next>Suggest another</button>
</div>
<p class="world-note">Curated recommendations; each link opens the author or original publisher. Free readings and paid books are labelled separately.</p>`;
        if(document.body.dataset.worldNavigation==='objects'&&!reducedMotion())
          content.querySelector('article').animate([{opacity:.2,transform:'translateX(10px)'},{opacity:1,transform:'none'}],220);
      };
    let selected = article;
    render();
    content.querySelector('[data-reading-topic]').addEventListener('change', choose);

    function choose(e) {
      selected = shelf.pick(e.target.value);
      render();
      bind();
      content.querySelector('[data-reading-topic]').focus({
        preventScroll: true
      });
    }

    function bind() {
      content.querySelector('[data-reading-topic]').addEventListener('change', choose);
      content.querySelector('[data-reading-choice]').addEventListener('change', e => {
        selected = shelf.select(e.target.value);
        shelf.last.set(shelf.category, selected.id);
        render();
        bind();
        content.querySelector('[data-reading-choice]').focus({
          preventScroll: true
        });
      });
      content.querySelector('[data-reading-next]').addEventListener('click', () => {
        selected = shelf.suggest();
        render();
        bind();
        content.querySelector('[data-reading-next]').focus({
          preventScroll: true
        });
      });
    }
    // Bind once; rebuilding replaces the previous controls and their listeners.
    content.querySelector('[data-reading-topic]').removeEventListener('change', choose);
    bind();
  }


  let pageAnimation=null,pageEvents=null,paused=false;
  function pausePage() {if(pageAnimation){paused||document.hidden?pageAnimation.pause():pageAnimation.play();}}
  function browse() {
    let selected=null,stage='contents',page='notes';
    pageEvents=new AbortController();
    const {signal}=pageEvents,compact=matchMedia('(max-width:720px), (max-height:499px)');
    document.addEventListener('visibilitychange',pausePage,{signal});
    compact.addEventListener('change',()=>render(),{signal});
    const suggestion=()=>{selected=shelf.suggest();stage='recommendation';page='notes';render('.book-notes h3',true);};
    const chapter=()=>readings.filter(r=>r.category===shelf.category);

    function render(focus,turn=false) {
      pageAnimation?.cancel();
      const pool=chapter(),category=readingCategories.find(([id])=>id===shelf.category)[1];
      const current=selected?pool.findIndex(r=>r.id===selected.id)+1:0;
      const topics=`<section class="book-leaf book-contents">
        <div class="book-leaf-text" role="region" aria-label="Chapter contents">
        <p class="book-running-title">An open shelf · 30 readings</p><h3>Contents</h3>
        <nav aria-label="Reading chapters">${readingCategories.map(([id,label],i)=>`
          <button type="button" data-book-topic="${id}" aria-current="${id===shelf.category?'page':'false'}">
          <span>0${i+1}</span>${escape(label)}</button>`).join('')}</nav>
        <p class="book-colophon">Six chapters. Original notes.<br>Follow the links to read each source.</p>
        </div><footer class="book-page-controls book-mobile-turn">
          <button type="button" data-book-turn>Turn page →</button>
          <button type="button" data-book-suggest>Suggest a reading →</button>
        </footer></section>`;
      let left=topics,right;
      if(stage==='contents') {
        right=`<p class="book-running-title">Find a reading</p><h3>Follow your curiosity.</h3>
          <p>Choose a chapter, then one of its five readings. Each recommendation has three ideas and a small exercise of your own.</p>
          <p>Explore free online readings and paid books with public samples. Every source is labelled.</p>
          <footer class="book-page-controls"><button type="button" data-reading-next>Suggest a reading →</button></footer>`;
      } else if(stage==='titles') {
        right=`<p class="book-running-title">Five places to start</p><h3>${escape(category)}</h3>
          <nav class="book-titles" aria-label="Reading titles">${pool.map((r,i)=>`
            <button type="button" data-book-open="${r.id}" aria-label="${escape(r.title+' — '+r.author)}">
            <span>0${i+1}</span><strong>${escape(r.displayTitle)}</strong>
            <small>${escape(r.byline)} · ${r.paid?'Paid book':'Free online'}</small></button>`).join('')}</nav>
          <footer class="book-page-controls"><button type="button" data-book-shelf>← Contents</button>
          <button type="button" data-reading-next>Suggest a reading →</button></footer>`;
      } else {
        const r=selected;
        const subtitle=r.subtitle?`<p class="book-subtitle">${escape(r.subtitle)}</p>`:'';
        left=`<section class="book-leaf book-notes">
          <div class="book-leaf-text" role="region" aria-label="${compact.matches&&page==='ideas'?'Three ideas':'Reading notes'}">
          <p class="book-running-title">${escape(category)} · Reading ${current} of ${pool.length}</p>
          <div class="book-summary"><h3 title="${escape(r.title)}">${escape(r.displayTitle)}</h3>${subtitle}
          <p class="book-author">${escape(r.author)}</p><p class="book-intro">${escape(r.intro)}</p></div>
          <div class="book-ideas"><h4>Three ideas</h4>
          <ol class="book-key-ideas">${r.keyIdeas.map(idea=>`<li>${escape(idea)}</li>`).join('')}</ol></div></div>
          <footer class="book-page-controls">
          <button type="button" ${compact.matches&&page==='ideas'?'data-book-prev-page':'data-book-shelf'}>
          ${compact.matches&&page==='ideas'?'← Notes':'← Titles'}</button>
          <button type="button" class="book-mobile-turn" data-book-turn>Turn page →</button>
          <span class="book-page-number book-mobile-turn">${page==='ideas'?'2':'1'} / 3</span></footer></section>`;
        const credits=r.author===r.publisher?r.author:r.author+' · '+r.publisher;
        right=`<p class="book-running-title">Your turn · ${r.exerciseMinutes} min exercise</p>
          <h3>Try this</h3><p class="book-exercise">${escape(r.prompt)}</p>
          <div class="book-provenance"><p class="book-access">${escape(r.access)}</p>
          <p class="book-credits">${escape(credits)}</p><div class="book-source-links ${r.basis.url!==r.source?'book-source-pair':''}">
          <a class="book-source" href="${escape(r.source)}" target="_blank" rel="noopener noreferrer">${escape(r.sourceLabel.replace(' ↗','\u00a0↗'))}</a>
          ${r.basis.url!==r.source?`<a class="book-basis" href="${escape(r.basis.url)}" target="_blank"
            rel="noopener noreferrer" aria-label="About this reading: ${escape(r.basis.label)}">About this reading&nbsp;↗</a>`:''}</div></div>
          <footer class="book-page-controls">
            <button type="button" class="book-mobile-turn" data-book-prev-page aria-label="Back to Three ideas">← Back</button>
            <button type="button" data-book-next>Next reading →</button>
            <button type="button" data-reading-next aria-label="Surprise me: suggest another reading">Surprise me ↻</button>
          </footer>`;
      }
      const footer=right.lastIndexOf('<footer');
      right='<div class="book-leaf-text" role="region" aria-label="'+
        (stage==='recommendation'?'Exercise and sources':'Reading choices')+'">'+right.slice(0,footer)+'</div>'+right.slice(footer);
      content.innerHTML=`<div class="book-spread" data-book-stage="${stage}" data-book-page="${page}"
        ${selected?`data-reading-id="${selected.id}"`:''}>${left}
        <section class="book-leaf book-recommendation">${right}</section></div>`;
      content.scrollTop=0;
      if(focus){const n=content.querySelector(focus);n.tabIndex=-1;n.focus({preventScroll:true});}
      if(turn&&!reducedMotion()) {
        const leaf=content.querySelector(stage==='recommendation'&&page!=='practice'?'.book-notes':
          stage==='contents'?'.book-contents':'.book-recommendation');
        pageAnimation=leaf.animate([{transform:'perspective(800px) rotateY(-55deg)',opacity:.35},{transform:'none',opacity:1}],420);
        pausePage();
      }
    }
    content.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button||!content.contains(button))return;
      if(button.hasAttribute('data-book-topic')) {
        shelf.category=button.dataset.bookTopic;selected=null;stage='titles';render('.book-recommendation h3',true);
      } else if(button.hasAttribute('data-book-open')) {
        selected=shelf.select(button.dataset.bookOpen);stage='recommendation';page='notes';render('.book-notes h3',true);
      } else if(button.hasAttribute('data-book-suggest')||button.hasAttribute('data-reading-next')) suggestion();
      else if(button.hasAttribute('data-book-next')) {
        selected=shelf.next(selected.id);page='notes';render('.book-notes h3',true);
      } else if(button.hasAttribute('data-book-turn')) {
        if(stage==='contents'){stage='titles';render('.book-recommendation h3',true);}
        else {page=page==='notes'?'ideas':'practice';render(page==='ideas'?'.book-ideas h4':'.book-recommendation h3',true);}
      } else if(button.hasAttribute('data-book-prev-page')) {
        page=page==='practice'?'ideas':'notes';render(page==='ideas'?'.book-ideas h4':'.book-notes h3',true);
      } else if(button.hasAttribute('data-book-shelf')) {
        stage=stage==='recommendation'?'titles':'contents';selected=null;
        render(stage==='contents'?'.book-contents h3':'.book-recommendation h3',true);
      }
    },{signal});
    render();
  }

  return {
    enter() {document.body.dataset.worldNavigation==='objects'?browse():reading();},
    update() {},
    setPaused(value){paused=value;pausePage();},
    exit() {
      pageAnimation?.cancel();pageEvents?.abort();
      content.replaceChildren();
    },
    state() {
      return {
        type: 'books',
        category: shelf.category,
        reading: shelf.last.get(shelf.category)
      };
    }
  };
}
