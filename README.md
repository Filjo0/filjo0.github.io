# Philipp Alimov Portfolio

Static developer portfolio, public resume and contact site for Philipp Alimov.

## Local Preview

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

The homepage is a navigable studio. Choose the monitor (Work), notebook
(Experience), wall print (Resume) or phone (Contact). The camera approaches that
object, then blends into an original closer viewpoint of the same room. These are
linked photographic views, with camera travel in HTML/CSS/JavaScript.

Each destination has live reading content integrated into the scene, with **Look
around** to reveal the full room and **Read** to restore the text. There are no
dialogs or modal focus traps. **Room overview**, Escape, previous/next arrows and
the persistent destination dock provide clear ways to move. Browser Back/Forward
and direct hash links restore the view; reader scroll positions are remembered.

The ordinary project, experience, capabilities, education and contact sections
are canonical DOM nodes moved into the scene reader. With JavaScript disabled or
initialization unavailable, normal section links and the standalone resume work.
The enhanced scene has no second page of repeated content beneath it.

Resume stays in the room using the approved same-origin `resume.html?embed=1`.
Its embedded screen mode hides the standalone toolbar; document facts and print
layout remain independent. PDF, standalone document and retry actions remain
available if the frame fails. Frame navigation replaces its own document to avoid
adding a spurious browser-history step.

**Pause motion** stops camera travel and ambient effects, including an interrupted
journey. System reduced-motion preferences take precedence. Mobile/tablet visitors
can pan the overview horizontally or use the dock directly. On narrow screens,
the approached object remains above a readable scrolling area; Look around returns
the scene to full height. Arrow keys also browse views when focus is on the scene,
without taking over keys used by links, buttons or reading content.

The design takes inspiration from the linked object views on
[Epic Sports](https://www.epicsports.football/epic-sports). All room artwork is
original and generated; no reference-site images or branding are included.

| Original asset | Purpose |
| --- | --- |
| `assets/studio-workspace.webp` | Room overview, loaded first |
| `assets/studio-work.webp` | Closer desk viewpoint |
| `assets/studio-experience.webp` | Notebook/table viewpoint |
| `assets/studio-resume.webp` | Wall-print viewpoint |
| `assets/studio-contact.webp` | Phone/table viewpoint |

The five images are WebP files. Destination images load on demand, with a five-second
failure timeout; if one fails, the zoomed overview and live text remain usable.

<details>
<summary>Original room generation prompts</summary>

Overview: premium cinematic architectural visualization of a software engineer's
studio in Perth at dusk, viewed from a slightly elevated wide angle. Warm oak,
charcoal concrete, copper details, amber desk lighting and dusk through a window.
Left desk with abstract-code monitor and keyboard; center coffee table with an open
notebook; right side table with smartphone and lamp; framed abstract wall print,
futsal ball and plants. Entire room visible, no people, readable text, logos, UI,
hotspots or watermarks. Landscape 16:9.

All closer viewpoints use the overview as their image reference: move the camera
inside the same room while preserving architecture, materials, warm lighting,
skyline, furniture and personal objects. Photoreal architectural visualization,
landscape 16:9, no people, text, logos or UI. Main object on the left, quieter detail
on the right for live HTML. Per-view camera instructions:

- Work: approach the left desk; monitor, keyboard and lamp in the foreground,
  seen from the room center, with abstract code on screen and skyline behind.
- Experience: approach the coffee table; open notebook, pen, books and mug in
  the foreground at seated eye level, looking towards the window.
- Resume: approach the framed abstract print on the right wall; frame prominent,
  warm textured wall, with a sliver of the shelf and sofa.
- Contact: approach the right side table; flat phone, copper lamp and plant in
  the foreground, looking down from the sofa.

</details>

## Validation

```powershell
npm test
npm run resume
npm test
```

Resume generation is a development-only task and requires Python Playwright
with its Chromium browser installed. The published site itself remains static
and dependency-free.

Browser checks use development Node Playwright tooling and generate ignored
screenshots under `validation-artifacts/`:

```powershell
npm run test:studio
```

Use an existing development Playwright installation. When it is installed outside
this project, set `PLAYWRIGHT_MODULE` to the file URL of its `index.mjs` entry point.
`STUDIO_BROWSER` selects `chromium` (default) or `webkit`; the matching development
browser binaries must be installed. `STUDIO_BROWSER_EXECUTABLE` optionally selects
an existing Chrome executable for Chromium checks. These tools are not site runtime
dependencies. The suite verifies actual camera transforms and distinct viewpoint
assets, interrupted navigation, routes/history/scroll restoration, object alignment,
responsive reading, keyboard/Escape behavior, embedded-resume history and failure
recovery, missing viewpoint art, motion settings and progressive enhancement.
Inspect the resulting screenshots as well as assertions. The zoom case verifies
layout reflow at an equivalent narrow viewport; it does not automate browser chrome.

The site has no runtime dependencies, analytics, cookies, database or contact-form backend. Contact uses the public business email.

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
