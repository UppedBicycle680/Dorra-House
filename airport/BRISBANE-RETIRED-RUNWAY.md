# Former runway 14/32 — retention and parking

The requested old Brisbane runway is interpreted as the modern airport's retired crosswind runway 14/32. It was decommissioned in 2020. The 07/25 designation belongs to an earlier Eagle Farm runway, not this surviving strip.

Plan: identify the surviving pavement and published parking stops; restore the clipped northern section; paint permanent-closure Xs; verify purchasing, flight-operation exclusion and actual aircraft movement; inspect screenshots against the source imagery and correct visual defects.

## Sources and geometry

- [Brisbane Airport, April 2020](https://newsroom.bne.com.au/bne-keeps-front-door-to-queensland-open-while-working-towards-recovery/) confirms aircraft parking on runway 14/32.
- [Brisbane Airport, May 2020](https://newsroom.bne.com.au/touch-and-go-on-brisbanes-new-runway/) confirms decommissioning during the new runway's readiness works.
- [BAC 2014 runway booklet](https://www.bne.com.au/sites/default/files/docs/Brisbane%20Airport%20Current%20and%20Future%20Flight%20Path%20and%20Noise%20Information%20Booklet_Part%201_April%202014.pdf) gives the former strip's dimensions: 1,760 x 30 m.
- Airservices BBNAP06-187 supplies the surviving pavement axis and parking positions. Its top neatline crops the northern runway; it is not the end of that runway. The retained 30 m surface continues along this registered axis to the historical length, with the existing apron shoulders preserved.
- The existing Esri/Vantor October 2025 aerial reference independently confirms the full strip's placement. The yellow overlay is registered through the published geographic grid, without fitting it to satellite landmarks. This is chart/aerial game accuracy, not survey accuracy.
- [CASA MOS 8.106](https://www.legislation.gov.au/F2019L01146/2024-12-14/2024-12-14/text/original/epub/OEBPS/document_1/document_1.html) specifies white permanent-closure markings, removal of former operating markings, crosses at both ends and intervals no greater than 300 m. Eight crosses use 36 x 14.5 m proportions and 1.8 m strokes. Their exact stations are the game's closure depiction, not a claim to surveyed paint locations.

## Implementation and QA

The strip is parking pavement and a separate retired-runway record. It is excluded from the operating runway inventory. It has no landing numbers, threshold bars, active centreline or runway lighting. Existing R1–R5 and alternative R1A occupy the strip; R6–R8 occupy its adjoining spur. All nine retain their original individual purchase identifiers, aircraft limits and conflict protection. The airport still has 197 published purchasable parking configurations.

The first screenshot round exposed an inverted label overlapping the north-apron name. The label was rotated and moved to the clear northern section, then screenshots were repeated.

Checks: `node airport-brisbane-retired-runway-regression.mjs`; `node airport-brisbane-capacity-regression.mjs`; `node airport-brisbane-all-taxiways-regression.mjs`; `node airport-brisbane-retired-runway-qa.mjs`.

Evidence: `output/playwright/brisbane-terminal-capacity/retired-runway/` contains 36 production-renderer aircraft screenshots (taxi-in, servicing, pushback and taxi-out at each of nine bays), four static views and a scene snapshot. `output/playwright/brisbane-all-taxiways/retired-runway/former-14-32.png` contains the registered aerial comparison. Purchasing and encrypted-save checks cover all 197 positions. The existing 87-taxiway / 24-runway-connection regression also passes.

The earlier full-airport audit remains a historical acceptance record for its saved inputs; this change's evidence is stored separately.
