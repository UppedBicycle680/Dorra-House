# House home workspace

The signed-in homepage uses the Dorra House emerald, soft gold, Manrope, and Cormorant Garamond foundations shared with the arrival and estate screens. A compact navigation sidebar and two-column overview replace the large stacked dashboard sections.

## Editable Figma source

- [Desktop, 1440 × 900](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=61-51)
- [Mobile, 390 px](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=61-231)
- Page: `04 · House home` (`61:28`). Native text, auto-layout, vectors, and component instances; no flattened UI image.
- Home game cards: desktop component set `61:31`, mobile component set `66:160`, open and locked variants, title/detail/symbol/action text properties.
- World portals: desktop component `61:44`, mobile component `64:196`.
- Existing estate navigation and action components, local color/spacing/radius variables, and shared text styles are reused.

## Functional behavior

- The original game buttons and listeners remain attached. Lower, Main, Premium, and Royal floor filters and case-insensitive search expose the full 13-game library. Locked tables retain the existing level checks and explain their unlock level.
- The balance and reward button retain their server actions, disabled/claimed states, and emergency refill behavior. No economy, authentication, or database rules change.
- Membership, XP, current/next access, daily objectives, collection totals/equipped items, and the expandable House record use the existing live renderers.
- Directory, Dorra Office/estate, story, boutique, motor gallery, all three standalone games, profile/settings, sound, reset, and owned devices retain their destinations and actions.
- Account and save indicators move into the flowing homepage sidebar, with their original listeners. Navigating to the estate reuses its sidebar placement; other screens retain their existing placement.
- The default desktop overview fits common desktop and laptop viewports. Choosing All games, expanding activity, large collections, smaller windows, and phones naturally allow scrolling rather than clipping content.
- CSS is scoped to the visible homepage. The app script and new stylesheet have fresh deployment URLs to avoid stale frontend caches.

## Validation

Used the Codex in-app browser only for manual UI testing. Verified desktop and laptop layout, 390 px and 320 px phones, search/no-result recovery, locked-table feedback, daily reward and reload, a Blackjack deal/stand/result, live objectives/XP/activity, a boutique purchase and equipped collection reload, profile on mobile, Games menu, directory, estate round trips, story, and motor gallery. The standalone link labels and URLs are preserved.

`npm run check`, all 80 `npm test` tests, `git diff --check`, and the static production build pass. A focused test covers floor/search matching across locked and unlocked levels. Existing GitHub Pages verification runs on deployment.
