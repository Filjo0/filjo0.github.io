// Opaque-origin frame. A dedicated MessagePort is the only control channel.
export function createDemo({
  onPause,
  onClose,
  onScreen = () => false
}) {
  let dialog = null,
    port = null,
    launcher = null,
    paused = false,
    handheld = false;
  let restoreScreen=()=>{},
    detach = () => {},
    lastClosed = -Infinity;

  function close() {
    if (!dialog) return;
    detach();
    port?.close();
    port = null;
    lastClosed = performance.now();
    dialog.remove();
    dialog = null;
    handheld=false;onScreen(false);
    restoreScreen();restoreScreen=()=>{};
    onClose();
    launcher?.focus({
      preventScroll: true
    });
  }
  return {
    close,
    setHandheld(value) {
      value=Boolean(value);if(value===handheld)return;handheld=value;
      port?.postMessage({type:'presentation',handheld});
    },
    handlesEscape() {
      return !!dialog || performance.now() - lastClosed < 150;
    },
    pause(value) {
      port?.postMessage({
        type: 'pause',
        paused: value
      });
    },
    open(trigger = document.activeElement, surface = null) {
      close();
      paused = false;
      launcher = trigger;
      const nonce = crypto.randomUUID();
      dialog = document.createElement(surface?'section':'dialog');
      dialog.className = 'world-demo'+(surface?' world-demo-in-screen':'');
      dialog.setAttribute('aria-label', 'Treadfront one-sector demo');
      dialog.innerHTML =
        `<header><button type="button" data-demo-close>Back to tank station</button>
        <span>Treadfront · One sector</span><button type="button" data-demo-pause>Pause</button></header>
        <iframe class="tank-frame" title="Treadfront one-sector playable demo" sandbox="allow-scripts"></iframe>`;
      dialog.querySelector('[data-demo-close]').textContent = launcher?.closest('[data-world-section="work"], .workspace-launcher') ?
        'Back to apps' : 'Back to tank station';
      const iframe = dialog.querySelector('iframe');
      iframe.src = `demo/treadfront/index.html#${nonce}`;

      function handshake(e) {
        if (e.source !== iframe.contentWindow || e.origin !== 'null' || e.data?.type !== 'demo-ready' ||
          e.data.nonce !== nonce || port) return;
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = message => {
          if (message.data?.type === 'exit') close();
          if (message.data?.type === 'pause-state' && dialog) {
            paused = Boolean(message.data.paused);
            dialog.querySelector('[data-demo-pause]').textContent = paused ? 'Resume' : 'Pause';
          }
        };
        iframe.contentWindow.postMessage({
          type: 'demo-connect',
          nonce,
          handheld
        }, '*', [channel.port2]);
      }
      window.addEventListener('message', handshake);
      detach = () => window.removeEventListener('message', handshake);
      dialog.querySelector('[data-demo-close]').addEventListener('click', close);
      dialog.querySelector('[data-demo-pause]').addEventListener('click', e => {
        paused = !paused;
        port?.postMessage({
          type: 'pause',
          paused
        });
        e.currentTarget.textContent = paused ? 'Resume' : 'Pause';
      });
      dialog.addEventListener('cancel', e => {
        e.preventDefault();
        close();
      });
      if(surface){
        const scrollTop=surface.scrollTop;
        const nodes=[...surface.children].map(node=>({node,hidden:node.hidden,inert:node.inert}));
        nodes.forEach(({node})=>{node.hidden=true;node.inert=true;});
        surface.append(dialog);
        restoreScreen=()=>{
          nodes.forEach(({node,hidden,inert})=>{node.hidden=hidden;node.inert=inert;});surface.scrollTop=scrollTop;
        };
      } else {document.body.append(dialog);dialog.showModal();}
      handheld=Boolean(onScreen(Boolean(surface)))||!surface&&
        (innerWidth<720||innerHeight<500||matchMedia('(pointer: coarse)').matches);
      onPause(true);
      (handheld&&surface?iframe:dialog.querySelector('[data-demo-close]')).focus();
    }
  };
}
