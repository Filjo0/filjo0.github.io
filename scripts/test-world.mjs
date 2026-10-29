import test from 'node:test';
import assert from 'node:assert/strict';
import {
  places,
  walkable,
  findPath,
  seedPattern,
  GOLDEN_ANGLE,
  GardenSession,
  plants,
  PenaltyShot,
  SkatingRun,
  skatingGates,
  climateAt,
  destinationFor
} from '../world-state.js';
import {
  LEVELS,
  createLevelState,
  startLevel,
  stepLevel,
  levelById,
  LABYRINTH_STAGES
} from '../demo/treadfront/core.js';
test('all places have a reachable route without pool or furniture shortcuts', () => {
  for (const goal of Object.values(places)) {
    const path = findPath(places.overview, goal);
    assert.ok(path.length, goal.label);
    for (const p of path) assert.ok(walkable(p.x, p.z), JSON.stringify(p));
    assert.deepEqual(path.at(-1), {
      x: goal.x,
      z: goal.z
    });
  }
  assert.deepEqual(findPath(places.overview, {
    x: 5,
    z: -11
  }), []);
});
test('the golden-angle experiment differs from repetitive spokes and stays bounded', () => {
  const golden = seedPattern(240),
    regular = seedPattern(240, 120);
  assert.ok(Math.abs(GOLDEN_ANGLE - 137.507764) < .00001);
  assert.notDeepEqual(golden, regular);
  for (const p of golden) assert.ok(Math.hypot(p.x - 130, p.y - 130) <= 110);
  assert.equal(seedPattern(100000).length, 800);
  assert.throws(() => seedPattern(240, Infinity));
});
test('plant choice retains an independent finite care journey', () => {
  const g = new GardenSession();
  g.advance();
  g.select('spider');
  assert.equal(g.stage, 0);
  for (let i = 0; i < 8; i++) g.advance();
  assert.equal(g.stage, 3);
  g.select('basil');
  assert.equal(g.stage, 1);
  assert.throws(() => g.select('unknown'));
  for (const p of plants) assert.ok(p.source.startsWith('https://www.rhs.org.uk/'));
});
test('demo contains one sector and rejects the full campaign and special missions', () => {
  assert.equal(LEVELS.length, 1);
  assert.equal(LEVELS[0].id, 'outer-wall');
  assert.equal(LABYRINTH_STAGES.length, 0);
  for (const id of ['steel-ring', 'minefield', 'ash-labyrinth', 'unknown']) assert.throws(() => levelById(
    id));
  const state = createLevelState('outer-wall', {
    endless: true,
    doctrine: 'bulwark'
  });
  assert.equal(state.endless, false);
  assert.equal(state.doctrine, null);
});
test('original combat moves the player and an unattended demo ends in defeat', () => {
  let s = startLevel(createLevelState('outer-wall'));
  const x = s.player.x;
  s = stepLevel(s, {
    x: 1,
    y: 0
  }, 1000 / 60);
  assert.ok(s.player.x > x);
  for (let i = 0; i < 36000 && s.phase === 'playing'; i++) s = stepLevel(s, {
    x: 0,
    y: 0
  }, 1000 / 60);
  assert.equal(s.phase, 'ended');
  assert.equal(s.result.outcome, 'lost');
});

test('a central futsal shot scores and a wide shot loses', () => {
  for (const [angle, result] of [
      [0, 'goal'],
      [45, 'missed']
    ]) {
    const s = new PenaltyShot();
    s.shoot(angle, 16);
    for (let i = 0; i < 1000 && ['playing', 'settling'].includes(s.phase); i++) s.step(1 / 120);
    assert.equal(s.phase, result);
  }
});

test('coast and snow are connected and the climate changes gradually', () => {
  const path = findPath(places.coast, places.winter);
  assert.ok(path.length > 50);
  assert.ok(path.some(p => p.z < -30 && p.z > -35));
  assert.equal(climateAt(19).region, 'coast');
  assert.equal(climateAt(-43).region, 'winter');
  assert.equal(climateAt(-31).snow, .5);
  assert.ok(!walkable(10, -30));
  for (const id of ['work', 'experience', 'resume', 'contact', 'books', 'fibonacci']) {
    const p = destinationFor(id, -43);
    assert.equal(climateAt(p.z).region, 'winter');
    assert.ok(walkable(p.x, p.z));
    assert.ok(findPath(places.winter, p).length);
  }
});
test('unsteered skating loses at the first gate and retry keeps the best', () => {
  const s = new SkatingRun();
  s.start();
  for (let i = 0; i < 500 && s.phase === 'playing'; i++) s.step(1 / 120);
  assert.equal(s.phase, 'lost');
  assert.equal(s.passed, 0);
  s.best = 3;
  s.start();
  assert.equal(s.passed, 0);
  assert.equal(s.best, 3);
  const snapshot = JSON.stringify(s);
  s.step(0, 1);
  assert.equal(JSON.stringify(s), snapshot);
});
test('a player can steer through all skating gates and win at the finish', () => {
  const s = new SkatingRun();
  s.start();
  for (let i = 0; i < 3000 && s.phase === 'playing'; i++) {
    const target = skatingGates[s.passed]?.x ?? 0;
    const steer = Math.max(-1, Math.min(1, (target - s.x) * 3 - s.velocity * 1.2));
    s.step(1 / 120, steer);
  }
  assert.equal(s.phase, 'won');
  assert.equal(s.passed, 5);
  assert.equal(s.best, 5);
});

import {
  nearestWalkable,
  assertWalkable
} from '../world-state.js';
import {
  SurfRide
} from '../world/logic/surf.js';
test('portfolio destinations are distinct and reachable in both climates', () => {
  for (const z of [19, -43]) {
    const positions = ['work', 'resume', 'contact', 'experience', 'books'].map(id => destinationFor(id,
      z));
    assert.equal(new Set(positions.map(p => `${p.x},${p.z}`)).size, positions.length);
    positions.forEach(p => assertWalkable(p));
  }
});
test('unsafe activity exits recover onto reachable solid ground', () => {
  for (const [x, z] of [
      [22, 7],
      [5, -11],
      [0, -90],
      [100, 100],
      [-11, -45]
    ]) {
    const p = nearestWalkable(x, z);
    assertWalkable(p);
    assert.ok(findPath(places.overview, p).length);
  }
  assert.throws(() => assertWalkable({
    x: 22,
    z: 7
  }));
});
test('surfing has a bounded win and an unattended fall', () => {
  const fall = new SurfRide();
  fall.start();
  for (let i = 0; i < 2400 && fall.phase === 'playing'; i++) fall.step(1 / 120);
  assert.equal(fall.phase, 'lost');
  assert.ok(fall.elapsed < 12);
  const win = new SurfRide();
  win.start();
  for (let i = 0; i < 2400 && win.phase === 'playing'; i++) {
    const steer = -(.20 + Math.sin(win.elapsed * 1.7) * .35) / .8 - win.balance;
    win.step(1 / 120, steer);
  }
  assert.equal(win.phase, 'won');
  assert.ok(win.elapsed <= 12.02);
});
test('futsal ball collides with back net, posts and crossbar and settles on the ground', () => {
  for (const start of [{
      x: -16,
      y: .17,
      z: -14
    }, {
      x: -18,
      y: .17,
      z: -19.5
    }, {
      x: -16,
      y: 2,
      z: -19.5
    }]) {
    const s = new PenaltyShot();
    s.shoot(0, 16, start);
    for (let i = 0; i < 1200 && ['playing', 'settling'].includes(s.phase); i++) {
      s.step(1 / 120);
      assert.ok(s.z >= -20.23);
      assert.ok(s.y >= .17);
    }
    assert.equal(s.phase, start.x === -16 && start.y === .17 ? 'goal' : 'missed');
    assert.equal(s.y, .17);
  }
});

test('public route labels retain their actual Unicode characters', () => {
  assert.equal(places.resume.label, 'Résumé');
  assert.equal(places.aqua.label, 'Aqua Local preview');
  assert.equal(places.swim, undefined);
});
