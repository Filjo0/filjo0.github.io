import {skatingGates} from '../world-state.js';
function line(c,a,b,width,colour){
  c.strokeStyle=colour;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
}
function ellipse(c,x,y,rx,ry,colour){c.fillStyle=colour;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function backdrop(c,w,h){
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#edca9f');
  sky.addColorStop(.5,'#f6e7c4');sky.addColorStop(1,'#58968f');
  c.fillStyle=sky;c.fillRect(0,0,w,h);
}
function paintSkate(c,w,h,run){
  const rink={x:8,y:8,width:w-16,height:h-16},playerY=h*.74,scale=rink.height/19;
  c.fillStyle='#ececdf';c.fillRect(0,0,w,h);
  const ice=c.createLinearGradient(0,0,w,h);ice.addColorStop(0,'#acd2d4');ice.addColorStop(1,'#d2e9e5');
  c.fillStyle=ice;c.fillRect(rink.x,rink.y,rink.width,rink.height);
  c.strokeStyle='#648f8d';c.lineWidth=3;c.strokeRect(rink.x,rink.y,rink.width,rink.height);
  const travel=-run.z-54,scroll=travel*scale;
  c.save();c.beginPath();c.rect(rink.x+2,rink.y+2,rink.width-4,rink.height-4);c.clip();
  // Ice lines and skate traces share the gates' top-down world coordinates.
  for(let metre=Math.floor(travel/2)*2-8;metre<travel+24;metre+=2){
    const y=playerY-(metre-travel)*scale;
    line(c,[rink.x,y],[rink.x+rink.width,y],1,'#f3fbf455');
    for(let i=0;i<6;i++){
      const x=rink.x+(i+.5)*rink.width/6;
      line(c,[x,y-8],[x+7,y+13],1,'#739f9b22');
    }
  }
  const mapX=x=>rink.x+rink.width*(x+4.3)/8.6;
  const gates=skatingGates.map((gate,i)=>({x:mapX(gate.x),y:playerY-(run.z-gate.z)*scale,
    width:rink.width*1.9/8.6,index:i,active:i===run.passed,passed:i<run.passed}));
  for(const g of gates){
    if(g.y<rink.y+10||g.y>rink.y+rink.height-8)continue;
    c.save();c.shadowColor='#c7ff82';c.shadowBlur=g.active?16:0;
    line(c,[g.x-g.width/2,g.y],[g.x+g.width/2,g.y],g.active?6:3,g.active?'#c9ff8e':'#809f96');
    ellipse(c,g.x-g.width/2,g.y,5,8,'#2f5547');ellipse(c,g.x+g.width/2,g.y,5,8,'#2f5547');c.restore();
    c.fillStyle='#203e35';c.font='600 12px system-ui';c.textAlign='center';c.fillText(String(g.index+1),g.x,g.y-11);
  }
  const finish=playerY-(run.z+82)*scale;
  if(finish>rink.y&&finish<rink.y+rink.height){
    for(let i=0;i<12;i++){c.fillStyle=i%2?'#f4f3de':'#34564d';c.fillRect(rink.x+i*rink.width/12,finish,rink.width/12,6);}
  }
  const x=mapX(run.x),size=Math.max(10,Math.min(20,w*.05,h*.085)),stride=Math.sin(run.elapsed*6)*size*.25;
  c.save();c.translate(x,playerY);c.rotate(-run.velocity*.09);
  ellipse(c,0,4,size*1.2,size*1.5,'#34595030');
  // Cap, shoulders, jacket and blades are all seen from above.
  line(c,[-size*.35,4],[-size*.55,13+stride],6,'#263f3e');
  line(c,[size*.35,4],[size*.55,13-stride],6,'#263f3e');
  line(c,[-size*.55,13+stride],[-size*.55,21+stride],3,'#f9fae8');
  line(c,[size*.55,13-stride],[size*.55,21-stride],3,'#f9fae8');
  line(c,[-size*.5,-2],[-size*1.15,5-stride],5,'#a1603f');
  line(c,[size*.5,-2],[size*1.15,5+stride],5,'#a1603f');
  ellipse(c,0,0,size*.65,size*.85,'#a1603f');
  ellipse(c,0,-size*.75,size*.43,size*.43,'#eee7ce');
  ellipse(c,0,-size*.82,size*.43,size*.29,'#355c4e');c.restore();c.restore();
  return {player:{x,y:playerY,radius:size*1.4},rink,gates,finish,view:'overhead',scroll};
}
function paintSurf(c,w,h,ride,{fallProgress=1,phase=ride.phase}={}){
  backdrop(c,w,h);
  const horizon=h*.30,crest=h*.68+Math.sin(ride.elapsed*1.7)*h*.03;
  const sea=c.createLinearGradient(0,horizon,0,h);sea.addColorStop(0,'#87b7b0');sea.addColorStop(1,'#276a73');
  c.fillStyle=sea;c.fillRect(0,horizon,w,h-horizon);

  for(let i=0;i<6;i++){
    const yy=horizon+h*.035+i*h*.065,offset=Math.sin(ride.elapsed*2+i)*15;
    line(c,[w*.2+offset,yy],[w+offset,yy],i===5?3:1,'#c8e7d273');
  }
  const wave=c.createLinearGradient(0,crest-30,0,h);wave.addColorStop(0,'#b7ddc4');
  wave.addColorStop(.3,'#609f9e');wave.addColorStop(1,'#174e62');
  c.fillStyle=wave;c.beginPath();c.moveTo(-20,h);
  for(let x=-20;x<=w+20;x+=8)c.lineTo(x,crest+Math.sin(x/w*5+ride.elapsed*2)*12);
  c.lineTo(w+20,h);c.closePath();c.fill();
  for(let x=-12;x<w+12;x+=14){const yy=crest+Math.sin(x/w*5+ride.elapsed*2)*12;
    ellipse(c,x,yy,12,3+Math.sin(x+ride.elapsed*3),'#e2f0db');}
  const x=w*.52,boardY=crest+Math.sin(2.6+ride.elapsed*2)*12-5,size=Math.max(12,Math.min(22,h*.065));
  const fallen=ride.phase==='lost',fall=fallen?Math.max(0,Math.min(1,fallProgress)):0;
  const side=Math.sign(ride.balance)||1,rotation=ride.balance*.4+side*Math.PI*.5*fall;
  const rider={x:x+side*size*.3*fall,y:boardY+size*1.8*fall};
  c.save();c.translate(x,boardY);c.rotate(ride.balance*.4);
  ellipse(c,0,0,size*2.5,size*.26,'#ece1b5');line(c,[-size*2,0],[size*2,0],2,'#aa754f');c.restore();
  c.save();c.translate(rider.x,rider.y);c.rotate(rotation);
  const hip=[0,-size*2.3],kneeL=[-size,-size],kneeR=[size*.9,-size*1.2];
  line(c,hip,kneeL,7,'#c5926d');line(c,kneeL,[-size*1.4,-3],6,'#c5926d');
  line(c,hip,kneeR,7,'#d8ad80');line(c,kneeR,[size*1.2,-3],6,'#d8ad80');
  line(c,hip,[-size*.3,-size*4],size*.75,'#234b4d');
  line(c,[-size*.3,-size*3.7],[-size*1.8,-size*3],5,'#d8ad80');
  line(c,[-size*.3,-size*3.7],[size*1.8,-size*3.7],5,'#d8ad80');
  ellipse(c,-size*.3,-size*4.7,size*.5,size*.62,'#d7ab7e');
  ellipse(c,-size*.4,-size*5,size*.5,size*.3,'#473d30');c.restore();
  if(fallen){
    const splashX=rider.x+side*size*2.4*fall,splashY=rider.y+size*.3;
    ellipse(c,splashX,splashY,size*2.3*fall,size*.45*fall,'#e2f0dbb0');
    for(let i=0;i<5;i++){
      const dx=(i-2)*size*.6;
      line(c,[splashX+dx,splashY],[splashX+dx*1.4,splashY-(12+i%2*9)*fall],3,'#e2f0db');
    }
  }
  const project=(px,py)=>({x:rider.x+px*Math.cos(rotation)-py*Math.sin(rotation),
    y:rider.y+px*Math.sin(rotation)+py*Math.cos(rotation)});
  const torso=project(-size*.15,-size*3.15),head=project(-size*.3,-size*4.7);
  const meter={x:w*.18,y:h*.15,width:w*.64,height:12},visible=ride.phase==='playing'&&phase==='playing';
  const marker=meter.x+meter.width*(.5+ride.balance*.47);
  if(visible){
    c.fillStyle='#f3e7c7';c.fillRect(meter.x,meter.y,meter.width,meter.height);
    c.fillStyle='#5e8965';c.fillRect(meter.x+meter.width*.35,meter.y,meter.width*.3,meter.height);
    line(c,[marker,meter.y-4],[marker,meter.y+meter.height+4],4,'#24483c');
    c.font='600 12px system-ui';c.textAlign='center';c.fillStyle='#234539';c.fillText('BALANCE',w*.5,meter.y-10);
  }
  return {board:{x,y:boardY,tilt:ride.balance*.4},wave:{crest,time:ride.elapsed},
    player:{...torso,radius:size*2.5,head,pose:fallen?(fall<1?'falling':'fallen'):'riding'},fallProgress:fall,balanceMeter:{...meter,marker,visible}};
}
export function paintDeviceSport(canvas,type,model,view={}){
  const w=canvas.parentElement.clientWidth,h=Math.max(100,canvas.parentElement.clientHeight),ratio=Math.min(devicePixelRatio,2);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  }
  const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  return type==='skate'?paintSkate(c,w,h,model):paintSurf(c,w,h,model,view);
}
