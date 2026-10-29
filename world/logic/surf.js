export class SurfRide {
  constructor() {
    this.reset();
  }
  reset() {
    this.phase = 'ready';
    this.elapsed = 0;
    this.balance = 0;
  }
  start() {
    this.reset();
    this.phase = 'playing';
  }
  step(dt, steer = 0) {
    if (this.phase !== 'playing') return;
    dt = Math.max(0, Math.min(.05, dt));
    this.elapsed += dt;
    const drift = .20 + Math.sin(this.elapsed * 1.7) * .35;
    this.balance += (drift + Math.max(-1, Math.min(1, steer)) * .8) * dt;
    if (Math.abs(this.balance) >= 1) this.phase = 'lost';
    else if (this.elapsed >= 12) this.phase = 'won';
  }
}
