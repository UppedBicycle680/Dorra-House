# Online Alpha deployment and operation

## Connected project

Supabase project: `fbebytnhlanqdbbvxzwz` (Sydney). Browser configuration in `online-config.js` contains the project URL and publishable key only. Never put a secret/service-role key into frontend configuration or a GitHub Pages artifact.

Apply committed database migrations before deploying `supabase/functions/dorra-api`. The deployed handler authenticates user JWTs with Supabase Auth; database transactions also check that the corresponding `auth.sessions` record remains active. Publishable-key requests cannot call save-storage RPCs or write private player state.

`npm run bundle:server` refreshes copies of the existing pure game engines before deploying the Edge Function. Its entrypoint is `index.ts`, and JWT verification remains enabled.

## Authentication settings

Email/password authentication must be enabled. Public signups require a unique username (3–24 letters, numbers or underscores).

For the requested Alpha without a mail provider, turn off **Confirm email** in Authentication → Sign In / Providers → Email. The frontend also supports confirmation if it is enabled later, but public email delivery needs a configured SMTP provider. Supabase’s built-in email sender has delivery restrictions and is unsuitable for unrestricted public registration.

Set the Auth Site URL to `https://uppedbicycle680.github.io/Dorra-House/` and allow redirects to `https://uppedbicycle680.github.io/Dorra-House/login.html*`. For development, also allow `http://localhost:4173/Dorra-House/login.html*`.

Password recovery is implemented using Supabase’s email recovery flow. Without an email provider, the owner must manage recovery in the Supabase dashboard. Changing the email-confirmation setting does not require a frontend rebuild.

## Save authority and device sessions

Each page acquires a new gameplay lease. Opening another tab or device takes over; the previous lease is rejected on its next request. Protected data lives in a private schema with RLS and no browser grants. Server-controlled `role` and `disabled` profile fields prepare future administration; editable user metadata never authorizes administrator actions.

An accepted command updates the shared wallet and all relevant mode state atomically. Revision checks prevent competing saves from overwriting one another. Request identifiers and bound command hashes prevent immediate retries from repeating a payout or withdrawal. A bounded replay window and bounded histories limit storage. Large replay results use lossless gzip internally so a retried airport view or match response retains its original data without duplicate rewards. Requests are limited to 180 accepted actions per account per minute and 32 KiB of input, with a bounded exceptions for profile pictures and club-crest uploads.

Hidden decks, future card reveals, airport random states and football execution seeds remain private. Strategic Command uses public world-generation data for accurate display; private cryptographic entropy controls outcomes. Existing developer resource grants are unavailable to player commands.

Players can alter their own browser display or automate valid decisions. Those capabilities cannot be eliminated by website code. Server validation protects stored progress from arbitrary save edits; this release does not claim to prevent every bot or browser modification. Competitive multiplayer and leaderboards need their own later threat review.

## Free-plan efficiency

Airports poll every 30 seconds and pause polling in hidden tabs. Every purchase and withdrawal saves immediately. Catch-up keeps the existing 24-hour cap. The optimized airport engine was compared with the original across full seven-airport careers and retained identical balances, departures, timers and random states, while reducing large catch-up work from 8–12 seconds to about 0.1 seconds. Compact airport responses remove duplicated data and use already-published geometry.

Investing retains whole-dollar House wallets. Costs round up and proceeds round down to prevent repeated fractional trades from creating money through wallet rounding. Quotes and holdings still preserve their financial precision.

The build uses valid same-model/trim/paint artwork for one corrupt upstream Taycan PNG when publishing its legacy path. Original source files remain available in the repository.

Free-plan capacity depends on active-player traffic, save sizes and Supabase’s current quotas. Monitor Database size, Edge Function invocations, CPU and egress in the project dashboard. Accounts with large football careers and active market history cost more storage than fresh accounts. The code bounds archives and replay data, but no fixed player capacity is promised.

## Validation

Regression tests cover all thirteen casino activities, authoritative costs and rewards, hidden information, market settlement, airport catch-up/withdrawals, football season progression and visual match authority, campaign commands, and malformed/forged payloads.

The connected database was verified transactionally for profile-role isolation, atomic saves, duplicate replay, request collisions, stale revisions, device takeover, revoked Auth sessions, and denied browser write grants. Synthetic test users were rolled back.

`npm test` runs 61 server and protocol regression tests. `npm run test:browser` runs the actual Auth SDK, login screen and save client in Chromium with intercepted transport and real game reducers. Further local desktop/mobile flows cover all modes. These browser fixtures verify behavior and resumption; their intercepted transport is not a live Supabase test.

The Alpha workflow independently verifies the actual public Auth/game API while building the site. Both checks must pass before Pages deployment. After a successful deployment, it runs `scripts/check-online.mjs` again against Supabase and the published pages. It checks the requested no-confirmation signup configuration before creating a temporary QA account, so it never requests a confirmation email. It verifies browser CORS access, login, refresh, cross-device saves and rejected tampering. The minimal workflow report records only the QA identity and validation results; passwords and tokens are never logged. Remove the recorded temporary QA account from Supabase Authentication after reviewing a live run.

The live backend check passed on 7 October 2026 in [Actions run 37680344169](https://github.com/UppedBicycle680/Dorra-House/actions/runs/37680344169), including all four modes restored on a second Auth session and rejection of the replaced device. That run also passed all 61 server tests and both browser tests, and produced a 298.7 MiB Pages artifact. The initial deployment was rejected by GitHub's `github-pages` environment because `Alpha` was not an allowed deployment branch. Allow `Alpha` under Repository Settings → Environments → github-pages → Deployment branches and tags, then rerun the failed jobs.
