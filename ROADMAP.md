# Nuuge roadmap

Planned and under-consideration features, grouped by theme. Items are documented for prioritization; order does not imply commitment date.

---

## 1. AI content guardrails

**Goal:** Ensure generated content (messages and images) stays safe, legal, and on-brand. Reject or redirect requests that would produce harmful or infringing material.

**Behaviors:**

- **No sexually explicit material** — Even if the user requests it, the system must not generate sexually explicit text or imagery. Treat as a hard guardrail.
- **No copyright / trademark infringement** — Do not generate images (or text) that incorporate protected IP. Examples:
  - User says: “I want Woodstock on the birthday cake” (Snoopy character) → **reject** or **redirect**, e.g. “We can’t use that character, but we could create a yellow bird on a cake in your chosen style.”
  - Similar treatment for other licensed characters, logos, brand names, etc.
- **User-facing response** — When we block a request:
  - **Option A:** Explain that the input cannot be accepted (e.g. “We don’t generate sexually explicit content” or “We can’t use copyrighted characters”).
  - **Option B:** Where possible, suggest a **safe alternative** (e.g. “How about a yellow bird on a cake instead?”) so the user still gets a usable card.

**Scope:** Apply to both **message generation** (e.g. generate-card API) and **image generation** (e.g. generate-image, merge-scene, suggest-designs). Guardrails can live in prompt instructions, response filters, and/or a pre-check step that validates the user’s request before calling the model.

**Future:** More guardrails can be added later (e.g. violence, hate speech, deepfakes, etc.). This item is the foundation.

**Note:** Guardrails are important for trust and safety; consider prioritizing before or at launch rather than deferring long-term.

---

## 2. Local sights (location-based image suggestions)

**Goal:** For certain occasions (e.g. thank you, thinking of you), offer an option to use a **notable local landmark or “sight”** near the sender (e.g. within ~10 miles) as the basis for the card image, rendered in the user’s selected style.

**Example:**

- Sender’s zip: **08801**
- Nearby: a historic mill in the next town that is one of the most photographed sites in the state (e.g. Clinton Mill).
- Occasion: thank you or thinking of you.
- Flow: “Use a local sight” → system suggests “Clinton Mill” (or similar) within ~10 miles → image prompt becomes something like “Clinton Mill, [user’s chosen style]” so the card shows that place in the selected aesthetic.

**Mechanics (to be designed):**

- Store or derive sender’s location (e.g. zip code from profile or address).
- Use a source of notable/local points of interest (POIs) within a radius (e.g. 10 miles): public API, curated list per region, or partner data.
- In the card-creation flow, for eligible occasions, show an option like “Use a local landmark” and either suggest one or let the user pick from a short list.
- Pass the chosen sight (and style) into the existing image-generation path so we don’t invent new art; we only change the subject to the landmark.

**Eligible occasions:** Start with thank you and thinking of you; expand later if it resonates.

**Note:** Fits well as a post-MVP / roadmap feature once core flows and guardrails are solid. Depends on having a reliable way to get “sights” (API or curated data) and a clean UX for choosing them.

---

---

## 3. Retrieval of prior successful cards

**Goal:** When generating new content, reference what worked in the past — which messages, designs, and tones the user kept and sent — so quality improves over time.

**Behaviors:**

- Before generating messages, retrieve the user's sent cards for the same recipient (or same occasion/relationship type) and pass successful examples as "here's what landed before."
- Before suggesting designs, check prior cards for the same recipient to avoid repeating the same subject/style and to build on what resonated.
- Surface a "Cards you've sent to [person]" context panel during creation so the user can see history at a glance.

**Depends on:** Server-side card storage (Supabase migration).

---

## 4. User feedback loop on tone and outcomes

**Goal:** Close the loop between "card sent" and "how it landed" so the system learns what works for each relationship.

**Mechanics:**

- After sending/sharing a card, prompt the user (optionally, non-blocking) to rate how it landed: "Did this card hit the right tone?" with a simple thumbs up/down or 3-point scale.
- Store feedback per card, linked to recipient, occasion, and tone.
- Feed positive signals back into generation: "For Alyssa, heartfelt + touch of humor has worked well in the past."
- Use negative signals to adjust: "Sarcastic tone didn't land for Mom — suggest warmer options first."

---

## 5. Event-driven reminders

**Goal:** Proactively remind users about upcoming occasions so cards are sent on time, not after the fact.

**Mechanics:**

- Use important dates and milestones stored on recipient profiles.
- Send reminders at configurable lead times (e.g. 14 days, 7 days, 3 days before).
- Channels: in-app notification on dashboard, email (when email is implemented), push (future).
- Smart suggestions: "Alyssa's anniversary is in 10 days. Last year you sent a watercolor card — want to create this year's?"

**Depends on:** Email infrastructure, notification system.

---

## 6. Structured memory by relationship

**Goal:** Build a persistent, evolving memory layer for each relationship that accumulates across cards and interactions.

**What it captures:**

- Cards sent (occasion, tone, themes, feedback)
- Preferences learned ("Alyssa responds well to humor", "Mom prefers traditional")
- Conversation snippets and personal details mentioned during creation
- Relationship evolution (new milestones, life events)

**How it's used:**

- Pre-populate creation context: "Based on your history with Alyssa, we suggest a warm + playful tone."
- Avoid repetition: "You've used sunflowers in the last 2 cards for Alyssa."
- Deepen personalization over time — the 10th card for someone should feel more personal than the 1st.

---

## 7. Tool-driven image generation improvements

**Goal:** Expand the image generation pipeline with more control and variety.

**Potential improvements:**

- Style transfer: "Generate in the style of the card I sent last year"
- Photo integration: Use a recipient's photo as a reference for illustrated portraits
- Multi-panel generation: Generate front + inside as a coordinated pair in one pass
- Background removal / compositing for more flexible layouts

---

## 8. Approval workflow with versioning

**Goal:** For co-signers and shared cards, add a review/approval step with version history.

**Mechanics:**

- When a card has co-signers, send a preview link for review before finalizing.
- Each edit creates a version (message v1, v2, v3) so changes can be compared and reverted.
- Approval status tracked per co-signer.
- Version history accessible from the card edit page.

**Depends on:** Authentication, server-side storage.

---

## 9. Analytics on which outputs resonate

**Goal:** Aggregate data on what generation parameters produce cards that users keep, send, and rate positively.

**What to track:**

- Which tones, art styles, and subjects lead to cards being sent vs. abandoned
- Regeneration frequency by parameter combination (high regen = bad fit)
- Front text acceptance rate (kept suggestion vs. custom)
- Time-to-completion by flow path
- Per-relationship quality trends

**What to surface:**

- Internal dashboard for product decisions (which recipes work, which don't)
- User-facing insights: "Your most-used style: Watercolor. Try Minimalist?"
- Feed learnings back into default suggestions and recipe weighting

**Depends on:** Usage logging (already capturing data), server-side analytics storage.

---

*Last updated: roadmap expanded with AI architecture layer improvements — retrieval, feedback loops, reminders, structured memory, image generation, approval workflows, and analytics.*
