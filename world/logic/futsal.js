export class PenaltyShot {
  constructor() {
    this.phase = 'ready';
    this.x = -16;
    this.z = -14;
    this.y = .17;
  }
  shoot(angle = 0, power = 12, start = {
    x: -16,
    y: .17,
    z: -14
  }) {
    this.phase = 'playing';
    this.outcome = null;
    this.elapsed = 0;
    this.settling = 0;
    Object.assign(this, start);
    const a = Math.max(-45, Math.min(45, angle)) * Math.PI / 180;
    const p = Math.max(8, Math.min(20, power));
    this.vx = Math.sin(a) * p;
    this.vz = -Math.cos(a) * p;
    this.vy = p * .085;
  }
  step(dt) {
    if (!['playing', 'settling'].includes(this.phase)) return;
    dt = Math.max(0, Math.min(.04, dt));
    this.elapsed += dt;
    const previousZ = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;
    this.vy -= 9.81 * dt;
    if (this.y < .17) {
      this.y = .17;
      this.vy = Math.max(0, -this.vy * .2);
      this.vx *= Math.exp(-2 * dt);
      this.vz *= Math.exp(-2 * dt);
    }
    if (!this.outcome && previousZ > -19.8 && this.z <= -19.8) {
      const insidePosts = Math.abs(this.x + 16) < 1.8;
      const underBar = this.y < 1.8;
      this.outcome = insidePosts && underBar ? 'goal' : 'missed';
      this.phase = 'settling';
      if (!insidePosts || !underBar) this.vz = Math.abs(this.vz) * .12;
    }
    // Continuous front-plane collision: a radius-wide ball cannot pass through posts or bar.
    if (previousZ > -19.8 && this.z <= -19.8) {
      const hitsPost = Math.abs(Math.abs(this.x + 16) - 2) <= .2 && this.y <= 2.2;
      const hitsBar = Math.abs(this.y - 2) <= .2 && Math.abs(this.x + 16) <= 2.2;
      if (hitsPost || hitsBar) {
        this.z = -19.79;
        this.vz = Math.abs(this.vz) * .35;
        this.outcome = 'missed';
        this.phase = 'settling';
      }
    }
    // Ball radius is .17 m; clamp before the back net, then rebound and settle.
    if (this.z <= -20.23) {
      this.z = -20.23;
      this.vz = Math.abs(this.vz) * .12;
    }
    if (this.phase === 'settling') {
      this.settling += dt;
      if (this.y <= .175 && this.settling > 1) {
        this.y = .17;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.phase = this.outcome;
      }
    } else if (this.elapsed > 4 || Math.hypot(this.vx, this.vz) < .3) {
      this.outcome = 'missed';
      this.phase = 'settling';
    }
  }
}
