# Dorra Estate online integration

Dorra Estate runs inside the authenticated online Alpha app. It uses the existing Dorra account, shared House balance, Supabase Auth client, session lease, and server-authoritative command client. Browser state is a view of the saved account.

## Browser contract

Estate sends the following intentions through `vault.dispatch('house', action, args)`:

| Action | Arguments |
| --- | --- |
| `estate-clicker-open` | `{venueId}` |
| `estate-clicker-serve` | `{venueId}` |
| `estate-clicker-upgrade` | `{venueId}` |
| `estate-clicker-manager` | `{venueId}` |
| `estate-clicker-claim` | `{}` |
| `estate-clicker-goal` | `{goalId}` |

The existing online controller adopts the returned account snapshot and refreshes the House UI. The client never uploads a complete save, balance, price, payout, timestamp, or outcome. A failed cloud command reports an error and cannot execute locally as a fallback.

`vault.serverNow` provides the server-aligned wall clock for presentation. Rendering uses a cloned progress object, so animated manager cycles cannot change the authoritative save. Rate calculations use `estateAutoPerMinute`, which cannot accrue income from the browser or execution host clock.

The existing database limit is 180 committed gameplay actions per minute. Cloud serving throttles to at least 400 milliseconds and permits only one outstanding action. The shared rules enforce a 300 millisecond service cooldown across all venues.

## Supabase backend

`supabase/functions/dorra-api/estate.mjs` validates the six commands and calls the shared rules in `shared/estate-engine.js`. Costs, manager eligibility, service bonuses, milestone rewards, and timestamps are server-derived. Wallet settlements require safe whole-dollar integers and reject overflow.

`house-progression.mjs` initializes the versioned clicker state during the existing House bootstrap and dispatches the new actions. Legacy Estate management commands are retired, including the old instant business-week reward, preventing old clients from bypassing the new economy. Other House, casino, contract, story, airport, campaign, and football commands retain their existing routes.

The founder advance now tops up to $1,000, with its original once-only protection. Existing venue levels, manager ownership, pending cash, staff, property investment, headquarters improvements, specialization, and House perks survive migration. Staff and trading records remain in the save; the clicker UI replaces their old management controls.

State remains under `progress.empire`, with bounded activity counters and milestone claims in `progress.empire.clicker`. The existing `dorra_private.player_state.snapshot` JSONB save, RLS, account checks, session replacement, request replay, revision checks, and transaction remain intact. The API limits total snapshot/private-state serialization to 9 MB; the database limit is 10 MB. No SQL migration or policy change is required.

## Source and deployment

The backend source is based on the repository's online `Alpha` branch. Only the new Estate reducer, its dispatch/migration, shared Estate rules, and related progression rules change. Auth credentials remain in the existing Supabase function environment. The browser uses only its existing public configuration.

Run `npm run bundle:server` after changing shared game rules. It copies the final pure modules into `supabase/functions/dorra-api/shared/`, including the Estate rules imported by progression.

Deploy the complete `supabase/functions/dorra-api/` directory as the existing `dorra-api` function, using `index.ts` as entrypoint, `deno.json` as import map, and JWT verification enabled. Do not redeploy the login or admin functions for an Estate change. The API permits the GitHub Pages origin and localhost/127.0.0.1 port 4173.

## Verification

Run `npm run check`, `npm test`, and the relevant browser tests. The Estate tests live in `tests/estate-engine.test.mjs`, `tests/estate-clicker-online.test.mjs`, and the Estate sections of `tests/house-progression-online.test.mjs`.

They cover prices, star gates, cooldowns, managers, offline caps, fractional earnings, VIP/rush rewards, wallet limits, milestone replay, migration investment, legacy action rejection, JSON saves, and historical server-clock normalization. The existing vault browser test covers Auth, ordered commands, uncertain-delivery request replay, cloned snapshots, and session replacement.

`node scripts/check-estate-online.mjs` exercises the deployed service with a disposable account: opening, manual service, milestone claims, upgrade, manager hire, automatic income, rejected tampering, same-request replay, and restoration after a fresh sign-in. It verifies email auto-confirm before signup, signs out its sessions, prints no credentials or player save, and returns only the temporary account UUID/username for narrowly scoped cleanup. Remove that QA Auth account and its cascading game data after the run.

A read-only literal fixture SELECT on Supabase also confirmed JSONB round-trip preservation of activity counters, venue ownership, and balance within both payload limits.
