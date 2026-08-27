from __future__ import annotations

import re
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError as error:
    raise SystemExit(
        "Resume generation requires Playwright: install it in a development "
        "environment and run `playwright install chromium`."
    ) from error


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resume.html"
OUTPUT = ROOT / "assets" / "Philipp_Alimov_Resume.pdf"

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.unlink(missing_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(SOURCE.as_uri(), wait_until="load")
    page.emulate_media(media="print")
    page.pdf(
        path=OUTPUT,
        format="A4",
        print_background=True,
        prefer_css_page_size=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
    )
    browser.close()

pdf = OUTPUT.read_bytes()
if not pdf.startswith(b"%PDF-"):
    raise SystemExit("Generated file is not a PDF.")

page_count = len(re.findall(rb"/Type\s*/Page\b", pdf))
if page_count != 2:
    OUTPUT.unlink(missing_ok=True)
    raise SystemExit(f"Expected a two-page resume, generated {page_count} pages.")

print(f"Generated two-page resume: {OUTPUT}")
