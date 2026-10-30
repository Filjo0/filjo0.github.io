# Portfolio Agent Guide

Maintain a factual, accessible static portfolio. Follow global working rules and use the source map in README.md. This guide replaces historical iteration notes; local history is preserved under ignored tasks/ and validation-artifacts/.

## Approved product

The default is an avatar-free coastal pavilion with matching Siberian winter and straight, camera-aligned object close-ups. Preserve approved scene images, outlines, calibration, ivory/green palette, Georgia headings and system body font. Do not regenerate artwork for unrelated fixes.

Main navigation is My apps / About / Résumé / Contact / Maths. Objects open in one click or tap; hover and keyboard focus reveal names. Keep direct navigation available if optional objects are cropped. Settings contain Coast/Winter, Sunset/Night, Reduce motion and Simple page view. The globe changes season.

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

Generated files have owning scripts: build-treadfront-demo.mjs for demo.bundle.js; render-share-card.mjs for the social image. Do not hand-edit generated binaries. The former résumé PDF exporter is retired in the ignored local archive; do not restore it or its public output.

Do not delete retained modules merely because their names mention old activities: current maths/reading and comparison renderers share them. Archived room assets stay outside the public root. Art provenance and reproducible commands are in art/README.md and asset manifests.

## Verification

Run the smallest relevant check first, then npm test and the relevant pure/browser suites listed in README.md. The full public browser run contains 20 suites. Save failures and investigate; never loosen assertions or rerun blindly until green. Review native screenshots as well as DOM/state checks. Include 320px and short landscape for responsive changes.

A corrected Windows WebKit build is required for native canvas screenshots after resize; README.md links the upstream bug. Test tools and the site are separate. Emulated touch is not proof of physical iPhone/Android behaviour. Keep implemented, locally tested, real-device checked and published claims distinct.

Preserve existing user work. Before a broad change, snapshot the current dirty worktree, not just HEAD. Write concrete multi-session handoff notes to ignored tasks/ with evidence, changed files, checks, unresolved risks and the next action.
