(() => {
  const menuButton = document.querySelector('[data-menu-button]');
  const menu = document.querySelector('[data-site-links]');

  const closeMenu = () => {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menu.dataset.open = 'false';
    document.body.dataset.menuOpen = 'false';
  };

  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menu.dataset.open = String(!isOpen);
      document.body.dataset.menuOpen = String(!isOpen);
    });

    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menuButton.focus();
      }
    });

    window.matchMedia('(min-width: 721px)').addEventListener('change', (event) => {
      if (event.matches) closeMenu();
    });
  }

  const studio = document.querySelector('[data-studio]');
  const stage = document.querySelector('[data-studio-stage]');
  const view = document.querySelector('[data-studio-view]');
  const motionButton = document.querySelector('[data-studio-motion]');

  if (studio && stage && view && motionButton) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopPointer = window.matchMedia('(min-width: 1101px) and (pointer: fine)');
    const mobile = window.matchMedia('(max-width: 1100px)');
    let manuallyPaused = false;
    let inView = true;
    let frame = 0;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;

    const paused = () => manuallyPaused || reducedMotion.matches;
    const canMove = () => !paused() && desktopPointer.matches && inView && !document.hidden && document.body.dataset.studioModal !== 'true';

    const resetCamera = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      x = y = targetX = targetY = 0;
      stage.style.setProperty('--scene-x', '0px');
      stage.style.setProperty('--scene-y', '0px');
    };

    const animateCamera = () => {
      frame = 0;
      if (!canMove()) return;
      x += (targetX - x) * 0.09;
      y += (targetY - y) * 0.09;
      stage.style.setProperty('--scene-x', `${x.toFixed(2)}px`);
      stage.style.setProperty('--scene-y', `${y.toFixed(2)}px`);
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.05) {
        frame = requestAnimationFrame(animateCamera);
      }
    };

    const queueCamera = () => {
      if (!frame && canMove()) frame = requestAnimationFrame(animateCamera);
    };

    studio.addEventListener('pointermove', (event) => {
      if (!canMove() || event.pointerType !== 'mouse') return;
      const bounds = view.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * -18;
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * -12;
      queueCamera();
    });

    studio.addEventListener('pointerleave', () => {
      targetX = targetY = 0;
      queueCamera();
    });

    const updateMotion = () => {
      studio.dataset.motionPaused = String(paused());
      motionButton.setAttribute('aria-pressed', String(paused()));
      motionButton.textContent = paused() ? 'Resume motion ▷' : 'Pause motion Ⅱ';
      motionButton.disabled = reducedMotion.matches;
      motionButton.hidden = reducedMotion.matches;
      resetCamera();
    };

    motionButton.addEventListener('click', () => {
      manuallyPaused = !manuallyPaused;
      updateMotion();
    });
    reducedMotion.addEventListener('change', updateMotion);
    desktopPointer.addEventListener('change', resetCamera);
    document.addEventListener('visibilitychange', resetCamera);
    updateMotion();

    // Center the swipeable room once per mobile entry; never interrupt a swipe.
    const centerRoom = () => {
      if (mobile.matches) view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2;
      else view.scrollLeft = 0;
    };
    mobile.addEventListener('change', centerRoom);
    centerRoom();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (!inView) resetCamera();
      }).observe(studio);
    }

    document.querySelectorAll('[data-studio-open]').forEach((link) => {
      const dialog = document.getElementById(link.dataset.studioOpen);
      if (!dialog || typeof dialog.showModal !== 'function') return;
      link.addEventListener('click', (event) => {
        // Preserve new-tab and modified-link behavior.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        closeMenu();
        resetCamera();
        dialog.showModal();
        dialog.scrollTop = 0;
        document.body.dataset.studioModal = 'true';
      });
    });

    document.querySelectorAll('.studio-dialog').forEach((dialog) => {
      const close = () => dialog.close();
      dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const links = dialog.querySelectorAll('button:not(:disabled), a[href]');
        const first = links[0];
        const last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      dialog.querySelector('[data-studio-close]').addEventListener('click', close);
      dialog.querySelectorAll('[data-studio-detail]').forEach((link) => link.addEventListener('click', close));
      dialog.addEventListener('close', () => { document.body.dataset.studioModal = 'false'; });
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      });
    });
  }

  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const printButton = document.querySelector('[data-print-resume]');
  if (printButton) printButton.addEventListener('click', () => window.print());
})();
