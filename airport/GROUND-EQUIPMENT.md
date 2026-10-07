# Ground equipment

The airport now uses nine authored 3D ground-support meshes in place of the
simple fuel/tug blocks. Open **Build → View ground fleet**, or select the Ground
equipment building and choose **View ground fleet**, to inspect front/rear views.

| Model | Triangles | Handling level |
| --- | ---: | ---: |
| Aviation fuel bowser | 42,572 | 1 |
| Pushback tractor | 31,573 | 2 |
| Baggage tractor and covered cart | 57,223 | 2 |
| Ground power unit | 21,668 | 3 |
| Belt loader | 16,510 | 3 |
| Mobile passenger stairs | 17,368 | 3 |
| Passenger apron bus | 53,888 | 3 |
| Container high loader | 17,500 | 4 |
| Heavy pushback tractor | 32,373 | 5 |

These are illustrative fleet designs in metres, not manufacturer CAD. Curved
tyres, wheel hubs/bolts, fuel tank shoulders, hose reels, tank bands, hydraulic
cylinders and tubular rails carry the tessellation. Flat panels have chamfered
edges without unnecessary coplanar subdivisions. The fleet includes glazed
cabs, mirrors, wipers, access steps, warning beacons, grilles, luggage, stair
treads, conveyor cleats, stabilisers, a scissor lift and cargo transfer rollers.

The tractor models were subsequently rebuilt against manufacturer references:
the tug now has a low raked cab, real wheel openings, recessed entry, detailed
pneumatic tyres and front/rear pin-type hitches. The baggage tractor has an open
operator station behind its bonnet, unequal front/rear tyres and a connected
covered cart with a 5 x 10 ft floor, steering turntable, curtains and a pitched
roof. See [the reference notes](GROUND-EQUIPMENT-REFERENCES.md) for the source
dimensions and the boundary between published specifications and interpretation.

## Integration

- `ground-equipment.mjs` builds and caches each mesh once. It shares the existing
  aircraft WebGL depth buffer and bounded rendered-view cache. Its canvas-only
  fallback has a separate 4-million-pixel / 64-view limit.
- `ground-equipment-tractors.mjs` owns the reference-led tractor/cart geometry,
  including the tyre sections, cab framing, steering, hitches and cart hardware.
- `ground-equipment-bus.mjs` adds a wide low-floor apron bus with six paired
  passenger doors, panoramic glazing, curved roof shoulders, cooling fans and
  guards, detailed tyres/rims, genuine wheel openings, mirrors and wipers.
- `ground-equipment-placement.mjs` stages equipment on existing non-scenic apron
  pavement, excluding holes, buildings, stand envelopes, roads, taxiways,
  jet-bridge corridors and protected runways. Padded bounds come from the mesh vertices. Placements are
  recalculated when airport infrastructure changes, not every frame.
- Level 1 starts with one bowser. Upgraded light/regional airports stage up to
  six appropriate units; larger airports stage up to sixteen. Bigger loaders
  and heavy tractors require an airport that supports heavy aircraft.
- Moving aircraft and pushback tractors take priority over staged equipment.
  Staged units that intersect their clearance envelope are hidden during the
  movement. Pushback uses the detailed tractor, with a heavy version for heavy
  aircraft at handling level 5.
- `passenger-shuttle.mjs` adds visual passenger transport to remote stands at
  handling level 3. A bus waits at the terminal, drives a validated apron loop
  when its stand has a passenger service, pauses for drop-off, then returns.
  Rounded turns have a 9 m centreline radius; travel speed is 4 m/s. The full
  route is reserved against other ground equipment and sampled for clearance.
  Jetway and cargo stands are excluded. When no complete loop fits, the bus
  waits at a clear nearby stand position. Reduced motion keeps it parked.
  The upgraded fixture finds a moving loop at Hamilton Island;
  Queensland Gateway, Sunshine Coast, Gold Coast and Brisbane receive staged buses. Vehicle
  motion is visual and does not change departure timing, revenue or save data.
- `ground-equipment-ui.mjs` creates cached preview images from the same meshes.
  Front and rear buttons use the normal dialog keyboard/focus behavior. Preview
  cards use two columns on desktop and one on narrow screens.
- Airport geometry, aircraft meshes, routing algorithms, economy and save data
  remain independent of the equipment renderer.

## Validation

Run `node airport-ground-equipment-qa.mjs`. It uses a read-only local fixture
server and an isolated browser; it does not load or edit the player's save.
The report and screenshots are in `output/playwright/ground-equipment/`.

The suite checks triangle budgets, finite vertices/normals, metre-scale bounds,
ground contact, handling/ownership constraints, equipment separation across all
seven airports, model rendering from both sides, integration in three airport
scenes, moving-aircraft clearance, the real fleet dialog, mobile sizing, preview
containment, Escape dismissal and rendering without WebGL.

`node airport-passenger-shuttle-regression.mjs` checks six doors, wheel/roof
detail, continuous outbound/return motion, dwell states, aircraft priority,
reserved-route clearance, no-service idle behavior and handling/cargo limits.

`node airport-bus-visual-qa.mjs` renders bus close-ups from both ends, advances
241 deterministic production-renderer frames through all four shuttle phases,
and verifies the bus without WebGL. It uses an isolated passenger-service
fixture and does not access the player's save. Screenshots and the result are
`bus-front.png`, `bus-rear.png`, `bus-passenger-stand.png` and `bus-results.json`
in the equipment output directory.

`node airport-regression.mjs` passed all 14 economy/progression groups. The much
larger existing aircraft-only traffic sweep completed Redcliffe and Archerfield
scenario traversal, then was stopped in favour of the equipment-focused motion
checks; a full aircraft traffic sweep is not claimed for this change.
