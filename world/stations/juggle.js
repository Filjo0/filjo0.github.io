import * as THREE from '../../assets/vendor/three.module.js';
import {
  JugglingRound
} from '../../room-activities.js';
export function createJuggle({
  avatar,
  props
}) {
  const round = new JugglingRound();
  const home = props.ball.position.clone();
  let kickTime = .45;
  return {
    exitSpot: {
      x: -16,
      z: -6
    },
    enter() {
      round.start();
      kickTime = .45;
      avatar.root.position.set(-16, 0, -6);
      avatar.root.rotation.y = Math.PI;
    },
    kick() {
      const accepted = round.kick();
      if (accepted) kickTime = 0;
      return accepted;
    },
    update(dt) {
      round.update(dt);
      kickTime += dt;
      avatar.kick(kickTime);
      // A foot-sized outward stance keeps the ball clear of the body silhouette.
      avatar.root.updateMatrixWorld(true);
      props.ball.position.copy(avatar.root.localToWorld(new THREE.Vector3(.46, round.y + .25, .15)));
    },
    state() {
      return {
        type: 'ball',
        phase: round.phase,
        score: round.score,
        best: round.best,
        height: round.y + .25,
        canKick: round.canKick
      };
    },
    exit() {
      round.cancel();
      props.ball.position.copy(home);
    }
  };
}
