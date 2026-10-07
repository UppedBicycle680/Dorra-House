# Generated aircraft previews

These 22 transparent 720 x 420 PNGs are fleet-dialog views of the production
aircraft geometry. They use the same camera and renderer as `aircraftSvg()`;
they are not independently drawn assets. Generating them ahead of time avoids
building cold high-polygon meshes on the UI thread when the fleet opens.

After changing any aircraft model, fidelity, raster or propeller module:

```powershell
node airport/build-aircraft-previews.mjs
node airport/build-aircraft-previews.mjs --check
node airport-aircraft-fidelity-regression.mjs
```

The build uses the repository's Playwright Chromium installation. `--check`
does not write assets: it verifies source hashes, complete catalogue coverage,
file hashes, dimensions and every decoded RGBA component against a fresh live
map render. The mesh regression also rejects stale source hashes. Keep the PNGs
and generated `manifest.json` together when distributing the offline game.

The map continues to render the full live models. The fleet uses fixed livery,
gear-down and reduced-motion artwork, matching its previous presentation.
