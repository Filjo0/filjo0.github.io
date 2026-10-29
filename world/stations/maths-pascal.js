import {bindMathsDiagram,nearestMathsMark,mathsRange,bindMathsRange} from './maths-interaction.js';
import {pascalRows,shallowDiagonal} from '../maths-patterns.js';
import {createMathsMotion} from '../maths-motion.js';

export function createPascalPage(content) {
  let selectedCell=null,count=5,numberRows=5,oddBase=8,mode='numbers',diagonal=-1,events=null,lastDraw='',slider=null;
  const motion=createMathsMotion(paint,()=>{sync();});
  const xy=(r,c)=>[160+(c-r/2)*32,20+r*28];
  function diagram() {
    const key=[count,mode,diagonal].join(':');if(key===lastDraw)return;lastDraw=key;
    const rows=pascalRows(count),svg=content.querySelector('[data-pascal-art]');
    const extent=Math.max(8,count),half=extent*16+8,height=extent*28+14;
    svg.setAttribute('viewBox',`${160-half} ${(count*28+14-height)/2} ${half*2} ${height}`);
    svg.style.maxWidth=`${half*2*36/26}px`;
    svg.setAttribute('aria-label',mode==='odd'?'Odd entries make a triangle of smaller triangles':
      `Pascal’s triangle with ${count} rows${mode==='diagonals'?', with shallow diagonals highlighted':''}`);
    const selected=mode==='diagonals'?shallowDiagonal(rows,diagonal):null;
    svg.innerHTML=rows.map((row,r)=>`<g data-pascal-row="${r}">${row.map((value,c)=>{
      const [x,y]=xy(r,c),active=selected?.cells.some(p=>p.row===r&&p.column===c);
      const colour=active?'#ecb75d':mode==='odd'?(value%2?'#365b40':'#dfd6be'):'#eee2c3';
      return `<g data-pascal-cell="${r}:${c}" data-value="${value}" data-odd="${value%2===1}">
        <circle cx="${x}" cy="${y}" r="13" fill="${colour}" stroke="#c4b58c" stroke-width=".7"/>
        ${count<=10?`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
          font-size="${value>=100?13:20}" fill="#293e32">${value}</text>`:''}</g>`;
    }).join('')}</g>`).join('');
    if(mode==='diagonals')for(let d=0;d<=diagonal;d++) {
      const cells=shallowDiagonal(rows,d).cells;
      if(cells.length>1)svg.insertAdjacentHTML('beforeend',`<path data-pascal-diagonal="${d}"
        d="M${cells.map(p=>xy(p.row,p.column).join(' ')).join('L')}" fill="none" stroke="#bf7435"
        stroke-width="3" stroke-linecap="round" opacity="${d===diagonal?.8:.2}"/>`);
    }
    content.querySelector('[data-pascal-pattern-rows]').textContent=mode==='numbers'?'':` · ${count} rows`;
    const sums=content.querySelector('[data-pascal-sums]');
    sums.textContent=mode==='diagonals'?Array.from({length:diagonal+1},(_,i)=>shallowDiagonal(rows,i).sum).join(' · '):'';
    const equation=content.querySelector('[data-pascal-equation]');
    if(selected)equation.textContent=selected.cells.map(p=>p.value).join(' + ')+' = '+selected.sum;
    else if(mode==='odd')equation.textContent='Odd numbers are green.';
    else if(count>2){const c=Math.floor((count-1)/2),above=rows[count-2];
      equation.textContent=`${above[c-1]} + ${above[c]} = ${rows[count-1][c]}`;}
    else equation.textContent='Start with 1.';
  }
  function selectCell(row,column) {
    if(motion.running())return;
    const rows=pascalRows(count);row=Math.max(0,Math.min(count-1,row));column=Math.max(0,Math.min(row,column));
    selectedCell={row,column};
    content.querySelectorAll('[data-pascal-cell] circle').forEach(n=>{
      n.style.stroke='#c4b58c';n.style.strokeWidth='.7';delete n.parentElement.dataset.selectedCell;
    });
    const mark=(r,c,colour)=>{const cell=content.querySelector(`[data-pascal-cell="${r}:${c}"]`);
      if(cell){cell.dataset.selectedCell='';cell.querySelector('circle').style.stroke=colour;cell.querySelector('circle').style.strokeWidth='3';}};
    mark(row,column,'#294d40');
    if(mode==='numbers'&&row>0){mark(row-1,column-1,'#bf7435');mark(row-1,column,'#bf7435');}
    const value=rows[row][column],parents=row>0?[rows[row-1][column-1],rows[row-1][column]].filter(n=>n!==undefined):[];
    content.querySelector('[data-pascal-equation]').textContent=mode==='odd'?`${value} is ${value%2?'odd':'even'}.`:
      parents.length?`${parents.join(' + ')} = ${value}`:'1 starts the triangle.';
    syncFeedback();
  }
  function paint(t) {
    if(mode==='odd'){count=oddBase+Math.floor((32-oddBase)*t);diagram();}
    else if(mode==='diagonals'){diagonal=Math.min(7,Math.floor(t*8));diagram();}
    else{const row=content.querySelector(`[data-pascal-row="${count-1}"]`);if(row)row.style.opacity=.3+.7*t;}
  }
  function syncFeedback() {
    const picked=selectedCell!==null;
    content.querySelector('[data-pascal-caption]').hidden=mode==='numbers'&&picked;
    content.querySelector('[data-pascal-equation]').hidden=mode==='numbers'&&!picked||mode==='odd'&&!picked;
  }
  function sync() {
    const button=content.querySelector('[data-pascal-next]'),other=content.querySelector('[data-pascal-reveal]');
    button.textContent=mode==='numbers'?'Colour the odd numbers':'Show the numbers';
    other.hidden=false;other.textContent=mode==='diagonals'?'Colour the odd numbers':'Add up the diagonals';
    for(const b of [button,other])b.setAttribute('aria-disabled',String(motion.running()));
    content.querySelector('[data-pascal-caption]').textContent=mode==='numbers'?'Tap a number to see the two above it.':
      mode==='odd'?'The odd numbers make triangles inside triangles.':
      'These diagonals give the Fibonacci numbers again.';
    content.querySelector('[data-range-control="pascal-rows"]').hidden=mode!=='numbers';
    content.querySelector('[data-pascal-page]').dataset.animating=String(motion.running());
    content.querySelector('[data-pascal-page]').dataset.pascalMode=mode;syncFeedback();
  }
  function setRows(value) {
    motion.cancel();selectedCell=null;numberRows=count=Math.max(1,Math.min(10,Math.round(value)));
    mode='numbers';diagonal=-1;diagram();sync();slider?.set(count);
  }
  function next() {
    if(motion.running())return;selectedCell=null;
    if(mode==='numbers'){mode='odd';oddBase=count;motion.start(2.4);}
    else setRows(numberRows);
    sync();
  }
  function reveal() {
    if(motion.running())return;selectedCell=null;
    if(mode==='diagonals'){mode='odd';oddBase=count;motion.start(2.4);}
    else{mode='diagonals';count=8;diagonal=0;motion.start(5.2);}
    sync();
  }
  return {enter(){
    events=new AbortController();motion.enter();lastDraw='';
    content.innerHTML=`<section class="creative-notebook maths-notebook" data-pascal-page data-animating="false">
      <header class="creative-title"><span>MATHS NOTEBOOK · 03<output data-pascal-pattern-rows></output></span><h3>Pascal’s triangle</h3></header>
      <div class="maths-spread"><figure class="maths-diagram"><svg data-pascal-art role="img"></svg></figure>
        <div class="maths-story">
          <p class="maths-number-line" data-pascal-sums aria-label="Diagonal totals"></p>
          ${mathsRange('pascal-rows','Rows',1,10,1,numberRows)}
          <p data-pascal-caption role="status" aria-live="polite" aria-atomic="true"></p>
          <output class="maths-equation" data-pascal-equation></output>
          <div class="maths-pascal-actions"><button type="button" data-pascal-next>Colour the odd numbers</button>
          <button type="button" class="maths-quiet" data-pascal-reveal>Add up the diagonals</button></div>
        </div></div></section>`;
    slider=bindMathsRange(content,'pascal-rows',{signal:events.signal,value:numberRows,coarse:3,onInput:setRows});
    content.querySelector('[data-pascal-next]').addEventListener('click',next,{signal:events.signal});
    bindMathsDiagram(content.querySelector('[data-pascal-art]'),{signal:events.signal,activate:event=>{
      const cell=event.target.closest('[data-pascal-cell]')||nearestMathsMark(event.currentTarget,'[data-pascal-cell]',event);
      if(!cell&&event.type!=='keydown')return;
      const [r,c]=cell?cell.dataset.pascalCell.split(':').map(Number):[count-1,Math.floor((count-1)/2)];selectCell(r,c);
    },move:key=>{const {row:r,column:c}=selectedCell||{row:count-1,column:Math.floor((count-1)/2)};
      selectCell(r+(key==='ArrowDown'?1:key==='ArrowUp'?-1:0),c+(key==='ArrowRight'?1:key==='ArrowLeft'?-1:0));}});
    content.querySelector('[data-pascal-reveal]').addEventListener('click',reveal,{signal:events.signal});
    // An interrupted reveal reopens in its complete state without starting a timer.
    if(mode==='odd')count=32;if(mode==='diagonals')diagonal=7;
    diagram();sync();if(selectedCell)selectCell(selectedCell.row,selectedCell.column);
  },exit(){motion.exit();events?.abort();events=null;slider=null;content.replaceChildren();},update:motion.update,
    setPaused:motion.setPaused,state:()=>({count,mode,diagonal})};
}
