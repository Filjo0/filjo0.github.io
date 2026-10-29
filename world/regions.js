// One setting, two seasons. No geographical teleport or position-based climate.
export function createRegions({ready, apply, changed, prepare = async () => {},
  loading = () => {}, reduced = () => false, failed = () => {}}) {
  let region = 'coast', target = region, phase = 'loading', blend = 0, elapsed = 0, from = 0, token = 0;
  let disposed = false;
  ready.then(() => {if (!disposed) {phase = 'settled'; apply(0); changed(region);}}).catch(error => {
    if (!disposed) {phase = 'failed'; failed(error);}
  });
  async function select(next) {
    const version = ++token;
    target = next;
    try {await ready;} catch {return false;}
    if (disposed || version !== token) return false;
    loading(next);
    try {await prepare(next);} catch(error) {
      if(!disposed&&version===token){target=region;phase='failed';failed(error);}
      return false;
    } finally {if(!disposed&&version===token)loading(null);}
    if(disposed||version!==token)return false;
    from = blend;
    elapsed = 0;
    if (reduced() || Math.abs(blend - (next === 'winter' ? 1 : 0)) < .0001) {
      blend = next === 'winter' ? 1 : 0;
      region = next; phase = 'settled'; apply(blend); changed(region);
    } else phase = 'transition';
    return true;
  }
  function step(dt) {
    if (phase !== 'transition') return;
    elapsed += dt;
    const t = Math.min(1, elapsed / 1.8), eased = t * t * (3 - 2 * t);
    blend = from + ((target === 'winter' ? 1 : 0) - from) * eased;
    apply(blend);
    if (t === 1) {region = target; phase = 'settled'; changed(region);}
  }
  function cancel() {
    ++token; loading(null); target=region; blend=region==='winter'?1:0;
    if(phase==='loading')return;
    phase='settled'; apply(blend); changed(region);
  }
  return {select, step, cancel, state: () => ({region, target, phase, blend}),
    toggle: () => select(target === 'winter' ? 'coast' : 'winter'), dispose() {disposed = true; ++token; loading(null);}};
}
