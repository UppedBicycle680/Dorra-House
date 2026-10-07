# Queensland Gateway International — Tidal Ribbon

Original fictional Queensland mega hub, replacing Granite Plains Regional. The selected **Tidal Ribbon** concept is implemented in the existing interactive airport renderer. YQGI is a fictional identifier. The `granite-plains` career key, unlock position, balances, upgrades and all plot IDs remain compatible.

## Layout and architecture

- Six parallel 4,500 × 60 m runways in two staggered banks of three. The eastern bank extends 250 world units farther south. Adjacent fictional runway numbers distinguish the two banks.
- One continuous S-shaped terminal with two sculpted ribbon roofs, a glazed central galleria, structural ribs, shaded glass facades and an entrance hall.
- Six connected double-sided concourses, A–F, with 32 independent stands each. There are 160 passenger jet bridges and 32 freight stands. All 192 plots retain their original IDs.
- A covered arrivals gallery connects the terminal directly to the barrel-roofed airport rail station. Hotels, parking terraces, landscaped forecourts, reflecting pools and rain gardens form one landside district.
- Six western engineering hangars and six eastern freight warehouses, plus cargo handling, fire stations, fuel compounds, a solar park, service yards and apron lighting.
- The camera is rotated for this airport so the central ribbon and the two runway banks read clearly. The other airports retain their normal camera orientation.

Runways, aircraft, stands and pavement share a scale of 0.12 world units/metre. The concept illustration is interpreted through the game's existing procedural isometric artwork; it is not a static background image. The comparison reference is `output/design/tidal-ribbon-reference.png`.

## Connected operations

The 94 named taxiways form one continuous network. Each runway has parallel taxiways, entry and exit connectors, rapid exits and approach lighting. Outer-runway traffic travels around its bank's ends instead of crossing a neighbouring active strip. Northern and southern transfer taxiways connect the two sides of the airport.

All 62 passenger terminal sections form one connected building complex. Road and railway networks also connect throughout the site. The entrance road and rail line pass underneath the southern cross-airport taxiway.

Flight slots remain independently scheduled per runway. Stand routes include approach, landing, exit, taxi-in, servicing, pushback, taxi-out, hold, line-up, takeoff and climb. North- and south-facing stands have correctly oriented jet bridges, paint, aircraft and holding headings.

The airport's full physical footprint is visible from the outset. Operating-length certification, gate size, pavement, handling and research still determine which aircraft may operate. Unowned plots remain unowned until purchased. Super-heavy expansion remains optional for onward career progression.

## Verification and preview

Run `node airport-queensland-gateway-regression.mjs --browser`. It uses an isolated temporary encrypted career and fresh browser profile, never the player's save.

Checks cover all 192 plot IDs, saved-career compatibility, all 22 aircraft types, connected taxiway/terminal/road/rail networks, taxiways remaining on land, pavement adherence, no foreign active-runway crossings, building clearance, six independent runway reservations, 491,520 sampled poses, sparse-terminal schedules, final-plot purchase, income settlement, grouped Build controls, responsive HUDs, stand selection and browser errors.

Screenshots and results are in `output/playwright/queensland-gateway/`. Design comparisons are in `output/design/`; the visual review is `design-qa.md`.

`node tmp/tidal-ribbon-preview.mjs` opens a read-only presentation at `http://127.0.0.1:4197`. It uses an entirely synthetic fully developed airport in memory and exposes no save or command API. It supports overview, terminal, arrivals, live traffic, panning, zooming and stand inspection. The actual game changes are in the normal airport modules and load when the game is reopened or refreshed.
