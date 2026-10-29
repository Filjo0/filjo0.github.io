import {
  PenaltyShot
} from '../logic/futsal.js';
export function createFutsal({
  avatar,
  props
}) {
  const shot = new PenaltyShot();
  const home = {x: -16, y: .17, z: -14};
  let phase = 'ready',
    angle = 0,
    power = 12,
    kickTime = 0,
    launch = null;
  return {
    exitSpot: {
      x: -16,
      z: -13.65
    },
    enter(options = {}) {
      angle = options.angle || 0;
      power = options.power || 12;
      phase = 'approaching';
      kickTime = 0;
      launch = null;
      props.ball.position.set(-16, .17, -14);
    },
    update(dt) {
      if (phase === 'approaching') {
        const root = avatar.root;
        const dx = -16 - root.position.x,
          dz = -13.65 - root.position.z;
        const d = Math.hypot(dx, dz),
          step = dt * 3;
        if (d > .04) {
          root.position.x += dx / d * Math.min(d, step);
          root.position.z += dz / d * Math.min(d, step);
          root.rotation.y = Math.atan2(dx, dz);
          avatar.walk(performance.now() / 120);
        } else {
          phase = 'kicking';
          avatar.reset();
          root.rotation.y = Math.PI;
        }
        return;
      }
      kickTime += dt;
      avatar.kick(kickTime);
      if (phase === 'kicking' && kickTime >= .18) {
        const foot = avatar.footWorld();
        launch = {
          x: foot.x,
          y: Math.max(.17, foot.y),
          z: foot.z - .18
        };
        shot.shoot(angle, power, launch);
        phase = 'playing';
      }
      if (phase === 'playing' || phase === 'settling') {
        shot.step(dt);
        phase = shot.phase;
        props.ball.position.set(shot.x, shot.y, shot.z);
      }
    },
    state() {
      return {
        type: 'penalty',
        phase,
        launch,
        ball: {
          x: shot.x,
          y: shot.y,
          z: shot.z
        }
      };
    },
    exit() {
      props.ball.position.set(home.x, home.y, home.z);
    }
  };
}
