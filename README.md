# Philipp Alimov Portfolio

A static portfolio with a coastal pavilion, matching Siberian winter, and linked object close-ups. The conventional page remains available without JavaScript or WebGL. No analytics, contact backend or runtime CDN is required. Publication has a local evidence-build and validation gate.

## Current experience

- My apps: FUTSL, Aqua Local and Treadfront, with dated public screenshots, an enlarged flat screenshot viewer, case studies and verified external links. Treadfront includes only the approved one-sector demo.
- About: a straight profile sheet beside the bag, with a visible scroll cue.
- Résumé: a straight clipboard and read-only HTML page with browser Print. The approved wording and one-page A4 print layout are preserved; no PDF download is required or offered.
- Contact: a phone screen with email, LinkedIn, GitHub and Copy email.
- Maths notebook: live sunflower-angle, Fibonacci-square and Pascal-row sliders, with tappable drawings. The reading book contains 30 sourced recommendations.
- Portrait phones open on a full-height desk view. Use "See the coast" or swipe horizontally to explore the pool and pitch, then return to the desk. The named pool and pitch open Aqua Local and FUTSL in My apps. The image never shrinks into a letterboxed strip.
- Pinned markers stay visible on the pictured objects: a ringed white dot, a short stem and an uppercase name pill on frosted glass in the locally hosted Zalando Sans Expanded face (OFL licence under assets/fonts/), developed from the Epic Sports reference. Each name sits directly below or above its own dot where space allows, outside every object and clear of other names and controls. Their 44px touch targets remain distinct. Dots pop in and draw their stems on arrival, and a staggered ripple travels out from each dot; names are visible from the first frame. Hover/tap brightens the name with a light sweep, enlarges the dot and lights the matching menu item, and focus adds the object glow. Pause, reduced motion and hidden pages stop the halo. One tap on the dot, name, object or menu opens the section, and Back restores the exact desk/coast view and focus. The five-item phone bar remains a secondary route. Reading is also reachable from About.
- Settings contain Coast/Winter, Auto · Perth / Morning / Daylight / Sunset / Night, Reduce motion and Simple page view. Auto follows Perth time; a manual choice is saved locally. Night settings use dark chrome. The globe changes the season.

Inspect optionally outlines the scene objects and shows dated, recorded local test evidence. It is a read-only quality view, with no quiz, score, tracking or user submissions. Pointer-driven depth is off; the scene stays rigid. Leaves, light and water details use compositor animation. Reduced motion removes these effects and the short object-approach transition.

Sports, planting, private project descriptions and the testing demo are not part of the public portfolio. Old activity hashes return to the main scene. `qa-lab/` must remain absent.

## Preview

From this directory:

```powershell
python scripts/serve.py
```

If port 8765 is already occupied, use `python scripts/serve.py --port 8775` and open `http://127.0.0.1:8775/` instead.

Open `http://127.0.0.1:8765/` when using the default port. The server is fixed to loopback, with persistent connections and a 128-connection queue for parallel module loading. It is visible only on this computer. For a phone test, serve a separate allowlisted public copy on the private LAN; do not expose this entire working folder, its notes or validation output. Stop the phone server after testing.

## Source map

| Area | Sources |
| --- | --- |
| Canonical content and plain-page fallback | `index.html`, `styles.css` |
| Navigation, focus, routes and settings | `world-controller.js`, `world/object-experience.js` |
| Scene framing and object outlines | `world/concept-world.js`, `world/concept-scene.js`, `world/concept-camera.js`, `world/scene-hotspots.js`, `world/scene-marker-layout.js` |
| Object artwork and HTML alignment | `world/plate-views.js`, `world/surfaces.js`, `art/outdoor/` manifests |
| Scene clock, atmosphere, inspection and approach | `world/scene-clock.js`, `world/scene-lighting.js`, `world/scene-atmosphere.js`, `world/scene-inspector.js`, `world/scene-travel.js`, `world/linked-menu-flow.js`, `linked-menu.css` |
| Shared design | `design-tokens.css`, `concept.css`, `world.css`, `resume-chrome.css` |
| Apps and screenshot viewer | `world-projects.js`, `assets/previews/` |
| Reading and maths | `room-reading.js`, `world/stations/books.js`, `world/stations/seeds.js`, `world/stations/maths-*.js`, `world/stations/sunflower.js` |
| Résumé | `resume.html`, `world/resume.js`, `script.js` |
| Isolated demo | `world/demo.js`, `demo/treadfront/` |

Only the active coast lighting source loads first. Morning uses a warm grade of the daylight source that preserves its black point and contrast; sunset and night keep their approved images. Winter and object close-ups load when requested. Navigation cancels obsolete season requests. The scene stops rendering when idle and respects reduced motion. Rendering failure restores the full conventional portfolio and logs a diagnostic reason locally.

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
npm run test:markers:browser
node scripts/check-linked-navigation.mjs
npm run test:enhancements
npm run test:enhancements:browser
```

The Node-based tools use ES modules; `package.json` declares this format explicitly. Development dependencies and Python virtual environments remain local and ignored.

The optional `test:studio` and `test:room` commands exercise the archived room and require the ignored `validation-artifacts/legacy-studio/` files. They are historical checks, separate from the 20 current portfolio suites; a clean checkout does not need that archive to validate the public site.

Browser checks use development Playwright. `PLAYWRIGHT_MODULE` may point to an existing installation's `index.mjs` file URL. `STUDIO_BROWSER` selects `chromium` or `webkit`; `STUDIO_BROWSER_EXECUTABLE` optionally selects installed Chrome. `STUDIO_URL` defaults to the local preview above. Clear the executable override when switching to WebKit. Evidence is written to ignored `validation-artifacts/`.

The core browser run has 20 suites and uses an explicit Sunset URL fixture for stable screenshots. Automatic Perth phases, timezone independence, phase failures, rigid scene pixels, idle-render behavior and the inspector have separate enhancement tests. The separate marker check covers always-visible dot/name buttons, native silhouette shortcuts and calibrated object anchors across desktop and phone viewports, including narrow tall phones. Enhancement checks measure native name-pill contrast in day and morning, both seasons and both portrait crops. Negative controls must reject unreadable text and an anchor displaced beyond the unchanged 1px rule. Inspect native screenshots as well as assertions at desktop, 390px, 320px and short landscape. Check first-Tab navigation, Escape/focus return, single-tap opening, slider dragging, screenshot viewer, browser printing, errors, interrupted loading and no-JavaScript fallback. A real iPhone/Android pass remains separate from browser emulation.

Windows WebKit builds before the fix in build 2371 can omit WebGL artwork from screenshots after a drawing-buffer resize. This also reproduces with a plain red canvas, without portfolio code. Use a matching corrected Playwright/WebKit pair; do not alter the website or weaken visual checks to hide that tool defect. See [the upstream fix](https://github.com/microsoft/playwright/pull/43085).

## Generated files and provenance

- `resume.html` is the canonical readable and printable résumé. The Print button invokes browser printing; with JavaScript disabled, use the browser menu. `check-resume-one-page.mjs` verifies approved facts, clipping and A4 geometry in both engines, and actual one-page Chromium print output. The former PDF download and exporter are retired. `assets/Philipp_Alimov_Resume.pdf` must remain absent; static and HTTP checks enforce this. Browser-print proofs belong only in ignored validation output. The retired PDF address must continue to return 404 after each release.
- Edit the Treadfront source wrapper/core, then run `npm run build:demo`. `ESBUILD_MODULE` may select a development esbuild installation. Preserve its opaque-origin sandbox, MessageChannel validation and one-sector export boundary; never add purchase, save or customer modules.
- `npm run share:render` produces the 1200×630 social preview. Verify the live social card after publication.
- `art/README.md` retains renderer/build recipes. Keep source licences and manifests. Three.js 0.186.1 is locally bundled with its MIT notice.

The old room lives only in the ignored `validation-artifacts/legacy-studio/` archive. Retained comparison modes (`?navigation=walk`, `?world=legacy`) and their source/tests are separate from the approved homepage. Do not restore retired room assets to the public root. Shared modules remain where current maths/reading code imports them.

## Local validation history

The linked-menu prototype was promoted into the public sources on 17 November 2026, together with the owner's Epic Sports-style on-image buttons. Its earlier review copy remains in `validation-artifacts/phone-preview-05nov/site/review/linked-menu/`. Current release evidence is in `validation-artifacts/epic-marker-refinement-17nov/`. Local browser tools, referenced inputs, packed Blender sources and provenance remain available. Completed historical reports are compressed in the sibling `Philipp-Alimov-Portfolio-Archive/completed-review-reports-2026-11-13.zip`. Cleanup receipts and the verified source backup are retained locally. Browser checks recreate their capture files when run.

## Recorded quality evidence

`assets/quality-evidence.json` contains a small public summary, not the private test artifacts. Generate it only after a clean local run using `node scripts/build-quality-evidence.mjs validation-artifacts/<run>`. That folder must contain all 20 core Chromium results, native marker results from Chromium/WebKit, the complete logic-test summary and both enhancement results. The enhancement results must match the current public-source fingerprint. The fingerprint covers runtime code, styles, HTML, geometry/data, demo files and lazy assets; only its own two generated outputs are excluded. Text line endings are normalized so the same source validates on Windows and GitHub Pages. Do not hand-edit counts or claim physical-device/production coverage. The inspector fetches this summary only when opened. It accepts a complete record matching the generated `world/quality-build.js` source fingerprint; missing, partial, invalid or stale data shows “Test summary unavailable”, never placeholder counts. The generator owns both files; do not edit either by hand.

Daylight originals were edited with the built-in image tool and converted at unchanged dimensions. Paths, exact prompts, source IDs, hashes, image sizes and compression settings are in `art/outdoor/daylight-scenes.json`. The new images are each smaller than their respective approved sunset source. No sound, additional engine, tracker or runtime dependency was added.

## Publication boundary

The existing site is `https://filjo0.github.io/`. Publication requires the owner's explicit request. Do not create a pull request. Review the precise staged diff, public file list, approved résumé, asset provenance, relative links and tests before a direct release. Keep `tasks/`, `validation-artifacts/`, source download caches and local credentials out of Git and the served release.

Before every authorized publish:

1. Finish all source edits, then run the 20 core suites in Chromium, marker and enhancement checks in Chromium and WebKit, the logic tests, and the release-boundary checks. Save the complete results in the quality-evidence folder layout above. The full Chromium run and focused WebKit runs have different scopes; do not describe them as equivalent.
2. Run `npm run quality:build -- validation-artifacts/<run>` to regenerate both the public summary and its build fingerprint from those completed results. This must happen after the final source edit.
3. Run `npm run check:publish`. It fails if the summary or generated fingerprint is stale, incomplete or a baseline, and also enforces the public-content guard. Do not publish an unavailable summary.
4. Review the exact release files. If source changes after the checks, repeat the affected validation and rebuild the summary before running the gate again. This command validates only; it does not commit, push or deploy.

Only approved public products and résumé facts belong in this repository, including documentation and tests. The portfolio uses `philalimov.apps@gmail.com`; the approved résumé keeps its existing personal email. No personal phone number, street address or private employer implementation details should be added.
