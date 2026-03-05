# Nuuge — Development Log & Architecture Summary

**What is Nuuge?** An AI-powered greeting card app that creates cards that actually sound like the sender. You set up your profile and add people through quick structured wizards with curated selection lists, then Nuuge generates personalized messages and illustrated card designs based on that deep context.

**Stack:** Next.js 16, React 19, Tailwind CSS 4, OpenAI API (GPT-4o for text, gpt-image-1 for images), localStorage + IndexedDB for client-side storage.

---

## How It All Fits Together

### The User Flow

1. **Onboarding** — A 4-step structured wizard (Basics → Personality & Interests → Communication Style → Review) with curated tappable selection lists. Takes ~60 seconds. No AI dependency — direct data entry with optional custom fields.

2. **Add recipients** — A 4-step wizard (Who → Personality & Interests → Card Preferences → Review) with the same curated-list approach. Captures relationship type, personality traits, interests, humor tolerance, tone preference, personal dates, and milestones. Takes ~90 seconds.

3. **Create a card** — Pick a recipient, choose an occasion and tone, and the app generates three message options (with toggleable profile elements and progressive de-emphasis on regeneration). Then a 3-step visual builder guides you through Subject, Art Style, and Personal Context. The image prompt is composed from a multi-layered "recipe" system (Subject × Mood × Style × Profile) that produces varied, engaging results with built-in randomness. You can also let Nuuge suggest designs instead. Refine the image iteratively until you're happy.

4. **Deliver** — Send digitally (animated envelope experience), print at home (formatted for card stock), or mail a physical card.

### File Structure

```
src/
├── app/
│   ├── page.tsx                          # Dashboard — all recipients, quick actions
│   ├── onboarding/page.tsx               # 4-step wizard for sender profile setup
│   ├── profile/page.tsx                  # Edit sender profile
│   ├── recipients/
│   │   ├── new/page.tsx                  # 4-step wizard for adding a recipient
│   │   └── [id]/page.tsx                 # Recipient profile + card history
│   ├── cards/
│   │   ├── create/[recipientId]/page.tsx # Card creation wizard (the big one)
│   │   ├── view/[cardId]/page.tsx        # Digital card viewer (envelope animation)
│   │   ├── edit/[cardId]/page.tsx        # Edit saved card
│   │   └── print/[cardId]/page.tsx       # Print layout with paper size controls
│   ├── api/
│   │   ├── chat/route.ts                 # Conversational AI (legacy, retained for future use)
│   │   ├── generate-card/route.ts        # Message generation (3 options per batch)
│   │   ├── suggest-designs/route.ts      # Card front design concepts (3 lanes)
│   │   ├── suggest-inside-designs/route.ts # Inside illustration concepts
│   │   ├── suggest-front-text/route.ts   # Front cover text suggestion
│   │   ├── generate-image/route.ts       # Image generation + editing (gpt-image-1)
│   │   ├── merge-scene/route.ts          # Merges refinement into running description
│   │   └── health/route.ts              # Health check (API key configured?)
│   ├── seed/page.tsx                     # Seed demo data
│   └── reset/page.tsx                    # Clear all data
├── components/
│   ├── ConversationFlow.tsx              # Chat interface (legacy, retained for future use)
│   └── ProfileEditor.tsx                 # Shared profile editing form
├── lib/
│   ├── store.ts                          # localStorage CRUD for profiles, recipients, cards
│   ├── image-store.ts                    # IndexedDB storage for large image data
│   ├── card-recipes.ts                   # Recipe system: subjects, moods, styles, prompt builder
│   ├── ai/prompts.ts                     # System prompts (legacy chat, retained for future use)
│   └── usage.ts                          # Usage tracking utilities
└── types/
    └── database.ts                       # TypeScript interfaces (UserProfile, Recipient, Card, etc.)
```

---

## Key Design Decisions & How We Got Here

### Structured Wizards — Replacing Conversational Interviews

**Problem:** The original onboarding and recipient flows used a conversational AI interview (via `ConversationFlow` component and `/api/chat`). While warm and personal-feeling, it had critical issues:
- **Fragile save logic** — The AI had to output `[CONTEXT_COMPLETE]` with valid JSON. Any malformed JSON silently broke the save, leaving users stranded after confirming their summary with no way forward.
- **Slow** — 7-8 back-and-forth messages, each requiring an API call. 3-5 minutes for data that could be captured in 60 seconds.
- **Cognitive burden** — Open-ended questions like "How would you describe your personality?" left users struggling for words. No vocabulary guidance.
- **UX friction** — No auto-focus on input, awkward left/right justified chat layout, question wording that felt too intimate ("What matters most to you in your close relationships?").

**Solution — 4-step structured wizards:**

Both onboarding and recipient creation now use step-by-step wizards with curated tappable selection lists, matching the visual pattern of the card creation flow.

**Onboarding (4 steps, ~60 seconds):**
| Step | Content |
|---|---|
| 1. Basics | Name, birthday (date picker) |
| 2. About you | 25 personality trait chips (tap to select) + add custom, categorized interest chips (Sports, Arts, Food, Entertainment, Nature, Tech) + add custom |
| 3. Your style | Communication style selector (5 options like "Big and sentimental", "Short and sweet"), humor style text input, lifestyle chips (Single/Partnered/Married/etc.), conditional partner name |
| 4. Review | Summary cards — tap any section to jump back and edit, then "Save & continue" |

**Recipient creation (4 steps, ~90 seconds):**
| Step | Content |
|---|---|
| 1. Who | Name, relationship type (15 options as chips + "Other" with custom input) |
| 2. Personality & interests | Same 25 personality chips + custom, same categorized interest lists + custom |
| 3. Card preferences | Humor tolerance (5-level scale from "Keep it sincere" to "Go wild"), preferred tone (pick 1-2 from the 8 tones), personal dates (select type + date picker), milestones & important dates (free text) |
| 4. Review | Summary cards — tap to edit, then "Save [name]" |

**What this gets us:**
- No AI dependency for profile creation — no JSON parsing, no broken flows
- 3-4x faster than the conversation
- Curated lists solve "I don't know what words to use"
- Every field maps directly to the data model — no extraction errors
- "Add your own" on every list preserves personalization
- The conversational chat components (`ConversationFlow`, `/api/chat`, `ai/prompts.ts`) are retained in the codebase for potential future use (e.g., a "Tell Nuuge more" feature or AI-guided card curation).

### Message Generation — Relationship-Aware with Diversity

**Problem:** The initial message generation over-indexed on one keyword from the recipient's profile (e.g., "dance") and repeated it across all three options. Worse, for family relationships like niece, the tone could sound inappropriately romantic.

**Solution (generate-card API):**
- **Relationship guardrails** — The system detects the relationship type (niece, parent, friend, partner, etc.) and adds explicit tone constraints. For younger family members: "Use warm, familial language — proud of you, watching you grow. NEVER use romantic or intimate language." Partners get no such restriction.
- **Diversity within each batch** — Each of the 3 options must draw from *different* profile details. "If option 1 mentions dancing, options 2 and 3 should NOT mention dancing."
- **Profile element toggles** — Before generating or regenerating messages, users see all profile details (interests, personality, humor, occupation, etc.) as toggleable pills. Deactivating "skateboarding" means the AI won't mention it. This gives users direct control over what the AI draws from.
- **Regeneration shifts emphasis aggressively** — Each time the user hits "Regenerate all," a counter increments and the system progressively de-emphasizes the profile:
  - 1st regen: pick different interests/traits than the rejected batch
  - 2nd regen: auto-deactivate ~50% of remaining active profile elements, focus on occasion and tone
  - 3rd regen: auto-deactivate ~80%, write something mostly generic and occasion-focused
  - 4th+ regen: ignore most profile details, simple honest human messages
- **Rejected messages are tracked** — Previous batches are passed back so the AI knows exactly what to avoid.

### Design Suggestions — Three Lanes, Not Three Versions of One Keyword

**Problem:** All three card design concepts would revolve around the same profile keyword (e.g., three different dance scenes).

**Solution (suggest-designs API):**
- **Concept 1 — Personal detail:** One specific interest from the profile, but rotated — if past cards already used "dance," pick something else.
- **Concept 2 — Relationship & occasion:** Focus on the sender-recipient dynamic or the occasion itself. The sender's personality influences this one.
- **Concept 3 — Mood & atmosphere:** A broader evocative scene that doesn't lean on keywords at all. The sender's style drives the vibe.
- **Past design themes** are passed in so the system avoids repeating itself across cards.

### Recipe-Based Image Builder — Multi-Layered Prompt Composition

**Problem:** The original image builder asked users to separately select subject, style, and mood, but then assembled these into a flat, formulaic prompt. Results were repetitive — every "funny birthday" card looked similar. Mood was effectively selected twice (once as message tone, again in the image builder). The AI had no domain-specific guidance on lighting, palette, composition, or what motifs work for which emotional register.

**Solution — the Recipe System (`src/lib/card-recipes.ts`):**

The image prompt is no longer a simple concatenation. It's composed from five structured layers, each contributing specific dimensions:

| Layer | Controls | Source |
|---|---|---|
| **Subject recipe** | What to draw — motifs, scene sketches, composition hints | 8 categories: Flowers, Animals, Nature, People/Relationships, Characters/Cute Illustrations, Holiday/Seasonal, Objects/Symbols, Abstract/Patterns |
| **Mood recipe** | How it feels — lighting, palette, texture, atmosphere | Derived from the message tone (8 tones). No separate mood step. |
| **Style recipe** | How it's rendered — technique, line quality, rendering notes | 6 styles: Watercolor, Cute/Whimsical, Minimalist, Vintage, Painterly, Abstract |
| **Profile context** | Personal flavor — recipient interests filtered by mood compatibility | Interests mapped to subject keywords, filtered by mood (e.g., "skateboarding" blocked for sympathy) |
| **Global guardrails** | Always enforced — no text, print-ready, no stock look, no clutter | Applied to every prompt and the generate-image API |

**How it works:**

1. **Mood is derived from tone** — The user picks a message tone (e.g., "Funny and playful") and that tone maps to a mood recipe with specific lighting arrays ("bright and cheerful"), palette pools ("candy colors", "pastel brights"), and atmosphere snippets. No duplicate mood selection.

2. **Scene sketches provide variety** — Each Subject × Mood combination has 3-4 pre-written scene descriptions (e.g., Animals + Funny → "A goofy dog wearing an oversized party hat, tongue out"). The prompt builder picks one at random, so regenerating the same selections produces a different scene.

3. **Recommended subjects** — Each mood recipe declares which subjects pair best. The UI shows these with a star indicator, guiding users toward natural pairings without restricting choice.

4. **Profile interests inject motifs** — If a recipient's profile includes "golden retriever" and the user picks "Animals," the prompt builder naturally works that in. But interests incompatible with the mood are filtered out (no "extreme sports" in a sympathy card).

5. **Randomness everywhere** — `pickRandom()` selects from pools of lighting options, palette colors, composition hints, and scene sketches. Same inputs, different prompt every time.

**The 3-step flow:**

1. **Step 1 — Subject:** 8 categories with emoji icons. Recommended subjects for the current tone are highlighted with stars. After selecting a subject, the UI shows 3-4 tappable scene sketch previews specific to that Subject × Tone combination. Users can tap to use one or type their own.

2. **Step 2 — Art Style:** 6 visual styles with descriptions. Unchanged.

3. **Step 3 — Personal Context:** Pre-filled from recipient's profile. Now includes a "Recipe preview" showing the AI's planned lighting and palette, so users understand what the prompt will produce. Card size selector here too.

The prompt builder (`buildRecipePrompt`) merges all layers: guardrails → scene description → subject composition → mood lighting/palette/atmosphere → style technique/texture → profile motifs → occasion → avoid list. Users review and can edit the full prompt before generation.

### Image Generation — Edit, Don't Recreate

**Problem:** DALL-E 3 can only generate brand new images from text. Every refinement ("change the sky from sunset to blue") threw away the entire image and drew something completely different. Users would lose scenes they liked.

**Solution:**
- **Switched from DALL-E 3 to gpt-image-1** (DALL-E 3 is being deprecated May 2026 anyway).
- **First generation** uses `images.generate` — new image from scratch.
- **Refinements** use `images.edit` — the existing image is sent to the API along with the change description. The model sees the actual image and modifies it, keeping composition and style intact. `input_fidelity: "high"` preserves as much of the original as possible.
- **"Revert to previous image"** button lets users undo a bad edit.

### Refinement Flow — The App Builds the Description for You

**Problem:** Image models need a complete scene description every time. Users shouldn't have to repeat "backyard garden party with string lights" and then add their change. That's a burden for general users.

**Solution (merge-scene API + confirmation step):**
1. User types just their change: "remove the people"
2. App calls `/api/merge-scene` which uses GPT to merge the change into the running scene description
3. App shows the merged result: "Backyard garden party with string lights, empty of people, warm evening atmosphere"
4. User can edit the merged text, then confirms
5. Only then does the image generate (as an edit of the existing image)

The running scene description is tracked in state (`currentSceneDescription`) and updates with each confirmed refinement, so context accumulates automatically.

### Print Layout — Proper Card Sizing

**Problem:** The print page was sized for 8.5x11 regardless of card size selection, producing overflow and extra pages.

**Solution (complete print page rewrite):**
- **Always uses `@page { size: landscape; }`** (standard letter paper) with dynamically calculated margins to center different card sizes (4x6, 5x7, or 8.5x11 full bleed). This ensures reliable duplex printing compatibility.
- **Paper stock selector** — "Card stock (exact size)" vs "Letter (8.5x11)" with centered margins when printing on letter paper.
- **No overflow** — each sheet is `width: 100%; height: 100vh` in print mode with `break-inside: avoid` and `break-after: page`.
- **Inside illustration** — six position options (top/middle/bottom banners, left/right edge strips, full watermark behind text). Watermark is edge-to-edge at 12% opacity. Message text gets `position: relative; z-index: 1` to layer above watermark.
- **Adaptive message sizing** — `messageSizing()` helper adjusts font size, line height, and spacing based on total message length so text naturally fills the card interior.
- **Front text styles** — three options: plain black, black on white box, white on dark box. Position is selectable (bottom-left, bottom-right, center). All editable from the print preview page via a toggleable settings panel.
- **Duplex printing** — print instructions guide users to select "Flip on short edge" for correct two-sided printing.

### Font Selection

Three font options available for both front text and inside message:
- **Clean (sans)** — Inter / Helvetica Neue / Arial
- **Elegant (script)** — Georgia / Palatino, italic
- **Bold (block)** — Impact / Arial Black, uppercase with letter-spacing

Font is chosen during the "Front text" step and applies to both the front overlay and the inside message.

### Storage — localStorage + IndexedDB

**Problem:** Switching to gpt-image-1 meant images are returned as base64 data (2-5 MB each) instead of temporary URLs. Saving a single card to localStorage would exceed the browser's ~5 MB quota.

**Solution:**
- **IndexedDB for images** (`src/lib/image-store.ts`) — a simple key-value store with no size limit concerns.
- **`saveCard`** detects large data URLs (>50 KB), moves them to IndexedDB, and stores a reference like `idb:card_abc_image_url` in localStorage.
- **`hydrateCardImages`** loads images back from IndexedDB when a page needs to display them (print, view, edit pages call this on load).
- **Card history thumbnails** on the recipient page gracefully skip `idb:` references.

---

## API Endpoints

| Endpoint | Model | Purpose |
|---|---|---|
| `/api/chat` | GPT-4o | Conversational AI (legacy, retained for potential future use) |
| `/api/generate-card` | GPT-4o | Generate 3 message options with relationship guardrails |
| `/api/suggest-designs` | GPT-4o | Suggest 3 diverse card front design concepts |
| `/api/suggest-inside-designs` | GPT-4o | Suggest 3 inside illustration concepts |
| `/api/suggest-front-text` | GPT-4o | Suggest front cover text wording + position |
| `/api/generate-image` | gpt-image-1 | Generate new images or edit existing ones |
| `/api/merge-scene` | GPT-4o-mini | Merge a user's refinement into the running scene description |
| `/api/health` | — | Check if OPENAI_API_KEY is configured |

---

## Data Model (Key Types)

**UserProfile** — sender's name, personality, humor style, interests, lifestyle, partner name, communication style.

**Recipient** — name, relationship type, personality, interests, humor tolerance, tone preference, links to other recipients (e.g., spouse), important dates.

**Card** — occasion, message text, image URL/prompt, inside image URL/prompt/position, front text/position/font, inside message font, card size (4x6 or 5x7), delivery method, tone, style label, co-signer.

---

### E-Card Viewer — Animated Envelope with Card Flip

The digital card view (`/cards/view/[cardId]`) presents cards as an interactive experience:
- **Envelope** with a dynamic label showing occasion and tone (e.g., "Birthday · Joyful and celebratory"), plus "for [recipient name]."
- **Seal** rendered as an SVG with "NUUGE" in an arc above a centered "N" — mimics a wax seal.
- **Card format** — 5:7 portrait ratio (not square). Tap to flip between front and inside, replicating the experience of opening a physical card.
- **Inside layout** matches the print version — same illustration positions, watermark opacity, font selections.

### Inside Illustrations — Derived from Front Cover

**Problem:** AI-generated inside illustrations often didn't fit the chosen position's aspect ratio (e.g., suggesting "enchanted pathway" for a 1-inch-tall bottom banner) and didn't thematically match the front cover.

**Solution:**
- Inside suggestions are now crops/extractions from the front cover image, not independent scenes.
- The `suggest-inside-designs` API receives the position and orientation, instructing the AI to suggest elements that fit narrow strips or wide banners.
- `generate-image` uses `images.edit` with the front cover image as the source for initial inside generation, ensuring visual continuity.
- Visual previews in the picker show a mini card mockup (90×126px, 5:7 ratio) with the suggestion placed in the selected position alongside placeholder text lines.

### Profile Editing — Robust Cancel/Save

**Problem:** Commas couldn't be typed in tag-style input fields (Interests, Values), and canceling an edit didn't revert changes.

**Solution:**
- `ProfileEditor` uses a local `editBuf` state for raw text input during editing, with conversion to arrays only on save (via `toTags()` helper).
- `handleCancel()` resets all state from the original recipient/profile data using dedicated initialization functions.

---

## What's Not Built Yet

- **Supabase backend** — currently everything is client-side (localStorage + IndexedDB). The schema and types are ready for migration.
- **Authentication** — no login yet.
- **Mail delivery** — the "Mail it" option is in the UI but doesn't connect to a print/mail service.
- **More fonts** — only 3 starter fonts. The architecture supports adding more.
- **Font size and color pickers** — planned, not yet implemented.
- **Recipe expansion** — the recipe library can grow with more scene sketches, style variants, and mood-specific motif pools as the card catalog matures.
