# Portfolio Agent Guide

Maintain a factual, accessible static portfolio. Follow global working rules and use the source map in README.md. This guide replaces historical iteration notes; local notes live under ignored tasks/ and current evidence under validation-artifacts/. Completed historical runs may be moved to the sibling archive described in README.md.

## Approved product

The default is an avatar-free coastal pavilion with matching Siberian winter and straight, camera-aligned object close-ups. Preserve approved scene images, outlines, calibration, ivory/green palette, Georgia headings and system body font. Do not regenerate artwork for unrelated fixes.

Every visible clickable object has a compact, always-visible white dot and uppercase translucent name capsule on the picture, following the owner's Epic Sports reference. Markers use black extended lettering from the locally hosted, OFL-licensed Zalando Sans Expanded face, with no capsule border or shadow. Names are at least 13px, with 44px native touch targets and 4.5:1 native text contrast. Preserve calibrated object anchors within 1px. The collision solver keeps pills fully visible, close to their own dots, and clear of other markers, important objects and controls. Dot anchors stay still. A soft staggered halo animates around each dot, stopping with pause, reduced motion, hidden pages and inspection. Capsules use a translucent white backdrop with opaque black text. Hover and keyboard focus add the object glow. Main navigation is My apps / About / Résumé / Contact / Maths, with a slim secondary phone bar. One tap on an object, dot, pill or menu action opens its section through a short approach. Reduced motion opens directly. Back restores the exact desk/coast view and opener, and remains usable while artwork loads. Reading is also reachable from About. Keep direct navigation when optional objects are cropped. Settings contain Coast/Winter, automatic Perth lighting with manual Morning/Daylight/Sunset/Night overrides, Reduce motion and Simple page view. The globe changes season.

The optional Inspect view is approved: real dated local validation only, with outlined objects and no quiz or scoring. Its wording and compact phone disclosure are approved; physical-phone validation remains separate. The panel must distinguish the full Chromium run from focused WebKit checks. Keep its generated quality summary and quality-build.js fingerprint synchronized with tested source; never invent counts or call browser emulation a real-device audit. Pointer-driven depth is off pending a separate layered-art decision; compositor details and short approaches stop with reduced motion, hidden pages, pause and disposal.

The public portfolio has no sports, planting or QA game. Retired activity hashes return to the main scene; qa-lab/ and world/activity-ui.js must remain absent. Maths and the 30-reading book remain. Do not restore rejected panels, phone-framed app previews, two-tap Open buttons or tilted text.

## Content and publication

- No commit, push, deployment or pull request without explicit user authorization. This user specifically prefers direct publication without a PR.
- Keep unreleased project details out of every public file, including tests and Markdown. Preserve the public-content guard. Notes and evidence belong in ignored directories.
- Use verified résumé/repository evidence; do not invent metrics, responsibilities, app data, platform availability or personal details.
- Résumé is read-only HTML with browser Print, not a downloadable PDF. The retired `assets/Philipp_Alimov_Resume.pdf` must remain absent from public assets. Preserve its approved wording, every role/date/degree and one-page A4 print layout. About intentionally retains its longer approved copy. Do not rewrite either to match the other.
- Portfolio contact uses philalimov.apps@gmail.com. Preserve the résumé's existing email. No phone number, street address or private employer details.
- FUTSL and Aqua Local use dated public captures and real external website/store links, not live data or invented app screens. Capture only public material, with no login, geolocation or server mutations.
- Treadfront approval covers one sector only. Preserve source.json, export limits, opaque allow-scripts iframe and MessageChannel checks. Never include native, purchase, save or customer modules.

## Implementation

Keep the site static and use relative paths. No new runtime dependencies, trackers, cookies or contact services without a justified request. Three.js is bundled locally; preserve its MIT notice. Shared colours and font sizes belong in design-tokens.css, not ad-hoc CSS values.

Move canonical sections without duplicate IDs and restore them on failure or simple-page mode. Preserve keyboard focus, visible focus rings, reduced motion, Escape/back/history, touch and scroll behaviour. Stop animation on hiding, leaving and disposal; avoid idle render loops. Lazy assets must handle cancellation, failure and retry without stale navigation.

The QA evidence JSON and world/quality-build.js are owned by build-quality-evidence.mjs; never hand-edit counts or the fingerprint. After final source validation and before every authorized release, rebuild both with npm run quality:build, then run npm run check:publish. Stale evidence blocks publication.

Generated files have owning scripts: build-treadfront-demo.mjs for demo.bundle.js; render-share-card.mjs for the social image. Do not hand-edit generated binaries. The former résumé PDF exporter is retired in the ignored local archive; do not restore it or its public output.

Do not delete retained modules merely because their names mention old activities: current maths/reading and comparison renderers share them. Archived room assets stay outside the public root. Art provenance and reproducible commands are in art/README.md and asset manifests.

## Verification

Run the smallest relevant check first, then npm test and the relevant pure/browser suites listed in README.md. The core browser run contains 20 suites; the focused marker check is available as test:markers:browser. Save failures and investigate; never loosen assertions or rerun blindly until green. Review native screenshots as well as DOM/state checks. Include 320px and short landscape for responsive changes.

A corrected Windows WebKit build is required for native canvas screenshots after resize; README.md links the upstream bug. Test tools and the site are separate. Emulated touch is not proof of physical iPhone/Android behaviour. Keep implemented, locally tested, real-device checked and published claims distinct.

Preserve existing user work. Before a broad change, snapshot the current dirty worktree, not just HEAD. Write concrete multi-session handoff notes to ignored tasks/ with evidence, changed files, checks, unresolved risks and the next action.
