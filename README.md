# Dorra House · Online Alpha

Play [Dorra House](https://uppedbicycle680.github.io/Dorra-House/) with a registered Supabase account. GitHub Pages hosts the browser client; authenticated Edge Functions and private PostgreSQL tables own saved progress and gameplay outcomes. House, Estate, Airports, Football and account administration use the existing online services. Strategic Command now uses the independent war simulation below. There is no offline save fallback.

## Strategic Command

Create a solo campaign against AI or join other registered players in public or invite-only operations. Choose a two-nation duel or the full world, then select fast or persistent time. Research national equipment and capabilities, build and upgrade facilities, mobilise formations, issue orders, manage diplomacy and contest provinces. Solo operations can pause and resume; multiplayer operations continue while players are away. Desktop and mobile share the same saved world.

Solo AI has three command levels: Recruit reviews every 12 game hours with up to two manoeuvres, Standard every six hours with up to four, and Veteran every three hours with up to six. All receive the same one-game-hour opening delay and use normal national starting forces, income, costs, combat and fog of war. Difficulty changes planning frequency and commitment, without resource or combat bonuses. The setup compares public scenario starting strength; picking a much stronger rival remains an asymmetric challenge at every difficulty. World solo campaigns activate the chosen rival; other unclaimed nations defend their territory.

The AI keeps a capital reserve, reinforces visible incursions, withdraws damaged formations, uses artillery and air defence in their roles, and stages island assaults through mapped ports. Mobilisation fills missing combat roles within resource reserves and a territory-scaled force target. Human and AI orders share the same private validation functions. Hidden forces and enemy orders cannot influence AI planning. Active rivals assess peace proposals on their decision cycle; accepted truces remain in force. Nuclear use is retaliatory rather than an automatic opening choice.

The full map retains 258 source regions and 4,603 real administrative provinces. There are 204 populated selectable country/scenario profiles; dependencies use the source dataset's sovereign parent while retaining their own map chunks. The representative equipment catalogue contains 95 formations, programmes and platforms across eight research branches. Named hardware has explicit operator allowlists and source links. Baseline infantry, engineering, logistics and command programmes are labelled scenario abstractions. Hardware coverage is curated rather than a complete national order of battle.

Combat follows platform roles: unarmed sensors and transports do not become assault weapons, ordinary infantry cannot shoot down aircraft or damage submerged submarines, and anti-air, anti-armour and anti-submarine systems use their appropriate counters. Anti-ship missiles target visible hostile surface or embarked formations; defensive interceptors protect friendly territory instead of bombarding provinces. Nuclear strikes retain area damage, collateral casualties and fallout. Fighter interception can defend a friendly base, while combat sorties reserve fuel for a return flight and ferry transfers may use the full transfer range. All effectiveness values and distances remain authored game statistics.

Own formations expose authoritative supply efficiency, entrenchment, carrier attachment and defensive cooldowns in their inspector; opponents receive no private readiness fields or readiness-change hints. The intelligence roster provides a keyboard-accessible way to select and focus formations. Operation summaries spell out capital-hold and territorial victory conditions.

Research now groups programmes into visible facility tiers with actual prerequisite links, national/import access, two concurrent project slots and a selected equipment dossier. The phone layout uses a compact branch picker and drawer-contained navigation. Mobilisation comes before infrastructure, distinguishes researched equipment from equipment that can be produced at the selected province, and shows the specific occupied construction queue. Original [unit-family artwork](assets/war/art/README.md), role summaries, counters and inspectable game ratings accompany the catalogue. Illustrations represent roles rather than exact vehicle models; equipment names, operators and source links remain catalogue data.

The map offers political ownership, diplomatic relations, terrain and reported morale views, with matching legends and local city/unit/range/route toggles. Country focus fits its primary theatre, capital and port labels take priority, and overlapping formation counters can be tapped repeatedly to select their members. Illustrated counters share the same 24 role panels as dossiers and production cards. Selected friendly units can show their listed game range and known movement route; hidden enemy orders, ranges and formations are not inferred. Touch pinch preserves its map anchor and permits continued one-finger panning. Arrow keys pan a focused map; the army roster remains the accessible alternative to map selection.

Research availability filters use actual prerequisites, national access, resource balances, queues and facilities. Programme paths name real cross-branch dependencies and subsequent unlocks. Desktop queues stay above independently scrolling tree and dossier panes; phones keep one drawer scroll, a branch picker and touch-sized filters. The dossier puts investment and the research action before detailed ratings. Researched equipment links to a suitable owned mobilisation base, or to province selection when its facility is missing, and always requires a separate production order.

Match cash, supplies, fuel, electronics and manpower are separate from the House wallet. Eligible completed matches can pay a House reward once: 250 Dorra for participation plus 750 for victory, within a combined 1,000-Dorra daily cap using the Australia/Brisbane day. Retiring and very short operations are ineligible. Permanent reward receipts prevent duplicate claims. Previous Strategic Command campaigns remain archived in the existing player save; legacy commands cannot spend House funds or replace that archive.

Gold is a separate account currency with **no payment system, purchases or starting grant**. Claiming an eligible victory awards **5 Gold**, capped at **10 per Brisbane calendar day**, independently of the House cash cap. The existing minimum of one game day and retirement exclusions apply. Administrators can use **Players → Resources → War simulation Gold → Grant Gold** for tournament or support awards, including accounts without a House save. Grants require current administrator access, a positive whole amount up to 100,000, a reason and explicit confirmation; the server records an immutable receipt and audit entry. Moderators cannot see or grant Gold balances.

Gold can instantly finish one already-paid research, production or construction queue item in a running operation. The server quotes **10 Gold per remaining game hour**, rounded up to the next Gold with a minimum of 1; confirmation can cost less as time elapses but never more than the quoted price. Quotes expire after one real minute. Finished/lost/foreign jobs, expired quotes, paused worlds and insufficient balances cannot spend Gold. Ordinary gameplay and account income are unchanged. Wallet summaries stay small during map updates; the explicit wallet dialog fetches private recent activity. Permanent spend and reward receipts outlive ordinary request, event and match pruning.

## Architecture and data

The editable [Skunkworks Figma design](https://www.figma.com/design/iF5NVZwPGDTDTBqiBzXktl) covers seven desktop and seven phone screens. The production interface uses a Canvas political map, accessible DOM panels, keyboard orders, pointer selection and touch zoom.

The [command-experience review frames](https://www.figma.com/design/iF5NVZwPGDTDTBqiBzXktl?node-id=18-2312) add six editable desktop/phone screens for research, mobilisation and Gold, with equipment, queue and four-state research components. The original fourteen screens remain preserved.

`war/client.mjs` sends bounded command intentions through `supabase/functions/dorra-war`. Version-one public contracts are documented in `war/contracts.d.ts`; the gateway negotiates `protocolVersion: 1`. The gateway authenticates the account and checks the active House gameplay lease. PostgreSQL implements the match rules once: membership, server time, movement, combat, visibility, research, production, construction, diplomacy and rewards. Request identifiers bind retries to their original command. Browser state, outcomes, balances and clocks are never accepted as authority.

The database dispatcher advances due events through `pg_cron`, including when nobody has the page open. Private per-player Realtime channels carry revision hints; clients retrieve authenticated, fog-filtered views and apply checked deltas. Hidden enemy formations do not enter the visible projection. A replaced or revoked gameplay session stops issuing commands until the player signs in or takes over again.

`war/catalog.mjs` supplies the browser catalogue and shared construction/research quotes. Production geometry is split into `assets/war/provinces/<regionId>.json`; parent nation `regionIds` lists the chunks it owns. The initial world map, nation profiles, equipment records and naval routing are under `assets/war/`. Geometry is not duplicated in match database rows.

The reproducible generator uses pinned, SHA-256-verified Natural Earth v5.1.2 admin0/admin1 boundaries, populated places, ports and geographic regions. Land neighbours come from original shared boundaries; simplification preserves the source shapes. Maritime links use a land-tested ocean waypoint graph with antimeridian connections. Raw inputs and build caches stay in ignored `work/`, and only derived production assets ship.

```sh
python -m pip install shapely==2.1.2
python scripts/build-war-world.py
# After equipment or price changes only:
python scripts/build-war-world.py --catalog-only
```

See [the world-data notes](assets/war/README.md) and `assets/war/manifest.json` for source URLs, hashes, transformation rules, identifiers and political-boundary conventions. Natural Earth's historical GDP estimates retain their source years. Military indices, prices, timers, movement, radar, stealth, electronic warfare, combat and nuclear effects are authored game abstractions. The map is not a current territorial-control assertion or a navigational chart, and equipment availability is not an exact current inventory.

## Run and verify

Use Node 22 or newer; CI uses Node 24.

```sh
npm ci
npm run check
npm test
npm run test:war
npm run test:war:ai
npm run test:war:balance
npm run test:war:campaigns
npm run test:war:browser
npm run test:war:load
npm run build
npm run serve
```

Open `http://localhost:4173/Dorra-House/`. The static development server still uses the configured Supabase project. Unit and database tests use isolated fixtures; `test:war:load` seeds the complete catalogue into local PGlite and measures four full worlds with 12 human memberships each. Browser fixtures exercise desktop/mobile layout, actual map assets, command handling and reconnection with intercepted transport.

`npm run check:war:online` is a separate live integration check. It creates two disposable registered QA accounts and real test operations, verifies authority and cross-device behavior, retires its operations and signs out. It records QA identities and results in ignored `work/war-live-report.json`; remove those QA Auth accounts after reviewing the run. Set `DORRA_WAR_BROWSER=1` to include the published desktop/mobile browser walkthrough. Do not treat local fixture or capacity results as proof of hosted production capacity.

`npm run test:war:campaigns` runs complete, repeatable land and island campaigns through the public command facade and actual PostgreSQL engine, using production geography, national starts, costs, queues, combat and rewards. Only local test time and transport bookkeeping are compressed. Browser campaign tests also exercise normal controls at desktop and 320px touch sizes through the actual gateway and database, including game over, rewards and reloading finished saves.

`npm run check:war:solo` is an opt-in live desktop/mobile playthrough using unmodified hosted fast time and normal UI commands, so allow up to 30 minutes per run. Its France–Luxembourg scenarios deliberately keep live verification tractable; they are not a balance or win-rate study. Set `DORRA_SOLO_SOURCE=1` to serve the local frontend against real Supabase, or omit it to use the published site. `DORRA_SOLO_CASES=mobile` or `desktop` selects one viewport. It writes ignored `work/war-solo-live-report.json`, retires incomplete matches and signs out; review and remove its disposable QA identities afterward. Live QA does not claim permanent House rewards.

AI recovery follows the same paid repair rules as players. Wounded formations regroup behind friendly lines, repair teams cover casualty concentrations, and a battered army can commission one missing recovery team beyond its planning target while retaining the normal 80-formation hard cap. Repeated combat stores health at six decimal places to bound database growth. Defensive bombardment can engage an explicitly detected hostile inside friendly territory; neutral, friendly, hidden and incompatible contacts remain invalid.

The build publishes `dist/` only. It converts published PNG artwork to WebP at original dimensions and quality 95, while preserving required original sources in the repository. Server code, migrations, tests, seed scripts, caches, the old launcher and the offline vault are excluded from the hosted artifact.

## Deployment and operating limits

Use the connected Supabase project and deploy in this order:

1. Apply committed `supabase/migrations/` in timestamp order. The war schema, private projection cache and runtime-limit migrations must all be present; retain the existing Auth, private-save and administration migrations.
2. Apply every numbered `scripts/war-seed/*.sql` file in lexical order. These bounded transactions upsert catalogue records only. Check `assets/war/manifest.json` against the seeded nation, province and platform counts.
3. Deploy the compatible `dorra-api` archival handler and the `dorra-war` Edge Function with JWT verification enabled. Retain the existing login, account administration and House save services. Confirm the private Realtime policies and `dorra-war-dispatch` cron job were installed by the migrations.
4. Run the local verification commands and the live war integration check, then merge the frontend release into `Alpha`. `.github/workflows/alpha-pages.yml` builds and deploys the Pages artifact after its checks. Run the published browser walkthrough after deployment.

New matches are guarded when the database reaches 400 MiB. The current launch envelope permits four running operations across the service, up to 12 humans per full world or two per duel, two unfinished hosted operations per account, and one unfinished solo campaign per account. The protocol also bounds request sizes, action rates, queues and formation counts. Fast time advances at 360× with a 30-game-day limit; persistent time advances at 4× with a 60-game-day limit. These are implementation limits, not a promised Supabase Free-plan player capacity.

The Gold migration requires the compatible `dorra-war` and `dorra-admin` handlers before publishing the new client. `supabase/tests/war-gold-hosted.sql` exercises the installed service role, full catalogue, admin awards, all three queue types, independent reward caps, ownership, compact responses and permanent replay in one bounded transaction ending in `ROLLBACK`. Always execute the entire file. It passed on the actual project after deployment; no fixture identities, staff grants or financial receipts persist.

Monitor database size, dispatcher `error_count`/`last_error`, delayed events, Edge Function latency/invocations, Realtime traffic and response size. Finished-world operational details are pruned after seven days; match summaries, memberships and permanent reward receipts remain. Existing unfinished matches are preserved. Review `work/war-capacity-report.json` when changing limits, geography density, visibility or AI behavior.

On 16 October 2026, the actual Free-project PostgreSQL rollback benchmark passed with the 95-entry catalogue, four full worlds, 48 human memberships and 437 formations per world. Dispatcher passes took 1,186 ms and 1,076 ms, leaving no due backlog or scheduler errors; visible-view queries took 145–155 ms and deltas 1,044–1,047 bytes. Batched notification visibility matched the individual fog filter exactly for 12 observers. The fixture emitted 412 private revision hints (46,208 payload bytes total, 113 bytes maximum), with no hidden state fields. This tests database simulation and broadcast creation, not 48 simultaneous browser connections or a 15-day soak. Healthy clients fetch on private hints with a five-minute recovery read; disconnected clients poll every 30 seconds. Sustained traffic must still fit the project's shared monthly Free quotas.

Keep **Enforce HTTPS** enabled in GitHub Pages, allow `Alpha` in the `github-pages` deployment environment, and retain the default [GitHub Pages address](https://uppedbicycle680.github.io/Dorra-House/). Frontend configuration contains the publishable Supabase key only. See [ONLINE-ALPHA.md](ONLINE-ALPHA.md) for the existing Auth, cloud-save and deployment configuration.

The solo AI update was also checked on the actual Free project on 16 October 2026. Four complete Veteran solo worlds ran their opening decision and two further planning cycles with dispatcher calls peaking at 1,378 ms, no remaining due events or scheduler errors, and matching private visibility filters. The human-world regression peaked at 1,634 ms for four worlds and 48 memberships. These rollback fixtures measure bounded database work, not sustained concurrent browser traffic. The reproducible AI balance harness covers eight equal-start mirror scenarios and four national-arsenal planning samples. It records first-move advantages and national differences; it does not establish human win rates or equal difficulty for every nation pairing.

The subsequent recovery and full-campaign pass completed four national scenarios (Belgium–Netherlands, Bahrain–Qatar, New Zealand–Fiji and Singapore–Malaysia) using ordinary research, production, combat and victory rules. Real Supabase playthroughs also finished a Standard desktop duel in 21 game hours and a Veteran 320px touch duel in 25 game hours, including pause/resume and saved-world reloads. These France–Luxembourg checks verify complete flows, not balanced starting nations. The full regression passed 275 automated tests and 53 browser tests. Hosted rollback fixtures with the updated simulation peaked at 1,256 ms per dispatcher call for four Veteran worlds and 1,211 ms for four human worlds, with no remaining due backlog or scheduler errors after bounded recovery.

On 17 October 2026, the deployed Gold rollback fixture passed in 1,199 ms; the four-world human and solo-AI dispatcher benchmarks peaked at 1,281 ms and 1,106 ms with no errors or due backlog. The command-experience release passed 306 unit/SQL checks and 60 browser checks, including complete campaigns and real-SQL research, mobilisation, construction and Gold confirmation on desktop and 390/320-pixel phones. These bounded checks do not establish sustained Free-plan capacity or human win rates.
