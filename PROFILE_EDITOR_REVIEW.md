# Profile Editor — Redesign Complete

> Snapshot document capturing the profile editor redesign. Original analysis and decisions preserved below; implementation status updated.

---

## Architecture Overview

- **`PersonProfile` interface** (`src/types/database.ts`): Shared base for both users and recipients
- **`Recipient` interface**: Extends `PersonProfile` with recipient-specific fields
- **`ProfileEditor` component** (`src/components/ProfileEditor.tsx`): Generic editor for `PersonProfile` fields — used on both user profile and recipient detail pages
- **Recipient-specific fields** (relationship, humor tolerance, important dates, milestones): Edited on the recipient detail page (`src/app/recipients/[id]/page.tsx`), not via `ProfileEditor`

---

## Current Field Inventory

### PersonProfile Fields (shared, via ProfileEditor)

| Field | Label in UI | Type | Current Hint | AI Usage |
|-------|-------------|------|-------------|----------|
| `display_name` | Display name (for salutations) | text | None | UI only — AI sees `name` from Recipient |
| `first_name` | First name | text | None | Not sent to AI |
| `last_name` | Last name | text | None | Not sent to AI |
| `nickname` | Nickname | text | None | Not sent to AI |
| `birthday` | Birthday | text | None | Used to calculate age for AI context |
| `personality` | Personality | textarea | None | Maps to `personality_notes` on save — IS sent to AI |
| `humor_style` | Humor style | text | None | Sent via profile element picker |
| `interests` | Interests | tags | "(comma-separated)" | Sent via element picker + used for image generation |
| `values` | Values | tags | "(comma-separated)" | Sent via element picker (when selected) |
| `occupation` | Occupation | text | None | Sent via element picker (when selected) |
| `location` | Location | text | None | **Not sent to AI** |
| `lifestyle` | Lifestyle / stage of life | textarea | None | Sent via element picker (when selected) |
| `pets` | Pets | text | None | Sent via element picker (when selected) |
| `children` | Children | text | None | **Not sent to AI** |
| `favorite_foods` | Favorite foods | text | None | Sent via element picker (when selected) |
| `favorite_music` | Favorite music | text | None | Sent via element picker (when selected) |
| `favorite_movies_tv` | Favorite movies / TV | text | None | **Not sent to AI** |
| `favorite_books` | Favorite books | text | None | **Not sent to AI** |
| `dislikes` | Dislikes / things to avoid | text | None | **Not sent to AI** |
| `communication_style` | Communication style | text | None | **Not sent to AI** (used for *sender* context only) |
| `emotional_energy` | Emotional energy | text | None | **Not sent to AI** (used for *sender* context only) |
| `mailing_address` | Mailing address | textarea | None | **Not sent to AI** — future mail fulfillment only |
| `email` | Email | text | None | **Not sent to AI** — contact info only |
| `notes` | Additional notes | textarea | None | **Not sent to AI** |

### Recipient-Only Fields (edited on recipient detail page)

| Field | Label in UI | Type | AI Usage |
|-------|-------------|------|----------|
| `name` | (header) | text | **Always sent** — the primary name the AI uses |
| `relationship_type` | Relationship | dropdown | **Always sent** — core to tone/style |
| `personality_notes` | Personality traits | text | **Always sent** (via element picker or fallback). Aliased as `personality` in ProfileEditor. |
| `humor_tolerance` | Humor tolerance | dropdown | **Always sent** (via element picker or fallback) |
| `tone_preference` | — | — | Stored but **never sent to AI** |
| `important_dates` | Important dates | structured list (label, date, recurring toggle) | Used only for age calculation (birthday extraction) |
| `milestones` | Milestones | comma-separated text | **Not sent to AI** |
| `age_band` | — | — | Fallback age context when birthday unknown |
| `context_raw` | — | — | **Not sent to AI** |

---

## How Context Reaches the AI

### Message Generation (`/api/generate-card`)

The `buildContextString()` function (in `src/app/cards/create/[recipientId]/page.tsx`) constructs two blocks:

**Sender context** (from `UserProfile`):
- `display_name`, `personality`, `communication_style`, `emotional_energy`, `humor_style`, `lifestyle`

**Recipient context** — three modes:

1. **With profile elements selected** (normal flow): `name`, `relationship_type`, age, checkpoint data, selected interests, and whichever of these the user toggled on: `personality_notes` traits, `humor_style`, `humor_tolerance`, `occupation`, `lifestyle`, `pets`, `favorite_foods`, `favorite_music`, `values`

2. **No elements selected** (user unchecked all): `name`, `relationship_type`, age, checkpoint data, and a note saying "no specific profile details selected"

3. **Fallback** (polish/refine, no element picker): `name`, `relationship_type`, age, `personality_notes`, `interests`, `humor_tolerance`

### `extractProfileElements()` — What Gets into the Element Picker (current)

- `interests` (as `interest: X`)
- `values` (as `value: X`)
- `personality_notes` (split on commas, as `personality: X`)
- `humor_style` (as `humor style: X`)
- `humor_tolerance` (as `humor tolerance: X`)
- `occupation` (as `occupation: X`)
- `lifestyle` (as `lifestyle: X`)
- `pets` (as `pets: X`)
- `favorite_foods` (as `favorite foods: X`)
- `favorite_music` (as `favorite music: X`)

**Not in the element picker (current):** `children`, `dislikes`, `notes`, `location`, `favorite_movies_tv`, `favorite_books`, `communication_style`, `emotional_energy`, `mailing_address`, `email`, `milestones`

### Image Generation (`buildRecipePrompt` / `buildUserFacingPrompt`)

Only receives: `relationship_type`, age/age_band, selected `interests`

### Front Text Suggestions (`/api/suggest-front-text`)

Only receives: `recipientName`, `relationshipType` (plus occasion, tone, art style, image subject)

---

## Settled Decisions

### Humor Fields

| Profile | Keep | Remove | Rationale |
|---------|------|--------|-----------|
| **Recipient** | `humor_tolerance` (passed to AI) | `humor_style` | Humor style only applies to the sender — not meaningful for recipients |
| **User** | `humor_style` (passed to AI as sender context) | `humor_tolerance` | The user is the sender, not a recipient |

### Recipient ProfileEditor Fields — Final List

#### KEEP (with hints/placeholders to add)

| Field | Hint | AI Status | Action Needed |
|-------|------|-----------|---------------|
| `first_name` | — | Not sent | None |
| `last_name` | — | Not sent | None |
| `nickname` | "e.g., Bear, Scooter, D" | Not sent | Add hint |
| `personality` | "e.g., Warm and thoughtful, adventurous, quiet but caring" | Sent (as `personality_notes`) | Add hint |
| `interests` | "e.g., Cooking, Hiking, Photography, Cars" | Sent + image gen | Add hint |
| `values` | "e.g., Family, Integrity, Adventure, Creativity, Faith" | Sent via picker | Add hint. Future: scroll wheel in onboarding. |
| `occupation` | "e.g., Teacher, Retired engineer, College student" | Sent via picker | Add hint |
| `lifestyle` | "e.g., Married with kids, Recently retired, Newlywed" | Sent via picker | Add hint |
| `pets` | "e.g., Dog named Max, Two cats" | Sent via picker | Add hint |
| `children` | "e.g., Emma (12), Liam (8)" | **Not sent yet** | Add hint + **wire into element picker** |
| `dislikes` | "Things to avoid in cards, e.g., Don't mention ex-spouse, no age jokes" | **Not sent yet** | Relabel to "Things to avoid in cards" + add hint + **wire into element picker as guardrail** |
| `mailing_address` | "Street, City, State, ZIP" | Not sent (mail fulfillment) | Fix pipe separator display. Future: structured fields + multiple addresses. |
| `email` | "name@example.com" | Not sent (contact) | Add hint |
| `notes` | "Anything else that helps Nuuge know this person better" | **Not sent yet** | Add hint + **wire into element picker** |

#### REMOVE from Recipient ProfileEditor

| Field | Reason | Data Action |
|-------|--------|-------------|
| `birthday` | Redundant — covered by important dates "Birthday" entry | **Migrate** existing birthday values to important dates entry, then remove field |
| `location` | Redundant — covered by mailing address | Delete stored data |
| `humor_style` | Only relevant to sender (user), not recipient | Delete stored data |
| `favorite_foods` | Not used by AI, low value | Delete stored data. Also remove from element picker. |
| `favorite_music` | Not used by AI, low value | Delete stored data. Also remove from element picker. |
| `favorite_movies_tv` | Not used by AI, low value | Delete stored data |
| `favorite_books` | Not used by AI, low value | Delete stored data |
| `communication_style` | Only used for sender context, not recipient | Delete stored data |
| `emotional_energy` | Only used for sender context, not recipient | Delete stored data |
| `display_name` | Already excluded from recipient editor via `excludeFields` | No change needed |

#### REMOVE from Recipient-Only Fields

| Field | Reason | Data Action |
|-------|--------|-------------|
| `milestones` | Redundant with important dates | Delete stored data |
| `tone_preference` | Never read by any code | Delete stored data |

### Important Dates UX Changes

1. Show label/date/recurring fields **by default** (not hidden until "Add date" is clicked)
2. Make "+ Add date" a **pill button** so it's visually obvious
3. Auto-migrate standalone `birthday` data into an important date entry labeled "Birthday"
4. Important dates section absorbs the milestones concept — no separate milestones field

### Element Picker Expansion

Add to `extractProfileElements()`:
- `children` (as `children: X`) — for family warmth in messages
- `dislikes` (as `things to avoid: X`) — as AI guardrail
- `notes` (as `additional context: X`) — free-form user context

Remove from `extractProfileElements()`:
- `favorite_foods` — field is being removed
- `favorite_music` — field is being removed

### User Profile Adjustments

- Keep `humor_style`, remove `humor_tolerance`
- Keep `communication_style` and `emotional_energy` (these ARE used for sender context)
- Otherwise same removals as recipient (location, favorites, etc.)

---

## Implementation Status

All items completed and deployed on March 19, 2026.

| Step | Status | Details |
|------|--------|---------|
| 1. Trim fields | **Done** | Removed `birthday`, `location`, `favorite_foods`, `favorite_music`, `favorite_movies_tv`, `favorite_books` from `PERSON_PROFILE_FIELDS`. Hid `humor_style`, `communication_style`, `emotional_energy` from recipient via `excludeFields`. |
| 2. Add hints/placeholders | **Done** | Added `placeholder` property to `PERSON_PROFILE_FIELDS` type. All remaining fields have contextual hints. `ProfileEditor` wired to use them. |
| 3. Wire new fields to AI | **Done** | Added `children`, `things to avoid` (dislikes), `additional context` (notes) to `extractProfileElements()`. Removed `favorite_foods`, `favorite_music`, `humor_style` from recipient picker. Updated `isInterestLikeKey`/`isToneLikeKey` classifications. Applied to both Circle and Share create paths. |
| 4. Birthday migration | **Done** | `getRecipients()` in `store.ts` auto-migrates `birthday` → Important dates entry on first load. `saveRecipient()` no longer syncs birthday from important dates. |
| 5. Important dates UX | **Done** | Milestones editing/view UI removed from recipient detail page. "+ Add date" button styled as pill. Humor tolerance field has placeholder hint. |
| 6. Mailing address | **Done** | Pipe-separated values converted to commas in edit buffer. Structured fields + multiple addresses remain future work. |

### Remaining Future Work

- **Data cleanup script**: Stored data for removed fields still exists in localStorage (harmless but unnecessary). A cleanup migration could be added to `getRecipients()` if desired.
- **Structured mailing address**: Replace freeform textarea with structured fields (street, city, state, ZIP) and support multiple addresses with a default checkbox.
- **`humor_tolerance` removal from user profile**: `PERSON_PROFILE_FIELDS` no longer shows it, but it could be formally excluded from the user profile page.

---

*Document created: March 18, 2026*
*Decisions settled: March 18, 2026*
*Implementation completed: March 19, 2026*
