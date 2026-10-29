import {containsPrivateProject} from './public-content-guard.mjs';
import {createHash} from 'node:crypto';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const archive=resolve(root,'validation-artifacts/legacy-studio');
const hasArchive=existsSync(resolve(archive,'studio.html'));
const prototype=path=>['studio.html','studio.css','walkthrough.css','room.js','room-details.js',
  'room-experience.js','room-audio.js','assets/studio-workspace.webp'].includes(path)||path.startsWith('assets/studio/');
const filePath=path=>resolve(prototype(path)?archive:root,path);

const textFiles = ['world-winter.js','world.css','world.js','world-state.js','world-controller.js','world-projects.js','studio.html','demo/treadfront/index.html','demo/treadfront/demo.css','demo/treadfront/demo.js','demo/treadfront/core.js','index.html', 'resume.html', 'design-tokens.css', 'resume-chrome.css', 'styles.css', 'studio.css', 'walkthrough.css', 'script.js', 'room.js', 'room-details.js', 'room-experience.js', 'room-audio.js', 'room-activities.js', 'room-reading.js', 'art/studio/surface_bake.py', 'art/studio/living_zone.py', 'art/studio/contact_zone.py', 'art/studio/studio_art.py', 'art/studio/desk_zone.py', 'README.md', 'AGENTS.md'];
function ownedModules(directory) {
  return readdirSync(resolve(root,directory), {withFileTypes:true}).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? ownedModules(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}
textFiles.push(...ownedModules('world'), 'demo/treadfront/demo.bundle.js', 'assets/site-icon.svg', 'assets/previews/previews.json');
const htmlFiles = ['index.html', 'resume.html', 'demo/treadfront/index.html',...(hasArchive?['studio.html']:[])];
if (existsSync(resolve(root,'world/activity-ui.js'))) throw Error('Retired activity-ui.js must remain absent.');

const requiredFiles = [
  ...textFiles,
  'concept.css',
  'favicon.ico',
  'scripts/build-site-icon.mjs',
  'art/outdoor/concept-scenes.json',
  'art/outdoor/concept-prompts.json',
  'scripts/test-concept-scenes.mjs',
  'scripts/check-concept-scenes.mjs',
  'scripts/check-legacy-world.mjs',
  '.nojekyll',
  'scripts/test-world.mjs',
  'scripts/test-world-surfaces.mjs',
  'scripts/check-world-surfaces.mjs',
  'scripts/check-world-discoveries.mjs',
  'scripts/capture-previews.mjs',
  'scripts/test-world-stations.mjs',
  'scripts/check-world-physics.mjs',
  'scripts/build-treadfront-demo.mjs',
  'scripts/check-world.mjs',
  'scripts/export-treadfront-demo.py',
  'demo/treadfront/source.json',
  'scripts/check-studio.mjs',
  'scripts/check-room-experience.mjs',
  'scripts/test-room-activities.mjs',
  'assets/hero-workspace.jpg',
  'assets/studio-workspace.webp',
  'assets/vendor/three.module.js',
  'assets/vendor/THREE-LICENSE.txt',
  'assets/outdoor/person.glb',
  'scripts/check-world-character.mjs',
  'assets/studio/contact-zone.glb',
  'assets/studio/desk-zone.glb',
  'assets/studio/living-zone.glb',
];
const failures = [];

const fail = (message) => failures.push(message);
if (existsSync(resolve(root,'assets/Philipp_Alimov_Resume.pdf')))
  fail('The retired résumé PDF must be absent from public assets; use the readable, printable HTML résumé.');
for (const path of requiredFiles.filter(path=>hasArchive||!prototype(path))) {
  if (!existsSync(filePath(path))) fail(`Missing required file: ${path}`);
}

const contents = new Map(
  textFiles
    .filter((path) => existsSync(filePath(path)))
    .map((path) => [path, readFileSync(filePath(path), 'utf8')]),
);

for (const [path, text] of contents) {
  if ((path.startsWith('world/') || /^world.*\.js$/.test(path)) && path.endsWith('.js')) {
    text.split('\n').forEach((line, i) => {
      if (line.length > 160) fail(`${path}:${i + 1} exceeds 160 characters.`);
    });
  }
}
// Shared UI colours live in one stylesheet; device/art exceptions are named there too.
const sharedCss = ['styles.css', 'world.css', 'concept.css', 'resume-chrome.css'];
const tokens = contents.get('design-tokens.css') || '';
const definitions = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const coreColours = new Set('paper paper-raised ink ink-muted line green green-deep green-soft copper white black'.split(' ').map(n=>'--color-'+n));
for(const name of definitions) {
  if(name.startsWith('--color-') && !coreColours.has(name)) fail(`Unapproved core UI colour: ${name}.`);
  if(/^--swatch-|-[\da-f]{6}\b/i.test(name)) fail(`Use a descriptive colour role, not ${name}.`);
}

for (const path of sharedCss) {
  const css = readFileSync(resolve(root,path),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  if (/#(?:[\da-f]{3,8})\b/i.test(css)) fail(`${path}: put literal colours in design-tokens.css.`);
  if (/--swatch-|\b(?:rgba?|hsla?)\(/i.test(css)) fail(`${path}: use named palette roles.`);
  if(path==='styles.css' && /var\(--(?:art|object|device|chrome-night)-/.test(css))
    fail('The simple page must use only the main UI palette.');
  if (/font(?:-family)?\s*:[^;{}]*\bInter\b/i.test(css)) fail(`${path}: Inter is not loaded; use the shared font stack.`);
  const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  for (const [,name,fallback] of css.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    if (!definitions.has(name) && !local.has(name) && !fallback)
      fail(`${path}: undefined design variable ${name}.`);
  }
}
const indexStyles = contents.get('index.html') || '';
if (!indexStyles.includes('href="design-tokens.css"') ||
    indexStyles.indexOf('href="design-tokens.css"') > indexStyles.indexOf('href="styles.css"'))
  fail('Load the shared design tokens before the main stylesheets.');

for (const path of ['index.html','resume.html']) {
  if (/Android[^<.;]*(?:release preparation|in preparation)|release preparation/i.test(contents.get(path) || ''))
    fail(`${path}: released Android availability must not be described as in preparation.`);
}

// A root icon also serves the unchanged standalone résumé's implicit browser request.
try {
  const icon=readFileSync(resolve(root,'favicon.ico')),sizes=[16,32,48,64];
  if(icon.readUInt16LE(0)!==0||icon.readUInt16LE(2)!==1||icon.readUInt16LE(4)!==sizes.length)throw Error('invalid ICO directory');
  for(let i=0;i<sizes.length;i++) {
    const p=6+i*16,length=icon.readUInt32LE(p+8),offset=icon.readUInt32LE(p+12);
    if(icon[p]!==sizes[i]||icon[p+1]!==sizes[i]||offset+length>icon.length||
      icon.subarray(offset,offset+8).toString('hex')!=='89504e470d0a1a0a'||
      icon.readUInt32BE(offset+16)!==sizes[i]||icon.readUInt32BE(offset+20)!==sizes[i])throw Error('invalid icon image');
  }
} catch(error){fail('Root favicon: '+error.message);}

const demoHash = createHash('sha256');
for (const file of ['demo/treadfront/core.js', 'demo/treadfront/demo.js']) {
  demoHash.update(contents.get(file) || '');
}
if (!contents.get('demo/treadfront/demo.bundle.js')?.includes(`// Source SHA-256: ${demoHash.digest('hex')}`)) {
  fail('Treadfront bundle is stale; run npm run build:demo with development esbuild.');
}

const previewPath=resolve(root,'assets/previews/previews.json');
if(existsSync(previewPath)) {
  try {
    const data=JSON.parse(readFileSync(previewPath,'utf8'));let total=0;
    for(const id of ['futsl','aqua']) {
      const project=data.projects[id];
      if(!project||!Number.isFinite(Date.parse(project.capturedAt)))throw Error('Missing capture date');
      const ids=new Set(project.screens.map(s=>s.id));
      if(!ids.has(project.start))throw Error('Missing start screen');
      for(const screen of project.screens) {
        const expectedHost=id==='futsl'?'perth-futsal.onrender.com':'aqualocal.com.au';
        if(new URL(screen.sourceUrl).hostname!==expectedHost)throw Error('Unapproved capture source');
        if(!/^assets\/previews\/[a-z-]+\.webp$/.test(screen.image))throw Error('Invalid asset path');
        const bytes=readFileSync(resolve(root,screen.image));total+=bytes.length;
        if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Invalid WebP');
        if(createHash('sha256').update(bytes).digest('hex')!==screen.sha256)throw Error('Capture hash mismatch');
        for(const h of screen.hotspots) {
          const r=h.rect;
          if(!ids.has(h.target)||r.x<0||r.y<0||r.width<=0||r.height<=0||
            r.x+r.width>screen.width+.01||r.y+r.height>screen.height+.01)throw Error('Invalid captured action');
        }
      }
    }
    if(total>400_000)throw Error('Captured previews exceed the 400 KB total budget');
  } catch(e) {fail(`Invalid public app previews: ${e.message}`);}
}
if(/Harbour FC|Shore Leisure Pool|Coastal Five|Park Swim Centre/.test(contents.get('world-projects.js')||''))
  fail('Invented app data has returned to the portfolio');

const index = contents.get('index.html') || '';
const resume = contents.get('resume.html') || '';
const resumeView = contents.get('world/resume.js') || '';
if (/Philipp_Alimov_Resume\.pdf|\bdownload\b/i.test(resume+'\n'+resumeView))
  fail('Résumé presentation must use the readable, printable HTML page, without a PDF download.');
if (!resume.includes('data-print-resume') || !resumeView.includes('href="resume.html"'))
  fail('Résumé must retain browser Print and a standalone reading link.');
const allText = [...contents.values()].join('\n');
const emailMatches = allText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
const approvedEmails = new Set(['philalimov.apps@gmail.com', 'philalimov@gmail.com']);
const unexpectedEmails = [...new Set([...contents].flatMap(([path,text])=>
  (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).filter(email=>
    !approvedEmails.has(email.toLowerCase()))))];
if (unexpectedEmails.length) fail(`Unexpected public email address: ${unexpectedEmails.join(', ')}`);
if (!index.includes('mailto:philalimov.apps@gmail.com')) fail('Portfolio business contact email is missing.');
const publicFolders=['world','scripts','art','demo','redoubt','assets'];
function publicText(directory='') {
  return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>{
    const name=directory?directory+'/'+entry.name:entry.name;
    if(entry.isDirectory())return (directory||publicFolders.includes(entry.name))&&!entry.name.startsWith('.')
      &&entry.name!=='__pycache__'?publicText(name):[];
    return /\.(?:html|js|mjs|css|md|json|py|svg|txt)$/.test(name)?[name]:[];
  });
}
for(const path of publicText())if(containsPrivateProject(readFileSync(resolve(root,path),'utf8')))
  fail('Unapproved project description appears in public source: '+path);
for(const property of ['og:type','og:title','og:description','og:url','og:image','og:image:alt'])
  if(!index.includes(`property="${property}" content="`))fail('Missing link-preview property: '+property);
if(!index.includes('name="twitter:card" content="summary_large_image"'))fail('Missing large-image sharing card.');
if(/(?:Back to park|Return to (?:exploring )?the park|Interactive park unavailable)/i.test(index+contents.get('world-controller.js')))
  fail('Visitor-facing park wording remains.');
const sharePath=resolve(root,'assets/portfolio-preview.jpg');
if(!existsSync(sharePath))fail('Missing portfolio sharing image.');
else {
 const jpeg=readFileSync(sharePath);let dimensions;
 for(let offset=2;offset+9<jpeg.length;){
  if(jpeg[offset]!==255)break;
  const marker=jpeg[offset+1],length=jpeg.readUInt16BE(offset+2);
  if([192,193,194].includes(marker)){dimensions=[jpeg.readUInt16BE(offset+7),jpeg.readUInt16BE(offset+5)];break;}
  offset+=2+length;
 }
 if(dimensions?.join('x')!=='1200x630'||jpeg.length>350000)fail('Sharing image must be 1200×630 JPEG below 350 KB.');
}
if (index.includes('mailto:philalimov@gmail.com')) fail('Personal resume email appears on the portfolio page.');
if (!resume.includes('mailto:philalimov@gmail.com')) fail('Original resume email is missing.');
if (resume.includes('mailto:philalimov.apps@gmail.com')) fail('Business contact email appears in the resume.');
if (!index.includes('<h3>FUTSL</h3>')) fail('The FUTSL portfolio project is missing.');
if (!resume.includes('<p class="entry-title">FUTSL</p>')) fail('The FUTSL resume project is missing.');
if (/Perth Futsal/i.test(`${index}\n${resume}`)) fail('Former FUTSL product branding appears in the public portfolio.');
if (/\b(?:\+?61[ -]?)?0?4\d{2}[ -]?\d{3}[ -]?\d{3}\b/.test(allText)) {
  fail('A personal phone number appears in the public site.');
}
if (/[A-Z]:\\Users\\/i.test(allText)) fail('An absolute local Windows path appears in the public site.');
if (/private_inputs/i.test(allText)) {
  fail('A private source or private-library reference appears in the public site.');
}

for (const path of htmlFiles) {
  const html = contents.get(path) || '';
  const ids = [...html.matchAll(/\sid="([^"]+)"/gi)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) fail(`${path} contains duplicate element IDs.`);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) fail(`${path} must contain exactly one h1; found ${h1Count}.`);
  if (!/<meta name="description" content="[^"]+">/i.test(html)) {
    fail(`${path} is missing a meta description.`);
  }
  if (!/class="skip-link"/i.test(html)) fail(`${path} is missing its skip link.`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|#)/i.test(reference)) continue;
    const withoutFragment = reference.split('#')[0].split('?')[0];
    if (!withoutFragment) continue;
    const target = resolve(dirname(filePath(path)), withoutFragment);
    if (!existsSync(target)) fail(`${path} references missing local file: ${reference}`);
  }

  for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
    if (!/rel="[^"]*noopener[^"]*"/i.test(match[0])) {
      fail(`${path} has a target=_blank link without rel=noopener.`);
    }
  }
}

const unreleasedProject = ['perth', 'tennis'].join(' ');
if (allText.toLowerCase().includes(unreleasedProject)) fail('Unreleased project material appears in the public site.');
for (const sectionId of ['work', 'experience', 'capabilities', 'resume', 'contact']) {
  if (!index.includes(`id="${sectionId}"`)) fail(`index.html is missing #${sectionId}.`);
}

const styles = `${contents.get('styles.css') || ''}\n${contents.get('studio.css') || ''}\n${contents.get('walkthrough.css') || ''}`;
if (/linear-gradient|radial-gradient/i.test(styles)) fail('Decorative gradients are not part of the portfolio system.');
if (/letter-spacing:\s*-/i.test(styles)) fail('Negative letter spacing is not allowed.');

for (const [file, label] of [['contact-zone.glb', 'Contact corner'], ['desk-zone.glb', 'Desk zone'], ['living-zone.glb', 'Living room']]) {
  const modelPath = filePath('assets/studio/'+file);
  if (!existsSync(modelPath)) continue;
  const model = readFileSync(modelPath);
  if (model.length > 2_000_000) fail(`${label} exceeds its 2 MB download budget.`);
  if (model.length < 20 || model.readUInt32LE(0) !== 0x46546c67 ||
      model.readUInt32LE(4) !== 2 || model.readUInt32LE(8) !== model.length) {
    fail(`${label} must be a complete glTF 2 binary asset.`);
    continue;
  }
  try {
    const length=model.readUInt32LE(12);
    if(model.readUInt32LE(16)!==0x4e4f534a||20+length>model.length)throw Error('invalid JSON chunk');
    const gltf=JSON.parse(model.subarray(20,20+length).toString('utf8'));
    const baked=gltf.materials.filter(m=>m.name?.startsWith('baked_'));
    if(!baked.length||baked.some(m=>!m.normalTexture||!m.pbrMetallicRoughness?.metallicRoughnessTexture)) {
      fail(`${label} lost an authored normal or roughness texture during export.`);
    }
  } catch(error) { fail(`${label} has invalid glTF material data: ${error.message}`); }

}

// The clothed outdoor character is a bounded, self-contained CC0 asset.
try {
  const bytes=readFileSync(resolve(root,'assets/outdoor/person.glb'));
  if(bytes.length>1_500_000||bytes.readUInt32LE(0)!==0x46546c67||
     bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('invalid or oversized GLB');
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  if(!gltf.skins?.length)throw Error('missing skeleton');
  for(const region of ['coast','winter'])if(!gltf.nodes.some(n=>n.extras?.wardrobe===region))throw Error('missing '+region+' wardrobe');
  if(gltf.buffers.some(b=>b.uri)||gltf.images?.some(i=>i.uri))throw Error('external asset reference');
} catch(error) {fail('Outdoor character: '+error.message);}

// The never-published testing demo has no public entry or directory.
for(const path of ['index.html','world-projects.js']) {
  const text=readFileSync(resolve(root,path),'utf8');
  if(/qa-lab\/|qa-invitation|workspace-qa|Test a booking flow/.test(text))fail(path+': retired testing demo is still discoverable');
}
if(existsSync(resolve(root,'qa-lab')))fail('Retired testing demo: qa-lab/ must not exist in the public source');

// The exact approved scene plates and linked desk views are bounded and pinned.
try {
  const manifest=JSON.parse(readFileSync(resolve(root,'art/outdoor/concept-scenes.json'),'utf8'));
  const assets=[...Object.values(manifest.assets),manifest.closeup,manifest.winter_closeup];
  let total=0;
  for(const asset of assets) {
    if(!asset.path.startsWith('assets/outdoor/')||!asset.path.endsWith('.webp'))throw Error('invalid scene path');
    const bytes=readFileSync(resolve(root,asset.path));total+=bytes.length;
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('invalid WebP');
    if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
      throw Error('scene differs from its approved asset record');
  }
  if(total>2_000_000)throw Error('scene plates exceed the combined 2 MB budget');
} catch(error) {fail('Concept artwork: '+error.message);}

// Optional evening plates have their own bounded download; the original 2 MB guard remains unchanged.
try {
  const manifest=JSON.parse(readFileSync(resolve(root,'art/outdoor/dusk-scenes.json'),'utf8'));let total=0;
  for(const asset of Object.values(manifest.assets)) {
    if(!asset.path.startsWith('assets/outdoor/concept-')||!/-dusk-v[1-9]\d*\.webp$/.test(asset.path))throw Error('invalid dusk path');
    const bytes=readFileSync(resolve(root,asset.path));total+=bytes.length;
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('invalid WebP');
    if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('dusk asset differs from record');
  }
  if(total>1_000_000||!manifest.lazy_loaded)throw Error('dusk plates exceed their optional combined 1 MB budget');
} catch(error){fail('Dusk artwork: '+error.message);}

// Runtime silhouette metadata must reproduce the reviewed authoring record exactly.
try {
  const source=readFileSync(resolve(root,'art/outdoor/hotspot-layout.json'),'utf8');
  if(source!==readFileSync(resolve(root,'assets/outdoor/hotspot-layout.json'),'utf8'))throw Error('runtime metadata differs from the approved outlines');
  if(Buffer.byteLength(source)>30_000)throw Error('outline metadata exceeds its 30 KB budget');
} catch(error){fail('Object outlines: '+error.message);}

// Optional object photographs are pinned separately; existing scene budgets remain intact.
try {
  const record=readFileSync(resolve(root,'art/outdoor/object-views.json'),'utf8');
  if(record!==readFileSync(resolve(root,'assets/outdoor/object-views.json'),'utf8'))throw Error('runtime metadata differs from provenance');
  const manifest=JSON.parse(record);let total=0;
  for(const asset of Object.values(manifest.views)) {
    if(!['concept-about-closeup-v3.webp','concept-book-closeup-v3.webp','concept-resume-closeup-v3.webp'].includes(asset.image)&&!/^concept-[a-z-]+-v2\.webp$/.test(asset.image))throw Error('invalid object image name');
    const bytes=readFileSync(resolve(root,'assets/outdoor',asset.image));total+=bytes.length;
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('invalid object WebP');
    if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
      throw Error('object image differs from its record');
    for(const quad of [asset.corners,...(asset.mobile_corners?[asset.mobile_corners]:[])]) {
      if(quad.length!==4||quad.some(p=>p.length!==2||p[0]<0||p[1]<0||p[0]>asset.width||p[1]>asset.height))
        throw Error('invalid screen/paper calibration');
    }
  }
  if(total>2_000_000||manifest.budget_bytes!==2_000_000||!manifest.lazy_loaded)throw Error('object views exceed optional 2 MB budget');
} catch(error){fail('Object artwork: '+error.message);}

// Launcher capture is restricted to the approved local one-sector demo.
try {
  const card=JSON.parse(readFileSync(resolve(root,'assets/previews/treadfront-card.json'),'utf8'));
  const bytes=readFileSync(resolve(root,card.image));
  if(card.source!=='demo/treadfront/index.html'||card.sector!==0||bytes.length>40_000||bytes.length!==card.bytes||
    createHash('sha256').update(bytes).digest('hex')!==card.sha256)throw Error('invalid one-sector capture');
} catch(error){fail('Demo card capture: '+error.message);}

for (const path of requiredFiles.filter((value) => ['.png', '.jpg', '.webp'].includes(extname(value).toLowerCase()))) {
  if (existsSync(filePath(path)) && statSync(filePath(path)).size === 0) {
    fail(`Generated or copied asset is empty: ${path}`);
  }
}

if (failures.length) {
  console.error('Portfolio validation failed:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Portfolio validation passed: ${requiredFiles.length} files, ${emailMatches.length} contact references.`);
