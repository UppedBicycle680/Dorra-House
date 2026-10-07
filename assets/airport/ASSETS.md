# Airport artwork

**Accuracy update:** the aircraft and building atlases below are retained as original artwork and provenance. The current playfield uses 22 individually proportioned aircraft from `airport/aircraft-models.mjs` and buildings projected onto the airport-specific footprints. This avoids rotating a single isometric sprite into the wrong perspective or using one A380 image for every super aircraft. The local coastal texture remains in use. See `airport/AIRCRAFT-REFERENCES.md` and `airport/REFERENCES.md` for current visual sources and conventions.

Generated on 2026-09-06 using the built-in Imagegen tool and the imagegen skill. Three original generations; no CLI/API fallback or variant set. All files are **1536 × 1024**. The artwork shares ivory concrete/fuselages, navy and teal accents, turquoise glass, warm sunlight, and a polished miniature airport-tycoon style.

| Project asset | Original generated filename | Format |
|---|---|---|
| aircraft-atlas.png | exec-74ee6482-64c6-4dbc-b850-02e15789b544.png | 32-bit ARGB, real transparency |
| buildings-atlas.png | exec-e4d8843f-4f1e-451d-8a53-270b5bb5090b.png | 32-bit ARGB, real transparency |
| coastal-terrain.png | exec-81608606-1498-4022-8176-931787c3794f.png | 24-bit RGB, opaque |

Original generation directory: `C:/Users/masonz28/.codex/generated_images/01a07523-fa0c-75d3-b51a-b858c92be694/`. Its `airport-assets-manifest.md` preserves the complete verbatim prompt set.

## Prompt briefs

**Aircraft:** Transparent functional 3-column × 2-row aircraft sprite atlas. Row 1: Cessna 172 light single-engine high-wing propeller aircraft; Q400 twin turboprop; E190 small regional jet. Row 2: 737 medium narrowbody; 777 heavy widebody; A380 four-engine double-deck super jumbo. Consistent orthographic high isometric camera, ivory fuselages, navy undersides, teal tails, crisp premium toy-like 3D forms. Isolated assets with empty transparent margins. No labels, logos, UI, ground, runways, or scenery.

**Buildings:** Transparent functional 3-column × 2-row building atlas. Row 1: passenger terminal with three short jet bridges and curved turquoise roof; control tower; fuel/ground equipment depot. Row 2: research centre with satellite dish; arched hangar/cargo warehouse; baggage tug, trailers, and stairs vehicle cluster. Same high isometric miniature style, ivory/navy/teal materials, ochre apron details. Each object on a small isolated apron pad. No aircraft, roads connecting assets, text, labels, or UI.

**Terrain:** Opaque wide Queensland subtropical coastal terrain map. At least 80% continuous flat unobstructed green grass through centre, lower half, and right side. Narrow turquoise water/sand sliver in far upper-left; palms and vegetation at top/left perimeter only. High top-down slight isometric miniature rendering, bright sunlight, subtle grass texture. No airport infrastructure, runways, buildings, roads, vehicles, aircraft, text, or UI.

## Cropping and integration

Use these custom crop rectangles, **[x, y, width, height]**. Bounds were measured from pixels with alpha >16. Add approximately **3 px transparent margin** per side when cropping. Equal 512 × 512 cell crops will clip some artwork.

| Aircraft | Rectangle | Building | Rectangle |
|---|---|---|---|
| light | [118,169,279,180] | terminal | [15,76,545,427] |
| turboprop | [571,43,402,351] | tower | [631,16,282,490] |
| small | [1084,57,424,327] | depot | [996,87,521,355] |
| medium | [41,560,443,345] | research | [14,541,462,415] |
| heavy | [512,514,493,399] | hangar | [493,571,546,345] |
| super | [1021,494,493,418] | vehicles | [1062,599,466,329] |

Aircraft noses point **lower-left**, approximately **140° from the positive screen x-axis**, although the prompt requested upper-right. Account for this baseline when drawing heading rotations. Aircraft proportions and engine counts distinguish the six classes. The super sprite crosses the nominal horizontal and vertical cell boundaries. Building footprints also vary beyond nominal grid cells.

Both atlases have verified zero alpha in empty corner and central-gap pixels; the dark gradient visible in tool previews is not an opaque background. Preserve PNG alpha. Terrain has approximately 85% clear grass and no visible infrastructure.
