import {reducedMotion} from './motion.js';
function cover(c,image,w,h){
  const scale=Math.max(w/image.width,h/image.height),sw=w/scale,sh=h/scale;
  c.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,0,0,w,h);
}
function shadow(c,x,y,rx,ry,opacity){
  c.save();c.translate(x,y);c.scale(1,ry/rx);
  const gradient=c.createRadialGradient(0,0,0,0,0,rx);
  gradient.addColorStop(0,'rgba(16,24,17,'+opacity+')');gradient.addColorStop(1,'rgba(16,24,17,0)');
  c.fillStyle=gradient;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();c.restore();
}
function athlete(c,art,{phase,kickTime,contact,missTime,age,footX,ground,radius,scale}){
  const {clips}=art.data,factor=scale*art.data.worldHeight/(art.data.frameSize?.[1]||480);
  let clip='idle',index=reducedMotion()?0:Math.floor(age*12)%clips.idle.length,extension=0;
  if(phase==='lost'){clip='miss';index=reducedMotion()?clips.miss.length-1:Math.min(clips.miss.length-1,Math.floor(missTime*24));}
  else if(kickTime<.34){
    clip='kick';extension=Math.max(0,1-kickTime/.34);
    const height=contact?.hit?ground-contact.y-radius*.3:scale*.3;
    const target=height*extension;
    index=clips.kick.reduce((best,frame,i)=>Math.abs((frame.plant[1]-frame.toe[1])*factor-target)<
      Math.abs((clips.kick[best].plant[1]-clips.kick[best].toe[1])*factor-target)?i:best,0);
  }
  const frame=clips[clip][index],r=frame.rect;
  const anchor=footX+radius*.5+(contact?.hit?(contact.x-footX)*extension:0);
  const x=anchor-frame.toe[0]*factor,y=ground-frame.plant[1]*factor;
  const point=p=>({x:x+p[0]*factor,y:y+p[1]*factor});
  const plant=point(frame.plant),toe=point(frame.toe);
  const sr=frame.shadowRect,sp=frame.shadowPlant,sf=factor*(frame.shadowScale||1);
  if(art.shadow&&sr)c.drawImage(art.shadow,...sr,plant.x-sp[0]*sf,plant.y-sp[1]*sf,sr[2]*sf,sr[3]*sf);
  c.drawImage(art.player,...r,x,y,r[2]*factor,r[3]*factor);
  const b=frame.bounds;
  return {toe,plant,clip,frame:index,bounds:{left:x+b[0]*factor,top:y+b[1]*factor,right:x+b[2]*factor,bottom:y+b[3]*factor},
    contact:Boolean(contact?.hit&&kickTime<.04)};
}
export function paintJuggling(canvas,round,{phase,kickTime,contact,art,age=0,missTime=0}){
  const box=canvas.parentElement,w=box.clientWidth,h=Math.max(100,box.clientHeight),ratio=Math.min(devicePixelRatio,2);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  c.fillStyle='#20382b';c.fillRect(0,0,w,h);
  if(art)cover(c,art.court,w,h);
  const spriteHeight=Math.min(h*(h<400?.64:.82),w*1.15,720),scale=spriteHeight/2.5;
  const ground=h*(h<400?.76:.82),radius=Math.max(10,scale*.115),span=Math.min(w*.52,scale*2.6);
  const heightToY=height=>ground-radius-(height-.115)*scale;
  const x=w*.43+round.x*span,y=heightToY(phase==='ready'?.115:round.y),footX=w*.43+round.foot*span;
  let leg={toe:{x:footX,y:ground},plant:{x:footX,y:ground},contact:false},player=null;
  if(art){leg=athlete(c,art,{phase,kickTime,contact,missTime,age,footX,ground,radius,scale});player=leg.bounds;}
  const ready=phase==='playing'&&round.canKick;
  // A court-plane glow stays under the kicking foot, never a floating target ellipse.
  const ring={x:footX+radius*.5,y:ground+3,rx:radius*2.4,ry:radius*.65,lit:ready};
  c.save();c.translate(ring.x,ring.y);c.scale(1,ring.ry/ring.rx);
  const glow=c.createRadialGradient(0,0,0,0,0,ring.rx);
  glow.addColorStop(0,ready?'#d6ff9bf2':'#f3e6ae50');
  glow.addColorStop(.5,ready?'#c4f883cc':'#f3e6ae28');glow.addColorStop(1,'#c4f88300');
  c.globalCompositeOperation='screen';c.fillStyle=glow;c.beginPath();c.arc(0,0,ring.rx,0,Math.PI*2);c.fill();c.restore();
  const shadowRadius=radius*(1.3+round.y*.45);
  shadow(c,x,ground+5,shadowRadius,shadowRadius*.23,.45/(1+round.y));
  if(art){
    c.save();c.translate(x,y);c.rotate(round.x*.8+round.y*.4);
    c.drawImage(art.ball,-radius,-radius,radius*2,radius*2);c.restore();
  }
  return {ball:{x,y,radius},shadow:{x,y:ground+5,radius:shadowRadius},ring:{...ring,lit:ready},leg,player,
    artReady:Boolean(art),sprite:art?{clip:leg.clip,frame:leg.frame}:null,ground};
}