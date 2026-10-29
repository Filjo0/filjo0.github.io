# Artwork and renderer provenance

The default portfolio uses the approved image plates in `assets/outdoor/`.
Prompts, hashes, sizes and source attribution are recorded in `art/outdoor/` manifests.
Keep those manifests and licence records when changing assets.
The room models below are archived experiments, not homepage dependencies.

## Renderer provenance

The renderers import the locally bundled **Three.js 0.186.1** from
`assets/vendor/three.module.js`. Its MIT notice is retained in
`assets/vendor/THREE-LICENSE.txt` and the bundle. The bundle was produced from the
official `three@0.186.1` npm package with esbuild
`--bundle --minify --format=esm --legal-comments=inline`, from an entry that re-exports
`three` plus the same package's `examples/jsm/loaders/GLTFLoader.js`:

```js
export * from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
```

Bundling `build/three.module.js` alone with the same flags reproduces the previous
vendored file byte for byte; the loader adds about 44 KB and shares the one library.
No runtime CDN, npm
installation or build step is needed to preview or publish this static site.
Three.js is the one runtime library, used for camera-calibrated object placement. No analytics, cookies, database or contact backend.

## Authored room zones

The phone corner (side table, copper lamp, small and floor plants, bookshelf, sofa) is
original artwork modelled by `art/studio/contact_zone.py`, a Blender script that builds
the geometry in the room's exact coordinates, bakes Cycles diffuse lighting (lamp,
dusk window, ceiling wash, bounce light) into the textures, bakes floor/wall shadow
decals, and exports `validation-artifacts/legacy-studio/assets/studio/contact-zone.glb`. Regenerate it with Blender 5.2:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python art/studio/contact_zone.py -- <out_dir>
```

Add `--preview` for two Cycles preview renders, `--fast` for a quick low-sample
bake, `--gpu` for an available CUDA device, or `--inspect` for mesh counts without
baking. CPU is the default; copy `<out_dir>/contact-zone.glb` into `validation-artifacts/legacy-studio/assets/studio/`.
No third-party models or textures are used; materials are procedural Blender nodes. Baked diffuse light is retained as emissive colour while authored normal and
roughness maps supply live surface highlights. Decals darken the floor and walls;
furniture also casts shadows that occlude live specular. Copper and the phone use
the shared one-off room reflection.
The oak uses irregular stretched noise with microscopic bump rather than repeating
wave bands. Book bevels and sofa subdivisions are limited to visible detail. The
GLB is about 1.70 MB; `npm test` enforces a 2,000,000-byte budget and validates its
binary header. Until the model loads, or if it fails, the procedural stand-ins
remain.

The desk zone (oak desk on a steel trestle frame, monitor housing and stand, keyboard,
mouse and felt mat, mesh-back office chair, copper desk lamp, desk and window-side
plants, futsal ball) is built the same way by `art/studio/desk_zone.py` into
`validation-artifacts/legacy-studio/assets/studio/desk-zone.glb` (about 1.70 MB, same budget check). It shares lights,
exposure, materials and the bake/decal/export pipeline through
`art/studio/studio_art.py`. The older standalone contact script and shared helpers
both use `art/studio/surface_bake.py` for leaf geometry/veins, weave, UVs and surface
map baking. Regenerate each affected zone when changing these helpers. The monitor's screen and the resume folio stay live: the screen is
the projected Work surface, and the folio is picked up. A baked emissive stand-in
lights the keyboard and desk with the screen's glow. Bake duration depends on the device and includes colour, normal and roughness passes.

The full-room finish is authored in `art/studio/living_zone.py` and exported as
`validation-artifacts/legacy-studio/assets/studio/living-zone.glb` (about 1.16 MB, the same 2 MB per-zone guard).
It uses the shared Cycles pipeline for warm grey stone slabs, textured plaster, skirting and sill,
coffee table, woven rug, linen ottoman, mug/coaster/books, cables, headphones,
a draped cardigan, a throw and original wall art. Regenerate with the same Blender
command, replacing the source path with `art/studio/living_zone.py`. Export to a
temporary output directory and copy the successful GLB into `validation-artifacts/legacy-studio/assets/studio/`.
All three zones have been rebaked with surface maps; the chair has actual open mesh
and plant leaves have curved outlines and veins. All three zones fall back to
ordinary room geometry independently. Baked illumination remains static.


## Other source pipelines

`art/outdoor/assets.json` records CC0 source models and textures for retained comparison modes.
`fetch_character.py`, `fetch_clothes.py` and `build_character.py` reproduce that character.
`build_coast.py`, `geometry.py`, `export_scene.py` and `sky.py` own the older geometric coast.
The retired sports rig has its own provenance in `art/games/`. Download caches and intermediate
Blender files remain ignored; the homepage does not load the character or sports artwork.
