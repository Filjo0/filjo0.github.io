import {
  LEVELS,
  WORLD,
  TILE,
  createLevelState,
  startLevel,
  stepLevel,
  defeatExplanation
} from './core.js';
const arena = document.querySelector('.arena'),
  canvas = document.querySelector('canvas'),
  ctx = canvas.getContext('2d'),
  overlay = document.querySelector('.start'),
  status = document.querySelector('[data-status]');
let state = createLevelState('outer-wall'),
  paused = false,
  frame = 0,
  last = 0,
  accumulator = 0,
  ammo = 'ap',
  fire = false,
  mine = false;
const held = new Set(),startButton=document.querySelector('[data-start]'),controls=document.querySelector('.controls');
const desktopIntro=overlay.querySelector('p').innerHTML;
let handheld=false,rotated=false;
function presentation(value) {
  handheld=Boolean(value);document.documentElement.dataset.handheld=String(handheld);
  (handheld?controls:overlay).append(startButton);
  document.querySelector('[data-fire]').textContent=handheld?'Fire':'Fire · Space';
  document.querySelector('[data-mine]').textContent=handheld?'Place mine':'Place mine · M';
  arena.setAttribute('aria-label',handheld?'Tank battlefield. Use the arrow buttons to move and aim; hold Fire to shoot.':
    'Tank battlefield. WASD or arrows move and aim; Space fires; M places one mine.');
  if(state.phase==='ready'){
    overlay.querySelector('p').innerHTML=handheld?
      'Defend the base.<br>Hold the arrows to move and aim; hold Fire to shoot.<br>AP fires fast; HE breaks brick.':desktopIntro;
    status.textContent=handheld?'Ready to defend the base.':
      'Defend the base. Move with WASD / arrows. Space fires. Cover blocks shells.';
  }
  draw();
}


function draw() {
  controls.dataset.playing=String(state.phase==='playing');
  startButton.hidden=state.phase==='playing';
  const w=canvas.clientWidth,h=canvas.clientHeight,turn=handheld&&w>h*1.2;
  if(turn!==rotated){held.clear();fire=false;rotated=turn;}
  const width=rotated?WORLD.height:WORLD.width,height=rotated?WORLD.width:WORLD.height;
  const scale=Math.min(w/width,h/height),ox=(w-width*scale)/2,oy=(h-height*scale)/2;
  const ratio = Math.min(devicePixelRatio, 2);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#253529';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  if(rotated){ctx.translate(WORLD.height,0);ctx.rotate(Math.PI/2);}
  ctx.fillStyle = '#57604a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  state.grid.forEach((row, r) => [...row].forEach((cell, c) => {
    const x = c * TILE,
      y = r * TILE;
    if (cell === '#' || cell === '%') {
      ctx.fillStyle = cell === '#' ? '#65716b' : '#a57b59';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = cell === '#' ? '#8c9690' : '#78573b';
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(x, y + j * 10);
        ctx.lineTo(x + TILE, y + j * 10);
        ctx.stroke();
      }
      if (cell === '#') {
        ctx.strokeRect(x + 5, y + 5, 30, 30);
      }
    } else if (cell === '~') {
      ctx.fillStyle = '#635d42';
      ctx.fillRect(x, y, TILE, TILE);
    } else if (cell === '^') {
      ctx.fillStyle = '#314f33';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x + 5 + (i % 3) * 12, y + 7 + Math.floor(i / 3) * 20, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }));
  ctx.fillStyle = '#dccb8f';
  ctx.fillRect(state.base.x - 18, state.base.y - 18, 36, 36);
  ctx.fillStyle = '#4c5843';
  ctx.fillRect(state.base.x - 11, state.base.y - 10, 22, 20);
  ctx.fillStyle = '#efe6bd';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BASE', state.base.x, state.base.y + 31);
  for (const m of state.mines) {
    ctx.fillStyle = '#dca56a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of state.powerupPickups) {
    ctx.fillStyle = '#a5d0c0';
    ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
  }

  function tank(t, player = false) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.heading + Math.PI / 2);
    ctx.fillStyle = '#202921';
    ctx.fillRect(-14, -15, 7, 30);
    ctx.fillRect(7, -15, 7, 30);
    ctx.fillStyle = player ? '#c2d0a5' : t.type === 'heavy' ? '#b89472' : t.type === 'artillery' ? '#c5af82' :
      '#ad795f';
    ctx.fillRect(-9, -13, 18, 26);
    ctx.fillStyle = '#354532';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2, -22, 4, 21);
    ctx.restore();
    ctx.fillStyle = player ? '#cae4b9' : '#d9a17f';
    ctx.fillRect(t.x - 12, t.y + 20, 24 * Math.max(0, t.hp) / t.maxHp, 3);
  }
  tank(state.player, true);
  state.enemies.filter(e => e.hp > 0).forEach(t => tank(t));
  for (const b of state.bullets) {
    ctx.fillStyle = b.owner === 'player' ? '#ffe4a2' : '#e1a46e';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius || 3, 0, Math.PI * 2);
    ctx.fill();
  }
  document.querySelector('[data-health]').textContent = `Tank ${state.player.hp}/${state.player.maxHp}`;
  document.querySelector('[data-base]').textContent = `Base ${state.base.hp}/${state.base.maxHp}`;
  document.querySelector('[data-score]').textContent =
    `${state.stats.enemiesDefeated}/${LEVELS[0].enemyCount} defeated`;
  document.querySelector('[data-mine]').disabled = state.player.minesRemaining === 0;
  canvas.dataset.gameState = JSON.stringify({
    phase: state.phase,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp
    },
    baseHp: state.base.hp,
    elapsedMs: state.elapsedMs,
    levelId: state.levelId,
    paused,
    ammo,
    shotsFired:state.stats.shotsFired,
    board:{x:ox,y:oy,width:width*scale,height:height*scale,rotated},
    playerScreen:{x:ox+(rotated?WORLD.height-state.player.y:state.player.x)*scale,
      y:oy+(rotated?state.player.x:state.player.y)*scale}
  });
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  last = 0;
  accumulator = 0;
}

function request() {
  if (!frame && !paused && !document.hidden && state.phase === 'playing') frame = requestAnimationFrame(tick);
}

function tick(now) {
  frame = 0;
  if (paused || document.hidden || state.phase !== 'playing') return;
  accumulator += last ? Math.min(now - last, 100) : 0;
  last = now;
  while (accumulator >= 1000 / 60) {
    state = stepLevel(state, {
      x: rotated?Number(held.has('down'))-Number(held.has('up')):Number(held.has('right'))-Number(held.has('left')),
      y: rotated?Number(held.has('left'))-Number(held.has('right')):Number(held.has('down'))-Number(held.has('up')),
      manualFire: fire,
      deployMine: mine,
      ammoMode: ammo
    }, 1000 / 60);
    mine = false;
    accumulator -= 1000 / 60;
  }
  draw();
  if (state.phase !== 'playing') {
    stop();
    overlay.hidden = false;
    overlay.querySelector('p').textContent = state.result?.outcome === 'won' ?
      'Sector defended. This is the end of the demo.' : defeatExplanation(state);
    document.querySelector('[data-start]').textContent = 'Try sector again';
    status.textContent = overlay.querySelector('p').textContent;
  } else request();
}
new ResizeObserver(() => {
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.max(1, canvas.clientWidth * ratio);
  canvas.height = Math.max(1, canvas.clientHeight * ratio);
  draw();
}).observe(arena);
document.querySelector('[data-start]').addEventListener('click', () => {
  stop();
  held.clear();
  fire = false;
  mine = false;
  state = startLevel(createLevelState('outer-wall'));
  paused = false;
  controlPort?.postMessage({
    type: 'pause-state',
    paused
  });
  document.querySelector('[data-pause]').textContent = 'Pause';
  document.querySelector('[data-pause]').setAttribute('aria-pressed', 'false');
  overlay.hidden = true;
  status.textContent = 'Defend the base. Move to aim; stop to brace.';
  arena.focus();
  draw();
  request();
});
document.querySelector('[data-pause]').addEventListener('click', e => {
  paused = !paused;
  controlPort?.postMessage({
    type: 'pause-state',
    paused
  });
  stop();
  e.currentTarget.textContent = paused ? 'Resume' : 'Pause';
  e.currentTarget.setAttribute('aria-pressed', String(paused));
  draw();
  request();
});
const keys = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right'
};
window.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || state.phase !== 'playing') return;
  if (keys[e.code]) {
    e.preventDefault();
    held.add(keys[e.code]);
  }
  if (e.code === 'Space' && !e.target.closest('button,a')) {
    e.preventDefault();
    fire = true;
  }
  if (e.code === 'KeyM' && !e.repeat) mine = true;
});
window.addEventListener('keyup', e => {
  held.delete(keys[e.code]);
  if (e.code === 'Space') fire = false;
});

function hold(button, down, up) {
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    down();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) button.addEventListener(
    event, up);
  button.addEventListener('keydown', e => {
    if (['Space', 'Enter'].includes(e.code)) {
      e.preventDefault();
      down();
    }
  });
  button.addEventListener('keyup', up);
}
document.querySelectorAll('[data-direction]').forEach(b => hold(b, () => held.add(b.dataset.direction), () =>
  held.delete(b.dataset.direction)));
hold(document.querySelector('[data-fire]'), () => {
  fire = true;
}, () => {
  fire = false;
});
document.querySelector('[data-mine]').addEventListener('click', () => {
  mine = true;
});
document.querySelectorAll('[data-ammo]').forEach(b => b.addEventListener('click', () => {
  ammo = b.dataset.ammo;
  document.querySelectorAll('[data-ammo]').forEach(a => a.setAttribute('aria-pressed', String(a ===
    b)));
  draw();
}));
window.addEventListener('blur', () => {
  held.clear();
  fire = false;
  stop();
  request();
});
document.addEventListener('visibilitychange', () => {
  held.clear();
  fire = false;
  stop();
  request();
});
draw();


let controlPort = null;
const nonce = location.hash.slice(1);
window.addEventListener('message', e => {
  if (e.source !== parent || e.data?.type !== 'demo-connect' || e.data.nonce !== nonce ||
    !e.ports[0] || controlPort) return;
  controlPort = e.ports[0];
  document.documentElement.dataset.connected='true';
  presentation(e.data.handheld);
  controlPort.onmessage = message => {
    if(message.data?.type==='presentation'){presentation(message.data.handheld);return;}
    if (message.data?.type !== 'pause') return;
    paused = Boolean(message.data.paused);
    held.clear();
    fire = false;
    stop();
    document.querySelector('[data-pause]').textContent = paused ? 'Resume' : 'Pause';
    document.querySelector('[data-pause]').setAttribute('aria-pressed', String(paused));
    draw();
    request();
  };
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && controlPort) {
    e.preventDefault();
    controlPort.postMessage({
      type: 'exit'
    });
  }
});
presentation(matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0);
if (parent !== window) document.documentElement.dataset.embedded = 'true';
if (parent !== window) parent.postMessage({
  type: 'demo-ready',
  nonce
}, '*');
