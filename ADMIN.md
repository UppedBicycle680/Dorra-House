# Dorra House administration

Panel: https://uppedbicycle680.github.io/Dorra-House/admin.html

The panel requires an existing Supabase account, an owner-approved staff role,
and the shared access code. A code alone never grants staff permission. Public
registration always creates a player. Production has no automatically selected
owner and no seeded staff accounts.

## First owner

1. Register your ordinary account through the live House login page.
2. In the **Dorra House** Supabase project's SQL editor, open
   `supabase/admin-owner-setup.sql`, replace `YOUR_EXACT_USERNAME`, and run it
   using your trusted project access. The script refuses to replace an owner.
3. Sign in to the panel with the same account and enter the privately delivered
   access code. You can also redeem the code in the game's Codes interface.
4. Open **Admin → Staff management**, select an existing player, and use
   **Change staff role** to approve an administrator or moderator. Each change
   requires a reason, preview and confirmation.

Owner status cannot be changed by ordinary administrators. Transferring the
owner is a trusted Supabase operation, rather than a public panel feature.
Keep the code private; it is never displayed by the panel or stored in browser
storage. The browser retains the existing Supabase Auth session only.

## Access and roles

- Grants last exactly 30 minutes from redemption, bound to the verified account
  and Auth session. Requests and polling never extend them.
- Lock panel, sign-out, account disabling, suspension, ban, role removal, owner
  revocation, deleted Auth sessions and code rotation invalidate access.
- Moderators create/resolve reports, record/resolve manual flags, warn and
  suspend for 24 hours, 7 days or 30 days. Administrators also change resources
  and progression, lift suspensions and permanently ban players.
- Only the owner assigns staff roles and revokes all panel grants for an account.
- Public and authenticated browser roles have no private-table grants and
  cannot execute storage or administrative RPCs. The Edge Function verifies
  JWTs with Auth, and the database repeats account/session/role/grant checks.

## Backend and deployment

Project reference: `fbebytnhlanqdbbvxzwz`. Function: `dorra-admin`, JWT verification
enabled. `SUPABASE_SERVICE_ROLE_KEY` is used only by the server runtime.
The one SHA-256 code digest is encrypted in Supabase Vault under
`dorra_admin_code_sha256`; Vault is a server-only secret store. No plaintext code
or verifier is shipped to GitHub Pages. Code attempts have atomic 15-minute
limits of five per approved account, fifty per hashed IP and one hundred total.

Apply checked-in migrations in timestamp order using a trusted Supabase
connection. Deploy with `supabase functions deploy dorra-admin --project-ref
fbebytnhlanqdbbvxzwz`; relative imports use the existing authoritative game
modules. Frontend publication follows the existing `Alpha` Pages workflow.

For code rotation, generate 32 cryptographically random bytes and encode them
as `DH-` plus 43 base64url characters. Deliver the plaintext privately; update
only its lowercase SHA-256 hex digest in the existing Vault secret using trusted
project access. Never paste plaintext into SQL history, logs, source files or
browser storage. The Vault update timestamp invalidates existing grants.

Resource previews expire after five minutes. Every commit locks the profile and
save, checks both revisions, and records an append-only audit entry in the same
transaction. Retrying the same confirmation ID replays its result. A changed
save requires a refreshed preview. Configured device purchases remain in the
existing game configurator; unavailable clubs/careers cannot be invented.
Airport edits preserve private RNG and increment the existing career revision.
Suspension expiry uses database time; every gameplay acquire/read/commit checks
the same account gate. Suspension expiry automatically releases gameplay.

## Metrics and history

- Active players: distinct accounts with an accepted gameplay command commit in
  the selected rolling 24-hour, 7-day or 30-day period. Acquisition, refresh,
  reads, duplicate retries and admin changes are excluded. Collection begins
  when this migration is installed; there is no fabricated historical backfill.
- Open reports: currently open staff-created reports, regardless of date.
- Flagged activity: currently unresolved manual staff flags. There is no
  automated detection system.
- Game changes: successful administrative resource/progression commits during
  the selected period.

Profile/report history includes all dates, paginated in Activity. Activity
records successful committed actions, actor, target, reason, before/after
changes and outcome. Rejected attempts produce actionable errors without
recording a successful change. No hidden decks, random seeds, passwords,
tokens or complete private snapshots are returned by admin operations.

## Verification

Run `npm test`, `npm run check`, `npm run test:browser`, and `npm run build`.
Run `tests/admin-database.sql` in the trusted SQL editor for rollback-only
database fixtures. It leaves no fixture accounts, grants, reports or saves.
`scripts/check-admin-live.mjs` verifies published assets, redirects and anonymous
API denial without credentials. Browser fixture metrics exist only in tests.

Live staff verification used explicitly disposable QA accounts, removed after
the walkthrough. The deployment remains locked until you designate the first
owner. See `design-qa.md` for the desktop visual and interaction checks.
