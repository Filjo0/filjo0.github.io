import {
  nearestWalkable,
  assertWalkable
} from '../../world-state.js';
import {
  createSurf
} from './surf.js';
import {
  createJuggle
} from './juggle.js';
import {
  createFutsal
} from './futsal.js';
import {
  createSkate
} from './skate.js';
import {
  createTank
} from './tank.js';
export function createStations(context, onGame, clearInput) {
  const stations = {
    surf: createSurf(context),
    ball: createJuggle(context),
    penalty: createFutsal(context),
    skate: createSkate(context),
    drive: createTank(context)
  };
  let active = null;

  function exit() {
    if (!active) return;
    const spot = active.exitSpot;
    active.exit();
    context.avatar.reset();
    clearInput();
    context.view.yaw = .2;
    const safe = nearestWalkable(spot.x, spot.z);
    assertWalkable(safe);
    context.avatar.root.position.set(safe.x, 0, safe.z);
    active = null;
  }
  return {
    enter(type, options) {
      exit();
      context.avatar.reset();
      clearInput();
      active = stations[type];
      if (!active) throw new Error(`Unknown activity: ${type}`);
      active.enter(options);
      active.update(0, {
        dx: 0,
        dz: 0,
        yaw: 0
      });
    },
    update(dt, input) {
      if (!active) return;
      let remaining = dt;
      do {
        const step = Math.min(.04, remaining);
        active.update(step, input);
        remaining -= step;
        if (['lost', 'won', 'goal', 'missed'].includes(active.state().phase)) break;
      } while (remaining > .000001);
      const state = active.state();
      if (['lost', 'won', 'goal', 'missed'].includes(state.phase)) exit();
      onGame(state);
    },
    exit,
    state() {
      return active?.state() || null;
    },
    running() {
      return !!active && (active.running ? active.running() : true);
    },
    kick() {
      return active?.kick?.() || false;
    },
    stroke() {
      active?.stroke?.();
    }
  };
}
