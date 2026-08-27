# Philipp Alimov Portfolio

Static developer portfolio, public resume and contact site for Philipp Alimov.

## Local Preview

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

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
