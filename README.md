# Philipp Alimov Portfolio

Static developer portfolio, public resume and contact site for Philipp Alimov.

## Local Preview

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

The homepage is one real-time 3D studio. Selecting an object walks the camera
along an aisle, turns toward it, and then opens its own reading surface:

- **Work:** projects appear on the monitor.
- **Experience:** the notebook is lifted from the coffee table and its page shows
  experience, capabilities and education.
- **Resume:** a document folio is lifted from the desk. Its page embeds the approved
  two-page resume; the wall artwork is decoration.
- **Contact:** approach the side table, pick up the phone, then tap its screen to
  reveal the business email, LinkedIn and GitHub links on the glass.

This replaces the earlier photographic angle tour. Geometry, furniture, lighting
and object positions belong to the same world throughout each journey. The lens
stays constant; camera translation, turning, occlusion and a subtle walking bob
create movement. Objects return to their original positions before leaving.
**Look around** puts a held object down; **Read** picks it up again. This is a
first-person experience without a visible avatar or animated hands.

The current room uses original procedural models and materials. It establishes
continuous navigation and physical object interactions; it is not a photoreal
architectural scene. Custom detailed models and authored PBR materials would be
needed for a substantially higher level of realism.

Desktop hotspots have translucent markers and reveal names on hover or keyboard
focus. Touch layouts retain compact names, and the destination dock is always
available. Drag the overview to look left/right. Room overview, Escape, previous/
next buttons and the dock provide return paths. Public hash routes, Back/Forward,
keyboard focus and reader scroll restoration remain available.

Live HTML is projected onto the actual object planes, keeping links, scroll areas
and the resume iframe usable. Canonical sections move into these surfaces; they
are never cloned. Hidden anchors preserve public hashes while mounted sections
use `scene-section-*` IDs, avoiding WebKit fragment re-anchoring. There is no
second page of duplicate content beneath the enhanced room.

Narrow screens move closer to the monitor's readable centre instead of fitting
its entire width. The notebook and folio have portrait pages. On short landscape
screens held objects turn sideways and their reading interface stays upright. PDF and
standalone resume links remain available when the document needs more space.
The approved resume facts and print layout are unchanged.

Pause motion immediately completes an interrupted movement and disables subsequent
travel animation. System reduced motion takes precedence. The renderer draws only
when the camera, props, viewport or textures change, with a pixel-ratio cap of 1.6;
there is no continuous idle render loop. WebGL2 is required for the enhanced room.
If JavaScript, the room module, WebGL initialization or the rendering context fails,
the ordinary HTML portfolio and standalone resume remain usable. A failed window
texture leaves the modeled room intact.

The interaction direction is inspired by
[Epic Sports](https://www.epicsports.football/epic-sports), using original room
geometry and artwork. No reference-site imagery or branding is included.
`assets/studio-workspace.webp` supplies the fallback hero and a cropped exterior
window texture. Earlier `studio-*-angle.webp` files are retained for comparison;
they no longer drive navigation.

## Renderer provenance

`room.js` imports the locally bundled **Three.js 0.186.1** from
`assets/vendor/three.module.js`. Its MIT notice is retained in
`assets/vendor/THREE-LICENSE.txt` and the bundle. The bundle was produced from the
official `three@0.186.1` npm package's `build/three.module.js` using esbuild with
`--bundle --minify --format=esm --legal-comments=inline`. No runtime CDN, npm
installation or build step is needed to preview or publish this static site.
Three.js is the one runtime library, necessary for real perspective geometry and
continuous camera movement. No analytics, cookies, database or contact backend.

## Validation

```powershell
npm test
npm run test:studio
```

Browser checks use development Node Playwright and write ignored screenshots to
`validation-artifacts/`. Set `PLAYWRIGHT_MODULE` to an external installation's
`index.mjs` file URL if needed. `STUDIO_BROWSER` chooses `chromium` (default) or
`webkit`; `STUDIO_BROWSER_EXECUTABLE` can select an existing Chrome executable.
The suite enables software WebGL for headless Chromium only; the website does not
set browser flags. Development tooling is not shipped with the site.

The suite checks actual camera translation with constant FOV, object surfaces,
phone activation, canonical content, rapid interruptions, routes/history/scroll,
focus and Escape inside the resume, motion settings, idle rendering, responsive
layouts, document failure and ordinary fallback after module/WebGL/context failure.
Inspect its screenshots as well as assertions. Local Chrome and WebKit evidence
does not establish physical iOS/Android GPU performance or production deployment.

Run `npm run resume` when `resume.html` changes. PDF generation requires development
Python Playwright with Chromium and verifies exactly two pages.

## GitHub Pages

1. Create the public repository `Filjo0/filjo0.github.io`.
2. Commit these files to the repository's `main` branch.
3. In repository settings, open **Pages** and choose **Deploy from a branch**.
4. Select `main` and `/ (root)`.
5. Confirm `https://filjo0.github.io` serves the site over HTTPS.

Add a custom domain only after it is registered and the Pages DNS records are configured. Keep relative links so the site works on both the GitHub address and a future custom domain.

## Public Content Boundary

- Employment, education and project claims must remain supported by the current resume or project repositories.
- Use the business email on the portfolio contact page and retain the original email on the approved resume. Do not add a personal phone number, home address, credentials or private adviser data.
- Do not publish private screenshots, production logs, customer data or employer-confidential material.
- Regenerate the PDF after changing `resume.html`; the generator removes the
  previous artifact and verifies that the replacement contains two pages.
