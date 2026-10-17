# Estate workspace

Implements the selected **option 1: Estate Workspace** for Through the Estate.

- [Editable desktop design](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=29-19)
- [Editable mobile design](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=29-20)
- [Published application](https://uppedbicycle680.github.io/Dorra-House/)

The estate uses compact navigation, a financial summary, one next investment,
a separate income bank, and a venue roadmap. Desktop first-owner overviews fit
1440×900, 1366×768, and 1280×720. Smaller screens stack the content; detailed
management sections and expanded trading reports use natural vertical scrolling.

`estate-workspace.js` renders existing state and retains the existing action
attributes. Supabase continues to approve purchases, collection, staffing,
week closure, and saves through the current API. No data migration is required.
Opening cost and base output are distinct from the live trading projection.
Closing a business week and collecting offline income remain separate actions.
Projected losses retain their minus sign even though the existing general wallet
formatter clamps negative numbers to zero.

Manrope and Cormorant Garamond follow the launch page. Icons reuse the vendored
MIT-licensed Tabler font. Figma uses the corresponding official Tabler outline
SVGs, reusable navigation/action/metric components, and existing Launch tokens.
The desktop and mobile frames contain native text and component instances.

## Terrace artwork provenance

`assets/estate-terrace-v1.png` is a generated photograph, 2170×725 pixels. It is
used in the next-move card and the Terrace portfolio detail. The existing build
optimizes it to WebP at its original dimensions and quality 95.

Generated with built-in Image Gen. The selected option 1 concept was provided
only as a visual reference. Final prompt:

> Photorealistic panoramic luxurious welcoming Terrace Cafe frontage at dusk;
> old stone facade, emerald awnings marked “THE TERRACE”, warm brass lamps,
> marble bistro tables, dark woven chairs, potted greenery and candlelit terrace.
> Eye level wide 3:1, facade/signage in center vertical band attractive at 4:1
> crop. Cinematic amber interior, deep emerald and cool evening shade. No
> featured people. Only photograph, no UI, cards, buttons, icons, overlays,
> watermark, or extra slogans.

## Validation

Local UI verification used the Codex in-app browser, as requested, with disposable
Supabase profiles. All seven estate sections, locked venue detail, House links,
dashboard return, keyboard focus, purchase, collection, week closing, staffing,
and saved-state reload were exercised. Responsive checks covered 1440×900,
1366×768, 1280×720, 1024×768, and 390×844.

`npm run check`: 188 modules. `npm test`: 75 passing tests. `npm run build`:
301.1 MiB, including the optimized Terrace photo. The existing deployment
workflow retains its authentication, gameplay, browser, and cloud-save checks.
See the estate section of `design-qa.md` for visual comparison evidence.
