# Tractor and baggage-cart accuracy references

Checked 9 September 2026. Models use manufacturer photography and published
dimensions to improve the generic fleet; they are not exact manufacturer CAD.

## Conventional pushback tractors

- [TLD TMX-150 product page](https://www.tld-group.com/products/conventional-aircraft-tractors/tmx-150/)
  and its [manufacturer photograph](https://www.tld-group.com/wp-content/uploads/tld-product/210-product-680x510.jpg).
  Visual references: cab integrated into the front body, raked glazing, open
  wheel arches, recessed steps, rear engine cover, low towing jaws and striped
  bumpers. The game model depicts an open driver's entrance.
- [TLD TMX-150 manufacturer data sheet, revision 11/2012, hosted by AeroServicios](https://aeroservicios.com/uploads/manuals/PBT_TLD_TMX_150_9_12_15_16.pdf).
  Reference dimensions include 1.680 m front/rear track and 0.220 m ground
  clearance. The dimension drawing gives a 2.150 m wheelbase. Front and rear
  towing pins are 70 mm diameter. Body, cab, trim and lamp contours are visual
  interpretations. Protruding hitch handles are included in rendered bounds.
- The heavy tractor uses the same conventional construction at a different
  size, with broad side decks and larger wheels. It is a generic heavy variant,
  not a scaled claim of a specific TMX-150 or an exact TMX-450 replica.

## Baggage tractor

- [TLD JST Series](https://www.tld-group.com/products/baggage-tractors/jst-series/)
  and its [manufacturer photograph](https://www.tld-group.com/wp-content/uploads/tld-product/227-product-680x510.jpg).
  The model now has the long front bonnet, smaller front tyres, open operator
  position behind the bonnet, steering wheel, seat, pedals, rear grab rails,
  beacon mast and a low rear towing jaw visible in this vehicle family.
- [San Bernardino International Airport board procurement packet, 22 May 2024](https://sbiaa.org/wp-content/uploads/2025/07/2024-05-22-Packet.pdf),
  containing TLD's JST technical sheet. Tractor reference dimensions: 2.985 m
  length, 1.440 m width and 1.600 m wheelbase. The diesel JST wheel sizes are
  185R14 front and 28 x 9-15 rear; the model uses a 0.7112 m rear diameter and
  0.2286 m rear width. Cockpit details, tyre tread, overhang and axle absolute
  stations are interpretations; the cart is a separate attachment.

## Covered baggage cart

- [Wilcox closed steel baggage cart](https://wilcoxgse.com/products/closed-steel-baggage-carts/).
  The load floor is 5 x 10 ft (1.524 x 3.048 m). The reference provides a
  fifth-wheel front steering assembly, towbar-actuated parking brake, solid
  rubber tyres, side curtains, roof drip rails, front grab handles, corner
  protection and a rear E-hitch. The model shows one curtain closed and the
  loading-side curtain rolled up, with visible luggage behind it.
- The roof pitch, curtain folds, chassis members, cart tyre dimensions and
  luggage are artistic interpretations. Drawbar articulation and steering are
  represented mechanically in the mesh; the parked train is not a new dynamic
  trailer-physics simulation.

## Passenger apron bus

- [COBUS 3000 manufacturer overview](https://www.cobus-industries.com/produkte/cobus-3000/)
  describes a wide low-floor apron bus, three double passenger doors on each
  side, up to 110 passengers, large mirrors, optional passenger-compartment
  cooling, service flaps and two roof hatches. These features inform the model.
- The 13.9 x 3 m body, 7.1 m axle spacing, tyre profile, fan guards, panel layout
  and lighting are authored approximations, not a licensed CAD reproduction.
  Mirror-inclusive mesh bounds are 14.032 x 3.54 x 3.298 m.
- The 53,888 triangles mainly describe tyre cross-sections, rims, bolts, curved
  shoulders, cooling guards and chamfered fittings. Flat glass/panels are not
  subdivided to inflate the count. Teal livery identifies passenger transport.

## Checks

`node airport-passenger-shuttle-regression.mjs` checks geometry and a complete
terminal–stand–terminal cycle, plus idle/yield states and route reservation.

`node airport-ground-tractor-regression.mjs` validates the source dimensions,
wheel arrangements, cab/bonnet topology, cart floor and eye/pin connection.
`node airport-ground-equipment-qa.mjs` rechecks fleet rendering, apron placement,
motion clearance, the in-game viewer, mobile layout and the canvas fallback.
