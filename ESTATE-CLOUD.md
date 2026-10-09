# Dorra Estate account saves

Dorra Estate offers protected local play and an optional existing Dorra account. Connecting an account shows that account's estate and balance inside Estate. The guest estate and casino wallet stay in the existing offline vault. Disconnecting returns to that guest estate.

## Browser contract

`createEstateCloud({onChange,onStatus})` in `estate-cloud.js` exposes cloned `snapshot`, `connected`, `username`, `status`, `serverNow`, `remembered`, and `error` getters. Its methods are `login(username,password)`, `resume()`, `refresh()`, `command(action,args)`, `disconnect()`, and `flush()`.

`createEstateAccount({cloud,onChange})` in `estate-account.js` owns the account dialog and exposes `show()` and `destroy()`. Include `estate-account.css` in the page.

Passwords are sent directly to the existing `dorra-login` endpoint and never stored. Access and refresh tokens use this tab's sessionStorage. The browser contains only the public publishable key. The service credential stays in Supabase's existing function environment.

The cloud snapshot is not written into the guest vault. A failed cloud action stays in cloud mode and reports its error; it cannot execute locally as a fallback. Every accepted API response replaces the adapter snapshot. UI previews can accrue a clone using `cloud.serverNow`.

## Authoritative commands

The API at `https://fbebytnhlanqdbbvxzwz.supabase.co/functions/v1/dorra-api` accepts POST commands with a user access token. Session acquisition accepts `{scope:"session",action:"acquire",leaseId}`. Gameplay accepts `{scope:"house",action,args,leaseId,requestId,expectedRevision}`.

| Action | Arguments |
| --- | --- |
| `estate-clicker-open` | `{venueId}` |
| `estate-clicker-serve` | `{venueId}` |
| `estate-clicker-upgrade` | `{venueId}` |
| `estate-clicker-manager` | `{venueId}` |
| `estate-clicker-claim` | `{}` |
| `estate-clicker-goal` | `{goalId}` |

The server derives costs, earnings, milestones, eligibility, and timestamps. Client prices, balances, clocks, and outcomes are rejected. Mutations use the existing session lease, revision check, request replay, and database transaction. If a network response is lost, the adapter retries the same request identifier so a committed action cannot pay or charge twice.

The existing database rate limit is 180 committed gameplay actions per minute. Cloud serving should throttle to at least 400 milliseconds and permit only one outstanding serve request. The shared rules enforce a 300 millisecond service cooldown across all venues.

## Supabase source and deployment

`supabase/functions/dorra-api/` contains the complete source bundle retrieved from the existing live `dorra-api` version 4 on 9 October 2026. The original entrypoint, protocol, casino, football, campaign, airport, and response codec remain intact. `house-progression.mjs` dispatches the six new commands to `estate.mjs`, which uses `shared/estate-engine.js`.

Before deployment, copy the final root `estate-engine.js` and `progression-engine.js` into their matching `shared/` paths. Keep these copies identical to the frontend rules. Deploy the complete directory as the existing `dorra-api`, with `index.ts` as the entrypoint, `deno.json` as the import map, and JWT verification enabled. No login function changes, SQL migrations, or table policy changes are needed.

Saves are existing `dorra_private.player_state.snapshot` JSONB values with RLS enabled and no direct client policies. New state lives under `progress.empire.clicker`; venue ownership and pending legacy income remain under `progress.empire`. The API limits total snapshot/private-state serialization to 9 MB and the database to 10 MB. The local vault limits progress to 2 MB; the new bounded counters and milestone lists stay far below these limits.

The client CSP must permit connections to `https://fbebytnhlanqdbbvxzwz.supabase.co`. The API permits the existing GitHub Pages origin and localhost/127.0.0.1 port 4173.

## Verification

Run:

```powershell
node --test estate-engine.test.mjs estate-cloud.test.mjs
```

The cloud suite tests the real backend reducer using isolated fixtures and an injected HTTP transport: server prices and timestamps, cooldowns, manager eligibility, offline cap, milestone replay, wallet limits, nested JSON saves, network replay, revision conflicts, auth refresh, and guest-save isolation.

A read-only fixture SELECT on the live Supabase project confirmed JSONB round-trip preservation of clicker counters, venue ownership, and balance, as well as both server payload limits. No production player data was read or modified for these checks. An authenticated live account gameplay round-trip requires a dedicated test account; fixture coverage does not claim to have modified a real player's cloud save.
