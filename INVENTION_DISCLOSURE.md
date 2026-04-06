# Nuuge — Invention Disclosure Document

**Prepared for:** Patent attorney review  
**Date:** March 30, 2026  
**Inventor(s):** [To be completed — name(s) of inventor(s)]  
**Application type:** Provisional patent (utility) + design patent candidates  
**Status:** Pre-filing disclosure  

---

## Table of Contents

1. [Title of Invention](#1-title-of-invention)
2. [Technical Field](#2-technical-field)
3. [Background and Prior Art](#3-background-and-prior-art)
4. [Summary of the Invention](#4-summary-of-the-invention)
5. [Detailed Description — Utility Patent Claims](#5-detailed-description--utility-patent-claims)
   - 5A. Profile-Driven Dual-Channel Generation
   - 5B. Age-Band Inference and Multi-Modal Guardrails
   - 5C. Accumulative Scene Refinement
   - 5D. Format-Driven Adaptive Creation Pipeline with Coordinated Multi-Image Humor Generation
6. [Detailed Description — Design Patent Claims](#6-detailed-description--design-patent-claims)
   - 6A. Multi-Path Convergent Creation Pipeline
   - 6B. Profile Checkpoint System
7. [System Architecture](#7-system-architecture)
8. [Data Models](#8-data-models)
9. [Figure Descriptions](#9-figure-descriptions)
10. [Claim Drafts](#10-claim-drafts)
11. [Source Code References](#11-source-code-references)
12. [Prior Art Distinctions](#12-prior-art-distinctions)

---

## 1. Title of Invention

**"System and Method for Generating Personalized Greeting Card Content Using Profile-Driven Dual-Channel AI Generation with Age-Calibrated Guardrails and Accumulative Scene Refinement"**

Short title: **Nuuge Personalized Card Generation System**

---

## 2. Technical Field

The invention relates to computer-implemented systems and methods for generating personalized greeting card content, specifically to systems that use stored personality profiles to simultaneously calibrate both textual message generation and visual image generation through artificial intelligence models, with age-aware guardrails and iterative scene refinement capabilities.

---

## 3. Background and Prior Art

### Existing Solutions

**Template-based card platforms** (e.g., Canva, Shutterfly, Minted): Users select from pre-designed templates and customize text manually. No AI generation. Personalization is limited to font/color choices and user-typed text.

**Single-channel AI card generators** (e.g., various GPT-powered card apps): Generate either a message OR an image, but not both from a unified profile. Typically accept a simple prompt ("birthday card for mom") without stored personality data.

**General AI image generators** (e.g., DALL-E, Midjourney via direct prompts): Generate images from text prompts but have no concept of recipient profiles, relationship context, age-appropriate calibration, or greeting card–specific guardrails.

**Commercial card companies with AI features** (e.g., Hallmark, Moonpig): May offer AI-suggested messages but typically from occasion templates, not from stored recipient personality profiles. Image selection is from catalogs, not AI-generated.

### Gaps in Prior Art

1. No existing system uses a **single stored personality profile** to simultaneously drive both message text generation and image generation, with the same profile data shaping both channels.
2. No existing system **infers recipient age from relationship context** (e.g., sender age + "grandchild" relationship) and uses that inference to calibrate message vocabulary, image subject matter, and scene suggestions across three independent generation layers.
3. No existing system maintains a **running scene description** that accumulates user refinements through an AI merging process, preserving prior context while integrating changes — as opposed to replacing the prompt on each iteration.

---

## 4. Summary of the Invention

The invention is a computer-implemented system for generating personalized greeting cards comprising:

**(a)** A **profile store** containing structured personality data for both card senders and recipients, including personality traits, interests, values, humor characteristics, relationship type, and age data;

**(b)** A **dual-channel generation engine** that consumes the same profile data to simultaneously calibrate (i) natural language message generation via a large language model (LLM) and (ii) visual image generation via an image generation model, such that both outputs reflect the stored personality characteristics of the recipient;

**(c)** An **age-band inference module** that derives approximate recipient age from contextual signals (sender age, relationship type, important dates) when exact age is unknown, and applies band-specific calibration rules to message tone, image content, and scene suggestions;

**(d)** An **accumulative scene refinement engine** that maintains a running scene description and merges user-requested changes into the existing description via an AI model, preserving structural context while integrating modifications — producing a new complete prompt for image regeneration rather than pixel-level editing.

The system also features **multiple convergent creation paths** with varying data requirements that feed into the same generation pipeline, and a **profile checkpoint interface** that presents AI-consumed data to the user for review and correction before generation begins.

---

## 5. Detailed Description — Utility Patent Claims

### 5A. Profile-Driven Dual-Channel Generation

#### Overview

The system maintains structured personality profiles for both senders and recipients. When a user initiates card creation, the system extracts relevant profile elements and constructs context strings that are provided to two independent AI generation channels: one for message text and one for card imagery.

#### Profile Data Structure

**Recipient profile** (stored per-recipient, persisted in client-side storage):

| Field | Type | Example |
|-------|------|---------|
| `personality_notes` | string | "Warm, nurturing, loves to laugh" |
| `interests` | string[] | ["gardening", "cooking", "hiking"] |
| `values` | string[] | ["family", "community"] |
| `humor_tolerance` | string | "Loves puns and wordplay" |
| `relationship_type` | string | "Mother" |
| `age_band` | enum | "adult" (child/teen/young_adult/adult/senior) |
| `children` | string | "Two daughters, ages 8 and 12" |
| `dislikes` | string | "Overly sentimental language" |
| `occupation` | string | "Retired teacher" |
| `lifestyle` | string | "Active, enjoys morning walks" |
| `pets` | string | "Golden retriever named Max" |
| `notes` | string | Free-form additional context |

**Sender profile** (stored once per user):

| Field | Type | Example |
|-------|------|---------|
| `personality` | string | "Thoughtful, detail-oriented" |
| `humor_style` | string | "Dry wit" |
| `interests` | string[] | ["photography", "travel"] |
| `values` | string[] | ["honesty", "creativity"] |
| `communication_style` | string | "Warm but concise" |
| `emotional_energy` | string | "Steady, grounded" |

#### Profile Element Extraction

The system extracts profile data into a **togglable element map** — a key-value structure where each key represents a profile attribute (e.g., `"interest: gardening"`, `"personality: warm"`, `"humor tolerance: loves puns"`) and the value is a boolean indicating whether that element is active for the current generation.

Function: `extractProfileElements(recipient) → Record<string, boolean>`

Elements are categorized as:
- **Interest-like keys**: interests, values, occupation, lifestyle, pets, children, additional context
- **Tone-like keys**: personality traits, humor tolerance, things to avoid

This categorization enables **progressive de-emphasis** during regeneration cycles (described below).

#### Context String Construction

The system constructs two context strings from the extracted elements:

1. **Sender context**: Assembled from the sender's `UserProfile` — display name, personality, communication style, emotional energy, humor style, lifestyle.

2. **Recipient context**: Assembled from active (toggled-on) elements in the extraction map. Three modes:
   - **Full profile**: All active elements expanded with labels (e.g., "Interests: gardening, cooking")
   - **Sparse/universal**: When no elements are toggled on, an explicit instruction is generated: "Write a universal, occasion-focused message"
   - **Progressive de-emphasis**: On repeated regeneration (2nd+ attempt), interest-like keys are deactivated first (50% at attempt 2), then tone-like keys (keep ~20% at attempt 3+), forcing the AI to explore different angles

#### Channel 1: Message Text Generation

The sender and recipient context strings, along with occasion, tone, and relationship metadata, are sent to a message generation API endpoint.

**API**: `POST /api/generate-card`  
**Model**: GPT-4o (temperature: 0.9, max_tokens: 1000)  
**Input**: `{ senderContext, recipientContext, occasion, tone, relationshipType, rejectedMessages[], regenerationCount, ... }`  
**Output**: Three message alternatives, each containing `{ label, greeting, body, closing }`

The system prompt includes:
- Sender and recipient profile blocks
- Relationship-specific guardrails (regex-matched: family-child, romantic, non-romantic, etc.)
- Rejected message tracking (to avoid repetition)
- Context safety instruction: "Do not guess age or invent profile facts not provided"
- Age-appropriate tone block (see §5B)
- Faith-based and gentle-occasion modifiers when applicable

#### Channel 2: Image Generation

The same recipient profile data feeds into image prompt construction via a separate function chain.

**Prompt construction**: `buildUserFacingPrompt(opts) → string`  
**Input**: `{ subjectId, tone, styleId, personalContext, profileInterests[], occasion, recipientAge, recipientAgeBand, recipientRelationship }`

The function:
1. Selects a scene sketch based on the chosen subject category and mood
2. If `profileInterests` are provided, weaves them into the scene description (e.g., "A gardening-inspired nature scene")
3. Appends a **Recipient line** with relationship and age context
4. Appends **age guidance** calibrated to the recipient's age band (see §5B)
5. Constructs the full prompt: `Mood → Scene → Art style → Composition → Lighting → Palette → Texture → Personal touch/context → Recipient → Age guidance`

**Image generation API**: `POST /api/generate-image`  
**Model**: gpt-image-1  
**Input**: `{ imagePrompt, userId, cardSize, ... }`  
**Output**: `{ imageUrl (data URI PNG), isEdit }`

The image generation route applies `GLOBAL_GUARDRAILS` (avoid lists, literal-rendering rules, human-figure constraints) on top of the user-facing prompt.

#### Key Innovation: Unified Profile → Dual Output

The critical novelty is that a **single stored profile** drives **both** generation channels. The same `interests: ["gardening"]` data point simultaneously:
- Causes the message to reference gardening naturally in the body text
- Causes the image to incorporate gardening elements in the visual scene

No user action is required to synchronize these channels — the system automatically extracts and applies profile data to both.

#### Progressive De-Emphasis on Regeneration

When a user rejects generated messages and requests new ones, the system **automatically reduces profile influence** to produce more varied results:

| Regeneration Attempt | Profile Behavior |
|---------------------|-------------------|
| 1st attempt | Full profile active — all interests, personality, humor |
| 2nd attempt | ~50% of interest-like elements deactivated randomly |
| 3rd+ attempt | ~80% of tone-like elements also deactivated; near occasion-only generation |

This prevents the "echo chamber" effect where repeated generations produce similar results by gradually shifting emphasis from profile-specific to occasion-generic content.

---

### 5B. Age-Band Inference and Multi-Modal Guardrails

#### Overview

The system addresses the problem of generating age-appropriate content when the recipient's exact age is unknown. It implements a three-layer approach: (1) infer approximate age from contextual signals, (2) confirm the inference with the user, (3) apply band-specific calibration to message tone, image content, and scene suggestions.

#### Age Band Definition

The system defines five age bands:

| Band ID | Label | Age Range | Midpoint |
|---------|-------|-----------|----------|
| `child` | Under 13 | 0–12 | 8 |
| `teen` | 13–18 | 13–18 | 15 |
| `young_adult` | 19–30 | 19–30 | 24 |
| `adult` | 31–55 | 31–55 | 43 |
| `senior` | 55+ | 56+ | 67 |

#### Age Inference Method

Function: `inferAgeBand(senderAge, relationshipType) → AgeBand | null`

When no birthday or age band is stored for a recipient, the system infers an approximate age using the **sender's own age** combined with the **relationship type**:

| Relationship | Inference Formula | Example (sender age 50) |
|-------------|-------------------|-------------------------|
| Child (son/daughter) | sender age − 25 | 25 → `young_adult` |
| Grandchild | sender age − 50 | 0 → `child` |
| Parent (mother/father) | sender age + 27 | 77 → `senior` |
| Grandparent | sender age + 50 | 100 → `senior` |
| Sibling/Twin | sender age | 50 → `adult` |
| Spouse/Partner | sender age | 50 → `adult` |
| Niece/Nephew | max(1, sender age − 18) | 32 → `adult` |
| Aunt/Uncle | sender age + 15 | 65 → `senior` |
| Godchild | max(1, sender age − 25) | 25 → `young_adult` |

Returns `null` for ambiguous relationships (friend, colleague, etc.) where age cannot be reasonably inferred.

#### Age Data Priority

The system applies a priority hierarchy for age information:

1. **Exact age** — computed from stored birthday or important dates (highest priority)
2. **User-confirmed age band** — set via the profile checkpoint interface (§6B)
3. **Inferred age band** — derived from relationship + sender age
4. **No age data** — generation proceeds without age-specific calibration

#### Multi-Modal Age Calibration

The confirmed or inferred age band is applied to **three independent generation layers**:

**Layer 1: Message Tone Calibration**

The `contextSafetyInstruction` block in the message generation API includes age-appropriate tone rules:

| Band | Tone Rules |
|------|------------|
| Child (<13) | Simple vocabulary, playful, encouraging; avoid adult themes |
| Teen (13–18) | Contemporary, not condescending; respect emerging independence |
| Young adult (19–30) | Peer-to-peer, modern references appropriate |
| Adult (31–55) | Peer-to-peer; no "watching you grow up" language; treat as equal |
| Senior (55+) | Respectful, not patronizing; no "elderly" language; warm and dignified |

Key instruction: "If only an approximate age range is provided, write for the **middle** of the range. Never echo the band label in the message text."

**Layer 2: Image Content Calibration**

The `ageGuidance` string in `buildUserFacingPrompt` modifies image generation:

| Band Level | Image Rules |
|-----------|-------------|
| Child (level 0) | Bright, playful, whimsical; cartoon animals welcome; fun patterns |
| Teen (level 1) | Contemporary, stylish; vibrant but not childish |
| Adult/Senior (level 3–4) | Sophisticated, refined; animals as natural/artistic — not cartoon; people depicted at correct age, not as children |

Young adult (level 2) receives no additional guidance, acting as the neutral baseline.

**Layer 3: Scene Suggestion Filtering**

Static scene sketches are tagged with audience suitability:

| Tag | Eligible Bands |
|-----|----------------|
| `"all"` | All age bands |
| `"young"` | Child and teen only (level ≤ 1) |
| `"mature"` | Adult and senior only (level ≥ 3) |

Function: `getFilteredSketches(recipe, moodId, ageBand) → SceneSketch[]`

Dynamic scene suggestions (via `/api/suggest-scene-sketches`) also receive the age band and relationship as input parameters, enabling the AI to generate age-appropriate scene ideas.

#### Stored vs. Inferred: The `age_band` Field

A critical design decision: inferred age is stored as a **band** (e.g., "adult"), not as a fake birthday. This avoids the "false birthday problem" where an inferred date would surface in birthday reminders or age calculations. The `age_band` field on the `Recipient` record is explicitly documented as "Estimated age range when exact birthday is unknown."

#### Propagation Through the System

The age band propagates through the system via these touchpoints:

1. **Profile checkpoint** (§6B) → user confirms/adjusts → `checkpointAgeBand` state
2. **`saveCheckpointToProfile`** → persists confirmed `age_band` to recipient record
3. **`buildContextString`** → includes `Approximate age: [band label]` in recipient context for message generation
4. **`buildUserFacingPrompt`** → includes `Recipient:` line and `Age guidance:` block for image generation
5. **`requestRefinement` / `requestInsideRefinement`** → passes age to `/api/merge-scene` for depiction consistency
6. **`fetchDynamicSketches`** → passes age to `/api/suggest-scene-sketches` for suggestion filtering

---

### 5C. Accumulative Scene Refinement

#### Overview

The system implements a scene refinement mechanism that maintains a **running scene description** — a complete, structured text prompt that fully describes the desired image. When a user requests changes, the system uses an AI model to **merge** the change into the existing description, producing an updated complete prompt rather than a replacement or a pixel-level edit instruction.

#### Running Scene Description

The scene description is a structured text block containing labeled sections:

```
Scene: A golden retriever playing in autumn leaves in a park setting
Art style: Watercolor with soft edges
Composition: Centered subject, wide angle
Lighting: Warm afternoon golden hour
Palette: Amber, rust, forest green
Texture: Visible brushstrokes, paper grain
Personal touch/context: Recipient loves dogs and nature walks
Recipient: Mother, approximate age: adult
```

This description is maintained in two state variables:
- `currentSceneDescription` — the committed (accepted) description
- `pendingSceneDescription` — the working copy being refined

#### Merge Process

When a user types a change request (e.g., "make the sky more orange" or "add a butterfly"), the system sends the full current description plus the change request to a merge endpoint.

**API**: `POST /api/merge-scene`  
**Model**: GPT-4o-mini (max_tokens: 1200)  
**Input**: `{ currentScene, change, currentInterests[], recipientAge, recipientAgeBand, recipientRelationship }`

**System prompt instructions**:
1. The output is for **generating a new image from scratch** — not pixel editing
2. Preserve the full structural format (Scene, Art style, Composition, Lighting, etc.)
3. Integrate the change **within the Scene section**, rewriting as one coherent paragraph
4. Use **generation-friendly** wording (positive constraints: "an orange sunset sky" rather than "remove the blue sky")
5. Classify the change as `refine` (adjustment within the same concept) or `redesign` (fundamental shift)
6. Do not alter other sections unless the change explicitly targets them

**Output**: `{ mergedScene: string, changeType: "refine" | "redesign", editInstruction: string }`

#### Key Properties of the Merge

1. **Context preservation**: Previous details are retained. If the original prompt mentioned "autumn leaves" and the user says "add a butterfly," the merged result includes both autumn leaves and a butterfly.

2. **Structural integrity**: The labeled-section format is preserved across merges, enabling consistent parsing by the image generation pipeline.

3. **Age and relationship awareness**: The merge endpoint receives recipient age/band/relationship data, ensuring that changes maintain age-appropriate depiction (e.g., if the user says "add a person," the merge instructions include correct age depiction for the recipient's relationship context).

4. **Interest integration**: If stored interests are provided, the merge instructions note which interests may appear in the "Personal touch" section, preventing interest drift during refinement.

5. **Positive reframing**: The system converts removal requests into positive generation language. "Remove the hiker" becomes a scene description that simply doesn't include a hiker, rather than a negation instruction.

#### Iterative Accumulation

The merge process is **repeatable**. Each merge takes the previous merged result as its `currentScene`, enabling multi-step refinement:

```
Round 1: Base prompt → "add a butterfly" → Merged prompt with butterfly
Round 2: Merged prompt → "make the sky more orange" → Prompt with butterfly + orange sky
Round 3: Merged prompt → "change to winter scene" → Prompt with butterfly + orange sky + winter
```

At each step, the user sees the merged text and can further edit it before confirming generation. The `changeType` classification (`refine` vs `redesign`) informs the UI about the magnitude of the change.

#### Contrast with Alternative Approaches

| Approach | Behavior | Limitation |
|----------|----------|------------|
| **Prompt replacement** | User types entirely new prompt each time | Loses all prior context; user must re-specify everything |
| **Pixel-level editing** | AI edits existing image pixels | Limited to visual modifications; can't change composition fundamentally; artifacts common |
| **Prompt appending** | New instructions appended to existing prompt | Creates contradictory instructions; prompt grows unbounded; order-dependent |
| **Accumulative merge (this invention)** | AI rewrites the scene section incorporating the change into a coherent whole | Preserves context, resolves contradictions, maintains structure, supports both refinement and redesign |

---

### 5D. Format-Driven Adaptive Creation Pipeline with Coordinated Multi-Image Humor Generation

#### Overview

The system introduces a **card format** abstraction that determines the content structure, step flow, and generation behavior of a card. Rather than a single implicit format (image front, message inside), the system supports multiple formats — each gating which creation steps appear, how AI generation is invoked, and how content is distributed between the front and inside of the card.

This section covers two novel extensions: (1) the format-driven adaptive pipeline itself, and (2) the coordinated multi-image humor generation for joke/punchline cards.

#### Card Format Abstraction

The system defines a `card_format` attribute on each card, selected early in the creation flow (after occasion/tone, before message generation). The selected format dynamically controls:

1. **Step visibility**: Which steps in the creation pipeline are shown, skipped, or reordered
2. **Generation mode**: Which API endpoints are called and with what prompt structure
3. **Content distribution**: How generated content maps to front vs. inside of the physical card
4. **Image generation count**: Whether one or two images are generated, and whether they must be coordinated

#### Defined Formats

| Format | Front Content | Inside Content | Steps Modified |
|--------|--------------|----------------|----------------|
| **Classic** | AI image + optional text overlay or baked text | Full AI-generated message (greeting, body, closing) + optional decoration | Default — all steps active |
| **Greeting** | AI image + baked substantial message | Blank, optional decoration, or simple "From ___" line | Skip inside message generation; skip inside illustration selection; front text step becomes primary message step with longer sentiment |
| **Joke / Punchline** | Setup line + setup image | Punchline text + optional payoff image | Replace message generation with concept generation; add second coordinated image generation; modify front text step to display setup line |

#### Format-Driven Step Gating

The existing creation pipeline already conditionally skips steps (e.g., front text editing is skipped when `frontTextMode === "bake"`). The format selector extends this pattern systematically:

**Classic format** (no change from current behavior):
```
Occasion → Tone → Message mode → Notes/Checkpoint → Generate 3 messages →
Select message → Design subject/style → Generate front image → Front text →
Inside illustration → Letter → Delivery
```

**Greeting format**:
```
Occasion → Tone → Notes/Checkpoint → Generate front message options →
Select front message → Design subject/style → Generate front image with baked message →
[Inside decoration optional] → Letter → Delivery
```

Key differences: Message generation produces **front-facing sentiments** (substantial, 1–3 lines suitable for baking into artwork) rather than inside card messages. Inside message steps are entirely removed. Baked-in text mode is defaulted and recommended.

**Joke / Punchline format**:
```
Occasion → Tone → Generate joke concepts (setup + punchline + image descriptions) →
Select concept → Generate front image (illustrating setup) → Preview front →
Generate inside image (illustrating punchline) [optional] → Preview inside → Delivery
```

Key differences: A new concept generation step replaces standard message generation. Two coordinated image generation calls replace the single front image call. Inside illustration is not decorative but integral to the content.

#### Coordinated Multi-Image Humor Generation (Joke / Punchline Format)

This subsection describes a novel method for generating greeting cards where humor is delivered through coordinated visual and textual elements across the front and inside of a card.

**Concept Generation**

A new API endpoint generates a complete joke concept as a coordinated set:

**Input**: `{ occasion, tone, recipientContext, senderContext, profileElements }`  
**Output**: `{ concepts[]: { setupLine, punchLine, frontImagePrompt, insideImagePrompt, humorType } }`

Where `humorType` classifies the joke as: `pun`, `wordplay`, `visual_pun`, `dad_joke`, `observational`, or `absurdist`.

The model generates 3 concept alternatives. Each concept is a **coordinated quad**: the setup line, punchline, and both image descriptions are designed to work together. The front image illustrates the setup scenario; the inside image delivers or reinforces the punchline.

**Example concept**:
```json
{
  "setupLine": "If you were a banana...",
  "punchLine": "...you'd be bread!",
  "frontImagePrompt": "A ripe banana wearing a tiny birthday hat, sitting on a kitchen counter, looking distinguished. Warm lighting, slightly humorous, photographic style.",
  "insideImagePrompt": "A golden loaf of banana bread wearing a party hat, with streamers and confetti around it. Warm bakery lighting, celebratory mood, photographic style.",
  "humorType": "pun"
}
```

**Coordinated Image Generation**

The two images are generated with awareness of each other:
1. The front image prompt is generated first
2. The inside image prompt is constructed to maintain **visual continuity** (same art style, similar lighting/palette, thematically linked subjects) while being **compositionally distinct**
3. Both prompts share style and mood directives to ensure the pair feels like a matched set
4. The accumulative scene refinement (§5C) applies to each image independently, but with the coordination constraint preserved — a change to the front image's style propagates to the inside image prompt

**Punchline Delivery Variants**

The system supports multiple inside content modes for joke cards:
- **Text + image**: Punchline text displayed alongside or above an image (e.g., "...you'd be bread!" with banana bread illustration)
- **Image only**: The image IS the punchline — no text needed (visual pun)
- **Text only**: Punchline text on a blank or minimally decorated inside (for jokes where the humor is entirely verbal)

The AI concept generation suggests which variant best fits each joke, but the user can override.

**Profile Integration**

Joke concepts are personalized using the same profile-driven system described in §5A:
- Recipient interests influence joke subject matter (e.g., a gardening enthusiast might get plant-based puns)
- Relationship type and humor tolerance calibrate joke edginess (e.g., dad jokes for family, sharper wit for close friends with high humor tolerance)
- Age band (§5B) calibrates humor sophistication (simpler wordplay for younger recipients, more nuanced humor for adults)
- The progressive de-emphasis on regeneration (§5A) applies to joke concepts as well

#### Key Innovation: Format as a First-Class Pipeline Control

The card format is not merely a template or layout choice — it fundamentally reshapes the AI generation pipeline. The same underlying infrastructure (profile extraction, context construction, age calibration, scene refinement) serves all formats, but the format determines:
- What is generated (message vs. joke concept vs. front sentiment)
- How many images are produced (one vs. two coordinated)
- How content maps to physical card surfaces (front vs. inside)
- Which creation steps the user experiences

This is analogous to how a manufacturing process might produce different products from the same raw materials and machinery by changing the production recipe — the "recipe" here is the card format.

#### Contrast with Prior Art

| System | Approach | Limitation |
|--------|----------|------------|
| Template card platforms | Fixed layouts; user selects template and fills in text | No AI generation; format locked at template selection |
| AI card generators | Single generation mode; always produce message + image | Cannot produce coordinated multi-image humor or message-front cards |
| Joke generators (standalone) | Text-only jokes; no image generation | No visual component; not integrated into card creation |
| **This invention** | Format selector drives an adaptive pipeline that reshapes AI generation, step flow, and content distribution | Unified system supports multiple card structures from one profile-driven engine |

---

## 6. Detailed Description — Design Patent Claims

### 6A. Multi-Path Convergent Creation Pipeline

#### Overview

The system provides three distinct entry points for card creation, each with different data requirements and user experiences, that converge into a single shared generation pipeline. This design pattern solves the problem of serving users with varying levels of available recipient data without duplicating the generation infrastructure.

#### Three Entry Paths

**Path 1: Circle (Full Profile)**
- Entry: User selects an existing recipient from their "circle" (stored contacts)
- Data available: Full personality profile (traits, interests, values, humor, relationship, age, important dates, history of previous cards)
- URL: `/cards/create/[recipientId]`
- Unique features: Profile element toggle map, card history for variety, profile checkpoint

**Path 2: Quick Card (Minimal Profile)**
- Entry: User clicks "Quick Card" from home page
- Data available: Name, relationship type, up to 10 personality traits (from scroll wheel), optional age band
- URL: `/cards/create/quick` → `/cards/create/__quick__`
- Unique features: Synthetic recipient object built from minimal data; no persistent recipient record; "Add to circle" graduation option after card creation

**Path 3: Moments / Share (Sender-Centric)**
- Entry: User clicks "Share a Moment" from home page
- Data available: Sender's own profile; no specific recipient data
- URL: `/cards/create/share`
- Unique features: Uses `extractSenderProfileElements` instead of recipient extraction; news categories instead of occasions; `mode: "news"` for message generation; fixed recipient context: "This card has no specific recipient"

#### Convergence Point

All three paths converge into the same step flow after their respective data collection:

```
[Path-specific data collection]
        ↓
   Occasion / Tone selection
        ↓
   Message mode (AI-generated vs BYOM)
        ↓
   Notes / Checkpoint (if applicable)
        ↓
   Message generation (3 options)
        ↓
   Design subject + style selection
        ↓
   Image generation + refinement
        ↓
   Inside illustration
        ↓
   Front text
        ↓
   Delivery / Save
```

The generation APIs receive the same input structure regardless of path — the path-specific logic is limited to how the context strings are assembled.

#### Quick Card Graduation

When a user creates a Quick Card for someone not in their circle, the system stores the card with `card_type: "beyond"` and the quick recipient's data (`quick_recipient_name`, `quick_recipient_relationship`, `quick_recipient_traits`). If the user later adds this person to their circle (creates a full recipient profile), the system can associate the card with the new profile, transferring the card to the recipient's history. This provides a **low-friction entry point** that preserves optionality for deeper engagement.

#### Design Significance

The three-path convergent design is a distinctive user interface pattern:
- The home page presents three visually distinct columns with clear labels and different visual treatment
- Each path has a unique data collection experience (scroll wheel for traits vs. full profile editor vs. moment description)
- Despite different entry experiences, the generation steps are visually and functionally identical
- Users who start with Quick Card experience the full generation quality, incentivizing graduation to Circle for even better personalization

---

### 6B. Profile Checkpoint System

#### Overview

The system provides a **"What Nuuge knows"** checkpoint interface that presents the user with a summary of all profile data the AI will use for generation, allowing review and correction **before** any generation occurs. This serves as both a transparency mechanism and a data quality gate.

#### Checkpoint Interface

Rendered on the "notes" step of the creation flow (for Circle and Quick Card paths, not Moments/Share):

**Displayed elements**:

1. **Relationship chip**: Shows the stored relationship type (e.g., "Mother")
2. **Occasion chip**: Shows the selected occasion (e.g., "Birthday")
3. **Age display**:
   - If exact age is known (from birthday): displays age as read-only text
   - If age band is known or inferred: displays selectable age band buttons (Child, Teen, Young Adult, Adult, Senior)
   - User can adjust the age band, which is then saved to the recipient profile
4. **Couple checkbox**: Appears for couple-critical occasions (Anniversary, Valentine's, Wedding) — allows the user to indicate whether the recipient is part of a couple
5. **Occasion-specific extras**: Anniversary years, graduation level — appear when the selected occasion includes these metadata fields
6. **Profile element toggles**: The extracted profile elements (interests, personality, values, etc.) displayed as toggleable pills — the user can turn off elements they don't want the AI to use for this particular card

#### Data Flow

```
Recipient profile data
        ↓
extractProfileElements() → toggle map
        ↓
Checkpoint UI (user reviews, adjusts age band, toggles elements)
        ↓
saveCheckpointToProfile() → persists age_band to recipient record
        ↓
buildContextString(toggles, checkpoint) → context strings for AI
        ↓
Message generation + Image generation
```

#### Design Significance

The checkpoint is a distinctive UI pattern that addresses AI trust:
- Users can see exactly what data influences their card before any API call is made
- Corrections made at the checkpoint (e.g., adjusting age band) are **persisted** to the profile, improving future generations
- The toggle mechanism allows per-card customization without permanently editing the profile (e.g., turning off "loves hiking" for a sympathy card)
- The interface is always visible on the notes step, not hidden behind an "advanced" toggle

---

## 7. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Circle   │  │  Quick    │  │  Moments/Share   │  │
│  │  Path     │  │  Card     │  │  Path            │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│       └──────────────┼─────────────────┘             │
│                      ▼                               │
│         ┌─────────────────────────┐                  │
│         │  Profile Element        │                  │
│         │  Extraction + Toggles   │                  │
│         └───────────┬─────────────┘                  │
│                     │                                │
│         ┌───────────┼────────────┐                   │
│         ▼           ▼            ▼                   │
│    ┌─────────┐ ┌──────────┐ ┌──────────┐            │
│    │ Context  │ │ Image    │ │ Age Band │            │
│    │ String   │ │ Prompt   │ │ Inference│            │
│    │ Builder  │ │ Builder  │ │ Module   │            │
│    └────┬────┘ └────┬─────┘ └────┬─────┘            │
│         │           │            │                   │
│  ┌──────┴───────────┴────────────┴──────────┐        │
│  │          Local Storage / IndexedDB        │        │
│  │    (Profiles, Cards, Drafts, Images)      │        │
│  └───────────────────────────────────────────┘        │
└─────────────────────────┬───────────────────────────┘
                          │ API Calls
                          ▼
┌─────────────────────────────────────────────────────┐
│                SERVER (Next.js API Routes)            │
│                                                     │
│  ┌───────────────┐  ┌──────────────┐                │
│  │ /generate-card │  │ /merge-scene │                │
│  │ (GPT-4o)      │  │ (GPT-4o-mini)│                │
│  │               │  │              │                │
│  │ Message gen   │  │ Scene merge  │                │
│  │ BYOM polish   │  │              │                │
│  └───────────────┘  └──────────────┘                │
│                                                     │
│  ┌────────────────┐  ┌───────────────────┐          │
│  │/generate-image │  │/suggest-designs   │          │
│  │(gpt-image-1)   │  │/suggest-front-text│          │
│  │                │  │/suggest-sketches  │          │
│  │ Image gen/edit │  │(GPT-4o / 4o-mini)│          │
│  └────────────────┘  └───────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### Dual-Channel Data Flow

```
                    Recipient Profile
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
   extractProfileElements()    buildUserFacingPrompt()
            │                         │
            ▼                         ▼
   buildContextString()         Image prompt string
   (sender + recipient)        (scene + age guidance)
            │                         │
            ▼                         ▼
   POST /api/generate-card     POST /api/generate-image
   (GPT-4o)                    (gpt-image-1)
            │                         │
            ▼                         ▼
   3 message options            Card front image
```

### Accumulative Scene Refinement Flow

```
Initial prompt (from buildUserFacingPrompt)
       │
       ▼
currentSceneDescription ─────────────────────────────┐
       │                                              │
       ▼                                              │
User sees image, requests change                      │
       │                                              │
       ▼                                              │
POST /api/merge-scene                                 │
  { currentScene + change + interests + age }         │
       │                                              │
       ▼                                              │
mergedScene (new complete prompt)                     │
       │                                              │
       ▼                                              │
pendingSceneDescription (user can edit)               │
       │                                              │
       ▼                                              │
User confirms → generateDesignImage(prompt)           │
       │                                              │
       ▼                                              │
New image generated from merged prompt                │
       │                                              │
       ▼                                              │
currentSceneDescription = mergedScene ────────────────┘
       │                                    (loop for
       ▼                                    next refinement)
User satisfied → proceed to next step
```

### Age-Band Inference and Propagation

```
                  ┌─────────────────────┐
                  │ Age Data Sources     │
                  ├─────────────────────┤
                  │ 1. Birthday/dates   │─── exact age
                  │ 2. User-set band    │─── confirmed band
                  │ 3. Inferred band    │─── relationship math
                  └────────┬────────────┘
                           │
                  ┌────────▼────────────┐
                  │ Checkpoint UI       │
                  │ (user confirms)     │
                  └────────┬────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
    ┌─────────────┐ ┌──────────┐ ┌──────────────┐
    │ Message     │ │ Image    │ │ Scene        │
    │ Tone Rules  │ │ Age      │ │ Sketch       │
    │             │ │ Guidance │ │ Filtering    │
    │ (generate-  │ │ (build-  │ │ (getFiltered │
    │  card API)  │ │  UserFa- │ │  Sketches)   │
    │             │ │  cing-   │ │              │
    │             │ │  Prompt) │ │              │
    └─────────────┘ └──────────┘ └──────────────┘
```

---

## 8. Data Models

### Core Types (TypeScript definitions from source)

**PersonProfile** (shared base for sender and recipient):
```
display_name, first_name, last_name, nickname, birthday,
personality, humor_style, interests[], values[],
occupation, lifestyle, pets, children, dislikes,
mailing_address, email, notes
```

**UserProfile** (extends PersonProfile):
```
+ id, partner_name, partner_recipient_id,
  household_links[], onboarding_complete
```

**Recipient** (extends PersonProfile):
```
+ id, name, relationship_type, personality_notes,
  humor_tolerance, important_dates[],
  links[] (to other recipients), age_band (AgeBand enum),
  setup_complete, setup_step
```

**Card**:
```
id, user_id, recipient_id, recipient_ids[],
card_type ("circle" | "news" | "beyond"),
occasion, occasion_custom, message_text,
image_url, image_prompt, inside_image_url,
front_text, front_text_mode ("overlay" | "bake" | "none"),
bake_greeting, bake_tagline,
art_style, image_subject, tone_used,
signer_recipient_ids[], signer_display_overrides{},
card_size, letter_text, letter_font
```

**CardDraft** (creation state persistence):
```
step, occasion fields, message fields,
activeProfileElements (toggle map),
currentSceneDescription, pendingSceneDescription,
frontTextMode, bakeGreeting, bakeTagline,
checkpoint fields (ageBand, isCouple, etc.),
accumulatedCost
```

---

## 9. Figure Descriptions

The following figures should be prepared for the patent filing. Descriptions are provided for an illustrator or diagram tool.

### Figure 1: System Architecture Diagram
High-level block diagram showing client application, three creation paths, profile extraction layer, context/prompt builders, local storage, and server-side API routes with their respective AI models. (See §7 text diagram)

### Figure 2: Dual-Channel Generation Flow
Data flow diagram showing a single recipient profile branching into two parallel channels — message generation (LLM) and image generation (image model) — with the profile data feeding both. Show the extraction step, context string construction, and the two API calls with their outputs.

### Figure 3: Age-Band Inference Decision Tree
Flowchart showing: (1) check for exact birthday → compute age, (2) check for stored age band, (3) check sender age + relationship → inference formula table, (4) no data available. Each branch leads to the age band value that propagates to the three calibration layers.

### Figure 4: Age-Band Calibration Matrix
Table/matrix showing the five age bands (rows) vs. three calibration targets (columns: message tone, image content, scene suggestions) with the specific rules applied at each intersection.

### Figure 5: Accumulative Scene Refinement Sequence
Sequence diagram showing: User → initial prompt → image generated → user requests change → merge API called with full prompt + change → merged prompt returned → user reviews/edits → new image generated from merged prompt → (loop). Show the running description growing/evolving across three refinement rounds.

### Figure 6: Multi-Path Convergent Pipeline
Diagram showing three entry paths (Circle, Quick Card, Moments) with their distinct data collection UIs, converging at the shared step flow. Highlight the different data volumes at each entry point and the shared generation pipeline.

### Figure 7: Profile Checkpoint Interface
Annotated screenshot or wireframe of the "What Nuuge knows" checkpoint showing: relationship chip, occasion chip, age band selector, couple checkbox, occasion extras, and profile element toggle pills. Annotate which elements are user-adjustable vs. read-only.

### Figure 8: Creation Step Flow
Complete step-by-step flow from occasion selection through delivery, with branches for BYOM vs. AI-generated, baked vs. overlay front text, and optional letter insert. Show the stage groupings (Message, Design, Details, Deliver).

### Figure 9: Profile Element Toggle Map
Diagram showing profile data fields being extracted into categorized toggle keys (interest-like vs. tone-like), with the progressive de-emphasis behavior on regeneration attempts.

### Figure 10: Card Format Selector and Step Gating
Diagram showing three card format options (Classic, Greeting, Joke/Punchline) with branching arrows to their respective step sequences. Highlight which steps are shared across formats and which are format-specific. Show how the format selector gates the pipeline.

### Figure 11: Coordinated Joke Concept Generation
Sequence diagram showing: (1) Profile + occasion data sent to joke concept API, (2) Three coordinated concepts returned (each with setup, punchline, front image prompt, inside image prompt), (3) User selects concept, (4) Front image generated from front prompt, (5) Inside image generated from inside prompt with visual continuity directives, (6) Assembled card with setup+image on front and punchline+image on inside. Show the coordination linkage between the two image prompts.

### Figure 12: Greeting Format vs. Classic Format Flow Comparison
Side-by-side flow diagrams comparing Classic format (message inside, front image + optional text) with Greeting format (message baked into front image, blank inside). Highlight the steps that are skipped in Greeting format and the modified front text step that becomes the primary message.

---

## 10. Claim Drafts

*Note: These are preliminary claim drafts for attorney review. A patent attorney should refine claim language, scope, and dependent claim structure.*

### Utility Patent — Independent Claims

**Claim 1 (Dual-Channel Generation)**:
A computer-implemented method for generating personalized greeting card content, comprising:
(a) receiving, from a data store, a recipient profile comprising a plurality of personality attributes including at least personality traits, interests, and relationship type;
(b) extracting, by a processor, a set of profile elements from said recipient profile into a structured element map;
(c) constructing a first context string from said element map for input to a text generation model;
(d) constructing a second prompt string from said element map for input to an image generation model;
(e) transmitting said first context string to a large language model to generate at least one personalized message text reflecting said personality attributes;
(f) transmitting said second prompt string to an image generation model to generate at least one personalized image reflecting said personality attributes;
wherein steps (e) and (f) consume data derived from the same stored recipient profile such that the generated message text and generated image are both calibrated to the personality characteristics of the same recipient.

**Claim 2 (Age-Band Inference)**:
A computer-implemented method for generating age-appropriate content for a greeting card recipient, comprising:
(a) determining, by a processor, that exact age data for a recipient is unavailable;
(b) receiving a sender age and a relationship type characterizing the relationship between a sender and said recipient;
(c) computing an inferred age value by applying a relationship-specific formula to said sender age, wherein said formula is selected from a predefined set of formulas indexed by relationship type;
(d) mapping said inferred age value to one of a plurality of predefined age bands;
(e) presenting said mapped age band to the user via a checkpoint interface for confirmation or adjustment;
(f) applying said confirmed age band to calibrate at least two of: (i) message tone generation, (ii) image content generation, and (iii) scene suggestion filtering;
wherein the calibration of each target is performed using band-specific rules that differ across at least three of the plurality of age bands.

**Claim 3 (Accumulative Scene Refinement)**:
A computer-implemented method for iteratively refining a visual scene description for image generation, comprising:
(a) maintaining, in a computer memory, a running scene description comprising a structured text prompt with labeled sections including at least a scene section and an art style section;
(b) receiving a user change request describing a desired modification to the scene;
(c) transmitting, to a language model, said running scene description and said change request with instructions to merge the change into the scene section while preserving the structure of remaining sections;
(d) receiving from said language model a merged scene description that integrates said change into a coherent rewrite of the scene section;
(e) presenting said merged scene description to the user for review and optional editing;
(f) upon user confirmation, generating a new image from said merged scene description using an image generation model;
(g) storing said merged scene description as the new running scene description for subsequent refinement iterations;
wherein each refinement iteration operates on the output of the previous iteration, accumulating changes without loss of prior context.

### Design Patent — Claims

**Claim 4 (Multi-Path Convergent UI)**:
The ornamental design of a graphical user interface for a greeting card creation application, as shown and described, comprising: a home screen displaying three visually distinct creation path options; each path presenting a unique data collection interface; all paths converging into a shared step-by-step generation flow with consistent visual design.

**Claim 5 (Profile Checkpoint UI)**:
The ornamental design of a graphical user interface for reviewing AI-consumed profile data, as shown and described, comprising: a checkpoint panel displaying relationship and occasion indicators as chip elements; an age band selector with selectable buttons; toggleable profile element pills organized by category; and occasion-specific metadata fields that appear conditionally.

**Claim 6 (Format-Driven Adaptive Pipeline)**:
A computer-implemented method for generating greeting card content with variable content structures, comprising:
(a) presenting, via a user interface, a plurality of card format options, each format defining a content distribution pattern between a front surface and an inside surface of a greeting card;
(b) receiving a user selection of a card format from said plurality;
(c) dynamically determining, based on said selected format, which steps of a multi-step creation pipeline are presented to the user, which steps are suppressed, and what prompt structure is used for AI content generation;
(d) invoking one or more AI generation endpoints with prompt structures adapted to said selected format;
wherein the same underlying profile data, age calibration, and scene refinement infrastructure serves all formats, and the format selection controls the generation recipe without requiring separate codepaths or duplicate generation engines.

**Claim 7 (Coordinated Multi-Image Humor Generation)**:
A computer-implemented method for generating a humor-based greeting card, comprising:
(a) receiving occasion, tone, and recipient profile data;
(b) transmitting said data to a language model with instructions to generate a coordinated joke concept comprising: a setup line, a punchline, a front image description illustrating the setup, and an inside image description illustrating or reinforcing the punchline;
(c) receiving from said language model a plurality of coordinated joke concepts, each concept being a matched set of textual and visual elements designed to deliver humor across two card surfaces;
(d) upon user selection of a concept, generating a first image from said front image description and a second image from said inside image description, wherein both images share art style and visual continuity directives to ensure they appear as a coordinated pair;
(e) assembling the setup line and first image on the card front, and the punchline and second image on the card inside;
wherein the joke concept generation is personalized using the same stored recipient profile data that drives standard message and image generation, including profile-derived humor calibration based on recipient humor tolerance and age band.

---

## 11. Source Code References

The following source files contain the implementation of the claimed inventions. Line numbers are approximate and may shift with future edits.

| Component | File Path | Key Functions/Sections |
|-----------|-----------|----------------------|
| Profile element extraction | `src/app/cards/create/[recipientId]/page.tsx` | `extractProfileElements()` (lines ~714–731) |
| Context string construction | `src/app/cards/create/[recipientId]/page.tsx` | `buildContextString()` (lines ~761–829) |
| Progressive de-emphasis | `src/app/cards/create/[recipientId]/page.tsx` | Regeneration logic (lines ~904–922) |
| Image prompt construction | `src/lib/card-recipes.ts` | `buildUserFacingPrompt()`, `getFilteredSketches()` |
| Age band types & inference | `src/lib/occasions.ts` | `AgeBand`, `AGE_BAND_LABELS`, `inferAgeBand()` |
| Age calibration (messages) | `src/app/api/generate-card/route.ts` | `contextSafetyInstruction` block |
| Age calibration (images) | `src/lib/card-recipes.ts` | `ageGuidance` in `buildUserFacingPrompt()` |
| Scene merge API | `src/app/api/merge-scene/route.ts` | Full route handler |
| Scene refinement state | `src/app/cards/create/[recipientId]/page.tsx` | `currentSceneDescription`, `pendingSceneDescription`, `requestRefinement()` |
| Quick card path | `src/app/cards/create/quick/page.tsx` | `QuickRecipientData`, `saveQuickRecipient()` |
| Moments/Share path | `src/app/cards/create/share/page.tsx` | `extractSenderProfileElements()`, `buildSenderContext()` |
| Profile checkpoint UI | `src/app/cards/create/[recipientId]/page.tsx` | "What Nuuge knows" section (lines ~2034–2140) |
| Message generation API | `src/app/api/generate-card/route.ts` | Full route handler |
| Image generation API | `src/app/api/generate-image/route.ts` | Full route handler |
| Data types | `src/types/database.ts` | `Card`, `Recipient`, `UserProfile`, `PersonProfile` |

---

## 12. Prior Art Distinctions

| Feature | Nuuge (This Invention) | Closest Prior Art | Distinction |
|---------|----------------------|-------------------|-------------|
| Profile-driven generation | Single stored profile drives both message AND image | Hallmark: template text; various apps: AI message from prompt only | Dual-channel from unified profile is novel |
| Age inference | Derives age from sender age + relationship formula; maps to calibration bands | No known prior art for relationship-based age inference in card generation | Both the inference method and three-layer calibration are novel |
| Scene refinement | AI merges change into running structured prompt; accumulative | DALL-E edit: pixel-level; Midjourney: prompt replacement | Structured merge preserving context across iterations is novel |
| Multi-path convergence | Three entry points with different data levels → same pipeline | Most card apps: single creation flow | Convergent architecture serving varying personalization depth is distinctive |
| Profile checkpoint | Shows user what AI "knows" before generation; toggleable elements | No known equivalent in card generation | Transparency + correction gate before AI generation is distinctive |
| Progressive de-emphasis | Automatically reduces profile influence on regeneration | No known equivalent | Systematic variety generation by deactivating profile elements is novel |
| Format-driven adaptive pipeline | Card format selection reshapes which steps appear, what is generated, and how content maps to card surfaces | Template platforms: fixed layouts selected at start; AI tools: single generation mode | Format as a pipeline control (not just a layout) that adapts AI generation behavior is novel |
| Coordinated multi-image humor | AI generates matched setup/punchline with coordinated front + inside images as a single concept | Joke generators: text-only; Card tools: single image; No known system generates coordinated front/inside visual humor | Coordinated quad output (setup line + punchline + two linked images) from profile-driven humor generation is novel |

---

## Appendix: Recommended Next Steps

1. **Prior art search**: Engage a patent search firm to search USPTO, EPO, and WIPO databases for related filings from Hallmark, Shutterfly, Canva, Moonpig, Adobe, and AI startups.

2. **Provisional filing**: File provisional applications for Claims 1–3 and 6–7 (utility) to establish priority date. The 12-month provisional window allows time for full prosecution. Claims 6–7 (format-driven pipeline, coordinated humor generation) are described as planned features with detailed specifications — consult with attorney on whether to file these as part of the initial provisional or as a continuation once implemented.

3. **Design patent applications**: File separate design patent applications for Claims 4–5, including annotated screenshots of the actual UI.

4. **Screenshot capture**: Before any significant UI changes, capture timestamped screenshots of all checkpoint, creation flow, and home page interfaces for design patent filings.

5. **Git history preservation**: The git repository contains dated commits establishing conception and reduction to practice for all claimed features. Ensure this history is preserved and backed up.

6. **Inventor declaration**: Confirm all persons who contributed to the conception of the claimed inventions.

---

*This document is prepared as an invention disclosure for patent attorney review. It is not a legal document and does not constitute a patent application. All claim language is preliminary and subject to attorney revision.*
