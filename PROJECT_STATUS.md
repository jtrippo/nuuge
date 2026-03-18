# Nuuge — Project Status

> **Purpose:** Context file for AI assistants. Read this when starting a fresh conversation to understand current state.
> **Last updated:** Feb 17, 2026

---

## TL;DR

Nuuge is a greeting-card app (Next.js, Vercel). Users create personalized AI-generated cards, send as e-cards, or print at home. Data lives in localStorage + IndexedDB (no accounts yet). The app is deployed at https://nuuge.vercel.app.

**Most recent work:** Fixed print preview / e-card font sync. All three views (print, view e-card, shared) now use identical text box proportions and container-relative font sizing — **verified working.**

---

## Key File Paths

| Path | Purpose |
|------|---------|
| `src/app/cards/print/[cardId]/page.tsx` | Print preview, text size dropdown, print-to-PDF. Uses `cqw` font sizing, `container-type: inline-size` on `.card-panel`. |
| `src/app/cards/view/[cardId]/page.tsx` | E-card view (tap to open). Same `cqw` + percentage padding as print. |
| `src/app/share/[shareId]/SharedCardViewer.tsx` | Shared link viewer. Same layout/sizing as view page. |
| `src/app/cards/edit/[cardId]/page.tsx` | Edit existing cards. Has preview (uses different sizing — see backlog). Navigation buttons call `handleSave()` before routing. |
| `src/app/cards/create/[recipientId]/page.tsx` | Card creation wizard. Saves `msg_font_scale`, `ft_font_scale`, etc. on completion. |
| `src/lib/card-ui-helpers.ts` | Shared: `messageSizing()`, `msgSizeOptions()`, `fontCSS()`, `maxMsgScale()`, accent helpers. |
| `LAUNCH_ARCHITECTURE.md` | Long-term launch plan: auth, billing, print fulfillment, migration path. |

---

## Font / Text Box Architecture (Current, Working)

**Problem solved:** Print preview, e-card view, and shared viewer were showing different text wrapping because:
1. Padding was fixed `rem` on view vs percentage on print → different text area widths
2. Font sizing was `rem` on print vs `cqw` on view → different scaling

**Fix in place:**
- **Message container padding:** `8% 10%` (default) or `6% 4%` (left/right images) on all three: print, view, SharedCardViewer
- **Font sizing:** `cqw` units with `remToCqw(rem, scale) = parseFloat(rem) * scale * 3.81 + "cqw"` on all three
- **Container:** `container-type: inline-size` on `.card-panel` (print) and `.ecard-panel` (view/share)

**Navigation:** Print page and edit page use `window.location.href` (not `router.push`) when navigating to view/print/edit so the destination page loads fresh from localStorage — avoids Next.js client cache showing stale data.

---

## Data & Persistence

- **Cards:** `localStorage` (metadata) + IndexedDB (base64 images via `image-store.ts`)
- **Recipients:** `localStorage`
- **Shared cards:** Supabase `shared_cards` table (server-side)
- **No auth yet** — all local; backup/restore exists at `/backup`

---

## Backlog (from LAUNCH_ARCHITECTURE.md)

Planned improvements not yet built:

1. **My News** — Sender-centric announcement cards (one card, multiple recipients)
2. **Image Library** — Reuse AI-generated images across cards
3. **Occasion Picker redesign** — Cleaner layout, less pill clutter
4. **Edit page preview** — Currently uses hardcoded `clamp()` font sizes, doesn’t respect Text size dropdown; could be updated to match print/view
5. **Cross-account card copy** — Preserve decoration metadata (low priority)

---

## Deploy

```bash
npm run build
npx vercel --prod
```

Production: https://nuuge.vercel.app
