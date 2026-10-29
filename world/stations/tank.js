import {
  walkable
} from '../../world-state.js';
export function createTank({
  avatar,
  props,
  isWalkable = walkable
}) {
  const tank = props.tank,
    home = tank.position.clone();
  let elapsed = 0;
  return {
    exitSpot: {
      x: -16,
      z: 9
    },
    enter() {
      elapsed = 0;
      avatar.root.position.set(-16, .5, 13);
    },
    update(dt, {
      dx,
      dz,
      yaw
    }) {
      elapsed += dt;
      const l = Math.hypot(dx, dz);
      if (l) {
        const x = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / l;
        const z = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / l;
        const nx = tank.position.x + x * dt * 4,
          nz = tank.position.z + z * dt * 4;
        const clear = [-2, 2].every(a => [-2, 2].every(b => isWalkable(nx + a, nz + b)));
        if (clear) {
          tank.position.x = nx;
          tank.position.z = nz;
          tank.rotation.y = Math.atan2(x, z);
        }
      }
      avatar.root.position.set(tank.position.x, 1.1, tank.position.z);
      avatar.root.rotation.y = tank.rotation.y;
      avatar.hips.position.y = (avatar.restHeight ?? .87) - .42;
      for (const l of avatar.limbs) {
        l.leg.visible = false;
        l.arm.rotation.x = -.4;
      }
    },
    state() {
      return {
        type: 'drive',
        phase: 'playing',
        elapsed
      };
    },
    running() {
      return false;
    },
    exit() {
      tank.position.copy(home);
      tank.rotation.y = 0;
    }
  };
}
