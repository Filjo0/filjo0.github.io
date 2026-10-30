# Philipp Alimov Portfolio

A static portfolio with a coastal pavilion, matching Siberian winter, and linked object close-ups. The conventional page remains available without JavaScript or WebGL. No analytics, contact backend, runtime CDN or publishing build step is required.

## Current experience

- My apps: FUTSL, Aqua Local and Treadfront, with dated public screenshots, an enlarged flat screenshot viewer, case studies and verified external links. Treadfront includes only the approved one-sector demo.
- About: a straight profile sheet beside the bag, with a visible scroll cue.
- Résumé: a straight clipboard and read-only HTML page with browser Print. The approved wording and one-page A4 print layout are preserved; no PDF download is required or offered.
- Contact: a phone screen with email, LinkedIn, GitHub and Copy email.
- Maths notebook: live sunflower-angle, Fibonacci-square and Pascal-row sliders, with tappable drawings. The reading book contains 30 sourced recommendations.
- Portrait phones open on a full-height desk view. Use "See the coast" or swipe horizontally to explore the pool, pitch and beach, then return to the desk. The named pool and pitch open Aqua Local and FUTSL in My apps. The image never shrinks into a letterboxed strip.
- Objects open with one click or tap. Hover and keyboard focus reveal their outlines and names. Main navigation stays available without needing to discover objects.
- Settings contain Coast/Winter, Sunset/Night, Reduce motion and Simple page view. Night settings use dark chrome. The globe changes the season.

Sports, planting, private project descriptions and the testing demo are not part of the public portfolio. Old activity hashes return to the main scene. `qa-lab/` must remain absent.

## Preview

From this directory:

```powershell
python scripts/serve.py
```

Open `http://127.0.0.1:8765/`. The server is fixed to loopback, with persistent connections and a 128-connection queue for parallel module loading. It is visible only on this computer. For a phone test, serve a separate allowlisted public copy on the private LAN; do not expose this entire working folder, its notes or validation output. Stop the phone server after testing.

## Source map

| Area | Sources |
| --- | --- |
| Canonical content and plain-page fallback | `index.html`, `styles.css` |
| Navigation, focus, routes and settings | `world-controller.js`, `world/object-experience.js` |
| Scene framing and object outlines | `world/concept-world.js`, `world/concept-scene.js`, `world/concept-camera.js`, `world/scene-hotspots.js` |
| Object artwork and HTML alignment | `world/plate-views.js`, `world/surfaces.js`, `art/outdoor/` manifests |
| Shared design | `design-tokens.css`, `concept.css`, `world.css`, `resume-chrome.css` |
| Apps and screenshot viewer | `world-projects.js`, `assets/previews/` |
| Reading and maths | `room-reading.js`, `world/stations/books.js`, `world/stations/seeds.js`, `world/stations/maths-*.js`, `world/stations/sunflower.js` |
| Résumé | `resume.html`, `world/resume.js`, `script.js` |
| Isolated demo | `world/demo.js`, `demo/treadfront/` |

The coast artwork loads first. Winter, night and object close-ups load when requested. Navigation cancels obsolete season requests. The scene stops rendering when idle and respects reduced motion. Rendering failure restores the full conventional portfolio and logs a diagnostic reason locally.

## Validation

```powershell
npm test
npm run test:privacy
node scripts/check-resume-one-page.mjs
npm run test:release:browser
npm run test:concept
npm run test:activities
npm run test:world
npm run test:surfaces
npm run test:concept:browser
```

Browser checks use development Playwright. `PLAYWRIGHT_MODULE` may point to an existing installation's `index.mjs` file URL. `STUDIO_BROWSER` selects `chromium` or `webkit`; `STUDIO_BROWSER_EXECUTABLE` optionally selects installed Chrome. `STUDIO_URL` defaults to the local preview above. Clear the executable override when switching to WebKit. Evidence is written to ignored `validation-artifacts/`.

The public experience has 20 browser suites. Inspect native screenshots as well as assertions at desktop, 390px, 320px and short landscape. Check first-Tab navigation, Escape/focus return, single-tap opening, slider dragging, screenshot viewer, browser printing, errors, interrupted loading and no-JavaScript fallback. A real iPhone/Android pass remains separate from browser emulation.

Windows WebKit builds before the fix in build 2371 can omit WebGL artwork from screenshots after a drawing-buffer resize. This also reproduces with a plain red canvas, without portfolio code. Use a matching corrected Playwright/WebKit pair; do not alter the website or weaken visual checks to hide that tool defect. See [the upstream fix](https://github.com/microsoft/playwright/pull/43085).

## Generated files and provenance

- `resume.html` is the canonical readable and printable résumé. The Print button invokes browser printing; with JavaScript disabled, use the browser menu. `check-resume-one-page.mjs` verifies approved facts, clipping and A4 geometry in both engines, and actual one-page Chromium print output. The former PDF download and exporter are retired. `assets/Philipp_Alimov_Resume.pdf` must remain absent; static and HTTP checks enforce this. Browser-print proofs belong only in ignored validation output. Include the tracked PDF deletion in the next authorized release so its old public address returns 404.
- Edit the Treadfront source wrapper/core, then run `npm run build:demo`. `ESBUILD_MODULE` may select a development esbuild installation. Preserve its opaque-origin sandbox, MessageChannel validation and one-sector export boundary; never add purchase, save or customer modules.
- `npm run share:render` produces the 1200×630 social preview. Verify the live social card after publication.
- `art/README.md` retains renderer/build recipes. Keep source licences and manifests. Three.js 0.186.1 is locally bundled with its MIT notice.

The old room lives only in the ignored `validation-artifacts/legacy-studio/` archive. Retained comparison modes (`?navigation=walk`, `?world=legacy`) and their source/tests are separate from the approved homepage. Do not restore retired room assets to the public root. Shared modules remain where current maths/reading code imports them.

## Publication boundary

The existing site is `https://filjo0.github.io/`. Publication requires the owner's explicit request. Do not create a pull request. Review the precise staged diff, public file list, approved résumé, asset provenance, relative links and tests before a direct release. Keep `tasks/`, `validation-artifacts/`, source download caches and local credentials out of Git and the served release.

Only approved public products and résumé facts belong in this repository, including documentation and tests. The portfolio uses `philalimov.apps@gmail.com`; the approved résumé keeps its existing personal email. No personal phone number, street address or private employer implementation details should be added.
