// Exact sequence values with a bounded drawing window; no artificial sequence cap.
export class FibonacciSketch {
  constructor(){this.count=0;this.previous=0n;this.next=1n;this.tiles=[];this.minX=0n;this.minY=0n;this.maxX=1n;this.maxY=1n;}
  append(){
    const size=this.next;[this.previous,this.next]=[this.next,this.previous+this.next];
    let x=0n,y=0n,dir=0;
    if(this.count>0){
      const side=(this.count-1)%4;dir=(side+1)%4;
      if(side===0){x=this.maxX;y=this.minY;this.maxX+=size;}
      else if(side===1){x=this.minX;y=this.maxY;this.maxY+=size;}
      else if(side===2){x=this.minX-size;y=this.minY;this.minX-=size;}
      else{x=this.minX;y=this.minY-size;this.minY-=size;}
    }
    this.count++;this.tiles.push({x,y,size,dir,index:this.count,value:size});
    if(this.tiles.length>12)this.tiles.shift();return size;
  }
  drawing(){
    const w=this.maxX-this.minX,h=this.maxY-this.minY,precision=1_000_000n;
    const ratio=(v,total)=>Number(v*precision/total)/Number(precision);
    return {count:this.count,aspect:ratio(w,h),tiles:this.tiles.map(t=>({...t,x:ratio(t.x-this.minX,w),y:ratio(t.y-this.minY,h),w:ratio(t.size,w),h:ratio(t.size,h)}))};
  }
}

// World units and seconds. A round only continues when the visitor returns the ball.
export class JugglingRound {
  constructor(){this.best=0;this.cancel();}
  cancel(){this.phase='ready';this.score=0;this.y=.88;this.velocity=0;this.cooldown=0;}
  start(){this.phase='playing';this.score=0;this.y=.42;this.velocity=4.05;this.cooldown=0;}
  get canKick(){return this.phase==='playing'&&this.velocity<0&&this.y<=.70&&this.y>.115&&this.cooldown<=0;}
  kick(){
    if(!this.canKick)return false;
    this.velocity=4.3;this.score++;this.best=Math.max(this.best,this.score);this.cooldown=.15;return true;
  }
  update(seconds){
    if(this.phase!=='playing')return;
    const dt=Math.max(0,Math.min(seconds,.05));this.cooldown=Math.max(0,this.cooldown-dt);
    this.y+=this.velocity*dt-4.905*dt*dt;this.velocity-=9.81*dt;
    if(this.y<=.115){this.y=.115;this.velocity=0;this.phase='lost';}
  }
}
