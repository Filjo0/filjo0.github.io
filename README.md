# Philipp Alimov Portfolio

Static developer portfolio, public resume and contact site for Philipp Alimov.

## Local Preview

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

The homepage opens in an interactive studio: explore the monitor for selected work,
the notebook for experience, the phone for contact, and the wall print for the resume.
The scene has gentle pointer movement, pulsing markers, lighting and sliding panels.
Use **Pause motion** to stop animation; the site also honours reduced-motion preferences.
On mobile and tablet, swipe the room or use the four links underneath it.
Section links still work without JavaScript.

The studio backdrop (`assets/studio-workspace.webp`) is an original image produced
with the built-in image generation tool, compressed to WebP for delivery.
Hotspots, lights, camera movement and panels are implemented in HTML, CSS and JavaScript.

<details>
<summary>Original backdrop generation prompt</summary>

Use case: stylized-concept. Asset type: background for an interactive personal portfolio, landscape 16:9. Create a premium cinematic architectural 3D render of a software engineer's small studio in Perth at dusk, viewed from the front at a slightly elevated wide angle, a realistic elegant room with warm oak furniture, charcoal concrete walls and copper accents, soft amber desk lighting and blue dusk through a window. The entire room is visible, straight walls, no people. On the left at 23% horizontal and 52% vertical: a small desk with a glowing desktop monitor showing abstract code, keyboard. At center around 47% horizontal and 65% vertical: a low desk with an open notebook. On the right at 74% horizontal and 55% vertical: a small side table with a smartphone. At 85% horizontal and 35% vertical: a framed abstract print on the wall. A futsal ball on the floor near the left desk, a small green plant, neat personal details, visually cohesive, beautifully lit, restrained. Leave the upper left wall and bottom edge uncluttered for HTML title and labels. Render as an immersive tactile miniature architectural scene with real material detail, not a flat illustration. No legible text, no logos, no UI labels, no hotspots baked in, no watermark. The objects will receive real interactive HTML overlays.

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
