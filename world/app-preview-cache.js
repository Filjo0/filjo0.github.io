// Local public captures only. Warm after the scene paints; reuse the decoded
// image elements when the app cards mount, including on no-store dev previews.
let captures = null,
  treadfront = null;
const images = new Map();
function json(file) {
  return fetch(new URL('../assets/previews/' + file, import.meta.url)).then(r => {
    if (!r.ok) throw Error('Capture unavailable');
    return r.json();
  });
}
export function appCaptures() {
  if (!captures) captures = json('previews.json').catch(e => {
    captures = null;
    throw e;
  });
  return captures;
}
export function treadfrontCapture() {
  if (!treadfront) treadfront = json('treadfront-card.json').catch(e => {
    treadfront = null;
    throw e;
  });
  return treadfront;
}
export function captureImage(file) {
  const url = new URL(file, document.baseURI).href;
  if (!images.has(url)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = file;
    images.set(url, image);
  }
  return images.get(url);
}
export async function warmAppScreenshots() {
  const [apps, tank] = await Promise.all([appCaptures(), treadfrontCapture()]);
  const screens = [...apps.projects.futsl.screens.slice(0, 2), ...apps.projects.aqua.screens.slice(0, 2), tank];
  await Promise.all(screens.map(async capture => {
    const image = captureImage(capture.image);
    try {
      await image.decode();
    } catch (error) {
      images.delete(image.src);
      throw error;
    }
  }));
  return screens.length;
}
