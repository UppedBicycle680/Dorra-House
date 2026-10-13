# Dorra Estate online integration

Dorra Estate runs inside the authenticated online Alpha app. It uses the existing Dorra account, shared House balance, Supabase Auth client, session lease, and server-authoritative command client. Browser state is a view of the saved account.

## Browser contract

Estate sends the following intentions through `vault.dispatch('house', action, args)`:

| Action | Arguments |
| --- | --- |
| `estate-clicker-open` | `{venueId}` |
| `estate-clicker-serve` | `{venueId}` |
| `estate-clicker-upgrade` | `{venueId, quantity}` (1, 10, or 100) |
| `estate-clicker-manager` | `{venueId}` |
| `estate-clicker-train` | `{venueId}` |
| `estate-clicker-specialist` | `{venueId, role}` (revenue or operations) |
| `estate-clicker-claim` | `{}` |
| `estate-clicker-tick` | `{}` |
| `estate-clicker-goal` | `{goalId}` |

The existing online controller adopts the returned account snapshot and refreshes the House UI. The client never uploads a complete save, balance, price, payout, timestamp, or outcome. A failed cloud command reports an error and cannot execute locally as a fallback.

`vault.serverNow` provides the server-aligned wall clock for presentation. Rendering uses a cloned progress object, so animated manager cycles cannot change the authoritative save. Rate calculations use `estateAutoPerMinute`, which cannot accrue income from the browser or execution host clock.

The existing database limit is 180 committed gameplay actions per minute. The browser permits one outstanding action and collects whole-dollar income at most once per 1.5 seconds, with exponential backoff on failed background saves. A manual tap starts a saved server timer and freezes its payout; it cannot restart an active run. Completion is settled once, including after reload or manager hiring. Managers earn with fractional elapsed-time accounting, avoiding loops over very fast cycles. Cycles at or below 120 milliseconds render as a solid animated bar.

Upgrades continue beyond Level 5, with authoritative bulk purchases of 1, 10, or 100 levels. Every 25 levels boosts income and speed. The opening economy now funds the Terrace director after one completed five-second customer. Opening costs and star gates stay the same; early upgrades and directors are cheaper, and later businesses have stronger payouts. Beyond Level 5, upgrade prices are bounded by 120–300 seconds of that business’s base automatic income, with trained teams shortening the wait further. The existing safe-integer House wallet remains bounded: cycle time floors at 1 ms, payouts cap at $1 billion per cycle, and individual upgrade prices cap at $9 trillion. No five-level gameplay cap remains; this is not an arbitrary-precision currency system. A full wallet retains unpaid bank income.

## Teams and pacing

Each of the six businesses has a named director plus a Revenue Lead (Level 10) and Operations Lead (Level 25), for 18 team members. Directors start at Rank 1, including migrated hires. Training adds 15% payout before rounding and reduces cycle time by 2%; Revenue Leads add 25% payout, and Operations Leads shorten cycles by 20%. These benefits respect the existing numerical production limits. The API rejects purchases that would add no income.

Training prices use the additional income and a payback window growing from 120 to 600 seconds. Specialist prices use 120 seconds of additional income. Both have a minimum of 20% of their venue opening price and a $9 trillion ceiling. New ranks and specialist ownership live under `clicker.venues`, so the existing venue sanitizer preserves them. Purchases settle old income first, retain the bar’s phase, and never reprice an already-started manual timer. New training, specialist, Level 25 and Level 100 milestones pay once.

`node scripts/simulate-estate-economy.mjs` runs a deterministic reinvestment policy from $1,000, with one manual customer and no outside rewards. Its current baseline hires the first director at 6 seconds, opens the Valet at 593 seconds, and manages all six businesses at 2,017 seconds (about 34 minutes). The longest saving wait is 98 seconds. These are simulated decisions with one second per purchase, not measured network or human playtime; regression tests bound the opening and portfolio pacing.

The UI displays training payback, extra income per second, funding shortfalls, approximate affordability waits and a next investment suggestion. Waits assume current portfolio income remains unchanged. Growth goals replace manual-serving suggestions once automation is available.

## Supabase backend

`supabase/functions/dorra-api/estate.mjs` validates the nine commands and calls the shared rules in `shared/estate-engine.js`. Costs, manager eligibility, service bonuses, milestone rewards, and timestamps are server-derived. Wallet settlements require safe whole-dollar integers and reject overflow.

`house-progression.mjs` initializes the versioned clicker state during the existing House bootstrap and dispatches the new actions. Legacy Estate management commands are retired, including the old instant business-week reward, preventing old clients from bypassing the new economy. Other House, casino, contract, story, airport, campaign, and football commands retain their existing routes.

The founder advance now tops up to $1,000, with its original once-only protection. Existing venue levels, manager ownership, pending cash, staff, property investment, headquarters improvements, specialization, and House perks survive migration. Staff and trading records remain in the save; the clicker UI replaces their old management controls.

State remains under `progress.empire`, with bounded activity counters and milestone claims in `progress.empire.clicker`. The existing `dorra_private.player_state.snapshot` JSONB save, RLS, account checks, session replacement, request replay, revision checks, and transaction remain intact. The API limits total snapshot/private-state serialization to 9 MB; the database limit is 10 MB. No SQL migration or policy change is required.

## Source and deployment

The backend source is based on the repository's online `Alpha` branch. Only the new Estate reducer, its dispatch/migration, shared Estate rules, and related progression rules change. Auth credentials remain in the existing Supabase function environment. The browser uses only its existing public configuration.

Run `npm run bundle:server` after changing shared game rules. It copies the final pure modules into `supabase/functions/dorra-api/shared/`, including the Estate rules imported by progression.

Deploy the complete `supabase/functions/dorra-api/` directory as the existing `dorra-api` function, using `index.ts` as entrypoint, `deno.json` as import map, and JWT verification enabled. Do not redeploy the login or admin functions for an Estate change. The API permits the GitHub Pages origin and localhost/127.0.0.1 port 4173.

## Verification

Run `npm run check`, `npm test`, and the relevant browser tests. The Estate tests live in `tests/estate-managers.test.mjs`, `tests/estate-cycles.test.mjs`, `tests/estate-engine.test.mjs`, `tests/estate-clicker-online.test.mjs`, and the Estate sections of `tests/house-progression-online.test.mjs`.

They cover prices, star gates, saved timers, unlimited levels, bulk purchases, managers, offline caps, fractional earnings, VIP/rush rewards, wallet limits, milestone replay, migration investment, legacy action rejection, JSON saves, and historical server-clock normalization. The existing vault browser test covers Auth, ordered commands, uncertain-delivery request replay, cloned snapshots, and session replacement.

`node scripts/check-estate-online.mjs` exercises the deployed service with a disposable account: opening, manual service, milestone claims, upgrade, manager hire, automatic income, rejected tampering, same-request replay, and restoration after a fresh sign-in. It verifies email auto-confirm before signup, signs out its sessions, prints no credentials or player save, and returns only the temporary account UUID/username for narrowly scoped cleanup. Remove that QA Auth account and its cascading game data after the run.

A read-only literal fixture SELECT on Supabase also confirmed JSONB round-trip preservation of activity counters, venue ownership, and balance within both payload limits.
