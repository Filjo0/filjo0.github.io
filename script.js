(() => {
  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
  document.querySelector('[data-print-resume]')?.addEventListener('click', () => window.print());
  if (window.parent !== window && new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.dataset.resumeEmbedded = 'true';
    document.querySelectorAll('a[href^="https:"]').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener';
    });
  }

  const studio = document.querySelector('[data-studio]');
  if (!studio) return;
  const find = (name) => document.querySelector(`[data-${name}]`);
  const view = find('studio-view');
  const stage = find('studio-stage');
  const fallback = find('studio-fallback');
  const viewpoint = find('viewpoint');
  const viewpointImage = find('viewpoint-image');
  const reader = find('scene-reader');
  const readerBody = find('reader-body');
  const content = find('scene-content');
  const title = find('scene-title');
  const tools = find('scene-tools');
  const toggle = find('reader-toggle');
  const motionButton = find('studio-motion');
  const resumeView = find('resume-view');
  const resumeFrame = find('resume-frame');
  const resumeStatus = find('resume-status');
  const resumeRetry = find('resume-retry');
  if (![view, stage, fallback, viewpoint, viewpointImage, reader, readerBody, content,
    title, tools, toggle, motionButton, resumeView, resumeFrame, resumeStatus, resumeRetry].every(Boolean)
    || !window.ResizeObserver || !stage.animate) return;

  const routes = {
    work: { title: 'Work', object: 'At the desk', text: 'Products, from idea to release.', sections: ['work'], x: 0.205, y: 0.395, scale: 2.35 },
    experience: { title: 'Experience', object: 'At the notebook', text: 'The work behind the products.', sections: ['experience', 'capabilities', 'resume'], x: 0.502, y: 0.625, scale: 2.45 },
    resume: { title: 'Resume', object: 'At the wall print', text: 'The full picture.', sections: [], x: 0.905, y: 0.25, scale: 2.5 },
    contact: { title: 'Contact', object: 'At the phone', text: 'Start a conversation.', sections: ['contact'], x: 0.798, y: 0.585, scale: 2.7 },
  };
  const order = ['overview', ...Object.keys(routes)];
  const labels = { overview: 'Room', ...Object.fromEntries(Object.entries(routes).map(([key, route]) => [key, route.title])) };
  const records = new Map();
  for (const route of Object.values(routes)) {
    for (const id of route.sections) {
      const node = document.getElementById(id);
      if (!node) return;
      records.set(id, { node, placeholder: document.createComment(`Source: ${id}`) });
    }
  }
  const links = [...document.querySelectorAll('[data-studio-route]')];
  const points = [...stage.querySelectorAll('.studio-point')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 1100px)');
  const finePointer = matchMedia('(pointer: fine)');
  const scrollPositions = new Map();
  const imageLoads = new Map();
  const previousScrollRestoration = history.scrollRestoration;
  let ready = false;
  let active = 'overview';
  let previousMobile = null;
  let opener = null;
  let pausedByUser = false;
  let travelling = false;
  let version = 0;
  let animations = [];
  let visibilityFrame = 0;
  let resumeRequested = false;
  let resumeTimer = 0;
  const isPaused = () => pausedByUser || reducedMotion.matches;

  const restoreSections = () => {
    for (const { node, placeholder } of records.values()) {
      if (placeholder.parentNode) placeholder.after(node);
    }
  };
  const updateVisibility = () => {
    visibilityFrame = 0;
    const bounds = view.getBoundingClientRect();
    const inside = (rect) => rect.left >= bounds.left + 6 && rect.right <= bounds.right - 6
      && rect.top >= bounds.top + 6 && rect.bottom <= bounds.bottom - 6;
    for (const point of points) {
      const inView = active === 'overview' && !travelling && inside(point.querySelector('.studio-marker').getBoundingClientRect());
      point.dataset.inView = String(inView);
      point.dataset.labelVisible = String(inView && inside(point.querySelector('.studio-label').getBoundingClientRect()));
      point.tabIndex = inView ? 0 : -1;
    }
  };
  const queueVisibility = () => {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(updateVisibility);
  };
  const cameraTransform = (destination) => {
    if (destination === 'overview') return 'translate(0px, 0px) scale(1)';
    const route = routes[destination];
    const scale = mobile.matches ? 1.9 : route.scale;
    // Place the approached object in the visible left half, beside the reading area.
    const stageCenter = stage.offsetLeft + stage.offsetWidth / 2 - view.scrollLeft;
    const targetX = view.clientWidth * (mobile.matches ? 0.5 : 0.3);
    const x = targetX - stageCenter - (route.x - 0.5) * stage.offsetWidth * scale;
    const y = (0.5 - route.y) * stage.offsetHeight * scale;
    return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale})`;
  };
  const layoutStage = () => {
    const oldRange = view.scrollWidth - view.clientWidth;
    const fraction = previousMobile && oldRange > 0 ? view.scrollLeft / oldRange : 0.5;
    const width = mobile.matches ? Math.max(view.clientWidth, view.clientHeight * 1672 / 941)
      : Math.min(view.clientWidth, view.clientHeight * 1672 / 941);
    stage.style.setProperty('--stage-width', `${Math.max(1, width)}px`);
    view.scrollLeft = mobile.matches ? Math.max(0, stage.offsetWidth - view.clientWidth) * fraction : 0;
    previousMobile = mobile.matches;
    if (!travelling) stage.style.transform = cameraTransform(active);
    queueVisibility();
  };
  const stopAnimations = () => {
    const transform = getComputedStyle(stage).transform;
    const opacity = getComputedStyle(viewpoint).opacity;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    stage.style.transform = transform;
    viewpoint.style.opacity = opacity;
  };
  const animate = async (node, frames, duration, delay = 0) => {
    if (isPaused()) {
      Object.assign(node.style, frames[frames.length - 1]);
      return;
    }
    const animation = node.animate(frames, { duration, delay, easing: 'cubic-bezier(.22,.65,.22,1)', fill: 'both' });
    animations.push(animation);
    try {
      await animation.finished;
      Object.assign(node.style, frames[frames.length - 1]);
      animation.cancel();
    } catch { /* A newer destination or motion preference cancelled this journey. */ }
  };
  const loadViewpoint = (destination) => {
    if (!imageLoads.has(destination)) {
      imageLoads.set(destination, new Promise((resolve) => {
        const image = new Image();
        const timer = setTimeout(() => resolve(null), 5000);
        image.onload = () => { clearTimeout(timer); resolve(image); };
        image.onerror = () => { clearTimeout(timer); resolve(null); };
        image.src = `assets/studio-${destination}.webp`;
      }));
    }
    return imageLoads.get(destination);
  };
  const setReaderVisible = (visible) => {
    reader.hidden = !visible || active === 'overview' || travelling;
    studio.dataset.reading = String(visible && active !== 'overview');
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.innerHTML = visible ? 'Look around <span aria-hidden="true">↗</span>'
      : `Read ${labels[active].toLowerCase()} <span aria-hidden="true">↙</span>`;
  };
  const updateControls = () => {
    const index = order.indexOf(active);
    const previous = order[(index + order.length - 1) % order.length];
    const next = order[(index + 1) % order.length];
    find('scene-previous').setAttribute('aria-label', `Previous view: ${labels[previous]}`);
    find('scene-next').setAttribute('aria-label', `Next view: ${labels[next]}`);
    find('previous-label').textContent = labels[previous];
    find('next-label').textContent = labels[next];
    find('scene-number').textContent = `0${index} / 04`;
    find('scene-caption-title').textContent = active === 'overview' ? 'The studio' : routes[active].object;
    find('scene-caption-text').textContent = active === 'overview' ? 'Choose an object. Take a closer look.' : routes[active].text;
    links.forEach((link) => {
      if (link.dataset.studioRoute === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    tools.hidden = active === 'overview';
  };
  const travel = async (destination, trigger, immediate = false) => {
    if (!ready || !order.includes(destination) || (active === destination && !immediate)) return;
    const currentVersion = ++version;
    const from = active;
    if (from !== 'overview') scrollPositions.set(from, readerBody.scrollTop);
    if (from === 'overview' && trigger) opener = trigger;
    stopAnimations();
    travelling = true;
    active = destination;
    studio.dataset.destination = destination;
    studio.dataset.travelling = 'true';
    reader.hidden = true;
    updateControls();
    updateVisibility();
    // Each section remains a single DOM node; only its owner changes.
    restoreSections();
    content.replaceChildren();
    resumeView.hidden = destination !== 'resume';
    readerBody.dataset.resume = String(destination === 'resume');
    if (destination !== 'overview') {
      const route = routes[destination];
      title.textContent = route.title;
      find('scene-kicker').textContent = route.object;
      route.sections.forEach((id) => content.append(records.get(id).node));
      if (destination === 'resume' && !resumeRequested) loadResume();
    }
    const target = cameraTransform(destination);
    const imagePromise = destination === 'overview' ? Promise.resolve(null) : loadViewpoint(destination);
    const duration = immediate || isPaused() ? 0 : 780;
    const camera = animate(stage, [{ transform: getComputedStyle(stage).transform }, { transform: target }], duration);
    await animate(viewpoint, [{ opacity: getComputedStyle(viewpoint).opacity }, { opacity: '0' }], duration ? 220 : 0);
    if (version !== currentVersion) return;
    studio.dataset.reading = String(destination !== 'overview');
    const image = await imagePromise;
    if (version !== currentVersion) return;
    if (image) {
      viewpointImage.src = image.src;
      viewpoint.hidden = false;
      // Crossfade near the end of the move, after approaching the original object.
      await camera;
      if (version !== currentVersion) return;
      await animate(viewpoint, [{ opacity: '0', transform: 'scale(1.06)' }, { opacity: '1', transform: 'scale(1)' }], duration ? 380 : 0);
    } else {
      await camera;
      if (version !== currentVersion) return;
      viewpoint.hidden = true;
    }
    if (version !== currentVersion) return;
    animations = [];
    travelling = false;
    stage.style.transform = cameraTransform(destination);
    setReaderVisible(destination !== 'overview');
    readerBody.scrollTop = scrollPositions.get(destination) || 0;
    // WebKit can defer native fragment scrolling until the reader becomes visible.
    // Restore after that layout frame, before declaring the journey settled.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (version !== currentVersion) return;
    readerBody.scrollTop = scrollPositions.get(destination) || 0;
    studio.dataset.travelling = 'false';
    find('scene-announcement').textContent = destination === 'overview' ? 'Room overview. Choose an object to explore.' : `${labels[destination]}. ${routes[destination].object}.`;
    updateVisibility();
    if (trigger && (document.activeElement === trigger || document.activeElement === document.body)) {
      if (destination === 'overview') {
        const target = opener?.isConnected && getComputedStyle(opener).visibility !== 'hidden' ? opener : find('studio-home');
        target?.focus({ preventScroll: true });
      } else title.focus({ preventScroll: true });
    }
  };
  const navigate = (destination, trigger) => {
    if (!order.includes(destination)) return;
    const hash = destination === 'overview' ? '' : `#${destination}`;
    if (location.hash !== hash) history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
    travel(destination, trigger);
  };
  const fromHash = () => {
    const hash = location.hash.slice(1);
    return hash === 'capabilities' ? 'experience' : Object.hasOwn(routes, hash) ? hash : 'overview';
  };
  const handleKeys = (event) => {
    if (!ready || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Escape' && active !== 'overview') {
      event.preventDefault();
      navigate('overview', document.activeElement);
    }
    // Arrow browsing is available on the scene; do not hijack reading or form controls.
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.closest('a,button,input,textarea,select,summary,[data-scene-reader]')) return;
    event.preventDefault();
    const offset = event.key === 'ArrowLeft' ? -1 : 1;
    navigate(order[(order.indexOf(active) + offset + order.length) % order.length]);
  };
  const failResume = () => {
    clearTimeout(resumeTimer);
    resumeFrame.hidden = true;
    resumeStatus.hidden = false;
    resumeStatus.textContent = 'The resume could not load. You can download the PDF or open the standalone resume.';
    resumeRetry.hidden = false;
    resumeView.dataset.state = 'error';
  };
  const loadResume = () => {
    resumeRequested = true;
    resumeView.dataset.state = 'loading';
    resumeStatus.hidden = false;
    resumeStatus.textContent = 'Loading resume…';
    resumeRetry.hidden = true;
    resumeFrame.hidden = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(failResume, 12000);
    // A frame navigation must not create another joint browser history entry.
    resumeFrame.contentWindow.location.replace(new URL('resume.html?embed=1', location.href).href);
  };
  resumeFrame.addEventListener('load', () => {
    if (!resumeRequested) return;
    try {
      const frameDocument = resumeFrame.contentDocument;
      if (!frameDocument?.querySelector('.page')) return failResume();
      clearTimeout(resumeTimer);
      frameDocument.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); navigate('overview', resumeFrame); }
      });
      resumeFrame.hidden = false;
      resumeStatus.hidden = true;
      resumeRetry.hidden = true;
      resumeView.dataset.state = 'ready';
    } catch { failResume(); }
  });
  resumeFrame.addEventListener('error', failResume);
  resumeRetry.addEventListener('click', loadResume);

  const updateMotion = () => {
    document.body.dataset.motionPaused = String(isPaused());
    motionButton.hidden = false;
    motionButton.disabled = reducedMotion.matches;
    motionButton.setAttribute('aria-pressed', String(isPaused()));
    const label = reducedMotion.matches ? 'Motion off: system preference' : isPaused() ? 'Resume motion' : 'Pause motion';
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    find('motion-label').textContent = isPaused() ? 'Motion off' : 'Pause motion';
    find('motion-icon').textContent = isPaused() ? '▷' : 'Ⅱ';
    if (travelling) travel(active, null, true);
    else stage.style.transform = cameraTransform(active);
  };
  document.addEventListener('click', (event) => {
    if (!ready || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[data-studio-route], a[data-studio-home]');
    if (!link) return;
    event.preventDefault();
    navigate(link.hasAttribute('data-studio-home') ? 'overview' : link.dataset.studioRoute, link);
  });
  toggle.addEventListener('click', () => setReaderVisible(toggle.getAttribute('aria-expanded') !== 'true'));
  for (const [attribute, offset] of [['scene-previous', -1], ['scene-next', 1]]) {
    find(attribute).addEventListener('click', (event) => navigate(order[(order.indexOf(active) + offset + order.length) % order.length], event.currentTarget));
  }
  document.addEventListener('keydown', handleKeys);
  window.addEventListener('popstate', () => travel(fromHash()));
  window.addEventListener('hashchange', () => travel(fromHash()));
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      if (!ready) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
        return;
      }
      window.scrollTo(0, 0);
      readerBody.scrollTop = scrollPositions.get(active) || 0;
    });
  }, { once: true });
  motionButton.addEventListener('click', () => { pausedByUser = !pausedByUser; updateMotion(); });
  reducedMotion.addEventListener('change', updateMotion);
  view.addEventListener('scroll', queueVisibility, { passive: true });
  view.addEventListener('pointermove', (event) => {
    if (active !== 'overview' || travelling || isPaused() || mobile.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
    const bounds = view.getBoundingClientRect();
    stage.style.transform = `translate(${((event.clientX - bounds.left) / bounds.width - 0.5) * -10}px, ${((event.clientY - bounds.top) / bounds.height - 0.5) * -6}px)`;
    queueVisibility();
  });
  view.addEventListener('pointerleave', () => {
    if (active === 'overview' && !travelling) stage.style.transform = cameraTransform(active);
  });
  try {
    for (const { node, placeholder } of records.values()) node.before(placeholder);
    ready = true;
    history.scrollRestoration = 'manual';
    document.body.dataset.studioReady = 'true';
    fallback.hidden = true;
    studio.dataset.destination = 'overview';
    studio.dataset.travelling = 'false';
    find('scene-arrows').hidden = false;
    find('scene-caption').hidden = false;
    updateMotion();
    updateControls();
    new ResizeObserver(layoutStage).observe(view);
    layoutStage();
    if (fromHash() !== 'overview') travel(fromHash(), null, true);
  } catch {
    ready = false;
    history.scrollRestoration = previousScrollRestoration;
    stopAnimations();
    restoreSections();
    fallback.hidden = false;
    reader.hidden = true;
    viewpoint.hidden = true;
    tools.hidden = true;
    find('scene-arrows').hidden = true;
    find('scene-caption').hidden = true;
    delete document.body.dataset.studioReady;
  }
})();
