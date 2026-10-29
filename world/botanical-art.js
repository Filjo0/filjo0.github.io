// Original SVG illustrations. No downloaded artwork, fonts or new dependencies.
export function plantDrawing(species, stage=3, id='plant') {
  const leaves=[];
  if(stage>=2) {
    if(species==='spider') {
      const n=stage===2?5:15;
      for(let i=0;i<n;i++) {
        const side=i%2?1:-1,reach=stage===2?32:38+i*3,height=stage===2?55:70+(i%4)*14;
        leaves.push(`<path data-leaf="strap" d="M120 176Q${120+side*15} ${176-height} ${120+side*reach} ${190-height/3}
Q${120+side*14} ${173-height/2} 120 176" fill="${i%3?'#4e7144':'#a0ad65'}" stroke="#32553b" stroke-width="1"/>`);
      }
    } else if(species==='basil') {
      const n=stage===2?2:10;
      leaves.push(`<path d="M120 180Q117 130 120 ${stage===2?118:59}" fill="none" stroke="#496442" stroke-width="4"/>`);
      for(let i=0;i<n;i++) {
        const side=i%2?1:-1,y=stage===2?135:164-Math.floor(i/2)*22,width=stage===2?22:30+(i%3)*5;
        leaves.push(`<path data-leaf="broad" d="M120 ${y}C${120+side*width} ${y-45} ${120+side*(width+24)} ${y-10}
${120+side*width} ${y+4}Q${120+side*15} ${y+12} 120 ${y}" fill="${i%3?'#567945':'#87a457'}"
stroke="#355e3e" stroke-width="1"/><path d="M120 ${y}L${120+side*width} ${y-12}" stroke="#c0cc8a" stroke-width="1"/>`);
      }
    } else {
      const branches=stage===2?2:5;
      for(let j=0;j<branches;j++) {
        const x=120+(j-Math.floor(branches/2))*19,top=stage===2?125:65+(j%2)*20;
        leaves.push(`<path d="M120 183Q${x} 138 ${x} ${top}" fill="none" stroke="#69714b" stroke-width="3"/>`);
        for(let i=0;i<(stage===2?4:9);i++)for(const side of [-1,1]) {
          const y=170-i*10;
          leaves.push(`<path data-leaf="needle" d="M${x} ${y}l${side*14} -12" stroke="${i%2?'#4e795b':'#88a180'}"
stroke-width="3.5" stroke-linecap="round"/>`);
        }
      }
    }
  }
  const starter=stage===1?(species==='basil'?`<g transform="translate(120 174)">
<path d="M-19 1q20-26 40-1q-21 18-40 1" fill="#cdb184" stroke="#846744"/>
<path d="M-12 0q15-7 26-2" stroke="#846744" fill="none"/></g>`:
    `<path d="M120 180v-48m0 10q-25-21-32-8q11 19 32 8m0-3q28-19 35-4q-15 15-35 4"
stroke="#537849" stroke-width="4" fill="#87a05d"/>`):'';
  return `<svg viewBox="10 30 220 245"
role="img"
aria-label="${species} · ${['Soil ready','Starter planted','New growth','Established plant'][stage]}" data-plant-art
data-stage="${stage}">
<defs>
<linearGradient id="${id}-pot" x1="0" x2="1">
<stop stop-color="#8d5134"/>
<stop offset=".38" stop-color="#cc8b5c"/>
<stop offset=".72" stop-color="#b8794e"/>
<stop offset="1" stop-color="#87553a"/>
</linearGradient>
<radialGradient id="${id}-shadow">
<stop stop-color="#463c2e" stop-opacity=".22"/>
<stop offset="1" stop-color="#463c2e" stop-opacity="0"/>
</radialGradient>
</defs>
<ellipse cx="120" cy="261" rx="86" ry="15"
fill="url(#${id}-shadow)"/>
<g data-plant-pot><path d="M63 181h114l-17 72q-39 13-80 0z"
fill="url(#${id}-pot)"
stroke="#906447"/>
<path d="M73 201l13 44m7-40l8 42m40-42l-6 43m25-45l-11 43"
stroke="#e5b28a" stroke-width="1" opacity=".35"/>
<ellipse cx="120" cy="182" rx="61" ry="15"
fill="#d29163"/>
<ellipse cx="120" cy="181" rx="53" ry="10"
fill="#493c2b"/>
${Array.from({length:21},(_,i)=>`<ellipse cx="${78+(i*31)%86}" cy="${177+(i*7)%8}" rx="${1+i%3}" ry="1"
fill="${i%2?'#927654':'#b89c76'}"/>`).join('')}
</g>${starter}${leaves.join('')}<path d="M63 194q55 17 114 0"
stroke="#e3a67b" stroke-width="2"
fill="none"/>
</svg>`;
}
export function sunflowerDrawing() {
  return `<svg viewBox="0 0 330 360"
class="sunflower-art" data-seed-art
role="img"
aria-label="Sunflower head with no seeds yet">
<defs>
<linearGradient id="petal-ochre" x1="0" y1="0" x2="1" y2="1">
<stop stop-color="#f3ce68"/>
<stop offset=".6" stop-color="#d59b3d"/>
<stop offset="1" stop-color="#ad7030"/>
</linearGradient>
<radialGradient id="seed-disc">
<stop stop-color="#5c5232"/>
<stop offset="1" stop-color="#7c6940"/>
</radialGradient>
</defs>
<path d="M164 268q13 44 1 81"
stroke="#647e46" stroke-width="8"
fill="none"/>
<path d="M166 320q-62-63-97-22q36 38 97 22m1 15q62-66 98-24q-43 36-98 24"
fill="#758b4f"
stroke="#526e42"/>
<g
transform="translate(165 165)">${Array.from({length:34},(_,i)=>`<path d="M-9-108Q-26-132 0-157Q25-132 9-108Z"
transform="rotate(${i*360/34})"
fill="url(#petal-ochre)"
stroke="#b58339" stroke-width=".8"/>`).join('')}</g>
<circle cx="165" cy="165" r="115"
fill="url(#seed-disc)"
stroke="#a47c3e" stroke-width="4"/>
<g
transform="translate(35 35)" data-seed-layer>
</g>
<g transform="translate(35 35)" data-spiral-layer></g>
</svg>`;
}
