# Sunshine Coast passenger terminal — reference review

The YBSU terminal remains on the H116/26 apron-chart footprint, using the same scale, north and registration as the runway and stands. Four independent terminal controls agree with the aerodrome chart within 0.048 PDF points. The control tower remains on the concave landside; the RPT stands remain on the opposite face. The terminal is not a generic building moved to fit the game.

`ybsu-terminal.mjs` supplies the terminal-specific appearance: low pale roofs, a narrow solar spine and shorter frontage strips, pale service-wing walls, main-hall glazing, roof plant, the curved covered walkway and two tensioned entrance sails. The entrance sits across the concave landside boundary, rather than being a pyramid clipped onto the middle of the roof. A nearby curved drop-off road connects to the existing access road. The roof, walls and entrance fabric all select the same terminal upgrade. YBSU supports up to 12× zoom.

## Evidence and interpretation

- [Airservices SUP H116/26](https://www.airservicesaustralia.com/aip/current/sup/s26-h116.pdf), page 4: terminal ground outline and its relationship to the apron and stands. Four control points are independently checked against AD01 in `ybsu-reference.mjs`.
- [Airservices AIC H42/26](https://www.airservicesaustralia.com/aip/current/sup/a26-h42.pdf), Appendix 2: terminal, ATC, curved landside road and security precinct relationship. The game retains its permanent chart layout and does not simulate the temporary works closures.
- [Palisade's existing terminal photograph](https://www.palisadegroup.com/wp-content/uploads/2018/02/SCA-2020-scaled.jpeg): pale low roof, solar strips, curved covered frontage and tensile entry structure. The filename dates this reference to 2020.
- [Robert Myers' aerial, 4 May 2024](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Sunshine_Coast_Airport.jpg): the straight roof spine, broad pale curved roof section, roof plant and landside canopy. Photo inspected in the browser; it is not shipped as a game asset.
- [Operator update, 11 February 2026](https://www.sunshinecoastairport.com.au/corporate/media/media-releases/first-stage-of-terminal-redevelopment-complete-sunshine-coast-airport-opens-new-outbound-baggage-facility/): outbound baggage facility opened. The accompanying interior photo establishes completion, but cannot register a new exterior outline, so no guessed annex was added.
- [Operator arrivals update, 22 June 2026](https://www.sunshinecoastairport.com.au/corporate/media/media-releases/sneak-peek-into-new-arrivals-precinct-and-baggage-claim-as-part-of-terminal-redevelopment-project/): construction was underway; the accompanying illustration is a future render. The full redevelopment is due in 2027. Its future facade is not substituted for the photographed existing terminal.

The building is a photo-informed game miniature. Heights, canopy folds, individual panels, facade subdivisions and the small forecourt features are interpretations, not a measured architectural survey or a live model of construction progress. Ground identity, position, orientation and principal footprint use the published YBSU diagrams.

## QA

The dedicated review artifact is `C:/Users/masonz28/.codex/visualizations/2026/09/09/ybsu-terminal-review/`. It contains the plan, before/after screenshots, a frontage study, a roof plan, geometry and interaction reports, and the isolated production-game screenshots. QA scripts stay outside the repository.

The terminal geometry check verifies independent source controls, an unchanged ground footprint, finite drawing coordinates and roof details contained within that footprint. Browser QA clicks both the main roof and a canopy portion outside it, then tests pan/reset, responsive viewports and reload. An isolated encrypted save exercises the actual game's YBSU screen, camera and terminal management on desktop/mobile. The YBSU traffic regression still passes 1,296 plans and 259,200 sampled poses.

## Clipping follow-up

The entrance mesh now keeps its roof-side anchors and intermediate fabric points clear of the curved eave. The northern roof inset is contained as a whole polygon. YBSU terminal visibility subtracts opaque roof/wall shadow volumes along the camera ray, so rear posts and awnings do not show through the building; fabric faces render from back to front. The same fabric mesh supplies the click target. Visibility geometry is cached by terminal and camera orientation while pan, zoom and resize use the current projection.

The clipping review at C:/Users/masonz28/.codex/visualizations/2026/09/09/ybsu-terminal-clipping/ contains before/after screenshots, the iteration plan, independent whole-polygon and ray/solid checks, interaction reports and measured rendering cost. Final checks found zero roof-detail escapes, zero fabric/roof intersections and zero incorrectly visible samples among 13,530 sampled points.
