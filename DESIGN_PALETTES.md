# Nuuge — Design Palette & Style Reference

> Source of truth: `src/lib/card-recipes.ts`
> Last updated: Feb 17, 2026

---

## How the Prompt System Works

Every generated card image is composed from **three recipe layers** plus optional profile context:

1. **Subject** — WHAT to draw (flowers, animals, nature, people, characters, holiday, objects, abstract)
2. **Mood** — HOW IT FEELS (lighting, palette, atmosphere) — derived from the user's selected tone
3. **Style** — HOW IT'S RENDERED (technique, texture, line quality)
4. **Profile context** — personal interests injected as motif hints

The prompt builder picks **random items** from each layer's arrays, so results naturally vary across cards.

---

## Mood Palettes (by Tone)

### Heartfelt and sincere
| Palette options | Lighting options |
|---|---|
| soft pastels | soft natural light |
| gentle greens | gentle ambient light |
| dusty blue and sage | low contrast |
| muted rose and slate | soft diffused light |
| soft ivory and cool gray | overcast natural light |
| peach and blush accents | |

### Supportive and comforting
| Palette options | Lighting options |
|---|---|
| muted pastels | diffused soft light |
| soft blues | gentle dawn glow |
| lavender | low contrast |
| cool gray | overcast softness |
| sage | cool morning light |
| dusty periwinkle | |
| soft celadon | |

### Romantic and affectionate
| Palette options | Lighting options |
|---|---|
| blush pink | soft diffused glow |
| deep rose | gentle vignette |
| dusty mauve | low ambient light |
| soft plum and sage | twilight softness |
| muted teal accents | candlelight feel |
| burgundy and cool cream | |

### Joyful and celebratory
| Palette options | Lighting options |
|---|---|
| bright primaries | bright daylight feel |
| happy pastels | cheerful highlights |
| vibrant accents | medium contrast |
| sky blues and coral | vibrant clean light |
| fresh greens and turquoise | |
| vivid magenta and cobalt | |

### Warm with a touch of humor
| Palette options | Lighting options |
|---|---|
| soft pastels | soft cozy light |
| gentle teal and peach | friendly ambient tone |
| muted coral and sage | gentle natural light |
| dusty blue and cream | soft inviting shadows |
| light olive and blush | |

### Funny and playful
| Palette options | Lighting options |
|---|---|
| cheerful brights | bright and cheerful |
| pastel brights | simple clean shading |
| high color contrast but controlled | high clarity |
| candy colors | |

### Sarcastic and edgy
| Palette options | Lighting options |
|---|---|
| limited palette | flat or lightly shaded |
| bold single accent color | graphic contrast |
| neutral base (white/cream/gray) | controlled highlights |
| black and white with pop | |

### Simple and understated
| Palette options | Lighting options |
|---|---|
| neutral tones | soft and even |
| monochrome options | very low contrast |
| cool gray and white | no dramatic effects |
| soft gray-blue | flat ambient light |
| charcoal and ivory | |
| muted stone and slate | |

### Nostalgic and reflective
| Palette options | Lighting options |
|---|---|
| faded denim and ivory | late afternoon light |
| sepia and dusty rose | soft filtered light through curtains |
| muted olive and cream | gentle overcast glow |
| slate blue and parchment | dappled shade |
| antique gold and soft gray | quiet evening light |
| cool lavender and warm bisque | |

---

### Future Tone Candidates

These tones are not yet implemented but are strong candidates for future addition:

| Tone | Emotional Territory | Pairs well with |
|---|---|---|
| **Inspirational and uplifting** | Encouragement, graduation, new beginnings — forward-looking and motivational | Watercolor, Abstract, Art Deco |
| **Elegant and sophisticated** | Weddings, formal thank-yous, corporate — refinement and formality | Art Deco, Line Art, Minimalist |

---

## Art Styles

| Style ID | Label | Key Technique | Texture |
|---|---|---|---|
| `watercolor` | Watercolor | wet-on-wet washes, transparent layers, pigment blooming | visible brushstrokes, paint bleeding, paper grain |
| `whimsical` | Cute / Whimsical | rounded simplified forms, storybook feel | soft digital coloring, gentle shading |
| `minimalist` | Minimalist | reduction to essential forms, geometric simplification | flat/near-flat color, matte clean finish |
| `vintage` | Vintage | mid-century illustration, screen-print aesthetic | subtle paper aging, slight grain, muted saturation |
| `painterly` | Painterly | thick impasto strokes, rich color layering | heavy visible brushwork, canvas-like surface |
| `abstract_style` | Abstract | color field composition, gestural mark-making | varied — smooth gradients to rough marks |
| `art_deco` | Art Deco | geometric symmetry, bold angular forms, 1920s-30s decorative design | smooth polished surfaces, metallic accents (gold, silver, bronze) |
| `line_art` | Line Art / Ink | pen and ink illustration, cross-hatching, contour drawing | crisp ink on paper, occasional ink splatter |
| `gouache` | Gouache | flat opaque color, layered shapes with clean edges, modern editorial style | matte velvety finish, smooth flat color fields |

### Style Details

#### Art Deco (`art_deco`)
- **Era:** 1920s–1930s decorative design
- **Line quality:** Strong precise outlines, angular geometric shapes, symmetrical framing
- **Rendering notes:** Emphasize symmetry and geometric repetition; luxurious and glamorous without being gaudy
- **Best for:** Elegant/formal occasions, anniversaries, milestone celebrations

#### Line Art / Ink (`line_art`)
- **Technique:** Pen and ink, cross-hatching for depth, contour drawing
- **Line quality:** Varied line weight for emphasis, confident fluid strokes, fine detail work
- **Rendering notes:** Limited palette — black ink with at most one or two accent colors; let the linework carry the composition
- **Best for:** Classic, timeless cards; pairs well with minimalist and simple tones

#### Gouache (`gouache`)
- **Technique:** Flat opaque color, layered shapes with clean edges, modern editorial illustration
- **Line quality:** Shapes defined by color contrast not outlines, crisp silhouettes
- **Rendering notes:** Bold flat areas of color with confident placement; contemporary and fresh — like a modern book or magazine illustration
- **Best for:** Modern, fresh-feeling cards; works across all tones

---

## Subject Categories

| Subject ID | Label | Best for |
|---|---|---|
| `flowers` | Flowers / Botanicals | roses, wildflowers, sunflowers, cherry blossoms, succulents |
| `animals` | Animals | fox, dog, cat, birds, butterflies, deer, rabbit |
| `nature` | Nature & Places | forest, mountains, ocean, garden, cozy cottage, cafe street, old bridge, city skyline |
| `people` | People / Relationships | silhouettes, abstract figures, hands, shadows (never detailed faces) |
| `characters` | Characters / Cute Illustrations | hedgehog, fox in scarf, penguin, teddy bear, gnome |
| `holiday` | Holiday / Seasonal | Christmas, pumpkins, fireworks, snowflakes |
| `objects` | Objects & Celebrations | coffee cup, books, guitar, birthday cake, champagne, tea set, gift box, picnic |
| `abstract` | Abstract / Patterns | geometric shapes, color washes, swirls, gradients |
| `celestial` | Celestial / Night Sky | stars, moon, constellations, aurora, sunrise, galaxy, shooting star |

### Recent Subject Changes (Feb 2026)

- **Nature / Landscape → Nature & Places**: Expanded to include architecture and cityscapes (cozy cottages, Parisian cafes, cobblestone streets, bridges, doorways). Scene sketches describe complete settings so the AI generates them accurately regardless of the broader category name.
- **Objects / Symbols → Objects & Celebrations**: Expanded to include food and celebration items (birthday cakes, champagne, tea sets, picnic spreads). These are "meaningful objects" that naturally fit the existing category.
- **Celestial / Night Sky**: New category covering stars, moon, constellations, aurora, galaxies, and sunrise/sunset skies. Recommended for Romantic, Simple, Nostalgic, and Sarcastic tones.

---

## Global Guardrails (Always Applied)

**Always include:**
- Greeting card illustration, portrait format, full-bleed, print-ready, clean composition
- No text/words, no watermark, no logo, no signature, no frame/border

**Prefer:**
- Original hand-crafted feel, single illustrator's coherent style, balanced layout, clear focal point

**Avoid:**
- Busy cluttered backgrounds, stock photography look, corporate clip art
- Human figures/faces unless explicitly described
- Distorted anatomy, AI artifacts, generic/template composition

---

## Design Principles (Feb 2026 Update)

- Palettes are intentionally **color-diverse** — each mood includes cool, neutral, and warm options
- The prompt builder picks 3 random palette items per card, creating natural variation
- Lighting is similarly diversified to avoid a uniform warm cast
- Scene sketches use neutral light descriptors ("soft light", "gentle light") rather than warm-biased ones ("golden glow", "honey tones")
- The Vintage style uses "slightly aged color quality" rather than explicit warm-shifting
