# Dorra House estate workspace design QA

final result: passed

Selected direction: option 1, Estate Workspace. Source: editable Figma desktop
29:19 and mobile 29:20 in TUbK2IFNYYRcH8lCX57e5L. Local implementation:
http://localhost:4173/Dorra-House/index.html, signed-in first owner, Week 1,
$5,000, zero operating venues, no collected income.

## Comparison evidence

Source and rendered implementation were placed together in the same comparison
input, then inspected. Evidence directory on the implementation host:
C:/Users/masonz28/.codex/visualizations/2026/10/08/01a11a62-d17b-71d1-9a27-4a12352a10c3/

- estate-qa-desktop-final-comparison.png: Figma left, application right;
  both 1440×900 at 1×. No desktop scrollbar; document width/height 1440×900.
- estate-qa-detail-comparison.png: enlarged source/application next-move copy,
  investment facts, and primary control, inspected for readable detail.
- estate-qa-mobile-final-comparison.png: source/application full content,
  normalized to equal 390px width. Browser CSS viewport 390×844; scrollbar
  leaves 374px raster content width. Figma 390×1790, browser 374×2028 at 1×.
  Extra mobile height reflects real account/save and Strategic Command controls.

## Iterations and resolved findings

The initial mobile comparison was blocked by P2 mid-word wrapping of Objectives
in Figma after shared text styles replaced its compact instance font size.
Restored 11px Manrope on mobile navigation instances and recaptured the source.
The final combined comparison shows the full label; the implementation also
keeps the label intact. No remaining P0/P1/P2 visual differences.

Development checks also resolved inherited absolute income-bank positioning,
fixed corner account/save overlays, oversized shared text styles, and excess
vertical spacing. The account/save nodes now flow inside the sidebar. The first
owner overview fits 1440×900, 1366×768, and 1280×720 without scrolling. The mobile
Games chevron previously escaped its narrow cell; mobile now uses a readable
10px Manrope label and omits that decorative chevron. All tested sections have
scrollWidth equal to clientWidth.

## Required fidelity surfaces

- Fonts/typography: Manrope interface text and Cormorant Garamond headings and
  numeric summaries. No clipped or mid-word labels in the implementation.
  Compact laptop typography preserves hierarchy and readable controls.
- Spacing/layout: compact header and sidebar, four summary values, asymmetric
  next-move/income-bank columns, then roadmap. Mobile stacks cards naturally.
  Core opening/collection/week controls stay visible on desktop. Expanded
  analytics and detailed management content may scroll intentionally.
- Colors/tokens: dark emerald, ivory, muted supporting text, restrained gold,
  emerald active state and primary action. Minor surface differences between
  existing Launch tokens in Figma and estate CSS are acceptable P3 polish.
- Image quality: same generated Terrace photograph in source and implementation;
  natural panoramic desktop and tighter mobile crops, sharp and unobstructed.
  The image is photography only; navigation, copy and controls are native.
- Copy/content: honest first-owner zero state, actual $5,000 cost and $60/hour
  base output. Live trading projection remains separately labeled. Bank
  collection and week closure are separate; no invented graph or mechanics.
- Icons: reusable official Tabler components/font, consistent outline family.
  Native global header retains profile/sound/reset controls and its current
  brand mark. These functional additions to the simplified Figma header are
  expected; native sidebar also retains the contract count and account controls.
- Interaction/accessibility: semantic buttons/navigation, current-section state,
  image alt text, visible keyboard outline, Enter activation, reduced motion,
  disabled/locked states. Tab from Overview reaches Portfolio and Enter opens it.

## Functional evidence

All seven sections and locked Grand Valet details opened at desktop/mobile sizes.
Story, VIP Contracts, Office Ledger, and Back to dashboard remained reachable.
With a disposable Supabase profile: Terrace opening changed $5,000 to $0 and
created one operating Level 1 venue; collecting its opening advance credited
$100; closing Week 1 credited $4,032 net, yielding $4,132 and Week 2. Reload
restored those values and the venue. Hiring Guest service debited $1,200 and
saved one assigned staff member. No new runtime errors followed the corrected
renderer. Existing engine/server tests plus the new projected-loss regression
test passed (75 total); JavaScript check passed (188 modules), build passed.

Implementation checklist: source and rendered comparisons opened; focused
controls inspected; responsive and keyboard checks completed; real cloud actions
and reload verified; artwork provenance documented in ESTATE-DESIGN.md.

---

# Dorra House admin design QA

final result: passed

## Evidence and scope

Selected source: Figma `sv7uYgrh1ewy1OP5R5soB2`, Dashboard `5:2`, Players
`6:20`, Profile `6:100`, Reports `6:261`, Activity `6:382`.
Source capture: `C:/Users/masonz28/.codex/generated_images/01a11942-55f7-7e21-914a-c34a35b5720b/dashboard-qa.png`.
Implementation captures: `work/admin-qa/dashboard-1440.png` and
`work/admin-qa/dashboard-1280.png`. Screenshots are 1× at 1440×1024 and
1280×800 CSS viewports. The source and final 1440 screenshot were inspected
together, including the readable navigation, metric block and activity rows.
The screenshot fixture reproduces the source's four metric values and five
activity rows; it is confined to browser tests and is not production data.

Live Supabase walkthrough evidence is recorded in ignored QA reports; it used
disposable approved admin/moderator accounts and a player. These accounts are
removed after the published walkthrough. Production begins with genuine empty
reports, flags and staff-action history.

## Findings resolved

- P2: Long metric definition copy added an unwanted second line. Shortened
  dashboard annotations while retaining exact definitions in `ADMIN.md`.
- P2: Full timestamps and multi-line changes made dashboard rows unnecessarily
  dense. Compact rows now use local time and numeric deltas; Activity retains
  dates, reasons and before/after values.
- P1: Legacy code cleanup removed adjacent profile helpers. Restored the
  original helpers and verified profile, settings, edit-profile and Codes in a
  browser regression test.
- P1: Player history excluded older actions. Profile/report history now uses
  all dates with paginated Activity access.
- P2: Confirmation omitted explicit deltas. Numeric resource previews now show
  before, after and actual delta; text changes use a labelled before/after pair.

## Required fidelity surfaces

- **Typography:** Local Inter variable font, sans-serif fallback, 40/60 heading,
  48/72 metric values, 24/36 section headings, 14/21 rows and 12/18 metadata.
  Hierarchy, font loading and wrapping checked. Linked records are underlined
  for discoverability. Small optical rendering differences between Figma and
  Chromium are acceptable P3 polish.
- **Spacing/layout:** 81px navigation, 48px desktop margins, 40px content inset,
  32px section rhythm, four equal metric columns and full-width ruled tables.
  Laptop uses 32px margins/24px column gaps. No horizontal document overflow at
  either viewport; long content wraps and the page/dialog scroll normally.
- **Colors/tokens:** Source monochrome backgrounds, restrained borders and
  text tokens retained. Green/amber/red feedback always accompanies a label.
  Secondary and muted text remain readable against both dark surfaces;
  visible keyboard focus uses the light text token.
- **Assets:** Source has editable text and native UI rather than imagery or
  custom icons. The text wordmark and supplied local font are retained; no
  rasterized full-screen mockup, placeholder imagery or custom icon artwork.
- **Copy/content:** Actual usernames, counts and dates replace demonstration
  records in production. Code/access, required reasons, disabled prerequisites
  and stale-save messages explain the next action. No Needs review section or
  review queue exists. Access countdown replaces the source's Demo data label.

## Interaction and state checks

Navigation, search, filters, empty/no-results states, player resources and
progression, report evidence/context, warnings, suspension, ban-name validation,
manual flags, owner staff controls, before/after confirmation, save failure and
retry were verified through browser tests or isolated live Supabase workflows.
Native labelled forms/dialogs support keyboard navigation and focus trapping.
Restricted controls are hidden for moderators; direct API permission checks
remain authoritative. Expiry/revocation/sign-out clear cached records and open
dialogs. API responses are sanitized, not complete private snapshots.

Acceptable source deviations: real metric definitions, live access status,
actual action labels, staff-only report creation, owner controls and explicit
resource deltas are required by the production brief. No P0/P1/P2 issue remains.

## Implementation checklist

- [x] Native editable frontend matched to selected desktop composition.
- [x] No fictional production metrics, detection system or review queue.
- [x] Admin/moderator roles and complete access/error states.
- [x] 1440×1024 and 1280×800 layout, scrolling and readable contrast.
- [x] Required browser, gameplay and database verification.
- [x] Owner setup and backend dependencies documented separately from UI.
