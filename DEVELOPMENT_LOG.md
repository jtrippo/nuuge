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

### Design System Implementation

**Goal:** Establish a warm, friendly, personal, premium look and feel across the entire app.

**What was done:**
- **Typography:** Lora (headings) + Nunito (body) loaded via `next/font/google`. Additional card fonts added: Caveat (handwritten), Playfair Display (classic), Oswald (bold), Dancing Script (brush), plus Courier New (typewriter) — 7 total options, up from 3.
- **Color palette:** All colors defined as CSS custom properties in `globals.css` — warm cream background, warm charcoal text, forest green brand, amber actions, sage green accents, plus warning/error colors. Tailwind theme extended to use these variables.
- **Component classes:** Reusable `.btn-primary`, `.btn-brand`, `.btn-secondary`, `.btn-link`, `.card-surface`, `.tag`, `.input-field`, `.section-label` classes so the design is consistent and changeable from one place.
- **Homepage redesign:** Landing page restructured with a two-column hero (copy + SVG card illustration + testimonial bubble), "How it works" section, storytelling section with illustration, and bottom CTA. Sections use alternating background colors (white → cream → white → sage → cream) instead of line dividers.
- **Dashboard reorganization:** Profile/account menu moved to top-right avatar dropdown (My profile, Backup data, Seed data, Reset data). Smart contextual CTA adapts to user state (no people → "Add your first person", has people → "Create a card" + "+ Add someone"). Utility links removed from main nav.
- **Separate front/inside fonts:** Card creation wizard now offers independent font selection for the front cover and inside message.

---

## Future Considerations

### Prompt Visibility vs. Free Tier — IP Protection

**Concern:** The card creation flow shows the AI image prompt to users so they can review and edit it. In a "free to try" model, someone could copy these prompts and use them directly in DALL-E or Midjourney, bypassing the app after learning what works.

**Assessment:** The risk is real but limited. What a user copies is the *output* of the system — a single assembled prompt — not the recipe architecture behind it (mood recipes, subject recipes, style recipes, profile context weaving, progressive de-emphasis logic). That's the real IP. A raw prompt without the intelligence that built it is a one-time thing, not a repeatable capability.

**What can't be replicated outside Nuuge:**
- The iterative refinement flow (edit instruction → merge scene → regenerate)
- Profile-aware message generation with relationship guardrails
- Coordinated inside/outside card design
- Print layout, e-card delivery, card history
- The convenience of everything working together in one flow

**Potential mitigations (for when pricing is defined):**
- Show a human-readable summary instead of the full raw prompt (e.g., "Watercolor bouquet, warm and sentimental, birthday theme") — enough for trust and guidance, not a copy-paste DALL-E prompt
- Use CSS `user-select: none` or partial obscuring for the prompt display
- Gate prompt visibility behind a paid tier — free users see "generating your design..." while subscribers get the editable prompt
- Rate-limit free usage (e.g., 2 cards free, then subscribe) to minimize prompt exposure

**Bottom line:** The "free to try" model is good for user acquisition. Prompt visibility is good for user experience and trust. The tension is real but solvable with a tiered approach. The bigger risk today is *not* having users than losing a few prompts.

---

### Personal Letter Insert

**Concept:** An optional extra step in the card creation flow that lets the user include a personal letter — a text-only, formatted page tucked inside the card like a handwritten note.

**Design considerations:**
- Purely text with font selection (reuse the 7 card fonts — Caveat/handwritten feels especially right here).
- Light template structure: greeting, body, sign-off — similar to the message but with room for longer, more personal writing.
- AI can optionally help draft it using profile context, or the user writes it themselves.
- For print: a separate sheet at card size, inserted loose inside the fold — an additional print page.
- For e-cards: appears as a separate "unfold" after the inside of the card, like finding a tucked-in letter.
- Triggered by an optional prompt near the end of the flow: "Want to include a personal letter?"

**Phase:** Next phase after design system rollout. Self-contained — new step in creation flow, new field on Card type, new print page.

---

### Usage Analytics & Cost Tracking

**Concept:** Track API usage and estimated costs per call, per card, and per account to inform pricing decisions and understand cost structure.

**What to capture per API call:**
- Endpoint (generate-image, generate-card, merge-scene, suggest-designs, etc.)
- Model used (GPT-4o, GPT-4o-mini, gpt-image-1)
- Token count (input/output for text, image size for images)
- Estimated cost (based on published API pricing)
- Timestamp, associated card ID, recipient ID

**What to surface:**
- Per card: total cost breakdown (generations, refinements, message regens)
- Per account: running total, average cost per card, most expensive card
- Session awareness: subtle "This card: ~$0.35 so far" in the creation flow

**Architecture:** Existing `usage.ts` skeleton needs to move to IndexedDB (locally) or a proper API (when backend exists). Start by logging data on every API call; build the visualization dashboard later.

**Phase:** Begin logging immediately (capture data from day one). Dashboard/visualization comes later.

---

### E-card Envelope Redesign & Animation

**Concept:** Transform the e-card viewing experience from a simple card display into an addressed-letter experience with animation.

**Envelope front (what the recipient sees first):**
- Center: recipient's name (and address if available)
- Upper-left: sender's name / return address
- Upper-right: decorative stamp (Nuuge seal or occasion-themed)

**Animation sequence:**
1. Envelope front (addressed) — recipient sees their name, feels anticipation
2. Tap → flip to back (Nuuge seal) — brief 1-2 second pause (branding moment)
3. Tap or auto-advance → envelope opens, card slides out showing front cover
4. Tap → flip to inside with message and any inside illustration
5. (If letter insert exists) Tap → letter unfolds

**Profile fields needed (foundational — also required for mail delivery):**
- First name / Last name (currently just `display_name`)
- Mailing address (street, city, state, zip)
- Email address

**Phase:** Profile fields should be added soon (foundational for multiple features). Envelope redesign and animation after design system rollout. Animation is pure CSS/JS, no API work.

---

## Proposed Build Order

| Priority | Feature | Rationale |
|---|---|---|
| Now | Usage logging (capture data) | Zero-cost to add, invaluable data from day one |
| Next | Design system rollout to remaining pages | Consistent experience before adding new features |
| Then | Profile fields (first/last name, address, email) | Foundation for mail delivery, e-card envelope, and future features |
| Then | Letter insert | Differentiating feature, self-contained build |
| Then | E-card envelope + animation | Polish feature, uses new profile fields |
| Later | Analytics dashboard | Visualize the usage data collected since day one |

---

## AI Product Architecture — Layer Assessment

A framework for understanding what Nuuge has built and where it sits as an AI-powered product. These layers describe the system's architecture in terms of how AI, personalization, and tooling work together.

### Fully Implemented Layers

| Layer | What It Does | How Nuuge Implements It |
|-------|-------------|------------------------|
| **Experience** | The user-facing workflow | Greeting card creation wizard — occasion → tone → message → design → refine → deliver. Print preview, e-card viewer, edit flow. |
| **Context** | Inputs that shape AI output | Tone, humor style, relationship type, occasion, personality traits, interests, communication style — all captured via structured wizards and passed into every generation prompt. |
| **Model** | AI generation capabilities | GPT-4o for text (messages, suggestions, front text, scene merging). gpt-image-1 for illustrations (generate + edit). GPT-4o-mini for lightweight tasks (merge-scene). |
| **Guardrails** | Keeping outputs safe and on-brand | Relationship-aware tone constraints (e.g. no romantic language for family). Deterministic personalization via profile element toggles. Content safety (no explicit material, no copyrighted characters). Print-safe style stripping. |
| **Memory (relationship)** | Persistent knowledge about people | Recipient profiles with personality, interests, humor tolerance, tone preferences, important dates, milestones, linked relationships. Sender profile with communication style and personality. This is the "relationship memory layer" — the app knows who people are across cards. |
| **Tool (development)** | How the product is built and evolved | Cursor IDE with AI-assisted reading/writing/running code. Prompt files, development log, roadmap as living artifacts. |
| **Artifacts** | Documented knowledge that persists across sessions | `ROADMAP.md`, `DEVELOPMENT_LOG.md`, `MVP_STATUS.md`, prompt templates in API routes, recipe system in `card-recipes.ts`. |

### Partially Implemented Layers

| Layer | Current State | What's Missing |
|-------|--------------|----------------|
| **Retrieval** | Past design themes are passed to `suggest-designs` to avoid repetition. Rejected messages are tracked within a session. Previous front text wordings are excluded on regeneration. | No cross-session retrieval of successful cards. No "what worked before" lookup. No vector search or embedding-based similarity. |
| **Orchestration** | Workflow logic exists in the creation wizard (step sequencing, draft auto-save, resume, progressive de-emphasis on regeneration). | Not formalized as a reusable orchestration layer. Logic is embedded in page components rather than abstracted. No event-driven triggers. |
| **Persistent memory** | Profiles and card history stored locally (localStorage + IndexedDB). Cards retain all generation metadata (tone, style, prompts, profile elements used). | Memory is per-browser, not server-side. No structured "what resonated" feedback. No cross-card learning ("last 3 anniversary cards for Alyssa used watercolor — try something different?"). |

---

## What's Not Built Yet

- **Supabase backend** — currently everything is client-side (localStorage + IndexedDB). The schema and types are ready for migration.
- **Authentication** — no login yet.
- **Mail delivery** — the "Mail it" option is in the UI but doesn't connect to a print/mail service.
- **Font size and color pickers** — planned, not yet implemented.
- **Recipe expansion** — the recipe library can grow with more scene sketches, style variants, and mood-specific motif pools as the card catalog matures.
- **Drag-and-drop text positioning** — interactive editing of text placement on the card front.
- **Proactive card suggestions** — Nuuge nudges about upcoming dates and curates card ideas.
