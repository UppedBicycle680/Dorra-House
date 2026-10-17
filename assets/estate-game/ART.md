# Dorra Estate game artwork

Generated with the built-in Image Gen tool for this project; optimized with Sharp to WebP. Six square business scenes are 512×512 pixels; the staff atlas is 1200×600 (6 columns × 3 rows). Total image payload: about 670 KiB. No external image host or API key is required at runtime.

## Production prompt set

Shared business prompt: Production game artwork for Dorra Estate, a laptop idle business tycoon. One square standalone isometric business diorama, no UI, no labels, no letters, no written signage, no watermark. Polished soft 3D animated-film game illustration, rich small-scale rounded objects, coherent slightly top-down isometric 3/4 view, warm golden lighting, emerald teal, cream and gold palette. Friendly luxury miniature world, not photorealistic or a flat icon. Business fully visible, centered, with breathing room on subtly shaded warm stone ground and pale background #e9eadc. Crisp recognizable silhouettes at thumbnail size; edited detail, no excessive objects. Framed in a square game card.

Venue subjects:
- Terrace: corner coffee shop, cream limestone, emerald striped awning, espresso bar, two outdoor tables, greenery, brass lamps and tiny barista.
- Valet: luxury arrival pavilion, emerald canopy, two black/champagne sports cars, rope barrier, brass luggage trolley and tiny suited valet.
- Boutique: fashion and jewelry store, blue awning, mannequins, golden display windows, jewelry counter, shopping bags and tiny assistant.
- Skyline: rooftop lounge, teal cocktail bar, turquoise plunge pool, lounge chairs, brass lamps, palms and sunset city silhouette.
- Grand Prix: miniature motorsport clubhouse, cream facade, emerald canopy, red race car, checkered flag, tiny driver/mechanics and trophy display.
- Hotel: compact luxury grand hotel, cream facade, emerald mansard roof, three floors, golden windows, central entrance, trolley, palms and flowers.

Staff prompt: Exactly 6 columns × 3 rows of distinct, centered adult staff bust portraits; evenly sized square cells with no gaps, borders, labels or text, on matching cream #eee4cc backgrounds. Polished friendly stylized 3D animated-film look with expressive faces and emerald/navy/gold uniforms. Heads and shoulders stay inside their own cells. First row: the six directors, next row: six revenue leads, last row: six operations leads. Director looks in venue order: brown-skinned woman with black wavy hair; Latino man with dark hair; blonde woman with bob; East Asian man in dinner jacket; Mediterranean woman in racing jacket; older woman with silver streak in hotel uniform. Revenue and operations rows use varied ages, skin tones and hair styles. CSS selects each cell without making separate image requests.

## Mapping

Columns follow the existing venue order: terrace, valet, boutique, skyline, grandprix, hotel. Rows follow director, revenue, operations. Names and benefits come from the shared game rules and remain HTML text. Images never contain wallet values, progress, action controls or gameplay labels.
