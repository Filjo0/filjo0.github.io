import {GardenSession, plants} from '../../world-state.js';
import {plantDrawing} from '../botanical-art.js';

export function createGardenPage(content, getWorld, announce) {
  const garden=new GardenSession();
  const notes={
    basil:['Scatter seeds on moist, draining compost. Keep warm; do not bury them.',
      'Choose a warm, sunny location.',
      'Keep compost moist with good drainage. Avoid cold, waterlogged roots.',
      'Pick shoot tips to encourage branching. Remove flower buds for more leaves.'],
    spider:['Pot a rooted plantlet in moist houseplant compost, with drainage holes.',
      'Bright, indirect light. Keep leaves out of strong direct sun.',
      'Keep compost lightly moist. Empty the saucer; water less as growth slows.',
      'Repot when roots fill the pot. Mature plants may produce plantlets to share.'],
    rosemary:['Use a young plant or rooted cutting in sunny, free-draining soil.',
      'Full sun, best outdoors.',
      'Water young plants in dry spells. Avoid waterlogged roots.',
      'Trim after flowering. Container plants still need water in dry weather.']
  };
  const syncGarden=()=>{if(document.body.dataset.worldNavigation!=='objects')getWorld().garden(garden.stage,garden.selected);};
  function paint(focus) {
    const p=garden.plant,s=garden.stage;
    const stages=['Soil',p.id==='basil'?'Seed':'Starter','Sprout','Plant'];
    content.innerHTML=`<section
class="creative-notebook garden-notebook"
aria-label="Planting field notebook">
<header
class="creative-title">
<span>FIELD NOTES · 01</span>
<h3>Something to grow</h3>
</header>
<nav
class="seed-packets"
aria-label="Choose a plant">${plants.map((item,i)=>`<button type="button"
class="seed-packet"
data-plant-choice="${item.id}"
aria-pressed="${garden.selected===item.id}">
<span
class="packet-number">0${i+1} · ${item.id==='basil'?'SEEDS':'STARTER'}</span>${plantDrawing(item.id,3,'packet-'+item.id)}<strong>${item.name}</strong>
<span
class="packet-method">${item.method}</span>
</button>`).join('')}</nav>
<div
class="garden-workbench">
<div
class="planter-study">${plantDrawing(p.id,s,'planter')}
<ol
class="garden-stages"
aria-label="Illustrated planting progress">${stages.map((name,i)=>`<li ${s===i?'aria-current="step"':''} data-complete="${s>=i}">${name}</li>`).join('')}</ol>
</div>
<article
class="plant-label"
aria-label="${p.name} care label">
<span
class="label-hole" aria-hidden="true">
</span>
<span
class="label-caption">${s===3?'KEEP THIS CARE LABEL':'STEP '+(s+1)+' / 4'}</span>
<h4>${p.name}</h4>
<i>${p.latin}</i>
<p data-plant-note>${notes[p.id][s]}</p>
<a href="${p.source}" target="_blank" rel="noopener noreferrer" data-plant-source>RHS growing guide ↗</a>
</article>
</div>
<footer
class="garden-footer">
<button type="button" data-plant-step ${s===3?'disabled':''}>${
['Plant the '+(p.id==='basil'?'seed':'starter'),'Find the right light','Plan the care','Care label complete'][s]
}</button>
${s===3?`<button type="button"
class="quiet-action" data-plant-care>Read all care notes</button>`:`<span
class="garden-time">Illustrated steps · real growth takes time</span>`}</footer>
</section>`;
    for(const button of content.querySelectorAll('[data-plant-choice]'))button.addEventListener('click',()=>{
      garden.select(button.dataset.plantChoice);syncGarden();paint(button.dataset.plantChoice);
    });
    content.querySelector('[data-plant-step]').addEventListener('click',()=>{
      garden.advance();syncGarden();paint('step');
      announce(`${p.name}: ${garden.stage} of 3 planting steps complete.`);
    });
    content.querySelector('[data-plant-care]')?.addEventListener('click',()=>{
      const label=content.querySelector('.plant-label');label.classList.toggle('all-care');
      const all=label.classList.contains('all-care');
      label.querySelector('[data-plant-note]').innerHTML=all?`<b>Light</b> ${p.light}<br>
<b>Water</b> ${p.water}<br>
<b>Care</b> ${p.care}`:notes[p.id][3];
      content.querySelector('[data-plant-care]').textContent=all?'Back to care label':'Read all care notes';
    });
    if(focus)content.querySelector(
      focus==='step'?(s===3?'[data-plant-care]':'[data-plant-step]'):`[data-plant-choice="${focus}"]`
    ).focus({preventScroll:true});
  }
  return {enter:()=>paint(),update(){},exit(){content.replaceChildren();},state:()=>({type:'plants',species:garden.selected,stage:garden.stage})};
}
