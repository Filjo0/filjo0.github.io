// Navigation and experiments are independent of rendering and browser state.
export const places = {
  overview: {
    label: 'Coast',
    x: 0,
    z: 19
  },
  coast: {
    label: 'Warm coast',
    x: 0,
    z: 19
  },
  winter: {
    label: 'Winter',
    x: 0,
    z: -43
  },
  skate: {
    label: 'Ice skating',
    x: 0,
    z: -54
  },
  work: {
    label: 'My apps',
    x: -7,
    z: 1
  },
  experience: {
    label: 'About me',
    x: -5,
    z: 5
  },
  resume: {
    label: 'Résumé',
    x: -9,
    z: 6
  },
  contact: {
    label: 'Contact me',
    x: 1,
    z: 17
  },
  futsl: {
    label: 'FUTSL preview',
    x: -24,
    z: -3
  },
  aqua: {
    label: 'Aqua Local preview',
    x: 7,
    z: -2
  },
  ball: {
    label: 'Futsal & juggling',
    x: -16,
    z: -6
  },
  surf: {
    label: 'Surfing',
    x: 17,
    z: 7
  },
  tank: {
    label: 'Treadfront',
    x: -16,
    z: 9
  },
  plants: {
    label: 'Plant something',
    x: 3,
    z: 10
  },
  books: {
    label: 'Find a reading',
    x: -5,
    z: 8
  },
  coaching: {
    label: 'Coaching clipboard',
    x: -4,
    z: 5
  },
  tennis: {
    label: 'Tennis racket',
    x: -6,
    z: 5
  },
  receipts: {
    label: 'Receipt notes',
    x: -5.5,
    z: 1
  },
  fibonacci: {
    label: 'Maths notebook',
    x: 8,
    z: 4
  }
};
export const obstacles = [{
  x: 5,
  z: -11,
  w: 9,
  h: 15
}, {
  x: -7,
  z: -1,
  w: 3,
  h: 2
}, {
  x: 3,
  z: 12,
  w: 7,
  h: 2
}, {
  x: 8,
  z: 2,
  w: 2,
  h: 1
}, {
  x: -11,
  z: -45,
  w: 6,
  h: 5
}];
// Match the new tangible portfolio objects, not just their route coordinates.
obstacles.push({
  x: -9,
  z: 4.8,
  w: 1.5,
  h: .15
}, {
  x: 1,
  z: 15.8,
  w: .65,
  h: .45
}, {
  x: -5,
  z: 3.3,
  w: 2.8,
  h: 1.2
}, {
  x: -5,
  z: 6.8,
  w: 2,
  h: .4
}, {
  x: -24,
  z: -5,
  w: .4,
  h: .25
}, {
  x: 7,
  z: -3.2,
  w: .6,
  h: .25
}, {
  x: -16,
  z: 7.8,
  w: 1.4,
  h: .25
}, {
  x: -14,
  z: -40.2,
  w: 1.5,
  h: .15
}, {
  x: 3,
  z: -41.2,
  w: .65,
  h: .45
}, {
  x: -5,
  z: -42.8,
  w: .55,
  h: .25
});
export function walkable(x, z) {
  return x >= -27 && x <= 19 && z >= -86 && z <= 23 && (z >= -23 || z <= -35 || Math.abs(x) <= 4.5) && !
    obstacles.some(
      o => Math.abs(x - o.x) < o.w / 2 + .35 && Math.abs(z - o.z) < o.h / 2 + .35);
}
// Grid A* avoids cutting diagonally through furniture or the pool edge.
export function findPath(start, goal) {
  const cell = p => ({
      x: Math.round(p.x),
      z: Math.round(p.z)
    }),
    a = cell(start),
    b = cell(goal),
    key = p => `${p.x},${p.z}`;
  if (!walkable(b.x, b.z)) return [];
  const pending = [{
      ...a,
      g: 0,
      f: 0
    }],
    cost = new Map([
      [key(a), 0]
    ]),
    parents = new Map();
  let visited = 0;
  while (pending.length && visited++ < 6500) {
    pending.sort((u, v) => u.f - v.f);
    const p = pending.shift(),
      k = key(p);
    if (p.g !== cost.get(k)) continue;
    if (k === key(b)) {
      const result = [{
        x: goal.x,
        z: goal.z
      }];
      let t = k;
      while (parents.has(t)) {
        const q = parents.get(t);
        result.unshift({
          x: q.x,
          z: q.z
        });
        t = key(q);
      }
      return result;
    }
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
      const q = {
          x: p.x + dx,
          z: p.z + dz
        },
        qk = key(q),
        g = p.g + 1;
      if (!walkable(q.x, q.z) || g >= (cost.get(qk) ?? Infinity)) continue;
      cost.set(qk, g);
      parents.set(qk, p);
      pending.push({
        ...q,
        g,
        f: g + Math.abs(q.x - b.x) + Math.abs(q.z - b.z)
      });
    }
  }
  return [];
}
export const GOLDEN_ANGLE = 360 * (1 - 1 / ((1 + Math.sqrt(5)) / 2));
export function seedPattern(count = 240, angle = GOLDEN_ANGLE) {
  const n = Math.max(1, Math.min(800, Math.round(Number(count) || 1))),
    a = Number(angle) * Math.PI / 180;
  if (!Number.isFinite(a)) throw new TypeError('Angle must be finite');
  return Array.from({
    length: n
  }, (_, i) => {
    const r = 110 * Math.sqrt((i + .5) / n);
    return {
      x: 130 + r * Math.cos(i * a),
      y: 130 + r * Math.sin(i * a),
      index: i
    };
  });
}
export const plants = [{
  id: 'basil',
  name: 'Basil',
  latin: 'Ocimum basilicum',
  method: 'Sow seed',
  start: 'Use a draining pot and seed compost. Sow thinly on the surface without burying the seeds; keep them warm.',
  light: 'A warm, sunny location.',
  water: 'Keep the compost moist, with drainage. Avoid cold, waterlogged roots.',
  care: 'Pick shoot tips regularly to encourage branching; remove flower buds for a longer leaf harvest.',
  source: 'https://www.rhs.org.uk/herbs/basil/grow-your-own'
}, {
  id: 'spider',
  name: 'Spider plant',
  latin: 'Chlorophytum comosum',
  method: 'Plant an offset',
  start: 'Choose a plantlet that has developed roots. Pot it into moist houseplant compost in a container with drainage holes.',
  light: 'Bright, indirect light. Protect leaves from strong direct sun.',
  water: 'Keep compost lightly moist; empty excess water from the saucer. Water less when growth slows.',
  care: 'Repot when roots fill the pot. Mature plants can produce offsets that you can share.',
  source: 'https://www.rhs.org.uk/plants/spider-plants/growing-guide'
}, {
  id: 'rosemary',
  name: 'Rosemary',
  latin: 'Salvia rosmarinus',
  method: 'Plant a young plant',
  start: 'Start with a young plant or rooted cutting. Use a sunny spot and free-draining soil; do not bury the root crown deeply.',
  light: 'Full sun, best outdoors.',
  water: 'Water young plants during dry spells. Established plants need less; never leave roots waterlogged.',
  care: 'Trim after flowering to maintain shape. Container plants still need water in dry weather.',
  source: 'https://www.rhs.org.uk/herbs/rosemary/grow-your-own'
}];
export class GardenSession {
  constructor() {
    this.selected = 'basil';
    this.progress = new Map();
  }
  select(id) {
    if (!plants.some(p => p.id === id)) throw new RangeError('Unknown plant');
    this.selected = id;
    return this.plant;
  }
  get plant() {
    return plants.find(p => p.id === this.selected);
  }
  get stage() {
    return this.progress.get(this.selected) || 0;
  }
  advance() {
    const next = Math.min(3, this.stage + 1);
    this.progress.set(this.selected, next);
    return next;
  }
}

// A kick follows one physical trajectory; a missed goal ends the attempt.
export {
  PenaltyShot
}
from './world/logic/futsal.js';

// A transition in one continuous world, not live climate or geographical scale.
export function climateAt(z) {
  const snow = Math.max(0, Math.min(1, (-z - 25) / 12));
  return {
    region: snow >= .5 ? 'winter' : 'coast',
    snow
  };
}
export const skatingGates = Object.freeze(Array.from({
  length: 5
}, (_, i) => Object.freeze({
  x: i % 2 ? 1.3 : -1.3,
  z: -59 - i * 5
})));
export class SkatingRun {
  constructor() {
    this.best = 0;
    this.reset();
  }
  reset() {
    this.phase = 'ready';
    this.x = 0;
    this.z = -54;
    this.velocity = 0;
    this.passed = 0;
    this.elapsed = 0;
  }
  start() {
    this.reset();
    this.phase = 'playing';
  }
  step(dt, steer = 0) {
    if (this.phase !== 'playing') return;
    dt = Math.max(0, Math.min(.04, Number(dt) || 0));
    steer = Math.max(-1, Math.min(1, Number(steer) || 0));
    this.elapsed += dt;
    this.velocity = Math.max(-3.4, Math.min(3.4, this.velocity + steer * 10 * dt)) * Math.exp(-1.8 * dt);
    this.x += this.velocity * dt;
    this.z -= 2.8 * dt;
    if (Math.abs(this.x) > 4.3) {
      this.phase = 'lost';
      return;
    }
    const gate = skatingGates[this.passed];
    if (gate && this.z <= gate.z) {
      if (Math.abs(this.x - gate.x) > .95) {
        this.phase = 'lost';
        return;
      }
      this.passed++;
      this.best = Math.max(this.best, this.passed);
    }
    if (this.passed === skatingGates.length && this.z <= -82) this.phase = 'won';
  }
}

export function destinationFor(id, fromZ) {
  const p = places[id];
  if (!p) return null;
  const winter = {
    work: {
      x: -11,
      z: -40
    },
    experience: {
      x: -5,
      z: -42
    },
    resume: {
      x: -14,
      z: -39
    },
    contact: {
      x: 3,
      z: -40
    },
    books: {
      x: -5,
      z: -44
    },
    coaching: { x: -6, z: -42 },
    tennis: { x: -4, z: -42 },
    receipts: { x: -7, z: -42 },
    fibonacci: {
      x: 3,
      z: -45
    }
  };
  return climateAt(fromZ).region === 'winter' && winter[id] ? {
    ...p,
    ...winter[id]
  } : p;
}
export function nearestWalkable(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Exit coordinates must be finite');
  if (walkable(x, z)) return {
    x,
    z
  };
  const first = {
    x: Math.round(x),
    z: Math.round(z)
  };
  const queue = [first],
    seen = new Set([`${first.x},${first.z}`]);
  for (let i = 0; i < queue.length && i < 8000; i++) {
    const p = queue[i];
    if (walkable(p.x, p.z)) return p;
    for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]) {
      const next = {
          x: p.x + dx,
          z: p.z + dz
        },
        key = `${next.x},${next.z}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return {
    x: 0,
    z: 19
  };
}
export function assertWalkable(p) {
  if (!walkable(p.x, p.z)) throw new Error('Activity exit must be on solid walkable ground');
  return p;
}
