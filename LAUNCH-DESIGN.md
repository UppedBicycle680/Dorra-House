# Dorra House launch screen

The starting-focus screen presents Tables, Estate, and Story as three illustrated cards. The selected path and launch action fit within common desktop viewports. Below 801px, the cards stack and the page scrolls naturally.

- [Editable desktop design](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=22-19)
- [Editable mobile design](https://www.figma.com/design/TUbK2IFNYYRcH8lCX57e5L/Dorra-House?node-id=23-140)
- `arrival.css` owns the launch layout. `index.html` retains the existing radio and action identifiers.
- Local Manrope and Cormorant Garamond fonts match the Figma design. Their font licenses and provenance are in `vendor/`.
- Selection uses the existing Supabase arrival command and keeps account progress and the one-time Founder’s Advance intact. Actions are disabled while saving, and navigation uses the path actually submitted.
- Keyboard arrows select paths; Tab stays inside the launch dialog; background controls are inert until launch completes.

## Artwork

`assets/launch-journeys-v1.png` was generated with the built-in imagegen tool. CSS crops its three square panels to each card; the production build converts it to WebP. The artwork contains no interface text or controls.

Final prompt: Create a single wide 3:1 panoramic triptych of three equally wide square illustrations, directly adjacent with no gutters or borders. Left: ivory playing cards and dark red/brass chips on emerald felt under warm lamplight. Centre: a magnificent art deco private estate entrance at blue hour, with symmetrical illuminated windows and emerald foliage. Right: a woman in an emerald jacket and a male estate director reviewing a document in a warm wood-panelled rooftop study at night. Use cohesive, cinematic, realistic luxury hospitality illustration with muted gold and deep green, natural textures, and subjects contained within their panels. No text, labels, logos, numbers, interface controls, watermarks, or webpage mockups.

## Verification

The real frontend and Supabase account flow were checked at 1440×900, 1366×768, 1280×720, 1024×768, and 1280×600. All choices and launch actions fit without desktop scrolling. Mobile was checked at 390×844 for natural scrolling and no horizontal overflow. Estate launch, persisted progress after reload, changing to Tables and Story, and deciding later were exercised through the actual controls.

The Figma screens contain editable text, auto-layout, component instances, source SVG icons, and three discrete artwork fills per screen. Shared journey-card variants cover desktop/mobile and default/selected states.
