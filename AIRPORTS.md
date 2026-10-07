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
- Diamonds buy selected-airport cash boosts (2×, 5×, 10×; 5, 15, 30, 60 minutes), finish construction, pay an alternative purchase price, or open the next airport early. Boosts do not multiply research, diamonds, or one another.
- Click the cash balance to withdraw at **10 airport cash = 1 Dorra**. There are no Dorra deposits, and cash cannot be moved between airports. Leave enough for upgrades if you want to progress quickly.
- Advance through Redcliffe, Archerfield, fictional Queensland Gateway International, Hamilton Island, Sunshine Coast, Gold Coast, and Brisbane. Location size limits remain in force even when spending diamonds.

The reference balancing simulation reaches Archerfield on day 1 and Brisbane on day 10.5 using two 30-minute sessions daily, without boosts or withdrawals. Actual progress depends on construction and spending choices. Airports and aircraft requirements are game abstractions; the An-225 is a fictional heritage cargo appearance.

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
- `airport/server.mjs` serializes commands and withdrawals; `airport/store.mjs` persists the encrypted career. Neither server module is publicly served.
- `airport/vault-bridge.mjs` runs inside the shared save worker. `save-worker.js`, `vault-client.js`, and the House client protect receipt metadata and synchronize explicit navigation.
- `idle-airport.html`, `idle-airport.css`, `airport/ui.mjs`, and `airport/renderer.mjs` provide the desktop game. Rendering never creates money.
- `airport/layouts.mjs` gives each location its own runway topology, terminal precincts, shoreline or inland setting and north orientation. `airport/REFERENCES.md` documents the official sources and schematic redevelopment choices.
- `airport/brisbane-layout.mjs` authors Brisbane's named taxiways and building precincts. `airport/brisbane-reference.mjs` keeps independent chart calibration points for accuracy checks.
- `airport/aircraft-models.mjs` contains 22 original aircraft models with individual proportions, wings, engines, tails, decks and landing gear. The fleet catalogue uses the same models. Dimensions and variant choices are documented in `airport/AIRCRAFT-REFERENCES.md`.
- `airport/traffic.mjs` separates arrivals, service, pushback, holding, line-up and departures. Fixed visual runway slots prevent conflicting movements. New stands do not reset existing flight phases; runway extensions are adopted after the current visual flight finishes.

The airport layouts are recognisable schematics. Brisbane and Gold Coast use a common geographic, aircraft and pavement scale; other sites compress runway length independently of aircraft and pavement widths. Queensland Gateway uses all six runways for animated traffic. At the other sites, the primary runway carries animated traffic and secondary real-world strips provide visual context. Aircraft movements illustrate the server's operations and do not represent a one-to-one replay of its departure ledger.

Brisbane follows the staggered parallel runways and chart-based building positions, with distinct international, crescent domestic, general aviation and northern remote aprons. Its twelve existing plots retain their saved IDs. Eighty-five named taxiway paths, eastern maintenance, landside parking and the elevated Airtrain use the original pastel isometric style. See `airport/BRISBANE-SCREENSHOT-QA-PLAN.md` for the current plan, evidence and schematic limits.

Gold Coast now also has chart-anchored runway 17/35 pavement, a fire station beside the control tower, fuel tanks and navigation aids; see `airport/GOLD-COAST-ACCURACY-PLAN.md`.

Gold Coast has a midfield 17/35 crossing, full-length parallel C, named runway links and separate general aviation and commercial aprons. Its nine plots retain their saved IDs. See `airport/GOLD-COAST-LAYOUT-PLAN.md` for the completed layout plan, references and checks.

The original Imagegen assets remain bundled in `assets/airport/`; `assets/airport/ASSETS.md` records their provenance. The map now uses precise projected aircraft geometry instead of class-wide aircraft sprites, and retains the local scenery texture. Static scenery and parked aircraft are cached, animation pauses behind dialogs, and the canvas has a six-million-pixel budget; DOM controls and fonts stay at native resolution.

Queensland Gateway International replaces the former Granite Plains Regional with the Tidal Ribbon design: six staggered 4,500 m runways, 192 independent stands, one S-shaped terminal with six connected concourses, six engineering hangars, freight warehouses, a covered rail station and an airport city. Continuous taxiway, service-road and rail networks join the whole site. The original saved airport and plot IDs are retained. Super-heavy development is optional for onward progression. See `airport/QUEENSLAND-GATEWAY.md` for details and verification.

## Verification

Run from the project directory:

```text
node airport-queensland-gateway-regression.mjs --browser
node airport-regression.mjs
node --test airport-server-regression.mjs
node airport-vault-regression.mjs
node airport-browser-regression.mjs
node airport-layout-regression.mjs
node airport-gold-coast-regression.mjs
node airport-brisbane-accuracy-regression.mjs
node airport-brisbane-straightness-regression.mjs
node airport-brisbane-screenshot-qa.mjs review
node airport-traffic-regression.mjs
node airport-visual-regression.mjs
node security-save-regression.mjs
node progression-regression.mjs
node football-regression.mjs
node campaign-regression.mjs
```

Browser regressions use the repository's existing Playwright runtime and isolated temporary server saves. They do not edit the player's real airport career. Desktop screenshots are saved under `output/playwright/airport-*`.

`DORRA_PORT` and `DORRA_AIRPORT_DATA_DIR` exist for isolated local testing. Normal play uses the stable default address; the launcher reuses a matching existing server and reports an occupied port instead of silently switching browser storage origins.

Brisbane now draws its domestic, international, northern and logistics apron parking from the published stand inventory. Its 197 fixed-wing configurations are each purchasable operating spaces; alternate positions share pavement, so ownership does not imply simultaneous use. Players can activate an owned alternative and pause conflicting bays. The original twelve saved plot IDs and upgrades are retained. The terminals, circular lounges and jetways retain the game's established colours. Current implementation status and screenshot evidence are recorded in `airport/BRISBANE-TERMINAL-CAPACITY-PLAN.md`; movement QA remains part of that active goal.

