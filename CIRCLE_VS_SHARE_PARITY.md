# Circle vs Share (Moments) — Full Parity Comparison

> **Circle** = `/cards/create/[recipientId]/page.tsx` (~3480 lines)
> **Share** = `/cards/create/share/page.tsx` (~1467 lines)
> Shared prompt logic: `src/lib/card-recipes.ts`

---

## 1. Step Definitions

| Circle Step | Share Step | Notes |
|-------------|-----------|-------|
| `occasion` | `category` | Different by design (occasion picker vs news category) |
| `faith` | — | Circle has faith toggle inline on occasion step; Share omits |
| `tone` | `tone` | Circle: 9 tones. Share: 6 tones (no Romantic, Funny, Sarcastic) |
| `notes` | `notes` | See §3 for differences |
| `generating` | `generating` | Same |
| `select` | `select` | See §4 for differences |
| `preview` | `preview` | Same structure |
| `design_subject` | `design_subject` | See §5 — personal touch section differs |
| `design_style` | `design_style` | Both in Step type but unused (combined into design_subject) |
| `design_confirm_prompt` | `design_confirm_prompt` | See §6 — prompt building differs |
| `design_loading` | `design_loading` | Same |
| `design_generating` | `design_generating` | Same |
| **`design_confirm_refinement`** | **—** | **Share missing.** Circle has merge-scene → confirm → regenerate |
| `design_preview` | `design_preview` | **Major gap.** See §7 |
| `inside_design_ask` | `inside_design_ask` | **Major gap.** See §8 |
| `inside_position_pick` | `inside_position_pick` | Circle: inside banner flow. Share: always goes here |
| `inside_design_loading` | `inside_design_loading` | Same |
| `inside_design_pick` | `inside_design_pick` | **Gap.** See §9 |
| `inside_design_generating` | `inside_design_generating` | Same |
| `inside_design_preview` | `inside_design_preview` | **Gap.** See §10 |
| **`inside_confirm_refinement`** | **—** | **Share missing.** Circle has merge-scene for inside |
| `front_text_loading` | `front_text_loading` | Same |
| `front_text` | `front_text` | **Major gap.** See §11 |
| `letter` | `letter` | See §12 |
| `delivery` | `delivery` | Different by design |
| `saved` | `saved` | Different by design |

---

## 2. State Variables

### Circle has, Share doesn't

| Variable | Purpose |
|----------|---------|
| `imageInterests` | Recipient interests used for image prompt personalization |
| `previousImageUrl` | For "Revert to previous image" on design_preview |
| `previousSceneDescription` | For revert |
| `designFeedback` | "Want to change something?" input on design_preview |
| `merging` | Loading state for merge-scene API |
| `selectedInsideConcept` | Stores which inside concept was picked |
| `previousInsideImageUrl` | For "Revert" on inside_design_preview |
| `insideSceneDescription` | Tracks the inside image prompt for refinement |
| `insideDesignFeedback` | "Want to change something?" input for inside |
| `insideMerging` | Loading state for inside merge-scene |
| `pendingInsideScene` | Merged scene for inside_confirm_refinement |
| `pendingChangeType` | "refine" vs "redesign" from merge-scene |
| `pendingEditInstruction` | Edit instruction from merge-scene |
| `decorationType` | "banner" vs "accent" choice |
| `accentStyle` | "corner_flourish" / "top_edge_accent" / "frame" |
| `skipInsideDesign` | Explicit skip flag |
| `recipient` | Recipient object (Share has no recipient) |
| `includeFaithBased` | Faith-based toggle |
| `coSign` / signers | Co-signing / multi-signer |
| `TONE_TO_VISUAL` | Derived map for suggest-designs `preferredMood` |
| `sessionCost` | Running cost display |

### Share has, Circle doesn't

| Variable | Purpose |
|----------|---------|
| `newsCategory` | News category selection |
| `newsDescription` | User description of news |
| `shareUrl` / `sharing` | Share link generation |

---

## 3. Notes Step

### Circle
- Placeholder has multi-line suggestions ("Ideas: a recent trip, milestone, inside joke…")
- Shows "share to linked profiles" option for shared occasions
- Full **Envelope** section: "Going to" name, "Signed from" name, multi-signer checkboxes, group signature
- Profile pills: split into **Interests & details** (opt-in) and **Personality & style** (opt-out)
- Interests come from **recipient** profile

### Share
- Simpler placeholder ("e.g. mention the date, a special memory…")
- No envelope section
- No linked profiles / shared occasions
- Profile pills: same split structure, but comes from **sender** profile
- Uses `extractSenderProfileElements(profile)` instead of `extractProfileElements(recipient)`

### Gap: **Minor — intentionally different.** Share uses sender profile because there's no recipient.

---

## 4. Select Step

### Circle
- "Here are 3 options for {name}'s {occasion} card"
- Profile toggles with styled classes (`card-surface-clickable`, `bg-brand-light border-sage text-brand`)
- Back button styled as pill with SVG arrow

### Share
- "Here are 3 options for your {occasion} message"
- Profile toggles with inline styles
- Back and Regenerate as `btn-secondary` / `btn-primary`

### Gap: **Cosmetic only.** Functionality identical.

---

## 5. Design Subject Step

### Circle (lines 1822–2023)
1. Subject grid with ★ recommended, examples
2. Scene ideas (sceneSketches from card-recipes)
3. "Get more specific" input
4. Art style grid
5. **"Add a personal touch" section** (only when subject + style both selected):
   - **`imageInterests` pills** — "Which interests should influence the image?" (up to 3, from recipient's active profile interests)
   - **`personalContext` textarea** — "Anything else for the image?" with descriptive placeholder
6. "Review card design" button

### Share (lines 983–1113)
1. Subject grid with ★ recommended, examples ✅
2. Scene ideas ✅
3. "Get more specific" input ✅
4. Art style grid ✅
5. **No "Add a personal touch" section** — no `imageInterests` pills, no `personalContext` textarea (state exists but no UI)
6. "Review card design" button ✅

### Gap: **Share missing imageInterests pills and personalContext textarea.** Share could use sender's interests instead of recipient's. The `personalContext` state variable exists in Share but has no UI to set it.

---

## 6. Design Confirm Prompt / Prompt Building

### Circle `buildImagePromptFromSelections()` (line 858)
```
buildUserFacingPrompt({
  subjectId, subjectDetail, tone, styleId,
  personalContext,
  profileInterests: imageInterests.length > 0 ? imageInterests : undefined,
  occasion
})
```
- Uses `imageInterests` (user-selected from recipient profile)
- Uses `personalContext` (user-typed)

### Share `buildImagePrompt()` (line 459)
```
buildUserFacingPrompt({
  subjectId, subjectDetail, tone, styleId,
  personalContext,
  profileInterests: profile?.interests,
  occasion
})
```
- Uses raw `profile?.interests` (not filtered, not user-selected)
- `personalContext` is always empty (no UI to set it)

### Circle `loadDesignSuggestionsBackground()` (line 800)
- Sends `pastDesignThemes` (previous cards for this recipient)
- Sends `preferredMood: TONE_TO_VISUAL[tone]`
- Sends `includeFaithBased`

### Share `reviewCardDesign()` (line 472)
- No `pastDesignThemes`
- No `preferredMood`
- No `includeFaithBased`
- Sends a generic `recipientContext` string about "no specific recipient"

### Gap: **Prompt building is weaker in Share.** Missing imageInterests selection, personalContext input, pastDesignThemes, and preferredMood.

---

## 7. Design Preview Step

### Circle (lines 2217–2337)
- Card front image
- **Card inside preview** (message text in a styled card)
- **Refinement input**: "Want to change something?" with description, input, "Request change" button
- **Revert button**: "← Revert to previous image" (when `previousImageUrl` exists)
- "Pick different design" (back to confirm_prompt)
- "Next: Inside & front text"
- Uses `requestRefinement()` → merge-scene API → `design_confirm_refinement` step

### Share (lines 1195–1209)
- Card front image only
- **No inside preview**
- **No refinement input**
- **No revert**
- "Pick different design" and "Continue" buttons only

### Gap: **Share is missing the entire design iteration loop.** No merge-scene, no refinement, no revert, no inside preview.

---

## 8. Inside Design Ask Step

### Circle (lines 2339–2608)
- Title: "Add an inside decoration?"
- **Two cards**: "Image banner" vs "Decorative accent" (with visual mini-diagrams)
- **Banner flow**: 6 positions (top, middle, bottom, left, right, **behind/watermark**) with visual icons showing placement
- Focus suggestion input
- "Suggest illustrations" button
- **Accent flow**: 3 styles (Corner flourish, Edge motif, Frame) with visual previews
- Corner: multi-position picker (4 corners)
- Edge: multi-position picker (top/bottom)
- Frame: no positions needed
- "Generate accent" button
- "Skip — no decoration" button

### Share (lines 1212–1237)
- Title: "Inside illustration?"
- Two plain buttons: "Yes, add one" / "Skip"
- No banner vs accent choice
- Goes directly to `inside_position_pick`

### Share `inside_position_pick` (lines 1239–1311)
- 6 positions: top, middle, bottom, left, right, **corner_flourish** (no behind, no visual icons)
- Focus suggestion input
- "Suggest illustrations" button

### Gap: **Share is missing the full inside design system.** No banner vs accent, no watermark ("behind"), no accent styles (corner, edge, frame), no slot pickers, no visual position diagrams.

---

## 9. Inside Design Pick Step

### Circle (lines 2612–2707)
- "Choose an inside decoration"
- Each concept shows a **strip preview** (cropped front image) alongside title/description
- Strip dimensions vary by position (horizontal, vertical, square)
- Crop positions cycle: "top left", "center", "bottom right", etc.
- "behind" shows at 15% opacity
- Stores `selectedInsideConcept` for later reference

### Share (lines 1314–1343)
- Same title
- **Text only** — title + description, no strip preview
- No `selectedInsideConcept` storage

### Gap: **Share missing strip preview.** Users can't visualize how each concept will look in the chosen position.

---

## 10. Inside Design Preview Step

### Circle (lines 2780–3000)
- Full card mockup showing image in position (top/bottom/middle/left/right/behind/corner/edge/frame)
- **Refinement input**: "Want to change something?" with "Request change" button
- **Revert button**: "← Revert to previous image"
- Uses `requestInsideRefinement()` → merge-scene API → `inside_confirm_refinement` step
- Position-specific rendering (behind=opacity, corner=slot-based, frame=border, edge=strips)
- "Pick different" or "Change style" back button

### Share (lines 1345–1355)
- Raw image display only
- "Continue" button
- No mockup, no refinement, no revert

### Gap: **Share missing card mockup, refinement loop, and revert.** Same as design_preview gap but for inside.

---

## 11. Front Text Step

### Circle (lines 3003–3197)
- Title: "Front text & font style"
- **Suggestions** with selection highlighting
- **"Suggest new options"** link (calls `loadFrontTextSuggestions()` again)
- Wording textarea (multi-line with Enter support)
- **Position select** dropdown (center, bottom-right, bottom-center, top-center, top-left, top-right, bottom-left)
- **Text style** options: Plain black, Plain white, Black/white outline, White/black outline
- **Text style preview** on gradient background with actual font rendering
- **Front cover font** picker (grid of all CARD_FONT_OPTIONS with live preview)
- **Inside message font** picker (separate grid)
- **Skip** button (clears front text)

### Share (lines 1357–1395)
- Title: "Front text (optional)"
- Suggestions with selection
- **No "Suggest new options"**
- Wording input (single-line `<input>`, not textarea)
- **No position select**
- **No text style options**
- **No text style preview**
- **No front cover font picker**
- **No inside message font picker**
- **No skip button**
- "Next" button only

### Gap: **Share is missing most of the front text features.** Position, text style, font pickers, "Suggest new options", and skip are all absent.

---

## 12. Letter Step

### Circle (lines 3200–3280)
- "Include a personal letter?"
- Detailed description copy
- Placeholder uses **recipient name**: "Dear {name},\n\n...\nWith love,\n{sender}"
- **Font selector** dropdown (CARD_FONT_OPTIONS)
- Letter text area with `fontCSS(letterFont)` applied
- Two states: empty (simple textarea) vs has-text (expanded view with font selector)

### Share (lines 1397–1410)
- "Personal letter? (optional)"
- Simple textarea
- Generic placeholder: "A short note tucked inside..."
- **No font selector**
- No conditional layout based on content

### Gap: **Share missing font selector and personalized placeholder.** Could use sender name in placeholder.

---

## 13. Functions / Helpers That Share Is Missing

| Circle Function | Purpose | Share equivalent |
|----------------|---------|------------------|
| `requestRefinement(change)` | merge-scene API → design_confirm_refinement | None |
| `requestInsideRefinement(change)` | merge-scene API → inside_confirm_refinement | None |
| `buildAccentPrompt(accent)` | Generates accent-specific prompts | None |
| `insideImageOrientation()` | Maps position to orientation (incl. frame, edge) | Simplified inline |
| `getActiveInterests()` | Returns imageInterests or recipient interests | None — uses `profile?.interests` directly |
| `loadDesignSuggestionsBackground()` | Loads concepts with pastDesignThemes + preferredMood | `reviewCardDesign()` — simpler version |
| `loadFrontTextSuggestions()` | Standalone function, callable for "Suggest new options" | Inline in `useEffect` (no re-call possible) |

---

## 14. INSIDE_POSITIONS Comparison

| Position | Circle | Share |
|----------|--------|-------|
| top | ✅ | ✅ |
| middle | ✅ | ✅ |
| bottom | ✅ | ✅ |
| left | ✅ | ✅ |
| right | ✅ | ✅ |
| **behind** (watermark) | ✅ | ❌ |
| **corner_flourish** | ✅ (accent) | ✅ (in positions list) |
| **top_edge_accent** | ✅ (accent) | ❌ |
| **frame** | ✅ (accent) | ❌ |

Circle separates banner positions (top–right + behind) from accent styles (corner, edge, frame).
Share lumps corner_flourish into the position list and has no accent system.

---

## 15. API Call Differences

| API | Circle | Share |
|-----|--------|-------|
| `generate-card` | Sends `recipientContext`, `includeFaithBased`, `relationshipType`, `cardHistory`, `coSignWith` | Sends `mode: "news"`, `senderContext`, `newsCategory`, `newsDescription` — no recipientContext |
| `suggest-designs` | Sends `pastDesignThemes`, `preferredMood`, `includeFaithBased` | Omits all three |
| `generate-image` | `editExisting` flag, `editInstruction`, `existingImageBase64` for refinement | No edit support |
| `merge-scene` | Used for design + inside refinement | Not used |
| `suggest-front-text` | Sends `recipientName`, `relationshipType` | Sends empty `recipientName: ""`, no `relationshipType` |
| `suggest-inside-designs` | Same | Same ✅ |

---

## 16. UI / UX Differences

| Feature | Circle | Share |
|---------|--------|-------|
| Progress bar (stages) | ✅ 4-step progress: Message → Design → Details → Deliver | ❌ None |
| Session cost display | ✅ Shows `~$0.xx` | ❌ None |
| Back button style | Pill with SVG arrow | Mix of `btn-secondary` and pills |
| Edit mode | ✅ Full edit flow with `editCardId` | ❌ No edit mode |
| Card preview in header | ✅ Shows occasion + recipient name | Shows "Share a moment" |

---

## 17. Priority Ranking for Alignment

### Must-have (UX consistency)
1. **design_preview refinement** — "Request change", merge-scene, revert
2. **front_text** — Position select, text style, font pickers, "Suggest new options", skip
3. **design_subject personal touch** — imageInterests pills + personalContext textarea
4. **inside_design_ask** — Banner vs accent, visual position diagrams, behind/watermark

### Should-have
5. **inside_design_pick** — Strip preview
6. **design_confirm_refinement** step — Confirm merged prompt before regenerating
7. **inside_design_preview** — Card mockup + refinement + revert
8. **inside_confirm_refinement** step
9. **Prompt building** — pastDesignThemes, preferredMood, imageInterests in buildImagePrompt

### Nice-to-have
10. Progress bar (stages)
11. Letter font selector + personalized placeholder
12. Session cost display
13. Front text loading as standalone function (for re-call)
