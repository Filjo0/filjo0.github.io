(() => {
  document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
  const printButton = document.querySelector('[data-print-resume]');
  if (printButton) {
    printButton.hidden = false;
    printButton.addEventListener('click', () => window.print());
  }
  if (window.parent !== window && new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.dataset.resumeEmbedded = 'true';
    document.querySelectorAll('a[href^="https:"]').forEach(link => { link.target = '_blank'; link.rel = 'noopener'; });
  }
})();
