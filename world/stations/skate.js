import {
  SkatingRun
} from '../../world-state.js';
export function createSkate({
  avatar,
  winter,
  skates
}) {
  const run = new SkatingRun();
  return {
    exitSpot: {
      x: 0,
      z: -54
    },
    enter() {
      run.start();
      winter.markGate(0);
      skates.visible = true;
    },
    update(dt, input) {
      run.step(dt, input.dx);
      winter.markGate(run.passed);
      avatar.root.position.set(run.x, .18, run.z);
      avatar.root.rotation.y = Math.PI;
      avatar.root.rotation.z = -run.velocity * .055;
      avatar.hips.position.y = (avatar.restHeight ?? .87) - .09;
    },
    state() {
      return {
        type: 'skate',
        phase: run.phase,
        passed: run.passed,
        best: run.best,
        elapsed: run.elapsed
      };
    },
    exit() {
      run.reset();
      winter.markGate(-1);
      skates.visible = false;
    }
  };
}
