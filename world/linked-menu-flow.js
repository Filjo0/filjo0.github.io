import { warmAppScreenshots } from './app-preview-cache.js';
import { reducedMotion } from './motion.js';
const NS = 'http://www.w3.org/2000/svg';
const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
function waitFor(test, node, signal) {
  if (test()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const end = error => {
      observer.disconnect();
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      error ? reject(error) : resolve();
    };
    const cancel = () => end(new DOMException('Flow cancelled', 'AbortError'));
    const observer = new MutationObserver(() => {
      if (test()) end();
    });
    observer.observe(node, {
      attributes: true,
      childList: true,
      subtree: true
    });
    const timer = setTimeout(() => end(Error('The close-up did not become ready.')), 8000);
    signal.addEventListener('abort', cancel, {
      once: true
    });
  });
}
export function createLinkedMenuFlow({
  host,
  reader,
  signal,
  prepare,
  capture,
  restore,
  paused,
  open,
  back,
  focusPage,
  layout
}) {
  let phase = 'idle',
    entry = null,
    sheet = null,
    plane = null,
    animations = [],
    run = null,
    serial = 0,
    lastPress = null,
    shield = null,
    planeReady = Promise.resolve(),
    ignoredInputs = 0,
    pendingParent = null,
    backControl = null,
    backAnchor = null;
  let warmStarted = false,
    idle = null,
    paintQueued = false;
  const cancelIdle = () => {
    if (idle !== null) {
      if ('cancelIdleCallback' in window) cancelIdleCallback(idle);else clearTimeout(idle);
      idle = null;
    }
  };
  const idleScene = () => !document.hidden && reader.hidden && host.dataset.sceneReady === 'true' && host.dataset.scenePanning !== 'true' &&
     !['entering', 'mounting', 'returning'].includes(phase);
  function scheduleWarm() {
    if (warmStarted || paintQueued || idle !== null || !idleScene() || signal.aborted) return;
    paintQueued = true;
    frame().then(frame).then(() => {
      paintQueued = false;
      if (warmStarted || !idleScene() || signal.aborted) return;
      host.dataset.linkedWarmState = 'scheduled';
      const warm = () => {
        idle = null;
        if (!idleScene() || signal.aborted) return;
        warmStarted = true;
        const start = performance.now();
        host.dataset.linkedWarmState = 'loading';
        Promise.all([prepare('work'), warmAppScreenshots()]).then(([, count]) => {
          if (signal.aborted) return;
          host.dataset.linkedWarmState = 'ready';
          host.dataset.linkedWarmCount = String(count);
          host.dataset.linkedWarmMs = String(performance.now() - start);
        }).catch(() => {
          if (!signal.aborted) host.dataset.linkedWarmState = 'unavailable';
        });
      };
      idle = 'requestIdleCallback' in window ? requestIdleCallback(warm, {
        timeout: 1200
      }) : setTimeout(warm, 180);
    });
  }
  const idleObserver = new MutationObserver(scheduleWarm);
  idleObserver.observe(host, {
    attributes: true,
    attributeFilter: ['data-scene-ready', 'data-scene-panning']
  });
  idleObserver.observe(reader, {
    attributes: true,
    attributeFilter: ['hidden']
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelIdle();else scheduleWarm();
  }, {
    signal
  });
  signal.addEventListener('abort', () => {
    cancelIdle();
    idleObserver.disconnect();
  }, {
    once: true
  });
  scheduleWarm();
  const setPhase = value => {
    phase = value;
    document.body.dataset.linkedFlowPhase = value;
  };
  const highlight = id => document.dispatchEvent(new CustomEvent('linked-menu-highlight', {
    detail: id || ''
  }));
  const content = reader.querySelector('[data-world-content]');
  const titles = {
    work: 'My apps',
    experience: 'About',
    resume: 'Résumé',
    contact: 'Contact',
    fibonacci: 'Maths',
    books: 'Reading book'
  };
  function blockInput() {
    ignoredInputs = 0;
    shield = document.createElement('div');
    shield.className = 'linked-input-shield';
    shield.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-world-close]')) return;
      ignoredInputs++;
      if (entry) {
        entry.record.ignoredInputs = ignoredInputs;
        publish();
      }
      e.preventDefault();
      e.stopPropagation();
    });
    shield.addEventListener('click', e => {
      if (e.target.closest('[data-world-close]')) return;
      e.preventDefault();
      e.stopPropagation();
    });
    backControl = document.querySelector('[data-world-close]');
    backAnchor = document.createComment('travel-back-control');
    backControl.before(backAnchor);
    backControl.classList.add('linked-cancel');
    if (reader.hidden) {
      backControl.textContent = 'Cancel';
      backControl.setAttribute('aria-label', 'Cancel opening section');
    }
    shield.append(backControl);
    document.body.append(shield);
  }
  const unblock = () => {
    if (backControl) {
      backAnchor?.replaceWith(backControl);
      backControl.classList.remove('linked-cancel');
    }
    backControl = null;
    backAnchor = null;
    shield?.remove();
    shield = null;
  };
  const publish = () => {
    host.dataset.linkedFlowRecord = JSON.stringify(entry?.record || {});
  };
  const matrix = m => 'matrix(' + m.join(',') + ')';
  function clearSheet() {
    delete host.dataset.linkedEndpoint;
    for (const a of animations) a.cancel();
    animations = [];
    sheet?.remove();
    sheet = plane = null;
  }
  function free(e) {
    while (e) {
      e.canvas.width = 0;
      e = e.parent;
    }
  }
  function forget() {
    unblock();
    clearSheet();
    free(entry);
    entry = null;
    pendingParent = null;
    highlight('');
    setPhase('idle');
  }
  const pageReady = id => !reader.hidden && reader.dataset.object === id && !reader.classList.contains('world-object-opening') && (id !== 'resume' ||
     ['ready', 'error'].includes(content.dataset.resumeState));
  const rootOf = e => {
    while (e?.parent) e = e.parent;
    return e;
  };
  const currentHash = id => id ? '#' + id : '#top';
  function restorePage(e, from) {
    content.scrollTop = e.scrollTop || 0;
    const target = from?.opener?.isConnected ? from.opener : from?.returnSelector ? content.querySelector(from.returnSelector) : null;
    if (target) target.focus({
      preventScroll: true
    });else focusPage();
  }
  async function cancel() {
    const token = ++serial;
    run?.abort();
    run = new AbortController();
    const saved = entry;
    clearSheet();
    highlight('');
    if (pendingParent && saved === pendingParent) {
      pendingParent = null;
      unblock();
      setPhase('open');
      focusPage();
      return;
    }
    if (!saved) {
      unblock();
      setPhase('idle');
      return;
    }
    if (saved.parent) {
      entry = saved.parent;
      setPhase('returning');
      open(entry.id, {
        historyChange: false
      });
      history.replaceState({}, '', currentHash(entry.id));
      try {
        await waitFor(() => pageReady(entry.id), reader, run.signal);
      } catch {}
      if (token !== serial) return;
      saved.canvas.width = 0;
      unblock();
      setPhase('open');
      restorePage(entry, saved);
      publish();
    } else {
      back({
        historyChange: false
      });
      history.replaceState({}, '', saved.hash || '#top');
      restore(saved.saved);
      const opener = saved.opener;
      forget();
      opener?.focus({
        preventScroll: true
      });
    }
  }
  function overlay(start) {
    sheet = document.createElement('div');
    sheet.className = 'linked-transition';
    sheet.setAttribute('aria-hidden', 'true');
    plane = document.createElement('div');
    plane.className = 'linked-plane';
    plane.style.transform = matrix(start);
    plane.append(entry.canvas);
    const o = entry.object,
      l = Math.floor(o.left) - 2,
      t = Math.floor(o.top) - 2,
      w = Math.ceil(o.right) - l + 2,
      h = Math.ceil(o.bottom) - t + 2;
    const glow = document.createElement('div');
    glow.className = 'linked-object-glow';
    glow.style.opacity = '0';
    const lift = document.createElement('canvas');
    lift.className = 'linked-laptop-lift';
    lift.width = w;
    lift.height = h;
    Object.assign(lift.style, {
      left: l + 'px',
      top: t + 'px',
      width: w + 'px',
      height: h + 'px'
    });
    const context = lift.getContext('2d');
    context.beginPath();
    for (const ring of [entry.outline, ...entry.holes]) {
      ring.forEach(([u, v], i) => {
        const p = [u * 1672 - l, v * 941 - t];
        i ? context.lineTo(...p) : context.moveTo(...p);
      });
      context.closePath();
    }
    context.clip('evenodd');
    context.filter = 'brightness(1.18)';
    context.drawImage(entry.canvas, l, t, w, h, 0, 0, w, h);
    glow.append(lift);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1672 941');
    const d = entry.outline.map(([u, v], i) => (i ? 'L' : 'M') + u * 1672 + ' ' + v * 941).join(' ') + 'Z';
    for (const kind of ['halo', 'rim']) {
      const path = document.createElementNS(NS, 'path');
      path.classList.add('linked-laptop-' + kind);
      path.setAttribute('d', d);
      svg.append(path);
    }
    glow.append(svg);
    plane.append(glow);
    sheet.append(plane);
    document.body.append(sheet);
  }
  // The glow travels with the object; an off-screen object cannot flash over the coast.
  // Only this short approach owns a frame callback. There is no idle render loop.
  function revealGlow(token) {
    if (token !== serial || !plane || paused() || document.hidden) return;
    const r = plane.querySelector('.linked-laptop-rim').getBoundingClientRect(),
      header = document.querySelector('.world-header').getBoundingClientRect();
    const visible = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top,
       header.bottom));
    if (visible / Math.max(1, r.width * r.height) > .2) {
      plane.querySelector('.linked-object-glow').style.opacity = '1';
      entry.record.glowVisibleAt ??= performance.now();
      publish();
      return;
    }
    requestAnimationFrame(() => revealGlow(token));
  }
  async function animate(node, keyframes, duration) {
    const record = entry?.record,
      a = node.animate(keyframes, {
        duration: reducedMotion() ? 0 : duration,
        easing: 'cubic-bezier(.2,.65,.25,1)',
        fill: 'forwards'
      });
    animations.push(a);
    if (paused()) a.pause();
    if (node === plane) {
      planeReady = a.ready;
      const issued = performance.now();
      a.ready.then(() => {
        if (record) record.animationTiming = {
          issued,
          ready: performance.now(),
          start: a.startTime
        };
      }, () => {});
    }
    await a.finished;
    if (node === plane && record?.animationTiming) record.animationTiming.finished = performance.now();
  }
  const press = e => {
    document.body.dataset.linkedInput = 'pointer';
    const target = e.target.closest?.('.world-dock [data-world-route],[data-scene-object],[data-about-reading]');
    if (target) lastPress = {
      target,
      at: performance.now()
    };
  };
  document.addEventListener('pointerdown', press, {
    capture: true,
    signal
  });
  document.addEventListener('keydown', e => {
    document.body.dataset.linkedInput = 'keyboard';
    if (e.key === 'Enter' || e.key === ' ') lastPress = null;
    if (e.key === 'Escape' && ['entering', 'mounting'].includes(phase)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
    } else if (e.key === 'Escape' && phase === 'returning') {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (['entering', 'mounting', 'returning'].includes(phase) && e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      backControl?.focus({
        preventScroll: true
      });
    } else if (['entering', 'mounting', 'returning'].includes(phase) && ['Enter', ' '].includes(e.key) && e.target !== backControl) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, {
    capture: true,
    signal
  });
  window.addEventListener('resize', () => {
    if (['entering', 'mounting'].includes(phase)) cancel();
  }, {
    signal
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['entering', 'mounting'].includes(phase)) cancel();
  }, {
    signal
  });
  signal.addEventListener('abort', () => {
    ++serial;
    run?.abort();
    forget();
  }, {
    once: true
  });
  const finishMotion = () => {
    if (reducedMotion()) for (const animation of animations) animation.finish();
  };
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', finishMotion, {
    signal
  });
  const motionObserver = new MutationObserver(finishMotion);
  motionObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-motion']
  });
  signal.addEventListener('abort', () => motionObserver.disconnect(), {
    once: true
  });
  setPhase('idle');
  return {
    cancel,
    setPaused(value) {
      for (const animation of animations) {
        if (value && animation.playState === 'running') animation.pause();else if (!value && animation.playState === 'paused') animation.play();
      }
      if (!value && plane) revealGlow(serial);
    },
    busy: () => ['entering', 'mounting', 'returning'].includes(phase),
    opened: () => phase === 'open',
    opening: () => ['entering', 'mounting', 'returning'].includes(phase),
    current: () => entry?.id,
    parentId: () => entry?.parent?.id,
    opener: () => rootOf(entry)?.opener,
    area: () => entry?.area || 'desk',
    backLabel: () => entry?.parent ? titles[entry.parent.id] : entry?.area || 'desk',
    discard() {
      if (phase !== 'idle') {
        ++serial;
        run?.abort();
        forget();
      }
    },
    async enter(id, options = {}) {
      if (!['idle', 'open'].includes(phase)) return;
      const parent = phase === 'open' ? entry : null;
      pendingParent = parent;
      if (parent) {
        parent.scrollTop = content.scrollTop;
      }
      const token = ++serial;
      run = new AbortController();
      setPhase('entering');
      blockInput();
      highlight(id);
      const opener = options.opener || document.activeElement,
        clickAt = performance.now();
      const started = lastPress?.target === opener && clickAt - lastPress.at < 500 ? lastPress.at : clickAt;
      const animated = !reducedMotion() && !paused();
      try {
        cancelIdle();
        const prefetch = Promise.resolve(prepare(id)).then(() => null, error => error);
        if (id === 'work') warmAppScreenshots().catch(() => {});
        await waitFor(() => host.dataset.sceneReady === 'true', host, run.signal);
        const meta = await layout();
        if (token !== serial || signal.aborted) return;
        let snapshot;
        if (parent) {
          const canvas = document.createElement('canvas');
          canvas.width = parent.canvas.width;
          canvas.height = parent.canvas.height;
          canvas.getContext('2d').drawImage(parent.canvas, 0, 0);
          snapshot = {
            ...parent,
            canvas
          };
        } else snapshot = capture();
        const m = meta.targets[id],
          plate = JSON.parse(host.querySelector('canvas').dataset.worldState).lighting.files[document.body.dataset.worldRegion];
        const target = m.outline_variants?.[plate] || m;
        const xs = target.outline.map(p => p[0] * 1672),
          ys = target.outline.map(p => p[1] * 941);
        const object = {
          left: Math.min(...xs),
          right: Math.max(...xs),
          top: Math.min(...ys),
          bottom: Math.max(...ys)
        };
        const naturalCentre = [(object.left + object.right) / 2, (object.top + object.bottom) / 2];
        const c = snapshot.crop,
          w = snapshot.width,
          h = snapshot.height,
          fw = c.fullWidth,
          fh = c.fullHeight;
        const header = document.querySelector('.world-header').getBoundingClientRect(),
          dock = document.querySelector('.world-dock').getBoundingClientRect();
        const centre = [w / 2, (header.bottom + (dock.top > header.bottom ? dock.top : h)) / 2];
        const desired = w * (w < 720 ? .44 : .40) / (object.right - object.left);
        const centred = Math.max(desired, centre[0] / naturalCentre[0], (w - centre[0]) / (1672 - naturalCentre[0]), centre[1] / naturalCentre[1],
           (h - centre[1]) / (941 - naturalCentre[1]));
        // Book objects touch the authored image edge: a centred full-bleed approach
        // must grow past 44%, rather than silently clamping back towards the laptop.
        const scale = ['work', 'books', 'fibonacci'].includes(id) ? centred : Math.max(w / 1672, h / 941, Math.min(centred, w * .65 / (object.right -
           object.left)));
        const left = Math.max(0, Math.min(1672 * scale - w, naturalCentre[0] * scale - centre[0])),
          top = Math.max(0, Math.min(941 * scale - h, naturalCentre[1] * scale - centre[1]));
        const from = parent ? parent.to : [fw / 1672, 0, 0, fh / 941, -c.offsetX, -c.offsetY];
        const initial = {
          left: object.left * from[0] + from[4],
          right: object.right * from[0] + from[4]
        };
        const offscreen = initial.right < 0 || initial.left > w;
        const returnSelector = opener?.matches('[data-about-reading]') ? '[data-about-reading]' : opener?.dataset.worldRoute ? '[data-world-route="' +
           opener.dataset.worldRoute + '"]' : null;
        entry = {
          ...snapshot,
          id,
          parent,
          opener,
          returnSelector,
          hash: parent ? parent.hash : location.hash,
          options,
          animated,
          outline: target.outline,
          holes: target.outline_holes || [],
          object,
          from,
          to: [scale, 0, 0, scale, -left, -top],
          record: {
            id,
            plannedMs: snapshot.area === 'coast' || offscreen || parent ? 900 : 650,
            source: parent ? 'page:' + parent.id : snapshot.area,
            input: opener?.dataset.sceneObject ? 'object' : parent ? 'page' : 'menu',
            animated,
            started,
            clickAt,
            openCalls: 0,
            ignoredInputs,
            targetCentre: centre,
            initialLaptopWidth: (object.right - object.left) * from[0],
            framedWidth: (object.right - object.left) * scale
          }
        };
        pendingParent = null;
        publish();
        await frame();
        await sleep(started + 110 - performance.now());
        if (token !== serial) return;
        let approach = Promise.resolve();
        if (animated) {
          overlay(entry.from);
          if (parent) await animate(sheet, [{
            opacity: 0
          }, {
            opacity: 1
          }], 60);
          const duration = Math.max(240, started + entry.record.plannedMs - 180 - performance.now());
          entry.record.approachMs = duration;
          approach = animate(plane, [{
            transform: matrix(entry.from)
          }, {
            transform: matrix(entry.to)
          }], duration);
          approach.catch(() => {});
          revealGlow(token);
          // Start the compositor before mounting real content behind it.
          await planeReady;
        }
        if (token !== serial) return;
        setPhase('mounting');
        entry.record.navigateAt = performance.now();
        entry.record.openCalls++;
        publish();
        open(id, {
          ...options,
          opener
        });
        entry.record.mountReturnedAt = performance.now();
        await Promise.all([approach, waitFor(() => pageReady(id), reader, run.signal)]);
        const preparationError = await prefetch;
        if (preparationError) throw preparationError;
        if (token !== serial) return;
        entry.record.contentReadyAt = performance.now();
        entry.record.plateTiming = host.dataset.linkedPlateTiming ? JSON.parse(host.dataset.linkedPlateTiming) : null;
        if (animated) {
          const r = plane.querySelector('.linked-laptop-rim').getBoundingClientRect(),
            cover = plane.getBoundingClientRect();
          entry.record.endpoint = {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            centre: [r.x + r.width / 2, r.y + r.height / 2],
            screenWidth: host.clientWidth,
            cover: {
              left: cover.left,
              top: cover.top,
              right: cover.right,
              bottom: cover.bottom
            }
          };
          host.dataset.linkedEndpoint = 'holding';
          publish();
          await sleep(Math.max(50, started + entry.record.plannedMs - 110 - performance.now()));
          delete host.dataset.linkedEndpoint;
        }
        if (animated) await animate(sheet, [{
          opacity: 1
        }, {
          opacity: 0
        }], Math.max(70, Math.min(110, started + entry.record.plannedMs - performance.now())));
        if (token !== serial) return;
        clearSheet();
        unblock();
        highlight('');
        setPhase('open');
        focusPage();
        entry.record.openedAt = performance.now();
        entry.record.totalMs = entry.record.openedAt - started;
        publish();
        document.dispatchEvent(new CustomEvent('linked-menu-measure', {
          detail: entry.record
        }));
      } catch (error) {
        if (token === serial) {
          console.warn('[linked-menu]', error);
          cancel();
        }
      }
    },
    async leave(options = {}) {
      if (phase !== 'open') return;
      const token = ++serial;
      run = new AbortController();
      setPhase('returning');
      blockInput();
      const leaving = entry;
      const animated = entry.animated && !reducedMotion() && !paused() && entry.width === host.clientWidth && entry.height === host.clientHeight;
      try {
        if (animated) {
          overlay(entry.to);
          revealGlow(token);
          await animate(sheet, [{
            opacity: 0
          }, {
            opacity: 1
          }], 60);
        }
        if (token !== serial) return;
        if (leaving.parent) {
          entry = leaving.parent;
          open(entry.id, {
            ...options,
            opener: entry.opener
          });
          await waitFor(() => pageReady(entry.id), reader, run.signal);
        } else {
          back(options);
          restore(leaving.saved);
        }
        if (animated) {
          await animate(plane, [{
            transform: matrix(leaving.to)
          }, {
            transform: matrix(leaving.from)
          }], leaving.parent || leaving.area === 'coast' ? 720 : 380);
          await animate(sheet, [{
            opacity: 1
          }, {
            opacity: 0
          }], 60);
        }
        if (token !== serial) return;
        clearSheet();
        unblock();
        highlight('');
        if (leaving.parent) {
          leaving.canvas.width = 0;
          setPhase('open');
          restorePage(entry, leaving);
          publish();
        } else {
          leaving.record.returnedAt = performance.now();
          publish();
          const opener = leaving.opener;
          forget();
          opener?.focus({
            preventScroll: true
          });
        }
      } catch (error) {
        if (token === serial) {
          console.warn('[linked-menu:return]', error);
          cancel();
        }
      }
    }
  };
}
