import { MORNING_GRADE } from './scene-lighting.js';
// The scene is authored as a photographic plate. Reuse its decoded texture;
// resizing/readback of the live WebGL buffer made the first approach expensive.
const linear = Array.from({
  length: 256
}, (_, i) => {
  const c = i / 255;
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
});
const encode = c => {
  c = Math.max(0, Math.min(1, c));
  return Math.round(255 * (c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055));
};
export function createPlateSnapshot(uniforms) {
  const cache = new Map();
  const surface = () => {
    const c = document.createElement('canvas');
    c.width = 1672;
    c.height = 941;
    return c;
  };
  const graded = (x, c, w) => x * (1 - w) + (x * MORNING_GRADE.scale[c] + MORNING_GRADE.offset[c]) * w;
  function source(texture, warm) {
    const key = texture.uuid + ':' + warm;
    if (cache.has(key)) return cache.get(key);
    const c = surface(),
      ctx = c.getContext('2d', {
        willReadFrequently: true
      });
    ctx.drawImage(texture.image, 0, 0, 1672, 941);
    if (warm) {
      const p = ctx.getImageData(0, 0, 1672, 941),
        lut = [0, 1, 2].map(channel => linear.map(x => encode(graded(x, channel, warm))));
      for (let i = 0; i < p.data.length; i += 4) for (let j = 0; j < 3; j++) p.data[i + j] = lut[j][p.data[i + j]];
      ctx.putImageData(p, 0, 0);
    }
    cache.set(key, c);
    if (cache.size > 2) {
      const first = cache.keys().next().value;
      cache.get(first).width = 0;
      cache.delete(first);
    }
    return c;
  }
  return {
    capture() {
      const u = uniforms,
        s = u.season.value,
        p = u.lightProgress.value,
        output = surface(),
        ctx = output.getContext('2d');
      const inputs = [{
        t: u.coast.value,
        w: p * (1 - s),
        warm: u.morning.value
      }, {
        t: u.winter.value,
        w: p * s,
        warm: u.morning.value
      }, {
        t: u.oldCoast.value,
        w: (1 - p) * (1 - s),
        warm: u.oldMorning.value
      }, {
        t: u.oldWinter.value,
        w: (1 - p) * s,
        warm: u.oldMorning.value
      }].filter(i => i.w > 0);
      if (inputs.length === 1 && u.darkness.value === 1) {
        ctx.drawImage(source(inputs[0].t, inputs[0].warm), 0, 0);
        return output;
      }
      // Rare mid-light/season gestures preserve the shader's linear-space blend.
      const pixels = inputs.map(i => {
          const c = surface(),
            x = c.getContext('2d', {
              willReadFrequently: true
            });
          x.drawImage(i.t.image, 0, 0, 1672, 941);
          return x.getImageData(0, 0, 1672, 941).data;
        }),
        data = ctx.createImageData(1672, 941);
      for (let i = 0; i < data.data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          let value = 0;
          for (let k = 0; k < inputs.length; k++) value += inputs[k].w * graded(linear[pixels[k][i + j]], j, inputs[k].warm);
          data.data[i + j] = encode(value * u.darkness.value);
        }
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      return output;
    },
    dispose() {
      for (const c of cache.values()) c.width = 0;
      cache.clear();
    }
  };
}
