// Device-game challenge; the legacy room's timing model remains unchanged.
export class DeviceJugglingRound {
  constructor(){this.best=0;this.cancel();}
  cancel(){this.phase='ready';this.score=0;this.y=.88;this.velocity=0;this.x=0;this.vx=0;this.foot=0;this.cooldown=0;this.record=false;}
  start(){this.cancel();this.phase='playing';this.y=.42;this.velocity=4.05;this.previousBest=this.best;}
  get level(){return Math.min(4,Math.floor(this.score/4));}
  get gravity(){return 9.81*(1+this.level*.17);}
  get ceiling(){return .70-this.level*.055;}
  get inReach(){return Math.abs(this.x-this.foot)<=.17;}
  get canKick(){return this.phase==='playing'&&this.velocity<0&&this.y<=this.ceiling&&this.y>.115&&this.cooldown<=0&&this.inReach;}
  kick(){
    if(!this.canKick){this.cooldown=Math.max(this.cooldown,.16);return false;}
    this.velocity=4.3;this.cooldown=.15;this.score++;this.best=Math.max(this.best,this.score);
    this.record=this.score>this.previousBest;
    this.vx=this.score<4?0:(Math.floor(this.score/4)%2?1:-1)*(.12+this.level*.018);
    return true;
  }
  nudge(direction){if(this.phase==='playing')this.foot=Math.max(-.4,Math.min(.4,this.foot+direction*.13));}
  update(seconds){
    if(this.phase!=='playing')return;
    const dt=Math.max(0,Math.min(seconds,.05));this.cooldown=Math.max(0,this.cooldown-dt);
    this.y+=this.velocity*dt-this.gravity*dt*dt/2;this.velocity-=this.gravity*dt;
    this.x+=this.vx*dt;
    if(Math.abs(this.x)>.4){this.x=Math.sign(this.x)*.4;this.vx=-this.vx;}
    if(this.y<=.115){this.y=.115;this.velocity=0;this.phase='lost';}
  }
}
