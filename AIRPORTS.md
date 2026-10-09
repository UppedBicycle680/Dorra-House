# Dorra Airports

Start **START DORRA GAME.cmd**, open Dorra House, and choose **Dorra Airports**. The direct game page is `http://127.0.0.1:4173/idle-airport.html`. If an older launcher is already running, close that launcher and start it again to load the new airport server.

The game uses the existing installed Node runtime and bundled assets. Playing, saving, and recovering earnings require no internet connection. Keep the local server open during play; after closing it, reopening calculates up to 24 hours of missed production across every owned airport.

## Playing

- The opening dashboard shows all seven airports, their current cash and estimated income per hour. Choose **Visit airport** to enter an open location; **View dashboard** returns to the overview. Locked destinations remain visible. The location name inside the sim still opens airport progression and unlocks.
- Begin at Redcliffe with 500 local cash, 20 shared plane diamonds, a working dirt strip, and a light-aircraft gate.
- Click a facility or empty plot, or open **Build**, to improve the airport. Runway length, runway surface, taxiways, gate size, ground equipment, and research are separate requirements. **Aircraft** explains every missing requirement.
- Drag the airport to pan; scroll or use the +/− controls to zoom. With the playfield focused, arrow keys pan, +/− zoom, and 0 or Home restores the overview. Reduced motion parks the aircraft while the server continues production.
- Cash and research belong to the location where they were earned. Plane diamonds are shared. Old airports keep operating when a new one is selected.
- **Milestones** award one-time prizes. Completed departures occasionally award 1–3 diamonds, including departures reconciled after time away.
- **Land next** and **Take off next** clear the next available interactive flight. **Operations** lists individual flights, their aircraft, airline, destination, stand and extra cash bonus. Gates and runways are assigned automatically; a busy runway or incident explains why clearance is unavailable.
- One express crew can **Prioritise service**. It reduces that flight's remaining service by 20%, once per flight, and remains occupied until service finishes.
- Hire **ATC** permanently at each airport for `250 × 4^airport order` cash. It clears interactive flights automatically and restores full scheduled cash income while away. Automatic clearances can be switched off after purchase. ATC never dispatches incident crews.
- Scheduled gates keep earning independently of interactive flights. Before hiring ATC, an unattended airport earns **75% of its normal scheduled cash**; playing that airport restores 100%. Research, scheduled departure counts and diamond odds are unchanged. Completed interactive flights award a separate bonus equal to 25% of their normal departure cash, rounded down, with the active cash boost applied at completion.
- **Airlines & Routes** assigns simulated services to a compatible gate, or applies a service to all compatible gates. New assignments take effect on subsequent flights. Frequent services pay 90% cash with an 80% cycle, standard services use the normal values, and premium services pay 125% with a 135% cycle. Existing aircraft and airport requirements still apply. Local training, scenic charters and special cargo complement Qantas/QantasLink, Jetstar, Virgin Australia and Emirates profiles; these are game services, not actual schedules.
- **Contracts** offers three eligible jobs and one accepted job per airport. Choose relaxed play or a 15-minute deadline that counts only time spent playing that airport. Contracts count accepted interactive departures, including ATC-controlled flights. A completed contract awards the quoted cash plus 20 research points once. Abandonment and expiry have no fine.
- Fires, fuel shortages and baggage jams occur after 10–15 minutes of active play, with no new incidents while away. Dispatch the displayed crew manually: fires take 60 seconds, fuel shortages 30 seconds and baggage jams 45 seconds. Unanswered incidents recover automatically after five minutes. Only the affected stand is disrupted, interrupted work resumes, and no aircraft or facilities are permanently lost.
- Diamonds buy selected-airport cash boosts (2×, 5×, 10×; 5, 15, 30, 60 minutes), finish construction, pay an alternative purchase price, or open the next airport early. Boosts do not multiply research, diamonds, or one another.
- Click the cash balance to withdraw at **10 airport cash = 1 Dorra**. There are no Dorra deposits, and cash cannot be moved between airports. Leave enough for upgrades if you want to progress quickly.
- Advance through Redcliffe, Archerfield, fictional Queensland Gateway International, Hamilton Island, Sunshine Coast, Gold Coast, and Brisbane. Location size limits remain in force even when spending diamonds.

Progress depends on construction, ATC purchases, routes, contracts, time spent playing and withdrawals. Airports and aircraft requirements are game abstractions; the An-225 is a fictional heritage cargo appearance.

Passenger profiles use compatible existing aircraft families documented by [Qantas/QantasLink](https://www.qantas.com/en-au/onboard/fleet), [Jetstar](https://www.jetstar.com/au/en/about-us/our-fleet), [Virgin Australia](https://www.virginaustralia.com/au/en/travel-info/flying-with-us/our-fleet/) and [Emirates](https://www.emirates.com/us/english/experience/our-fleet/). The game does not reproduce their current timetables.

## Saves and withdrawals

The server owns airport cash, research, diamonds, flight rewards, construction, and unlocks. Browser actions request operations rather than sending replacement balances. Accepted changes are saved before the server replies.

Airport files live in `%LOCALAPPDATA%\DorraHouse\airports`, outside the website:

- `career.v1.enc` and `career.v1.backup.enc`: authenticated AES-256-GCM copies of the latest durable state.
- `installation.key`: the original installation encryption key.
- `server.lock`: excludes a second server from writing the same save.

To move or back up a career, close the launcher and preserve the entire airport save directory together with the original browser's Dorra data. The server career is bound to that browser's local Dorra identity. Copying only the website folder does not copy saved progress. No airport reset or arbitrary money-grant API is provided.

Withdrawals use a durable server receipt and a protected browser payout cursor. If interrupted, reopening reconciles the receipt without repeating the credit. An old or cleared browser wallet is never silently substituted for the original recipient. Dorra House's ordinary progress reset preserves the airport binding and payout cursor.

The airport authority resists browser-console changes, forged amounts, browser-clock edits, stale saves, and ordinary request replays. Other Dorra games retain their existing signed browser-save model. A person controlling the operating system, server code, or both storage systems remains outside the protection of a fully offline installation.

## Implementation

- `airport/catalog.mjs` defines locations, aircraft, projects, prices, and unlock requirements.
- `airport/engine.mjs` performs deterministic, integer-accounted simulation. Per-gate persisted traffic and diamond state make catch-up independent of polling frequency.
- `airport/operations.mjs` owns interactive flights, bounded presence leases, ATC, contracts and incidents. `airport/operations-catalog.mjs` defines simulated services, strategy multipliers and response durations. These additive fields preserve existing encrypted careers.
- `airport/server.mjs` serializes commands and withdrawals; `airport/store.mjs` persists the encrypted career. Neither server module is publicly served.
- `airport/vault-bridge.mjs` runs inside the shared save worker. `save-worker.js`, `vault-client.js`, and the House client protect receipt metadata and synchronize explicit navigation.
- `idle-airport.html`, `idle-airport.css`, `airport/ui.mjs`, and `airport/renderer.mjs` provide the desktop game. Rendering never creates money.
- `airport/layouts.mjs` gives each location its own runway topology, terminal precincts, shoreline or inland setting and north orientation. `airport/REFERENCES.md` documents the official sources and schematic redevelopment choices.
- `airport/brisbane-layout.mjs` authors Brisbane's named taxiways and building precincts. `airport/brisbane-reference.mjs` keeps independent chart calibration points for accuracy checks.
- `airport/aircraft-models.mjs` contains 22 original aircraft models with individual proportions, wings, engines, tails, decks and landing gear. The fleet catalogue uses the same models. Dimensions and variant choices are documented in `airport/AIRCRAFT-REFERENCES.md`.
- `airport/traffic.mjs` separates arrivals, service, pushback, holding, line-up and departures. Fixed visual runway slots prevent conflicting movements. New stands do not reset existing flight phases; runway extensions are adopted after the current visual flight finishes.

The airport layouts are recognisable schematics. Brisbane and Gold Coast use a common geographic, aircraft and pavement scale; other sites compress runway length independently of aircraft and pavement widths. Queensland Gateway uses all six runways for animated traffic. At the other sites, the primary runway carries animated traffic and secondary real-world strips provide visual context. Ordinary aircraft movements illustrate scheduled gate operations and do not replay their departure ledger one-to-one. Interactive aircraft use persisted server phases and earn separate cash bonuses; their landing and takeoff controls govern those phases.

Brisbane follows the staggered parallel runways and chart-based building positions, with distinct international, crescent domestic, general aviation and northern remote aprons. Its twelve existing plots retain their saved IDs. Eighty-five named taxiway paths, eastern maintenance, landside parking and the elevated Airtrain use the original pastel isometric style. See `airport/BRISBANE-SCREENSHOT-QA-PLAN.md` for the current plan, evidence and schematic limits.

Gold Coast now also has chart-anchored runway 17/35 pavement, a fire station beside the control tower, fuel tanks and navigation aids; see `airport/GOLD-COAST-ACCURACY-PLAN.md`.

Gold Coast has a midfield 17/35 crossing, full-length parallel C, named runway links and separate general aviation and commercial aprons. Its nine plots retain their saved IDs. See `airport/GOLD-COAST-LAYOUT-PLAN.md` for the completed layout plan, references and checks.

The original Imagegen assets remain bundled in `assets/airport/`; `assets/airport/ASSETS.md` records their provenance. The map now uses precise projected aircraft geometry instead of class-wide aircraft sprites, and retains the local scenery texture. Static scenery and parked aircraft are cached, animation pauses behind dialogs, and the canvas has a six-million-pixel budget; DOM controls and fonts stay at native resolution.

Queensland Gateway International replaces the former Granite Plains Regional with the Tidal Ribbon design: six staggered 4,500 m runways, 192 independent stands, one S-shaped terminal with six connected concourses, six engineering hangars, freight warehouses, a covered rail station and an airport city. Continuous taxiway, service-road and rail networks join the whole site. The original saved airport and plot IDs are retained. Super-heavy development is optional for onward progression. See `airport/QUEENSLAND-GATEWAY.md` for details and verification.

## Verification

Run from the project directory:

```text
node --test airport-operations-regression.test.mjs airport-service-regression.test.mjs airport-traffic-operations-regression.test.mjs
node airport-browser-operations-regression.mjs
```

The Node tests need no additional packages. Browser regression needs an installed Playwright runtime and Chromium; `NODE_PATH` can point to a bundled runtime. It uses the real game UI with an isolated encrypted service save and a controlled clock, covering flight controls, routes, contracts, incidents, mobile layouts and all seven maps. It never opens the player's real airport career. Screenshots are generated under `output/playwright/airport-operations/` (or `DORRA_QA_OUTPUT`) and can be removed after review.

`DORRA_QA_MODE=ui` or `maps` runs each browser check separately; the default runs both. `DORRA_QA_AIRPORTS` optionally limits map checks to comma-separated airport IDs. Map checks include moving-plane selection and warmed frame timings, using all 192 Gateway and 197 Brisbane stands. Reduced-motion checks verify static aircraft positions while the confirmed phase clock advances.

`DORRA_PORT` and `DORRA_AIRPORT_DATA_DIR` exist for isolated local testing. Normal play uses the stable default address; the launcher reuses a matching existing server and reports an occupied port instead of silently switching browser storage origins.

Brisbane now draws its domestic, international, northern and logistics apron parking from the published stand inventory. Its 197 fixed-wing configurations are each purchasable operating spaces; alternate positions share pavement, so ownership does not imply simultaneous use. Players can activate an owned alternative and pause conflicting bays. The original twelve saved plot IDs and upgrades are retained. The terminals, circular lounges and jetways retain the game's established colours. Current implementation status and screenshot evidence are recorded in `airport/BRISBANE-TERMINAL-CAPACITY-PLAN.md`; movement QA remains part of that active goal.

