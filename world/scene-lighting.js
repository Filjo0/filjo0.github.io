import {sceneAsset,initialLight,LIGHT_PHASES} from './scene-clock.js';
// Shared by the WebGL plate and the SVG object highlight, both in linear colour.
export const MORNING_GRADE={scale:[1.05,1.015,.94],offset:[-.008,-.008,-.008]};
// Only an active season/phase is requested. Old frames remain usable on failure.
export function createSceneLighting({texture,uniforms,reduced,initial=initialLight().phase}){
 const cache=new Map();
 let phase=initial,region='coast',disposed=false,version=0,target=initial==='night'?1:0;
 let files={coast:sceneAsset('coast',initial),winter:sceneAsset('coast',initial)},previous={...files};
 const load=file=>{
  if(!cache.has(file))cache.set(file,texture(file).catch(e=>{cache.delete(file);throw e;}));
  return cache.get(file);
 };
 uniforms.twilight.value=target;uniforms.lightProgress.value=1;
 uniforms.morning.value=initial==='morning'?1:0;uniforms.oldMorning.value=uniforms.morning.value;
 const ready=load(files.coast).then(image=>{
  for(const name of ['coast','winter','oldCoast','oldWinter'])uniforms[name].value=image;
 });
 async function prepareSeason(next){
  const file=sceneAsset(next,phase),image=await load(file);if(disposed)return;
  // A phase may have changed while the season image was loading.
  if(file!==sceneAsset(next,phase))return prepareSeason(next);
  uniforms[next].value=image;uniforms[next==='coast'?'oldCoast':'oldWinter'].value=image;
  files[next]=file;previous[next]=file;
 }
 async function setPhase(next){
  if(!LIGHT_PHASES.includes(next))throw Error('Unknown light phase');
  const token=++version;
  if(next===phase){await ready;return !disposed&&token===version;}
  const images=new Map(),needed=()=>uniforms.season?.value>0&&uniforms.season.value<1?['coast','winter']:[region];
  // Re-evaluate visible seasons after each await. A load started on the coast
  // must never be installed on winter if the globe moved while it was pending.
  while(needed().some(name=>!images.has(name))){
   await Promise.all(needed().filter(name=>!images.has(name)).map(async name=>{
    const file=sceneAsset(name,next);images.set(name,{file,image:await load(file)});
   }));
   if(disposed||token!==version)return false;
  }
  previous={...files};
  uniforms.oldCoast.value=uniforms.coast.value;uniforms.oldWinter.value=uniforms.winter.value;
  uniforms.oldMorning.value=uniforms.morning.value;
  for(const [name,value] of images){uniforms[name].value=value.image;files[name]=value.file;}
  phase=next;target=next==='night'?1:0;
  uniforms.morning.value=next==='morning'?1:0;uniforms.lightProgress.value=reduced()?1:0;
  if(reduced())uniforms.twilight.value=target;
  return true;
 }
 return {ready,prepareSeason,setPhase,
  setRegion(value){region=value;},
  step(dt){
   const d=target-uniforms.twilight.value;
   uniforms.twilight.value+=Math.sign(d)*Math.min(Math.abs(d),dt/1.1);
   uniforms.lightProgress.value=Math.min(1,uniforms.lightProgress.value+dt/.45);
  },
  state:()=>({phase,blend:uniforms.twilight.value,target,ready:phase==='night',files:{...files},previous:{...previous},
   progress:uniforms.lightProgress.value,morning:uniforms.morning.value,oldMorning:uniforms.oldMorning.value}),
  running:()=>uniforms.lightProgress.value<1||Math.abs(uniforms.twilight.value-target)>.00001,
  dispose(){disposed=true;++version;}
 };
}
