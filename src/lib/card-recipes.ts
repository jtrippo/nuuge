/**
 * Card Recipe System — three-axis prompt composition for AI greeting card images.
 *
 * Subject recipe  → WHAT to draw (motifs, scene types, composition)
 * Mood recipe     → HOW IT FEELS (lighting, palette, atmosphere)
 * Style recipe    → HOW IT'S RENDERED (technique, texture, line quality)
 * Profile context → PERSONAL FLAVOR (filtered interests injected as motif hints)
 * Global guards   → ALWAYS APPLIED (no text, print-ready, etc.)
 *
 * The prompt builder merges all layers with conflict resolution:
 *   mood wins on palette/lighting, style wins on texture/technique,
 *   subject wins on composition/motifs, profile adds flavor.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface GlobalGuardrails {
  alwaysInclude: string[];
  prefer: string[];
  avoid: string[];
}

export interface SubjectRecipe {
  id: string;
  label: string;
  emoji: string;
  examples: string;
  /** Motif pools keyed by mood id — prompt builder picks 1-2 at random */
  sceneSketches: Record<string, string[]>;
  compositionHints: string[];
  /** Interest keywords from a person's profile that map to this subject */
  profileKeywords: string[];
}

export interface MoodRecipe {
  id: string;
  label: string;
  /** Subject ids that pair best with this mood — shown as "recommended" in UI */
  recommendedSubjects: string[];
  lighting: string[];
  palette: string[];
  texture: string[];
  composition: string[];
  avoid: string[];
  promptSnippets: string[];
  /**
   * Profile interest categories compatible with this mood.
   * e.g. "skateboarding" fits joyful/funny but not sympathy.
   * "all" = any interest can be used, "gentle" = only calm/warm interests
   */
  profileFilter: "all" | "gentle" | "energetic" | "minimal";
}

export interface StyleRecipe {
  id: string;
  label: string;
  desc: string;
  technique: string[];
  texture: string[];
  lineQuality: string[];
  renderingNotes: string[];
}

// ─── Global Guardrails ───────────────────────────────────────────────

export const GLOBAL_GUARDRAILS: GlobalGuardrails = {
  alwaysInclude: [
    "greeting card illustration",
    "portrait format (taller than wide)",
    "full-bleed composition",
    "print-ready",
    "clean composition",
    "no text or words in the image",
    "no watermark",
    "no logo",
    "no signature",
    "no frame or border",
  ],
  prefer: [
    "original, hand-crafted artistic feel",
    "single illustrator's coherent style",
    "balanced layout",
    "clear focal point",
  ],
  avoid: [
    "busy cluttered backgrounds",
    "stock photography look",
    "corporate clip art",
    "human figures, faces, or body parts UNLESS the prompt explicitly describes people — when in doubt, leave people out",
    "cartoon-style or children's-book-style depictions of people",
    "distorted anatomy",
    "AI-generated artifacts or glitches",
    "generic or template-like composition",
  ],
};

// ─── Subject Recipes ─────────────────────────────────────────────────

export const SUBJECT_RECIPES: SubjectRecipe[] = [
  {
    id: "flowers",
    label: "Flowers / Botanicals",
    emoji: "🌸",
    examples: "roses, wildflowers, sunflowers, cherry blossoms, succulents",
    compositionHints: [
      "focal bouquet or single bloom arrangement",
      "organic flowing shapes",
      "natural asymmetry with visual balance",
    ],
    profileKeywords: ["garden", "flowers", "roses", "plants", "gardening", "botany", "floral", "sunflowers", "orchids", "lavender"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A loose bouquet of wildflowers tied with twine, catching soft morning light",
        "Sunflowers turning toward gentle light in a simple glass jar",
        "A gentle arrangement of daisies and lavender with dewdrops on petals",
      ],
      supportive_and_comforting: [
        "A single resilient flower pushing through soft earth at dawn",
        "Quiet lavender stems in soft mist, gentle and calming",
        "A small potted succulent on a windowsill with soft diffused light",
      ],
      romantic_and_affectionate: [
        "Lush peonies and garden roses in full bloom, soft ambient light",
        "A cascading arrangement of soft pink roses with delicate ribbon",
        "An intimate close-up of intertwined rose stems with velvet petals",
      ],
      joyful_and_celebratory: [
        "A vibrant explosion of mixed wildflowers in bold cheerful colors",
        "Bright sunflowers and zinnias bursting upward with festive energy",
        "A colorful flower crown arrangement with poppies and cornflowers",
      ],
      warm_with_a_touch_of_humor: [
        "A cheerful daisy growing stubbornly through a crack in a path",
        "A slightly lopsided bouquet in a quirky watering can, charmingly imperfect",
        "Sunflowers with one bloom facing the wrong way, endearingly goofy",
      ],
      funny_and_playful: [
        "A flower with an exaggerated cartoon grin among normal flowers",
        "A tiny cactus in a party hat among a group of elegant roses",
        "Flowers arranged to look like they're dancing in the breeze",
      ],
      sarcastic_and_edgy: [
        "A single bold red rose in a concrete setting, stark and graphic",
        "A cactus surrounded by delicate flowers, standing its ground",
        "A dramatic dark dahlia against a minimal neutral background",
      ],
      simple_and_understated: [
        "A single elegant stem — one flower, lots of white space",
        "Three simple line-drawn botanical stems, minimal and refined",
        "A quiet sprig of eucalyptus, understated and modern",
      ],
      nostalgic_and_reflective: [
        "Dried pressed flowers in a vintage botanical arrangement, faded and delicate",
        "A well-worn garden gate overgrown with climbing roses, soft afternoon light",
        "Wildflowers in a weathered mason jar on an old wooden table",
      ],
    },
  },
  {
    id: "animals",
    label: "Animals",
    emoji: "🦊",
    examples: "fox, dog, cat, birds, butterflies, deer, rabbit",
    compositionHints: [
      "character-forward with clear silhouette",
      "animal as emotional anchor of the scene",
      "natural habitat context or simple background",
    ],
    profileKeywords: ["dog", "cat", "bird", "pet", "horse", "fish", "wildlife", "zoo", "puppy", "kitten", "rabbit", "fox", "deer", "butterfly"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A gentle fox curled up beside wildflowers in soft diffused light",
        "Two small birds sitting together on a branch in quiet evening light",
        "A loyal dog resting its head on a cozy blanket, peaceful and content",
      ],
      supportive_and_comforting: [
        "A calm deer standing at the edge of a misty forest at dawn",
        "A mother bird sheltering chicks under her wing in soft rain",
        "A rabbit resting under a quiet willow tree in gentle morning light",
      ],
      romantic_and_affectionate: [
        "Two swans forming a heart shape on still water at dusk",
        "A pair of lovebirds on a flowering branch, heads touching",
        "Two foxes nuzzling in a meadow of soft wildflowers",
      ],
      joyful_and_celebratory: [
        "A jubilant dog mid-leap catching a frisbee in bright sunshine",
        "Colorful tropical birds in flight against a blue sky",
        "A playful otter splashing joyfully in sparkling water",
      ],
      warm_with_a_touch_of_humor: [
        "A cat napping in a sunbeam, one paw dangling off the edge of a shelf",
        "A dog tilting its head quizzically, one ear up and one down",
        "An owl perched on a stack of books looking wisely at the viewer",
      ],
      funny_and_playful: [
        "A goofy dog wearing an oversized party hat, tongue out",
        "A cat tangled in a ball of yarn looking bewildered",
        "A penguin sliding belly-first into a pile of wrapped presents",
        "A bear balancing a birthday cake on one paw, looking proud",
      ],
      sarcastic_and_edgy: [
        "A cat sitting in a box, judging the viewer with deadpan indifference",
        "A grumpy hedgehog next to a cupcake it clearly doesn't want",
        "A raccoon in sunglasses leaning against a wall, too cool",
      ],
      simple_and_understated: [
        "A single hummingbird in flight, minimal background",
        "A quiet silhouette of a cat on a windowsill",
        "One small bird perched on a bare branch, elegant and simple",
      ],
      nostalgic_and_reflective: [
        "An old dog resting on a porch, quiet afternoon light filtering through trees",
        "A pair of songbirds on a fence post, soft overcast sky",
        "A cat curled on a stack of vintage books beside a window",
      ],
    },
  },
  {
    id: "nature",
    label: "Nature & Places",
    emoji: "🏔️",
    examples: "forest, mountains, ocean, garden, cozy cottage, cafe street, old bridge, city skyline",
    compositionHints: [
      "sweeping vista or intimate nature detail",
      "horizon line placement for mood (low = expansive sky, high = grounded)",
      "natural depth through layered elements",
      "architectural scenes framed with natural elements for warmth",
    ],
    profileKeywords: ["hiking", "camping", "mountains", "beach", "ocean", "outdoors", "fishing", "skiing", "surfing", "kayaking", "travel", "nature", "forest", "lake", "city", "architecture", "paris", "europe", "urban", "home", "cottage"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A sun-dappled path through a gentle woodland, inviting and serene",
        "A quiet garden bench under a canopy of soft spring blossoms",
        "Rolling hills dotted with wildflowers under a soft open sky",
        "A cozy cottage with a welcoming front door and climbing roses",
      ],
      supportive_and_comforting: [
        "A peaceful sunrise over a calm lake, soft mist rising",
        "A single tree standing strong on a gentle hill, dawn sky behind",
        "A quiet forest path with dappled light filtering through leaves",
        "A sheltered stone doorway with warm light glowing from within",
      ],
      romantic_and_affectionate: [
        "A moonlit beach with gentle waves and a soft sky at dusk",
        "A winding garden path through rose arches in late afternoon light",
        "A secluded woodland clearing with fireflies at twilight",
        "A quaint Parisian cafe at dusk, warm light spilling onto cobblestones",
      ],
      joyful_and_celebratory: [
        "A brilliant rainbow arching over a sunlit mountain valley",
        "A meadow of bright wildflowers under a vivid blue sky",
        "A sparkling ocean scene with bright sun and vibrant sky colors",
        "A festive town square with colorful bunting and bright market stalls",
      ],
      warm_with_a_touch_of_humor: [
        "A cozy cabin porch with a welcoming rocking chair and soft light",
        "A puddle reflecting a surprisingly beautiful sky, humble and charming",
        "A garden gate slightly ajar, as if inviting the viewer in",
        "A crooked little bookshop on a cobblestone lane, endearingly quirky",
      ],
      funny_and_playful: [
        "A mountain peak with a cartoonish flag planted at the top",
        "A tropical island so small it has just one palm tree and a beach chair",
        "A garden where the flowers are growing in unexpectedly wild directions",
        "A tiny house with an absurdly oversized chimney puffing cheerful smoke",
      ],
      sarcastic_and_edgy: [
        "A lone cactus in a vast desert, bold and graphic",
        "A stark mountain silhouette against a dramatic moody sky",
        "A single dead tree in an otherwise empty landscape, powerful and minimal",
        "A brutalist concrete building, stark and unapologetic against a flat sky",
      ],
      simple_and_understated: [
        "A minimal mountain range silhouette against a soft gradient sky",
        "A single leaf floating on still water, concentric ripples",
        "A quiet horizon line where sea meets sky, almost abstract",
        "A simple arched doorway framing a distant view, elegant and spare",
      ],
      nostalgic_and_reflective: [
        "A winding country road disappearing into misty rolling hills",
        "An old wooden dock on a still lake at dusk, soft reflections",
        "A weathered bench under an ancient oak tree, dappled shade",
        "An old stone bridge over a quiet river, soft afternoon light",
      ],
    },
  },
  {
    id: "people",
    label: "People / Relationships",
    emoji: "👨‍👩‍👧",
    examples: "silhouetted couple, abstract figures, hands held, shadows on a path",
    compositionHints: [
      "ALWAYS render people as silhouettes, abstract shapes, or impressionistic forms — NEVER detailed faces or skin tones",
      "body language and posture convey emotion, not facial features",
      "seen from behind, in shadow, or as elegant minimal outlines",
      "do NOT depict specific racial features, hair textures, or skin colors — keep figures universal",
    ],
    profileKeywords: ["family", "friends", "dancing", "sports", "couple", "wedding", "together", "kids", "grandchildren", "partner"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "Two silhouetted figures walking side by side down a tree-lined path in soft autumn light, seen from behind",
        "A small silhouette hand reaching up to hold a larger one, gentle sky glow behind them",
        "Two abstract figures on a park bench viewed from a distance, soft bokeh light around them",
      ],
      supportive_and_comforting: [
        "Two dark silhouettes standing shoulder to shoulder facing a peaceful sunrise over water",
        "An impressionistic embrace — two abstract forms blending together in soft muted tones",
        "A single outstretched hand offering another hand, rendered as a minimal ink sketch",
      ],
      romantic_and_affectionate: [
        "Two silhouettes dancing under string lights in a garden at dusk, faces not visible",
        "Abstract figures sharing an umbrella in soft rain, rendered as fluid watercolor shapes",
        "Two silhouettes on a balcony watching a sunset, seen from behind as dark outlines",
      ],
      joyful_and_celebratory: [
        "Raised glasses clinking in a toast, hands only, bright festive light and confetti",
        "A row of silhouetted figures jumping joyfully on a hilltop against a bright sky",
        "An impressionistic table scene — lively light, indistinct figures, celebration implied through color and energy",
      ],
      warm_with_a_touch_of_humor: [
        "Two oversized coffee mugs on a porch railing, two pairs of feet propped up beside them",
        "A kitchen scene with flour everywhere — only hands and mixing bowls visible, warmth and chaos",
        "Two shadows cast long across a sunlit yard, one clearly chasing the other",
      ],
      funny_and_playful: [
        "Two pairs of hands in a playful tug-of-war over the last slice of cake on a plate",
        "A row of silly shadows on a wall — exaggerated poses cast by unseen figures",
        "Two pairs of sneakers side by side, one pair standing on tiptoe, playful energy",
      ],
      sarcastic_and_edgy: [
        "Two silhouettes clinking coffee mugs with deadpan posture, minimal background",
        "An empty party chair with a single balloon and a half-eaten cake slice — wryly funny",
        "Two pairs of sunglasses resting side by side on a table, cool and understated",
      ],
      simple_and_understated: [
        "A single elegant silhouette looking out over a quiet landscape at dusk",
        "Two minimal continuous-line figures holding hands, white space all around",
        "A quiet shadow profile against a soft gradient background, elegant and spare",
      ],
      nostalgic_and_reflective: [
        "Two silhouettes walking together down a tree-lined path, soft filtered light",
        "A figure sitting on a porch swing looking at a distant sunset",
        "Gentle shadows of two people sharing an umbrella in light rain",
      ],
    },
  },
  {
    id: "characters",
    label: "Characters / Cute Illustrations",
    emoji: "🧸",
    examples: "hedgehog with balloon, fox in scarf, penguin, teddy bear, gnome",
    compositionHints: [
      "character-forward, big personality in small figure",
      "clear readable expression and pose",
      "simple background or no background to let character shine",
    ],
    profileKeywords: ["cute", "kawaii", "cartoon", "animation", "stuffed animals", "plush", "teddy", "whimsical"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A small hedgehog offering a tiny flower with earnest expression",
        "A fox cub sitting under a string of soft fairy lights, content",
        "A teddy bear holding a hand-written card, looking up sweetly",
      ],
      supportive_and_comforting: [
        "A small bear wrapping a blanket around a smaller friend",
        "A gentle elephant holding a tiny umbrella over a mouse in the rain",
        "A sleepy owl on a branch, keeping watch through the night",
      ],
      romantic_and_affectionate: [
        "Two otters holding hands while floating on calm water",
        "A fox and rabbit sharing a scarf, sitting close together",
        "A pair of lovebird characters on a branch with tiny hearts",
      ],
      joyful_and_celebratory: [
        "A little bear wearing a party hat, arms up in celebration",
        "A parade of tiny woodland creatures carrying a banner",
        "A penguin popping confetti from a little cannon, delighted",
      ],
      warm_with_a_touch_of_humor: [
        "A hedgehog trying to hug a cactus, both looking surprised",
        "A cat character sitting in a box too small for it, perfectly content",
        "A tiny gnome carrying an enormous mushroom, determined",
      ],
      funny_and_playful: [
        "A raccoon character caught mid-heist with a cupcake, no regrets",
        "A penguin doing a dramatic belly slide through confetti",
        "An owl wearing comically large glasses, looking scholarly",
        "A corgi character doing a backflip off a stack of pancakes",
      ],
      sarcastic_and_edgy: [
        "A cat character sipping tea and side-eyeing the viewer",
        "A sloth character hanging from a branch, unbothered by everything",
        "A tiny grumpy frog sitting on a lily pad with a deadpan stare",
      ],
      simple_and_understated: [
        "A single small bird character perched quietly, minimal line art",
        "A tiny fox silhouette, clean and elegant against white space",
        "A simple bunny character in repose, gentle and refined",
      ],
      nostalgic_and_reflective: [
        "A small owl character sitting on a stack of old letters",
        "A gentle bear character holding a faded photograph",
        "A rabbit character tending a timeworn garden, quiet contentment",
      ],
    },
  },
  {
    id: "holiday",
    label: "Holiday / Seasonal",
    emoji: "🎄",
    examples: "Christmas tree, pumpkins, fireworks, snowflakes, spring garden",
    compositionHints: [
      "seasonal elements as central motif",
      "festive atmosphere without clutter",
      "recognizable holiday symbols used tastefully",
    ],
    profileKeywords: ["christmas", "halloween", "easter", "thanksgiving", "hanukkah", "diwali", "new year", "valentines", "fourth of july", "holiday"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A cozy fireplace scene with stockings, soft candlelight",
        "A gentle snow-covered cottage with soft light in the windows",
        "A spring garden in soft bloom, easter-morning feeling",
      ],
      supportive_and_comforting: [
        "A single candle flame glowing steadily against a quiet winter night",
        "First snowdrops emerging in early spring, promise of renewal",
        "A quiet winter scene with soft falling snow and gentle light",
      ],
      romantic_and_affectionate: [
        "Mistletoe and soft string lights in a cozy winter setting",
        "A Valentine's garden with heart-shaped topiaries and roses",
        "Two stockings hanging side by side by a quiet fire",
      ],
      joyful_and_celebratory: [
        "Brilliant fireworks bursting over a cityscape in celebration",
        "A brightly decorated Christmas tree with glowing ornaments",
        "Festive autumn harvest table with pumpkins and rich seasonal colors",
      ],
      warm_with_a_touch_of_humor: [
        "A snowman with a slightly crooked carrot nose, charming and imperfect",
        "A Christmas tree ornament that's a tiny disco ball among traditional ones",
        "A jack-o-lantern with a goofy surprised expression",
      ],
      funny_and_playful: [
        "A turkey wearing a pilgrim hat looking relieved it's not Thanksgiving",
        "A snowman that has clearly been in a snowball fight and lost",
        "A Christmas tree that's been enthusiastically over-decorated by a cat",
      ],
      sarcastic_and_edgy: [
        "A single wilting Valentine's rose in a stark modern vase",
        "A Christmas cactus decorated with one tiny ornament, minimal effort",
        "A jack-o-lantern with a deeply unimpressed carved expression",
      ],
      simple_and_understated: [
        "A single snowflake crystal against a soft blue gradient",
        "A minimal holly branch with red berries, elegant and clean",
        "One simple autumn leaf, perfectly formed, against white space",
      ],
      nostalgic_and_reflective: [
        "Vintage Christmas ornaments in a worn wooden box, soft light",
        "An old-fashioned valentine with lace edges and faded ink",
        "A weathered birthday candle holder with a single lit flame, quiet celebration",
      ],
    },
  },
  {
    id: "objects",
    label: "Objects & Celebrations",
    emoji: "☕",
    examples: "coffee cup, books, guitar, birthday cake, champagne, tea set, gift box, picnic",
    compositionHints: [
      "single strong focal object",
      "object as metaphor or symbol of the sentiment",
      "lots of negative space around the focal element",
      "food and drink items styled as still life with atmosphere",
    ],
    profileKeywords: ["coffee", "tea", "books", "reading", "music", "guitar", "piano", "cooking", "baking", "art", "photography", "cycling", "running", "wine", "craft", "knitting", "chess", "gaming", "writing", "vintage", "food", "cake", "cocktails", "brunch"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A steaming cup of tea with steam curling upward in soft light",
        "An open book with pressed flowers between the pages",
        "A hand-written letter in an envelope with a wax seal",
        "A lovingly arranged tea set for two on a linen cloth, soft light",
      ],
      supportive_and_comforting: [
        "A soft blanket draped over a reading chair, gentle lamp light",
        "A steaming mug of cocoa with a cozy knit sleeve",
        "A small candle glowing steadily beside a stack of books",
        "A warm bowl of soup and fresh bread on a quiet table, comforting light",
      ],
      romantic_and_affectionate: [
        "Two wine glasses touching in a toast, soft candlelight",
        "A vintage key on a velvet ribbon, symbolizing the heart",
        "A pair of intertwined coffee cups viewed from above",
        "A box of artisan chocolates with a satin ribbon, intimate setting",
      ],
      joyful_and_celebratory: [
        "A champagne bottle with cork popping and sparkles",
        "A colorful birthday cake with lit candles, festive and bright",
        "A gift box with a spectacular bow, anticipation and joy",
        "A festive table spread with cupcakes, confetti, and party favors",
      ],
      warm_with_a_touch_of_humor: [
        "A coffee mug that says something you can't quite read, next to a donut",
        "A guitar leaning against a porch railing on a lazy afternoon",
        "A stack of books piled improbably high, endearingly precarious",
        "A slightly lopsided homemade birthday cake, charming and heartfelt",
      ],
      funny_and_playful: [
        "A donut wearing sunglasses next to a very serious cup of coffee",
        "A pizza slice on a throne with a tiny crown",
        "A sock missing its match, looking forlorn on a clothesline",
        "A cake with way too many candles, cheerful and absurd",
      ],
      sarcastic_and_edgy: [
        "A single black coffee in a stark white mug, no nonsense",
        "A vintage typewriter with a crumpled paper ball beside it",
        "A cactus in a tiny pot on an otherwise empty desk",
        "A single candle on a cupcake, deadpan minimal birthday",
      ],
      simple_and_understated: [
        "A single vintage bicycle leaning against a wall",
        "A compass rose, clean and elegant against a soft background",
        "A simple line drawing of a coffee cup, refined and minimal",
        "A single macaron on a white plate, elegant and spare",
      ],
      nostalgic_and_reflective: [
        "A well-loved book open on a worn leather armchair, reading glasses nearby",
        "An antique pocket watch resting on a handwritten letter",
        "A vintage camera on a wooden shelf beside faded photographs",
        "A grandmother's tea cup and saucer on a lace doily, gentle light",
      ],
    },
  },
  {
    id: "abstract",
    label: "Abstract / Patterns",
    emoji: "🎨",
    examples: "geometric shapes, color washes, swirls, gradients, textures",
    compositionHints: [
      "non-representational shapes and forms",
      "color and texture as the primary subject",
      "rhythm and movement through abstract elements",
    ],
    profileKeywords: ["art", "design", "patterns", "geometry", "colors", "abstract", "modern", "contemporary", "minimal"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "Soft watercolor washes blending gentle blues, sage, and muted rose",
        "Flowing organic shapes in soft pastel tones, like a gentle embrace",
        "A soft gradient from dusty blue to blush pink, simple and emotional",
      ],
      supportive_and_comforting: [
        "Gentle concentric circles in calming blues and soft lavender",
        "A smooth gradient from dawn blue to warm cream, peaceful and steady",
        "Soft overlapping shapes in muted tones, like a gentle exhale",
      ],
      romantic_and_affectionate: [
        "Flowing curves in deep rose and slate, intimate and refined",
        "Intertwining abstract forms in blush and burgundy",
        "Soft bokeh-like circles in romantic pink and muted plum tones",
      ],
      joyful_and_celebratory: [
        "Bold splashes of confetti-like color bursting across the canvas",
        "Energetic geometric patterns in bright, festive primary colors",
        "Radiating sunburst pattern in vibrant yellows and oranges",
      ],
      warm_with_a_touch_of_humor: [
        "Playful polka dots in mismatched soft colors, charming and casual",
        "Squiggly hand-drawn shapes in friendly muted tones",
        "A pattern where one element is deliberately out of place, winking",
      ],
      funny_and_playful: [
        "Wild zigzag patterns in clashing bright colors, joyfully chaotic",
        "Cartoon-style explosion shapes in cheerful neon pastels",
        "Confetti-like scattered shapes in every direction, pure fun",
      ],
      sarcastic_and_edgy: [
        "A stark geometric grid with one element breaking the pattern",
        "Bold black and white contrast with a single pop of color",
        "Minimal graphic shapes — strong, clean, unapologetic",
      ],
      simple_and_understated: [
        "A single thin line forming a gentle curve against white space",
        "Two overlapping circles in muted neutral tones",
        "A quiet gradient from soft gray to cool white, barely there",
      ],
      nostalgic_and_reflective: [
        "Layered translucent shapes suggesting faded memories, soft edges",
        "A gentle wash of sepia and dusty blue, abstract and evocative",
        "Overlapping circles in muted tones, like ripples in still water",
      ],
    },
  },
  {
    id: "celestial",
    label: "Celestial / Night Sky",
    emoji: "🌙",
    examples: "stars, moon, constellations, aurora, sunrise, galaxy, shooting star",
    compositionHints: [
      "sky as the dominant element, filling most of the composition",
      "single celestial focal point (moon, star cluster, aurora band)",
      "sense of vastness and wonder through scale and color",
    ],
    profileKeywords: ["astronomy", "stars", "space", "science", "nature", "night", "sky", "travel", "wonder", "meditation", "philosophy"],
    sceneSketches: {
      heartfelt_and_sincere: [
        "A gentle crescent moon above a quiet landscape, soft starlight",
        "A sky full of softly glowing stars reflected in still water below",
        "A warm sunrise breaking over a distant horizon, hopeful and tender",
      ],
      supportive_and_comforting: [
        "A steady guiding star in a soft night sky, calm and reassuring",
        "The first light of dawn appearing on a dark horizon, quiet promise",
        "A gentle aurora in soft blues and greens over a peaceful scene",
      ],
      romantic_and_affectionate: [
        "A full moon casting silver light over a calm sea at night",
        "Two shooting stars crossing paths in a deep twilight sky",
        "A starlit sky above a silhouetted tree line, intimate and magical",
      ],
      joyful_and_celebratory: [
        "A brilliant burst of shooting stars streaking across a vivid sky",
        "A vibrant aurora borealis in greens, pinks, and purples, dazzling",
        "A radiant sunrise with bold color bands of coral, gold, and blue",
      ],
      nostalgic_and_reflective: [
        "A familiar constellation in a faded indigo sky, quiet wonder",
        "An old telescope pointed at a soft moon, sense of shared memories",
        "The last light of a sunset fading into deep blue dusk",
      ],
      warm_with_a_touch_of_humor: [
        "A smiling crescent moon peeking through friendly clouds",
        "A single star that shines just a bit brighter than the rest, winking",
        "A cozy rooftop scene with a blanket laid out for stargazing",
      ],
      funny_and_playful: [
        "A moon with a cheerful face winking at the viewer, bright and playful",
        "Stars arranged in a cartoonishly perfect constellation shape",
        "A rocket ship trailing a rainbow through a starry cartoon sky",
      ],
      sarcastic_and_edgy: [
        "A stark black sky with a single unimpressed-looking star",
        "A dramatic eclipse in high contrast, bold and graphic",
        "A minimalist crescent moon against absolute darkness, striking",
      ],
      simple_and_understated: [
        "A thin crescent moon against a soft gradient sky, minimal and elegant",
        "Three small stars in a quiet expanse of night, understated and calm",
        "A single horizon line with the faintest glow of predawn light",
      ],
    },
  },
];

// ─── Mood Recipes ────────────────────────────────────────────────────

export const MOOD_RECIPES: MoodRecipe[] = [
  {
    id: "heartfelt_and_sincere",
    label: "Heartfelt and sincere",
    recommendedSubjects: ["flowers", "animals", "nature", "people"],
    lighting: ["soft natural light", "gentle ambient light", "low contrast", "soft diffused light", "overcast natural light"],
    palette: ["soft pastels", "gentle greens", "dusty blue and sage", "muted rose and slate", "soft ivory and cool gray", "peach and blush accents"],
    texture: ["subtle paper texture", "soft gradients", "light painterly edges"],
    composition: ["simple focal subject", "airy spacing", "lower-third focal point"],
    avoid: ["confetti", "neon colors", "harsh shadows", "overly busy compositions"],
    promptSnippets: [
      "genuine, heartfelt atmosphere",
      "soft natural light and gentle inviting colors",
      "simple uncluttered composition with breathing room",
    ],
    profileFilter: "all",
  },
  {
    id: "supportive_and_comforting",
    label: "Supportive and comforting",
    recommendedSubjects: ["nature", "objects", "flowers", "characters"],
    lighting: ["diffused soft light", "gentle dawn glow", "low contrast", "overcast softness", "cool morning light"],
    palette: ["muted pastels", "soft blues", "lavender", "cool gray", "sage", "dusty periwinkle", "soft celadon"],
    texture: ["smooth washes", "very light grain", "misty atmospheric quality"],
    composition: ["minimal elements", "single focal point", "wide open space", "very low visual density"],
    avoid: ["celebration elements", "high saturation", "dramatic contrast", "busy patterns"],
    promptSnippets: [
      "quiet, peaceful, reassuring mood",
      "minimal composition with gentle diffused light",
      "soft muted palette and calm serene atmosphere",
    ],
    profileFilter: "gentle",
  },
  {
    id: "romantic_and_affectionate",
    label: "Romantic and affectionate",
    recommendedSubjects: ["flowers", "people", "nature", "celestial"],
    lighting: ["soft diffused glow", "gentle vignette", "low ambient light", "twilight softness", "candlelight feel"],
    palette: ["blush pink", "deep rose", "dusty mauve", "soft plum and sage", "muted teal accents", "burgundy and cool cream"],
    texture: ["velvety soft blending", "gentle painterly quality", "light paper texture"],
    composition: ["elegant focal arrangement", "gently asymmetrical balance", "intimate framing"],
    avoid: ["cartoonish exaggeration", "neon pinks", "overcrowded compositions", "harsh contrast"],
    promptSnippets: [
      "romantic, affectionate, intimate atmosphere",
      "soft glow with elegant refined composition",
      "beautiful details with breathing room",
    ],
    profileFilter: "all",
  },
  {
    id: "joyful_and_celebratory",
    label: "Joyful and celebratory",
    recommendedSubjects: ["characters", "holiday", "flowers", "animals"],
    lighting: ["bright daylight feel", "cheerful highlights", "medium contrast", "vibrant clean light"],
    palette: ["bright primaries", "happy pastels", "vibrant accents", "sky blues and coral", "fresh greens and turquoise", "vivid magenta and cobalt"],
    texture: ["clean illustration", "crisp shapes", "energetic brushwork"],
    composition: ["energetic but not cluttered", "clear focal elements", "upward diagonal movement"],
    avoid: ["overdense confetti", "dark moody palettes", "too many competing elements"],
    promptSnippets: [
      "joyful, festive, celebratory atmosphere",
      "bright uplifting colors with clean energetic composition",
      "celebration feeling with visual clarity",
    ],
    profileFilter: "all",
  },
  {
    id: "warm_with_a_touch_of_humor",
    label: "Warm with a touch of humor",
    recommendedSubjects: ["characters", "animals", "objects", "flowers"],
    lighting: ["soft cozy light", "friendly ambient tone", "gentle natural light", "soft inviting shadows"],
    palette: ["soft pastels", "gentle teal and peach", "muted coral and sage", "dusty blue and cream", "light olive and blush"],
    texture: ["hand-drawn feel", "slight ink outline", "soft friendly shading"],
    composition: ["simple character or object + one prop", "clear read at small size", "ample whitespace"],
    avoid: ["mean-spirited elements", "heavy sarcasm", "aggressive contrast", "visual chaos"],
    promptSnippets: [
      "friendly mood with a subtle charming twist",
      "simple inviting composition with personality",
      "approachable palette and clean uncluttered background",
    ],
    profileFilter: "all",
  },
  {
    id: "funny_and_playful",
    label: "Funny and playful",
    recommendedSubjects: ["characters", "animals", "objects", "holiday"],
    lighting: ["bright and cheerful", "simple clean shading", "high clarity"],
    palette: ["cheerful brights", "pastel brights", "high color contrast but controlled", "candy colors"],
    texture: ["cartoon illustration texture", "clean edges", "optional light grain"],
    composition: ["character-forward", "clear silhouette", "big readable expression", "minimal background"],
    avoid: ["dark humor imagery", "edgy symbols", "too many small details", "busy backgrounds"],
    promptSnippets: [
      "playful, comedic, lighthearted tone",
      "simple scene with strong focal point and minimal background",
      "bright cheerful palette with personality",
    ],
    profileFilter: "energetic",
  },
  {
    id: "sarcastic_and_edgy",
    label: "Sarcastic and edgy",
    recommendedSubjects: ["objects", "characters", "celestial", "abstract"],
    lighting: ["flat or lightly shaded", "graphic contrast", "controlled highlights"],
    palette: ["limited palette", "bold single accent color", "neutral base (white/cream/gray)", "black and white with pop"],
    texture: ["graphic illustration", "poster-like cleanliness", "crisp outlines"],
    composition: ["minimal", "strong single focal element", "lots of whitespace", "high readability"],
    avoid: ["hate symbols", "graphic violence", "explicit content", "political imagery", "overcrowded layouts"],
    promptSnippets: [
      "wry, deadpan, edgy-but-not-offensive tone",
      "minimal graphic composition with one strong focal point",
      "limited palette with one bold accent color",
    ],
    profileFilter: "minimal",
  },
  {
    id: "simple_and_understated",
    label: "Simple and understated",
    recommendedSubjects: ["objects", "flowers", "abstract", "celestial"],
    lighting: ["soft and even", "very low contrast", "no dramatic effects", "flat ambient light"],
    palette: ["neutral tones", "monochrome options", "cool gray and white", "soft gray-blue", "charcoal and ivory", "muted stone and slate"],
    texture: ["clean matte look", "very subtle grain", "no heavy brush texture"],
    composition: ["ultra minimal", "abundant negative space", "centered or rule-of-thirds placement"],
    avoid: ["visual noise", "busy patterns", "too many colors", "complex scenes", "clutter"],
    promptSnippets: [
      "minimal, refined composition with generous whitespace",
      "subtle muted palette and calm restrained tone",
      "simple forms with elegant sophistication",
    ],
    profileFilter: "minimal",
  },
  {
    id: "nostalgic_and_reflective",
    label: "Nostalgic and reflective",
    recommendedSubjects: ["nature", "objects", "celestial", "flowers"],
    lighting: ["late afternoon light", "soft filtered light through curtains", "gentle overcast glow", "dappled shade", "quiet evening light"],
    palette: ["faded denim and ivory", "sepia and dusty rose", "muted olive and cream", "slate blue and parchment", "antique gold and soft gray", "cool lavender and warm bisque"],
    texture: ["subtle paper aging", "soft grain", "gentle vignette", "slightly faded edges"],
    composition: ["single evocative object", "wide negative space inviting memory", "off-center focal point with breathing room"],
    avoid: ["neon colors", "busy patterns", "overly modern elements", "harsh contrast", "cartoonish exaggeration"],
    promptSnippets: [
      "nostalgic, reflective atmosphere evoking cherished memories",
      "soft muted palette with gentle vintage quality",
      "quiet composition that invites contemplation and warmth",
    ],
    profileFilter: "all",
  },
];

// ─── Style Recipes ───────────────────────────────────────────────────

export const STYLE_RECIPES: StyleRecipe[] = [
  {
    id: "watercolor",
    label: "Watercolor",
    desc: "Soft, flowing washes of color with visible brush strokes",
    technique: ["wet-on-wet watercolor washes", "transparent color layers", "pigment blooming"],
    texture: ["visible brushstrokes", "paint bleeding at edges", "subtle paper grain showing through"],
    lineQuality: ["soft edges", "no hard outlines", "color defines form"],
    renderingNotes: ["allow white paper to show through", "embrace happy accidents in color mixing"],
  },
  {
    id: "whimsical",
    label: "Cute / Whimsical",
    desc: "Playful, charming illustrations with rounded shapes and personality",
    technique: ["rounded simplified forms", "expressive character design", "storybook illustration feel"],
    texture: ["soft digital coloring", "gentle shading", "clean but not sterile"],
    lineQuality: ["friendly rounded outlines", "varying line weight", "hand-drawn warmth"],
    renderingNotes: ["exaggerate proportions for charm (big heads, small bodies)", "emotive eyes and gestures"],
  },
  {
    id: "minimalist",
    label: "Minimalist",
    desc: "Clean lines, lots of white space, simple and elegant",
    technique: ["reduction to essential forms", "geometric simplification", "intentional emptiness"],
    texture: ["flat or near-flat color", "no visible brushwork", "matte clean finish"],
    lineQuality: ["thin precise lines", "uniform weight", "architectural precision"],
    renderingNotes: ["every element must earn its place", "white space is the dominant element"],
  },
  {
    id: "vintage",
    label: "Vintage",
    desc: "Retro, slightly aged look with muted tones and nostalgic charm",
    technique: ["mid-century illustration style", "screen-print aesthetic", "limited color separations"],
    texture: ["subtle paper aging", "slight grain or noise", "muted color saturation"],
    lineQuality: ["bold confident strokes", "retro lettering-style curves", "woodblock feel"],
    renderingNotes: ["desaturate slightly", "slightly aged color quality", "embrace imperfection in registration"],
  },
  {
    id: "painterly",
    label: "Painterly",
    desc: "Rich, textured like an oil or acrylic painting with visible brushwork",
    technique: ["thick impasto-like strokes", "rich color layering", "painterly blending"],
    texture: ["heavy visible brushwork", "canvas-like surface", "rich tactile quality"],
    lineQuality: ["no outlines — form built from color and value", "bold confident marks"],
    renderingNotes: ["embrace texture and materiality", "visible artist's hand in every stroke"],
  },
  {
    id: "abstract_style",
    label: "Abstract",
    desc: "Expressive, non-representational shapes and colors",
    technique: ["color field composition", "gestural mark-making", "shape-based storytelling"],
    texture: ["varied — from smooth gradients to rough marks", "mixed media feel"],
    lineQuality: ["free-form", "expressive", "no concern for realism"],
    renderingNotes: ["emotion through color and form, not representation", "bold compositional choices"],
  },
  {
    id: "art_deco",
    label: "Art Deco",
    desc: "Geometric elegance with bold lines, symmetry, and luxurious detail",
    technique: ["geometric symmetry", "bold angular forms", "ornamental pattern work", "1920s-30s decorative design"],
    texture: ["smooth polished surfaces", "metallic accents (gold, silver, bronze)", "crisp clean rendering"],
    lineQuality: ["strong precise outlines", "angular geometric shapes", "symmetrical framing elements"],
    renderingNotes: ["emphasize symmetry and geometric repetition", "luxurious and glamorous without being gaudy"],
  },
  {
    id: "line_art",
    label: "Line Art / Ink",
    desc: "Clean ink drawings with expressive linework and minimal or no color",
    technique: ["pen and ink illustration", "cross-hatching for depth", "contour drawing"],
    texture: ["crisp ink on paper", "occasional ink splatter or bleed", "white space as a design element"],
    lineQuality: ["varied line weight for emphasis", "confident fluid strokes", "fine detail work"],
    renderingNotes: ["limited palette — black ink with at most one or two accent colors", "let the linework carry the composition"],
  },
  {
    id: "gouache",
    label: "Gouache",
    desc: "Flat, opaque, matte color with a modern illustrative feel",
    technique: ["flat opaque color application", "layered shapes with clean edges", "modern editorial illustration style"],
    texture: ["matte velvety finish", "smooth flat color fields", "subtle visible brush marks at edges"],
    lineQuality: ["shapes defined by color contrast, not outlines", "crisp silhouettes", "occasional thin outline accents"],
    renderingNotes: ["bold flat areas of color with confident placement", "contemporary and fresh — like a modern book or magazine illustration"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

/** Pick n random items from an array (Fisher-Yates partial shuffle) */
export function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

/** Convert a tone label (e.g. "Heartfelt and sincere") to a mood recipe id */
export function toneToMoodId(tone: string): string {
  return tone.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
}

/** Look up recipes by id */
export function getSubjectRecipe(id: string): SubjectRecipe | undefined {
  return SUBJECT_RECIPES.find((s) => s.id === id);
}

export function getMoodRecipe(tone: string): MoodRecipe | undefined {
  const moodId = toneToMoodId(tone);
  return MOOD_RECIPES.find((m) => m.id === moodId);
}

export function getStyleRecipe(id: string): StyleRecipe | undefined {
  return STYLE_RECIPES.find((s) => s.id === id);
}

/**
 * Filter profile interests that are compatible with the current mood.
 * "gentle" moods (sympathy, comforting) filter out high-energy interests.
 * "energetic" moods (funny, playful) prefer active interests.
 * "minimal" moods (sarcastic, understated) use very few profile details.
 */
const GENTLE_BLOCK = ["skateboarding", "gaming", "extreme", "racing", "wrestling", "boxing", "partying"];
const ENERGETIC_BOOST = ["sports", "dancing", "skateboarding", "surfing", "gaming", "partying", "adventure"];

export function filterProfileInterests(
  interests: string[],
  mood: MoodRecipe
): string[] {
  if (mood.profileFilter === "minimal") return interests.slice(0, 1);
  if (mood.profileFilter === "gentle") {
    return interests.filter((i) => !GENTLE_BLOCK.some((b) => i.toLowerCase().includes(b)));
  }
  if (mood.profileFilter === "energetic") {
    const boosted = interests.filter((i) => ENERGETIC_BOOST.some((b) => i.toLowerCase().includes(b)));
    const rest = interests.filter((i) => !ENERGETIC_BOOST.some((b) => i.toLowerCase().includes(b)));
    return [...boosted, ...rest];
  }
  return interests;
}

/**
 * Build a complete image prompt from all recipe layers + profile context.
 */
/** Return the best birthday string for age calculation: recipient.birthday or the date from an Important date with label "Birthday". */
export function getBirthdayForAge(
  birthday: string | null | undefined,
  importantDates?: { label: string; date: string }[] | null
): string | null {
  if (birthday?.trim()) return birthday.trim();
  const entry = (importantDates || []).find(
    (d) => (d.label ?? "").toLowerCase().trim() === "birthday"
  );
  return (entry?.date ?? "").trim() || null;
}

/** Calculate age from a birthday string (YYYY-MM-DD or similar parseable format) */
export function calculateAge(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const dob = new Date(birthday);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function buildRecipePrompt(opts: {
  subjectId: string;
  subjectDetail?: string;
  tone: string;
  styleId: string;
  personalContext?: string;
  profileInterests?: string[];
  occasion: string;
  recipientAge?: number | null;
  relationshipType?: string;
  includeFaithBased?: boolean;
}): string {
  const subject = getSubjectRecipe(opts.subjectId);
  const mood = getMoodRecipe(opts.tone);
  const style = getStyleRecipe(opts.styleId);

  if (!subject || !mood || !style) {
    return `Greeting card illustration for ${opts.occasion}. ${opts.personalContext || ""}`;
  }

  // Pick a random scene sketch for this subject×mood combination
  const moodId = toneToMoodId(opts.tone);
  const sketches = subject.sceneSketches[moodId] || [];
  const chosenSketch = opts.subjectDetail?.trim()
    ? opts.subjectDetail.trim()
    : (pickRandom(sketches, 1)[0] || `${subject.label} illustration`);

  // Filter and inject profile interests as motif hints
  let profileHint = "";
  if (opts.profileInterests && opts.profileInterests.length > 0) {
    const filtered = filterProfileInterests(opts.profileInterests, mood);
    const relevant = filtered.filter((interest) =>
      subject.profileKeywords.some((kw) =>
        interest.toLowerCase().includes(kw) || kw.includes(interest.toLowerCase())
      )
    );
    if (relevant.length > 0) {
      const picked = pickRandom(relevant, 2);
      profileHint = `\nPersonal touch: incorporate ${picked.join(" and ")} naturally into the scene.`;
    }
  }

  const personalCtx = opts.personalContext?.trim()
    ? `\nAdditional context: ${opts.personalContext.trim()}`
    : "";

  // Build age/relationship context so the AI knows who this card is for
  let recipientContext = "";
  if (opts.recipientAge != null || opts.relationshipType) {
    const parts: string[] = [];
    if (opts.relationshipType) parts.push(`Recipient is the sender's ${opts.relationshipType.toLowerCase()}`);
    if (opts.recipientAge != null) {
      parts.push(`${opts.recipientAge} years old`);
      if (opts.recipientAge < 5) parts.push("— design for a toddler/young child");
      else if (opts.recipientAge < 13) parts.push("— design for a child");
      else if (opts.recipientAge < 20) parts.push("— design for a teenager");
      else if (opts.recipientAge < 30) parts.push("— design for a young adult");
      else if (opts.recipientAge < 60) parts.push("— design for an adult");
      else parts.push("— design for a mature adult");
    }
    recipientContext = `\nRecipient context (for theme/mood only, NOT to depict): ${parts.join(", ")}. Do NOT draw the recipient.`;
  }

  // Compose the prompt from all layers
  const lines = [
    // Global guardrails
    GLOBAL_GUARDRAILS.alwaysInclude.join(". ") + ".",

    // Recipient age/relationship (high priority — placed early)
    recipientContext,

    // Scene description (from subject × mood)
    `\nScene: ${chosenSketch}`,

    // Subject composition
    `\nComposition: ${pickRandom(subject.compositionHints, 2).join(". ")}.`,

    // Mood atmosphere
    `\nLighting: ${pickRandom(mood.lighting, 2).join(", ")}.`,
    `Palette: ${pickRandom(mood.palette, 3).join(", ")}.`,
    `Atmosphere: ${pickRandom(mood.promptSnippets, 2).join(". ")}.`,

    // Style technique
    `\nArt style: ${style.label} — ${pickRandom(style.technique, 2).join(", ")}.`,
    `Texture: ${pickRandom(style.texture, 2).join(", ")}.`,
    `Line quality: ${pickRandom(style.lineQuality, 1).join(", ")}.`,
    pickRandom(style.renderingNotes, 1).join(". ") + ".",

    // Mood composition guidelines
    `\nComposition feel: ${pickRandom(mood.composition, 2).join(". ")}.`,

    // Profile and personal context
    profileHint,
    personalCtx,

    // Occasion
    `\nOccasion: ${opts.occasion}.`,

    // Faith-based modifier (non-denominational, respectful imagery)
    ...(opts.includeFaithBased ? ["\nFaith-based card: use respectful, non-denominational imagery (soft light, peaceful, warm). Avoid humor or edgy elements."] : []),

    // Avoid list (global + mood-specific)
    `\nAVOID: ${[...GLOBAL_GUARDRAILS.avoid, ...mood.avoid].join("; ")}.`,
  ];

  return lines.filter(Boolean).join("\n");
}

/**
 * User-facing variant of buildRecipePrompt.
 * Shows only the creative scene description — system guardrails, avoid lists,
 * recipient metadata, and faith modifiers are stripped because the generate-image
 * API already enforces them via literalRules.
 */
export function buildUserFacingPrompt(opts: {
  subjectId: string;
  subjectDetail?: string;
  tone: string;
  styleId: string;
  personalContext?: string;
  profileInterests?: string[];
  occasion: string;
}): string {
  const subject = getSubjectRecipe(opts.subjectId);
  const mood = getMoodRecipe(opts.tone);
  const style = getStyleRecipe(opts.styleId);

  if (!subject || !mood || !style) {
    return `Illustration for a ${opts.occasion} card. ${opts.personalContext || ""}`;
  }

  const moodId = toneToMoodId(opts.tone);
  const sketches = subject.sceneSketches[moodId] || [];
  const chosenSketch = opts.subjectDetail?.trim()
    ? opts.subjectDetail.trim()
    : (pickRandom(sketches, 1)[0] || `${subject.label} illustration`);

  let profileHint = "";
  if (opts.profileInterests && opts.profileInterests.length > 0) {
    const filtered = filterProfileInterests(opts.profileInterests, mood);
    const relevant = filtered.filter((interest) =>
      subject.profileKeywords.some((kw) =>
        interest.toLowerCase().includes(kw) || kw.includes(interest.toLowerCase())
      )
    );
    if (relevant.length > 0) {
      const picked = pickRandom(relevant, 2);
      profileHint = `\nPersonal touch: incorporate ${picked.join(" and ")} naturally into the scene.`;
    }
  }

  const personalCtx = opts.personalContext?.trim()
    ? `\nAdditional context: ${opts.personalContext.trim()}`
    : "";

  const lines = [
    `Scene: ${chosenSketch}`,
    `\nArt style: ${style.label} — ${pickRandom(style.technique, 2).join(", ")}.`,
    `Lighting: ${pickRandom(mood.lighting, 2).join(", ")}.`,
    `Palette: ${pickRandom(mood.palette, 3).join(", ")}.`,
    `Atmosphere: ${pickRandom(mood.promptSnippets, 2).join(". ")}.`,
    profileHint,
    personalCtx,
    `\nOccasion: ${opts.occasion}.`,
  ];

  return lines.filter(Boolean).join("\n");
}
