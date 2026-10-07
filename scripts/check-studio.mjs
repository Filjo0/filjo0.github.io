import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => {
  throw new Error('Use development Playwright tooling; PLAYWRIGHT_MODULE can point to its index.mjs file URL.');
});
const browserName = process.env.STUDIO_BROWSER || 'chromium';
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'validation-artifacts', browserName);
await mkdir(artifacts, { recursive: true });
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) throw new Error('Outside project');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}`;
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions += 1; };
let browser;
try {
  browser = await playwright[browserName].launch({ headless: true, ...(process.env.STUDIO_BROWSER_EXECUTABLE ? { executablePath: process.env.STUDIO_BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const settled = (destination) => page.waitForFunction((expected) => {
    const scene = document.querySelector('[data-studio]');
    return scene.dataset.destination === expected && scene.dataset.travelling === 'false';
  }, destination);
  const open = async (destination) => {
    await page.locator(`.studio-dock [data-studio-route="${destination}"]`).click();
    await settled(destination);
  };
  const home = async () => { await page.goto(url); await settled('overview'); };
  const uniqueIds = async () => check(await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
    return new Set(ids).size === ids.length;
  }), 'Canonical sections retain unique IDs');
  const noOverflow = async () => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1 && document.querySelector('[data-studio]').scrollTop === 0), 'Enhanced room fits the viewport');
  const screenshot = (name) => page.screenshot({ path: resolve(artifacts, `${name}.png`) });
  await home();
  check(await page.locator('dialog,[role="dialog"]').count() === 0, 'Room navigation has no dialogs');
  check(await page.locator('[data-studio-fallback]').isHidden(), 'Ordinary page does not duplicate the enhanced scene');
  await noOverflow();
  await screenshot('overview');
  const before = await page.locator('[data-studio-stage]').evaluate((node) => getComputedStyle(node).transform);
  await page.locator('.studio-point-work').click();
  await page.waitForTimeout(140);
  const during = await page.locator('[data-studio-stage]').evaluate((node) => getComputedStyle(node).transform);
  check(before !== during, 'Clicking an object actually changes the camera transform');
  check(await page.locator('[data-scene-reader]').isHidden(), 'Camera travel precedes reading content');
  await settled('work');
  check(page.url().endsWith('#work'), 'Scene has a shareable route');
  check((await page.locator('[data-viewpoint-image]').getAttribute('src')).endsWith('studio-work.webp'), 'Desk uses its own closer viewpoint');
  check(await page.locator('[data-scene-content] #work').isVisible(), 'Live project content belongs to the desk');
  check(await page.locator('[data-scene-title]').evaluate((node) => document.activeElement === node), 'Destination is announced through heading focus');
  await uniqueIds();
  await screenshot('work');
  await page.locator('[data-reader-toggle]').click();
  check(await page.locator('[data-scene-reader]').isHidden(), 'Look around reveals the whole scene');
  check(await page.locator('[data-viewpoint]').isVisible(), 'Looking around retains the approached viewpoint');
  await screenshot('work-look-around');
  await page.locator('[data-reader-toggle]').click();
  await page.locator('[data-reader-body]').evaluate((node) => { node.scrollTop = 230; });
  await open('experience');
  check(await page.locator('[data-scene-content] #experience').isVisible(), 'Notebook owns experience');
  check(await page.locator('[data-scene-content] #capabilities').count() === 1, 'Capabilities stay available');
  check(await page.locator('[data-scene-content] #resume').count() === 1, 'Education stays available in experience');
  await page.goBack(); await settled('work');
  const restoredScroll = await page.locator('[data-reader-body]').evaluate((node) => node.scrollTop);
  check(Math.abs(restoredScroll - 230) < 3, `History restores reading position: expected 230, got ${restoredScroll}`);
  await page.goForward(); await settled('experience');
  await page.locator('[data-scene-next]').click(); await settled('resume');
  await page.waitForFunction(() => document.querySelector('[data-resume-view]').dataset.state === 'ready');
  check(await page.locator('[data-resume-frame]').isVisible(), 'Resume stays in the room');
  check(await page.frameLocator('[data-resume-frame]').locator('.page').count() === 2, 'Approved two-page resume is embedded');
  check(await page.frameLocator('[data-resume-frame]').locator('.resume-toolbar').isHidden(), 'Embedded resume hides duplicate toolbar');
  await page.goBack(); await settled('experience');
  check(page.url().endsWith('#experience'), 'Frame did not add a spurious history step');
  await open('resume');
  const frameLink = page.frameLocator('[data-resume-frame]').locator('a').first();
  await frameLink.focus();
  await page.keyboard.press('Escape'); await settled('overview');
  check(await page.locator('[data-scene-reader]').isHidden(), 'Escape within resume returns to overview');
  await page.locator('.studio-point-work').focus(); await page.keyboard.press('Enter'); await settled('work');
  await page.keyboard.press('Escape'); await settled('overview');
  check(await page.locator('.studio-point-work').evaluate((node) => document.activeElement === node), 'Returning restores the original object focus');
  // Keep navigation responsive when a journey is interrupted.
  await page.locator('.studio-dock [data-studio-route="work"]').click();
  await page.locator('.studio-dock [data-studio-route="contact"]').click();
  await settled('contact');
  check(await page.locator('[data-scene-content] #contact').isVisible(), 'Newest rapid destination wins');
  check(await page.locator('[data-scene-content] #work').count() === 0, 'Earlier journey does not restore stale content');
  await uniqueIds();
  await screenshot('contact');
  // Motion settings change during a journey as well as between journeys.
  await page.locator('.studio-dock [data-studio-route="experience"]').click();
  await page.locator('[data-studio-motion]').click(); await settled('experience');
  check(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length === 0), 'Pause cancels camera and ambient animation');
  await open('work');
  check(await page.locator('[data-viewpoint]').isVisible(), 'Paused motion still reaches the destination');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-studio-motion]').disabled);
  check(await page.locator('[data-studio-motion]').isDisabled(), 'System preference cannot be overridden');
  await open('resume'); await screenshot('resume');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.querySelector('[data-studio-motion]').disabled);
  await page.locator('[data-studio-motion]').click();
  // Every breakpoint has visible destinations, readable content and matching object anchors.
  for (const [width, height] of [[1920,1080], [1101,900], [1100,900], [721,900], [720,900], [390,844], [320,568], [844,390]]) {
    await page.setViewportSize({ width, height }); await home(); await noOverflow();
    for (const destination of ['work','experience','resume','contact']) {
      check(await page.locator(`.studio-dock [data-studio-route="${destination}"]`).isVisible(), `${width}: ${destination} direct navigation`);
    }
    const geometry = await page.locator('.studio-point').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).visibility !== 'hidden').map((node) => {
      const marker = node.querySelector('.studio-marker').getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return Math.abs(marker.x + marker.width/2 - box.x - box.width/2) < 1 && Math.abs(marker.y + marker.height/2 - box.y - box.height/2) < 1;
    }));
    check(geometry.every(Boolean), `${width}: markers stay centered on their target`);
    await open('work'); await noOverflow();
    const reading = await page.locator('[data-reader-body]').boundingBox();
    check(reading.width >= 270 && reading.height > 55, `${width}: scrollable reading area remains usable`);
    await screenshot(`work-${width}`);
    if (width === 390) {
      for (const destination of ['experience','resume','contact']) {
        await open(destination);
        check(await page.locator('[data-reader-body]').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), `${destination}: reading content has no horizontal overflow`);
        await screenshot(`${destination}-mobile`);
        if (destination === 'experience') {
          await page.locator('[data-reader-body]').evaluate((node) => { node.scrollTop = node.scrollHeight; });
          await screenshot('education-mobile');
        }
      }
      await page.locator('[data-reader-toggle]').click(); await screenshot('contact-mobile-look-around');
      await page.locator('.scene-back').click(); await settled('overview');
      const sceneView = page.locator('[data-studio-view]');
      const originalScroll = await sceneView.evaluate((node) => node.scrollLeft);
      await sceneView.hover({ position: { x: 200, y: 150 } });
      await page.mouse.wheel(350, 0); await page.waitForTimeout(250);
      check(await sceneView.evaluate((node) => node.scrollLeft) > originalScroll, 'Mobile overview supports horizontal room exploration');
      await screenshot('overview-mobile');
    }
  }
  // Browser zoom reflows into the narrow layout rather than clipping content.
  await page.setViewportSize({ width:720, height:500 }); await home(); await open('experience'); await noOverflow(); await screenshot('zoom-reflow');
  await page.setViewportSize({ width:1440, height:1000 });
  await page.goto(`${url}/#capabilities`); await settled('experience');
  check(await page.locator('#capabilities').isVisible(), 'Legacy capabilities route resolves to notebook');
  await page.goto(`${url}/#contact`); await settled('contact');
  check(await page.locator('[data-reader-body]').evaluate((node) => node.scrollTop) === 0, 'Deep link starts at the beginning of the content');
  await noOverflow();
  // Content still works without a generated close-up.
  const missingArt = await browser.newPage();
  await missingArt.route('**/studio-work.webp', (route) => route.fulfill({ status:404, body:'Not found' }));
  await missingArt.goto(`${url}/#work`);
  await missingArt.waitForFunction(() => document.querySelector('[data-studio]').dataset.travelling === 'false');
  check(await missingArt.locator('[data-scene-content] #work').isVisible(), 'Missing art keeps zoomed room and readable content');
  await missingArt.close();
  const brokenResume = await browser.newPage();
  await brokenResume.route('**/resume.html?embed=1', (route) => route.fulfill({ status:404, contentType:'text/html', body:'Missing resume' }));
  await brokenResume.goto(`${url}/#resume`);
  await brokenResume.waitForFunction(() => document.querySelector('[data-resume-view]').dataset.state === 'error');
  check(await brokenResume.locator('[data-resume-retry]').isVisible(), 'Resume failure provides retry');
  check(await brokenResume.locator('[data-standalone-resume]').isVisible(), 'Standalone resume survives failure');
  check(await brokenResume.locator('[download]').isVisible(), 'PDF survives failure');
  await brokenResume.unroute('**/resume.html?embed=1');
  await brokenResume.locator('[data-resume-retry]').click();
  await brokenResume.waitForFunction(() => document.querySelector('[data-resume-view]').dataset.state === 'ready');
  await brokenResume.close();
  const noJS = await browser.newPage({ javaScriptEnabled:false, viewport:{width:390,height:844} });
  await noJS.goto(url);
  check(await noJS.locator('[data-studio-fallback]').isVisible(), 'No-JavaScript content remains available');
  await noJS.locator('.studio-dock [href="#work"]').click();
  check(await noJS.locator('#work').isVisible(), 'No-JavaScript links navigate ordinary content');
  check(await noJS.locator('[data-studio-route="resume"]').first().getAttribute('href') === 'resume.html', 'No-JavaScript resume remains a normal link');
  await noJS.close();
  const initFailure = await browser.newPage();
  await initFailure.addInitScript(() => { window.ResizeObserver = undefined; });
  await initFailure.goto(url);
  check(await initFailure.locator('[data-studio-fallback]').isVisible(), 'Unsupported initialization never hides content');
  await initFailure.close();
  const rollback = await browser.newPage();
  await rollback.addInitScript(() => { window.ResizeObserver = class { constructor() { throw new Error('Simulated unavailable layout observer'); } }; });
  await rollback.goto(`${url}/#work`);
  await rollback.waitForFunction(() => window.scrollY > 0);
  check(await rollback.locator('[data-studio-fallback]').isVisible(), 'Failed initialization restores ordinary content');
  check(await rollback.locator('#work').count() === 1, 'Rollback does not duplicate sections');
  check(await rollback.evaluate(() => history.scrollRestoration === 'auto'), 'Rollback restores normal browser scrolling');
  await rollback.close();
  await page.goto(`${url}/resume.html`);
  check(await page.locator('.resume-toolbar').isVisible(), 'Standalone resume toolbar is unchanged');
  check(await page.locator('.page').count() === 2, 'Standalone resume preserves two pages');
  check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
  console.log(`${browserName}: ${assertions} room navigation and fallback checks passed.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
