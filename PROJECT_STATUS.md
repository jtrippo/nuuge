# Nuuge — Project Status

> **Purpose:** Context file for AI assistants. Read this when starting a fresh conversation to understand current state.
> **Last updated:** Mar 18, 2026

---

## TL;DR

Nuuge is a greeting-card app (Next.js, Vercel). Users create personalized AI-generated cards, send as e-cards, or print at home. Data lives in localStorage + IndexedDB (no accounts yet). The app is deployed at https://nuuge.vercel.app.

**Most recent work (Mar 2026):** Letter Insert PDF Overhaul — fixed font rendering (html2canvas inheritance issue), auto-fit text sizing (measures content, calculates optimal scale), character limit with countdown, mode-aware guidelines (card stock = clean PDF, letter paper = crop marks), "Save to Print" button. Also: Relationship Closeness & Context Enhancement, Impressionist art style, custom co-signer fix, edit page manual save. Earlier: PDF print system, profile editor overhaul, baked-in text, "Use Again" flow, message refinement, clean letter viewing, interests-driven image design, age-appropriate messaging/imagery, and home page redesign.

---

## Key File Paths

| Path | Purpose |
|------|---------|
| `src/app/cards/create/[recipientId]/page.tsx` | Card creation wizard (Circle/Beyond path) — the big one |
| `src/app/cards/create/share/page.tsx` | Card creation wizard (Moments/Share path) |
| `src/app/cards/create/quick/page.tsx` | Quick card creation (Beyond my circle) |
| `src/app/cards/edit/[cardId]/page.tsx` | Edit existing cards. Sticky preview, header buttons. |
| `src/app/cards/print/[cardId]/page.tsx` | Print preview with PDF generation (two modes), paper size controls |
| `src/app/cards/view/[cardId]/page.tsx` | Digital card viewer (envelope animation) |
| `src/app/share/[shareId]/SharedCardViewer.tsx` | Shared link viewer |
| `src/app/page.tsx` | Home page — 3-column layout (Circle, Moments, Quick Card) |
| `src/app/backup/page.tsx` | Backup/restore (includes drafts) |
| `src/lib/card-recipes.ts` | Recipe system: subjects, moods, styles, scene sketches (age-tagged), prompt builder |
| `src/lib/card-ui-helpers.ts` | Shared CSS helpers, accent/frame opacity defaults, font sizing |
| `src/lib/store.ts` | localStorage CRUD, backup/restore with drafts |
| `src/lib/image-store.ts` | IndexedDB storage for large image data |
| `src/lib/occasions.ts` | Occasion categories, age band inference, couple inference |
| `src/lib/usage-store.ts` | API cost tracking (IndexedDB) |
| `src/lib/signer-helpers.ts` | Co-signer management: `getSenderNames`, `getSignerNameList`, custom signer support |
| `src/lib/share-card.ts` | Serializes card data for shared links — **must include all visual fields** |
| `src/types/database.ts` | TypeScript interfaces (UserProfile, Recipient, Card, etc.) |
| `src/app/api/generate-card/route.ts` | Message generation with relationship/age guardrails |
| `src/app/api/suggest-designs/route.ts` | Card front design concepts (3 lanes, interest-aware) |
| `src/app/api/suggest-inside-designs/route.ts` | Inside illustration concepts (frame-aware) |
| `src/app/api/suggest-scene-sketches/route.ts` | Dynamic age-calibrated scene ideas (GPT-4o-mini) |
| `src/app/api/suggest-front-text/route.ts` | Front cover text suggestions |
| `src/app/api/generate-image/route.ts` | Image generation/editing (gpt-image-1, frame rules) |
| `src/app/api/merge-scene/route.ts` | Merge refinements with recipient age context |
| `SCENE_SKETCHES_REFERENCE.md` | Human-readable tagged list of all static scene sketches |
| `LAUNCH_ARCHITECTURE.md` | Long-term launch plan |
| `DEVELOPMENT_LOG.md` | Architecture and design decisions log |

---

## Recent Improvements (Feb–Mar 2026)

### 1. Home Page Redesign
- Redesigned top section to a **3-column grid**: "Cards that sound like you" (Circle), "Share a Moment" (Moments), "Quick Card" (Beyond my circle)
- Updated labels and action button text for clarity
- Quick Card option now prominently featured instead of buried below

### 2. Bring Your Own Message (BYOM) Flow
- New "message_mode" entry point after occasion/tone selection
- Users can write their own message; Nuuge suggests 2-3 polished alternatives (original + refined + reimagined)
- Available in both Circle/Beyond and Moments/Share creation paths
- Notes step adapts: BYOM path only shows the Envelope section

### 3. Age-Appropriate Messaging
- **Context Checkpoint System:** Always-visible "What Nuuge knows" section on the notes page
  - Shows inferred/known relationship, occasion, age band, couple status
  - Editable age band selector when exact birthday unknown
  - Occasion-specific fields (anniversary years, graduation level)
  - Saves confirmed data back to recipient profile
- **`age_band` field** on Recipient: Stores estimated age range without creating false birthdays
- **Per-age-band tone guidance** in message generation API:
  - Child: Simple, playful
  - Teen: Casual, relatable, no condescension
  - Young adult: Energetic, forward-looking
  - Adult: Peer-to-peer, no "watching you grow" language
  - Senior: Warm, respectful, no patronizing
- **API guardrails**: Explicit instructions not to guess/invent missing details

### 4. Age-Appropriate Image Design
- `buildUserFacingPrompt()` includes age guidance for DALL-E (e.g., cartoon for kids, sophisticated for adults)
- `suggest-designs` API includes age-calibrated imagery instructions
- `merge-scene` API carries recipient age/relationship context for refinements
- Age band flows through the entire image pipeline

### 5. Dynamic Scene Ideas
- New `/api/suggest-scene-sketches` route (GPT-4o-mini) generates age-calibrated scene ideas per subject
- Three-state tracking: idle → pending → ready (with failed fallback)
- Falls back to age-filtered static sketches if API fails
- Static scene sketches (~263) converted to `SceneSketch` objects with `for: "all" | "young" | "mature"` tags
- `SCENE_SKETCHES_REFERENCE.md` provides editable reference of all static sketches

### 6. Interests-Driven Image Design
- Interest selection pills shown at top of design step (before subject selection)
- "Generate scene ideas" / "Refresh with new interests" button for explicit user control
- Interests passed to `suggest-scene-sketches` and `suggest-designs` APIs
- Scene line in image prompt naturally weaves in selected interests
- Removed redundant `profileHint` that caused literal interpretation clutter
- "Suggest new ideas" button for regenerating Nuuge design suggestions

### 7. Decorative Frame Fixes
- **Frame orientation**: Returns `"frame"` (not `"vertical"`) so DALL-E generates correct aspect ratio
- **Edge-to-edge generation**: Strengthened prompts in `suggest-inside-designs` and `generate-image` requiring border decoration to touch all four edges with zero margin
- **Pure white background**: Explicit #FFFFFF instructions, not cream/off-white
- **Create path fix**: Passes `isAccent: true` when generating from suggested concepts, preventing DALL-E from editing the front cover instead of creating from scratch
- **Default opacity**: `DEFAULT_FRAME_OPACITY` raised from 0.25 to 0.45
- **Intensity slider**: Added to both create and edit flows for real-time accent opacity control
- **`accent_opacity`** saved in card data

### 8. Cost Tracking Persistence
- `sessionCost` now persists across draft save/resume via `accumulatedCost` in `CardDraft`
- Cost display shows accumulated total, not just current session
- Edit mode also tracks API costs via `logApiCall`

### 9. Household Links
- Schema: `RecipientLink` interface, `linkRecipients`/`unlinkRecipients` helpers
- `household_links` array on `UserProfile` for co-signers
- UI: Linked recipients appear as checkboxes in "Going to" and "Signed from" sections
- Cards sent to linked recipients appear in all relevant recipient profiles

### 10. Sender Name & Co-signer Fixes
- Envelope "Signed from" override now flows to AI message closing
- `recipientAddressedTo` parameter ensures AI addresses all recipients (e.g., "Alex & Novarah")
- Strengthened `SIGNED BY` / `SOLO SIGNER` directives prevent name confusion
- `rejectedMessages` cleared on back navigation and draft restore to prevent contamination

### 11. Front Text UX
- "Suggest new options" uses inline blur + spinner instead of full-page blank
- `frontTextRefreshing` state keeps page visible during refresh

### 12. Edit Page Layout
- Sticky preview panel with scrollable edit section below
- All action buttons (Save as new, View E-card, Print Preview) in header — right-justified
- Print Preview page buttons also right-justified with gap from back button

### 13. Drafts in Backup/Restore
- `localStorage` draft keys (`nuuge_card_draft_*`) included in backup export/import
- Draft count shown in export/import status messages

### 14. Standardized Pill Sizing
- Occasion and tone selection pills use `min-w-[120px] text-center` across all create flows

### 15. Cut Paper Folk Art Style
- New art style option with Charley Harper-inspired prompt guidance
- Style reference image approach documented for future use

### 16. Baked-in Front Text
- New option to embed front greeting text directly into the AI-generated image artwork (via DALL-E)
- Two-line approach: creative greeting line + occasion tagline (e.g., "Naps are cosmic" + "Happy Birthday")
- User chooses between baked-in text, overlay text, or no front text
- Available in all create paths (Circle, Share, Quick Card)
- Baked-in cards lock occasion for "Use Again" (overlay/none cards allow occasion changes)

### 17. Message Refinement Step
- After message selection, users can edit the chosen message and request Nuuge to polish their edits
- Presents 3 options: user's original edit + 2 Nuuge refinements (via existing `/api/generate-card` polish endpoint)
- Available in both Circle/Beyond and Moments/Share creation paths

### 18. "Use Again" Flow
- Redesigned reuse: navigates to create flow, pre-loads original card's image/design, regenerates messages for new recipient/occasion
- Available from recipient profile card history and print preview page
- "Save as new" removed from edit page to avoid confusion
- Button renames: "View" → "E-card", "Reprint" → "Preview", "Reuse for someone else" → "Use Again"

### 19. Clean Letter Viewing Experience
- Inside message stage shows only the "tap to read" hint when a letter exists
- All navigation buttons consolidated on final letter stage
- "View again" button added to letter stage for both sender and shared views

### 20. Move Beyond Cards to Circle
- Auto-moves quick cards to circle profile when user adds the quick recipient to their circle
- Manual "Move to profile" button on individual beyond cards for existing circle recipients

### 21. Profile Editor Overhaul
- **Fields trimmed from recipient UI:** `birthday`, `location`, `favorite_foods`, `favorite_music`, `favorite_movies_tv`, `favorite_books`, `humor_style`, `communication_style`, `emotional_energy`
- **Fields relabeled:** `dislikes` → "Things to avoid in cards"
- **Placeholders/hints added** to all remaining fields for user guidance
- **Birthday migration:** On first load, any `birthday` value auto-migrates to an Important dates entry (label: "Birthday", recurring: true), then the field is cleared. Age calculation still works via `getBirthdayForAge()`.
- **Milestones removed:** Editing and view UI removed from recipient detail page
- **Mailing address pipe fix:** Pipe-separated addresses display as comma-separated when editing
- **"+ Add date" pill button:** Styled as a rounded pill on both onboarding and recipient detail page
- **Sender-only fields preserved:** `humor_style`, `communication_style`, `emotional_energy` remain on the user profile (used for sender AI context), hidden from recipient profiles via `excludeFields`
- **AI element picker changes** (see next section)

### 22. AI Context Changes (Profile Editor)

Changes to what the AI receives when generating messages. Monitor for quality regressions.

| Change | Element Picker Key | Default State | Risk |
|--------|-------------------|---------------|------|
| **Removed:** `favorite_foods` | `favorite foods: X` | — | Low — rarely influenced message quality |
| **Removed:** `favorite_music` | `favorite music: X` | — | Low — same reason |
| **Removed:** `humor_style` from recipient | `humor style: X` | — | Low — `humor_tolerance` is the correct recipient field |
| **Added:** `children` | `children: X` | Off (user selects) | Medium — could add warmth, watch for over-inclusion |
| **Added:** `dislikes` → "things to avoid" | `things to avoid: X` | **Always on** | Medium — should improve quality by preventing awkward topics |
| **Added:** `notes` → "additional context" | `additional context: X` | Off (user selects) | Medium — depends on freeform content |

`things to avoid` is classified as "tone-like" (not "interest-like") so it persists through regeneration trimming — it won't be removed even after multiple regenerations.

### 23. Recipient Onboarding Updates
- **Values wheel** added to Step 2 with `TraitPickerWheel` (same style as personality traits)
- **Milestones textarea** removed from Step 3
- **"Personal dates"** relabeled to **"Important dates"**
- **"+ Add date"** styled as a pill button
- **Review step** updated to reflect values and label changes

### 24. PDF Print System
Replaced unreliable browser `window.print()` as the primary print path with client-side PDF generation using `jsPDF` + `html2canvas`.

**Two PDF modes:**
| Mode | Button | Output | Target |
|------|--------|--------|--------|
| **Letter paper** | `PDF · Letter paper` | Card centered on 8.5×11 with crop marks + fold line indicator | Most users — any printer, standard paper, trim to size |
| **Card stock** | `PDF · Card stock` (primary) | Exact card dimensions (e.g., 10×7 for 5×7 folded) | Power users — pre-scored card stock, borderless printer |

**Split PDFs:** When a letter insert exists, card (pages 1–2) and letter (page 3) download as **separate PDFs** so the user can swap from card stock to plain paper between prints. Letter PDF format adapts to paper mode: card stock → exact letter dimensions (no guidelines); letter paper → centered on 8.5×11 with crop marks.

**Smart filenames:** `Nuuge_YYYY.MM.DD_Last_First_Occasion_Card.pdf`
- Date-first for chronological sorting
- Last_First name for secondary grouping
- Circle: `Nuuge_2026.03.18_Tripp_Linda_Thank_You_Card.pdf`
- Beyond/Quick: `Nuuge_2026.03.18_Dr_Denning_Thank_You_Card.pdf`
- Moments: `Nuuge_2026.03.18_Moment_Birthday_Card.pdf`
- Letter suffix: `..._Letter.pdf` (downloads separately)

**Technical details:**
- Libraries loaded via dynamic `import()` to avoid SSR crashes
- Each card sheet is **cloned at print resolution** (200 DPI) before capture, so the browser reflows text and images at correct proportions (not just scaled-up screenshots)
- `object-fit: cover` images converted to `background-image` divs in the clone (html2canvas compatibility)
- SVGs, fixed-size text, and padding scaled proportionally for print resolution
- Letter-paper mode draws crop marks at corners + dashed fold line indicator via jsPDF drawing API
- Browser `window.print()` retained as tertiary fallback ("Browser print" button)

**Print instructions** updated in the "How to print" info panel with separate guidance for letter paper and card stock workflows.

### 25. Nuuge Wax Seal
- `NuugeWaxSeal` component (`src/components/NuugeWaxSeal.tsx`): Reusable SVG wax seal with embossed 'N' in brand green
- Applied to: card back (print preview), e-card viewer footer, shared card viewer footer, envelope back
- Replaces old inline red wax seal SVG

### 26. Edit Page Manual Save
- Edits are no longer auto-saved — changes require explicit "Save" action
- `snapshotRef` captures initial card state on load for dirty detection and revert
- When `isDirty`: header shows "Cancel" / "Save" buttons; when clean: shows "View E-card" / "Print Preview"
- `handleCancel()` reverts all state to snapshot; `handleSave()` persists and updates snapshot
- Navigation guard prompts `window.confirm()` if unsaved changes exist
- Dynamic info banner: "You have unsaved changes" → "Changes saved" → default guidance

### 27. Relationship Closeness & Context Enhancement
Addresses AI message generation for distant/professional relationships where messages felt too warm despite specific notes.

**Multi-layer approach:**

1. **Closeness data model**: `relationship_closeness` field on `Recipient` with options: Very close, Close, Friendly, Acquaintance, Distant, It's complicated
2. **Closeness collection**: Pill selector in onboarding (Step 1, after relationship) and editable on recipient profile page
3. **Closeness-aware AI guardrails** (`generate-card` API): Distinct prompt instructions for "distant," "complicated," "acquaintance" relationships. Professional relationship detection (`isProfessional` regex) adds workplace-appropriate tone guidance. Both injected into standard and BYOM prompt paths.
4. **Elevated sender notes**: `additionalNotes` moved before occasion/tone in the AI prompt with priority instruction that respects emotional boundaries over profile-inferred warmth
5. **Post-generation approach diagnostic**: API returns `approachSummary` (1-2 sentence interpretation). Message selection page shows "Right direction?" Yes/No prompt. "Yes" dismisses the panel. "Not quite" expands to show AI's interpretation + correction textarea. "Regenerate with correction" sends direction correction as highest-priority constraint.
6. **Relationship-adaptive profiles**: `isProRelationship()` helper detects professional relationships. `PROFESSIONAL_TRAITS` and `PROFESSIONAL_INTERESTS` arrays. Onboarding Step 2 conditionally swaps trait/interest wheels, labels, and subtitle for professional relationships.

**UX refinements:**
- "Tap a message above to select it, or:" hint above Back/Regenerate buttons
- "Tap to select →" hover hint on message cards
- "Close" button on expanded diagnostic panel
- Notes placeholder updated to prompt for relationship context

### 28. Impressionist Art Style
- Added `"impressionist"` to `STYLE_RECIPES` in `card-recipes.ts`
- Prompt guidance: broken brushwork, optical color mixing, en plein air atmosphere, soft diffused edges, sun-dappled quality
- Distinct from existing "Painterly" (which emphasizes thick impasto texture over light/atmosphere)

### 29. Custom Co-signer Fix
- `getSenderNames()` and `getSignerNameList()` now process `__custom_N__` override keys (custom signer names added via "+ Add a name" in edit page)
- Previously only handled `signer_recipient_ids` (household links) and `co_signed_with` (legacy partner), causing custom names to be silently dropped from envelope display
- Legacy `co_signed_with` now cleared on save when custom signers are present (not just when household links are checked)
- Edit page migration for `co_signed_with` → `signer_recipient_ids` now searches user's `household_links` (was incorrectly searching recipient's links)

### 30. PDF Text Scaling Fix
- `captureSheet()` text scaling now reads computed font sizes from the **original attached DOM elements** instead of the detached clone
- Previous approach called `getComputedStyle()` on clone elements before they were appended to the DOM, which returned unreliable values
- Mirrors the pattern already used for front-text and panel padding scaling
- Fixes "Created by Nuuge" text and other fixed-size text appearing undersized in PDF output relative to print preview

### 31. Letter Insert PDF Overhaul
Rebuilt the letter insert printing system for correct fonts, auto-fit sizing, and mode-aware guidelines.

**Font fix — root cause:**
The card message spreads `...messageFontStyle` directly onto every `<p>` and `<div>` text element, giving each its own inline `fontFamily`. The letter only set `letterFontStyle` on the outer wrapper div — children inherited via CSS. html2canvas doesn't properly cascade inherited fonts from resolved inline styles. Fix: spread `...letterFontStyle` onto each letter text element (greeting `<p>`, body `<div>`, closing `<p>`), matching the card pattern.

**`captureSheet()` improvements:**
- **Unified pass**: Replaced separate text-scaling and font-resolution blocks with a single walk over all elements — resolves fonts and scales text in one pass
- **`textScaleCap` parameter**: Optional cap on the text scale factor (layout scaling uses full `scaleFactor`, text uses `min(scaleFactor, cap)`)
- **Aggressive font resolution**: Removed `includes("var(")` guard — now resolves computed `fontFamily` for every element with inline `fontFamily`, regardless of whether it contains CSS variables
- **CSS custom property propagation**: Copies all `--font-*` variable values from `<body>` onto the clone root, so any remaining `var()` references in stylesheets also resolve

**Auto-fit text sizing:**
`generateLetterPDF()` dynamically calculates the ideal text scale instead of using a fixed value:
1. Creates a temporary hidden clone at full scale (off-screen, `height: auto`, `overflow: visible`)
2. Scales text in the clone using the same logic as `captureSheet`
3. Measures `scrollHeight` to get actual rendered text height
4. Calculates ideal scale: `baseScale × √(availableH × 0.90 / measuredTextH)` — the `sqrt` accounts for text re-wrapping (larger font → fewer chars/line → more total lines)
5. Caps at 18pt body text for very short notes
6. Passes calculated scale to `captureSheet` via `textScaleCap`

**Character limit:**
- `letterMaxChars = letterWidthIn × letterHeightIn × 26` — dynamic based on letter page area
  - 5×7 card (7×10 letter): ~1,820 characters
  - 4×6 card (6×8 letter): ~1,248 characters
- Countdown displayed below textarea: "X characters remaining" — turns red at 90% usage
- Enforced via `maxLength` attribute and `onChange` guard
- Prevents auto-fit from producing unreadably small text for overly long letters

**Card stock vs letter paper mode:**
- **Card stock**: Letter PDF at exact letter dimensions (e.g., 7×10), no crop marks, no fold line — user scales to any paper from the PDF app
- **Letter paper**: Letter PDF on 8.5×11 with crop marks and fold line (unchanged behavior)
- Preview adapts: card stock mode hides the 8.5×11 frame, crop marks, and fold line

**Multi-page:** Not currently supported. If text exceeds one page, auto-fit scales it down to fit. Multi-page letter support would be a future enhancement.

**Button rename:** "Save" → "Save to Print" — clearer action-oriented label. All hint text references updated to match.

---

## Dual Rendering Paths — IMPORTANT

The card has **two independent rendering paths** that must stay in sync:

| Path | File | Data Source | User |
|------|------|-------------|------|
| **Sender view** | `src/app/cards/view/[cardId]/page.tsx` | Full `Card` object from `localStorage` | Card creator |
| **Shared view** | `src/app/share/[shareId]/SharedCardViewer.tsx` | Serialized JSON from `src/lib/share-card.ts` | Anyone with the link |

**Critical rule:** Any card field that affects rendering **must be explicitly included** in the `cardJson` payload in `share-card.ts`. The shared viewer only sees fields listed there — it cannot access `localStorage`.

**Fields currently synced:** `front_text`, `front_text_mode`, `front_text_position`, `front_text_font`, `front_text_style`, `ft_font_scale`, `msg_font_scale`, `letter_font_scale`, `inside_image_position`, `font`, `accent_opacity`, `letter_text`, `letter_font`, plus image URLs and recipient/sender names.

**When adding new visual features**, always ask: "Does the shared viewer need this field?" If the feature changes how the card looks, the answer is yes.

---

## Three Card Creation Paths

| Path | Entry Point | Use Case |
|------|-------------|----------|
| **Circle** (`/cards/create/[recipientId]`) | Select a person from your circle | Personalized card using full recipient profile |
| **Moments / Share** (`/cards/create/share`) | "Share a Moment" on home page | One card, share with multiple people |
| **Quick Card** (`/cards/create/quick`) | "Quick Card" on home page | Minimal profile — name, relationship, traits, optional age band |

All three paths share: occasion/tone selection, BYOM option, message generation, design step with interests/scene ideas, inside illustration with accent options, front text, and envelope settings.

---

## Data Model (Key Types)

**UserProfile** — name, personality, humor style, interests, values, lifestyle, communication style, emotional energy, partner name, household_links.

**Recipient** — name, relationship type, personality, interests, values, humor tolerance, children, dislikes ("things to avoid"), notes, links to other recipients, important dates (absorbs birthday + milestones), `age_band` (estimated age range), `relationship_closeness` (very_close → complicated), `setup_complete`, `setup_step`.

**Card** — occasion, message text, image URL/prompt, inside image URL/prompt/position, front text/position/font, card size, tone, style label, `card_type` ("circle" | "news" | "beyond"), `envelope_label`, `accent_opacity`, `recipient_ids`, `front_text_mode` ("overlay" | "bake" | "none"), `bake_greeting`, `bake_tagline`, quick recipient fields.

**CardDraft** — Full in-progress state including checkpoint data, message mode, BYOM fields, `accumulatedCost`.

---

## API Endpoints

| Endpoint | Model | Purpose |
|----------|-------|---------|
| `/api/generate-card` | GPT-4o | Generate 3 message options with relationship/age/closeness guardrails, BYOM polish, approach summary, direction correction |
| `/api/suggest-designs` | GPT-4o | Suggest 3 diverse card front concepts (interest-aware, age-calibrated) |
| `/api/suggest-inside-designs` | GPT-4o | Suggest 3 inside illustration concepts (frame-aware prompts) |
| `/api/suggest-scene-sketches` | GPT-4o-mini | Dynamic age-calibrated scene ideas per subject |
| `/api/suggest-front-text` | GPT-4o | Suggest front cover text wording + position |
| `/api/generate-image` | gpt-image-1 | Generate new images or edit existing (frame layout rules) |
| `/api/merge-scene` | GPT-4o-mini | Merge refinement into running description (with recipient age context) |
| `/api/health` | — | Check if OPENAI_API_KEY is configured |

---

## Deploy

```bash
npm run build
npx vercel --prod
```

Production: https://nuuge.vercel.app

---

## Known Issues / Backlog

- Frame background color occasionally renders as cream/off-white despite prompt instructions (DALL-E limitation)
- **Borderless printing on custom paper sizes**: HP OfficeJet printers can't do true borderless on custom paper sizes (e.g., 10×7). Canon Pixma iX6820 is recommended for card stock borderless printing. The PDF card-stock mode works around this by providing exact-size output for "Actual Size" printing.
- **Browser print path**: Retained as fallback but unreliable across browsers/printers for precise sizing. PDF is the recommended path.
- Supabase backend / authentication — schema ready, not migrated
- Mail delivery integration — UI exists, no print/mail service connected. **Professional print & mail** (Lob, Stannp) planned as future premium feature.
- Proactive card suggestions (upcoming date reminders) — planned
- Mailing address: future structured fields + support for multiple addresses
- Data cleanup: stored data for removed fields (`location`, `favorite_foods`, `favorite_music`, `favorite_movies_tv`, `favorite_books`, `communication_style` on recipients, `humor_style` on recipients, `milestones`, `tone_preference`) still exists in localStorage but is no longer displayed or sent to AI

### Photographic / Photo-Realistic Style (Planned)

Add a "Photographic" art style option that generates photo-realistic card imagery. gpt-image-1 handles this well for landscapes, nature, and animals.

**Scope**: Scenery, nature, animals only — no people, faces, or human figures.

**Guardrails needed**:
1. **Prompt-level constraints**: When Photographic style is active, prepend "No people, no human figures, no faces, no body parts" to every image generation and refinement prompt, regardless of user input. OpenAI's built-in content filters catch explicit content but won't block benign-looking people requests.
2. **Subject filtering**: Hide "People / Relationships" and "Characters / Cute Illustrations" from the Image Subject picker when Photographic is selected. Only allow: Flowers/Botanicals, Animals, Nature/Landscape, Objects/Symbols, Holiday/Seasonal, Abstract/Patterns.
3. **User cue on selection**: When the user picks the Photographic style, display a note: *"Photographic scenes work best with landscapes, nature, and animals. People and faces are not available in this style."*
4. **Refinement guardrails**: In the "describe changes" refinement step, prepend the same no-people constraint to the user's change request before sending to `/api/merge-scene` and image generation. This prevents users from adding people via iterative refinement.
5. **Scene idea filtering**: Dynamic scene suggestions (`/api/suggest-scene-sketches`) and static fallback sketches should exclude people-centric scenes when Photographic is active.
6. **Card aesthetic considerations**: Photo-realistic images pair differently with text overlays — baked-in front text may look more natural than overlays on photos. Consider recommending or defaulting to "bake" mode for this style.

**Implementation touches**: Art style list (add option), prompt construction in create paths, subject picker conditional filtering, refinement prompt prepend, scene suggestion filtering, optional UX hint for front text mode.

### Card Format System (Planned)

Introduce a **card format** selector early in the creation flow that determines the content structure and which steps appear. This replaces the current implicit "image front, message inside" assumption.

**Formats:**

| Format | Front | Inside | Use Case |
|--------|-------|--------|----------|
| **Classic** (current default) | Image + optional text overlay/bake | Full AI message + optional decoration | Standard personalized greeting card |
| **Greeting** (new) | Image + baked message (substantial sentiment) | Blank, or simple decoration / "From ___" | Photo-realistic scenes, artistic front-message cards |
| **Joke / Punchline** (new) | Setup line + setup image | Punchline text + optional payoff image | Humor cards, dad jokes, visual puns |

**Format selector placement**: After occasion/tone, before message generation. The selected format gates which creation steps appear in the flow.

#### Greeting Format (Message-Front / Blank Inside)

- Skip inside message generation entirely
- Skip inside illustration selection (or offer optional-only decoration)
- Front text step becomes the primary message step — longer sentiment, not just "Happy Birthday"
- Default to baked-in text mode (message integrated into artwork)
- Photo-realistic art style is a natural pairing
- Inside offers: blank, optional decoration only, or a simple "From ___" line
- **Build priority**: High — straightforward extension of existing baked-text feature, broadens product significantly

#### Joke / Punchline Format

- **Two-phase AI generation**: AI generates a *concept* first — setup line, punchline, front image description, and inside image description — as a coordinated set. This is a different prompt structure from the current three-message-options approach.
- **Linked imagery**: Front and inside images are thematically connected but visually distinct (e.g., "old banana" on front, "banana bread in a party hat" on inside). Requires two coordinated image generation calls.
- **Punchline variants**: The inside payoff may be text-only, image-only, or both. The flow should let the user choose or the AI can suggest.
- **Humor generation**: GPT-4o handles greeting card humor well — puns, wordplay, dad jokes, visual puns, occasion-specific jokes. The genre is formulaic (setup/payoff) which plays to LLM strengths.
- **Tone pairing**: Naturally pairs with "Funny and playful", "Sarcastic and edgy", or a new dedicated "Dad Joke" tone.
- **New API considerations**: May need a `/api/generate-joke-concept` endpoint that returns `{ setupLine, punchLine, frontImagePrompt, insideImagePrompt }` as a coordinated set.
- **Build priority**: Medium — more ambitious, requires new generation logic, but highly differentiated. No known AI card tool generates coordinated front/inside visual humor.

**Architecture impact**: The existing step flow already conditionally skips steps (e.g., front text for baked mode). Format-driven step gating would extend this pattern. The `Card` data model would need a `card_format` field. Draft persistence would include the selected format.

### Onboarding Funnel — Progressive Profiling & Sample Card (Planned)

Address the cold-start problem: Nuuge's value proposition requires profile data, but the upfront investment is a barrier before new users experience the output quality.

**Three-layer approach:**

1. **Sample E-card on Landing Page** — Show a finished card (or 2-3 swipeable examples) directly on the landing page so visitors see the end product in seconds. Reuse the existing `SharedCardViewer` component (or a simplified inline version) with pre-built static card data and images stored in `/public/`. This replaces or augments the current SVG illustration in the hero section.
   - **Build priority**: High — low effort, high impact for first impressions.

2. **Progressive Profiling** — Instead of collecting everything upfront, the first card only needs bare minimum (name, relationship, occasion). After the user sees the result, prompt enrichment: *"Want this to sound more like you? Tell us a bit more."* Each subsequent card improves as the profile fills organically.
   - **Build priority**: Medium — requires rethinking onboarding flow and making profile fields optional/deferred.

3. **Quick Card as Default Gateway → Profile Capture** — New users enter via Quick Card flow (minimal fields, fast to first result). After card completion, Nuuge offers: *"Save [name] to your circle? Next time will be even better."* Pre-populates the profile with data already entered and optionally surfaces 2-3 quick enrichment questions while the user is feeling positive about the result.
   - **Build priority**: Medium — Quick Card flow exists; needs post-completion save prompt and profile pre-population logic.
