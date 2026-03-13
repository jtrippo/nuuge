# Nuuge — MVP Readiness Assessment

**Date:** February 17, 2026  
**Assessed by:** Development team  
**App version:** Pre-release (local-first, no auth)

---

## Executive Summary

Nuuge is a personal greeting card creation app that helps users write and design cards that reflect their real relationships. The core creation, editing, printing, and e-card viewing flows are fully functional. The app runs as a Next.js application deployed to Vercel, using OpenAI for text and image generation, with all user data stored locally in the browser.

**Bottom line:** The app is at MVP for a *personal-use / demo release* — one user creating cards on their own device. It is **not yet ready** for a multi-user public launch due to the absence of authentication, server-side persistence, shareable e-card URLs, and abuse controls.

---

## What's Built

### Card Creation Flow (Complete)
- Multi-step wizard: occasion selection, tone, personal context, message generation
- AI-generated messages via GPT-4o with sender/recipient personality context
- Message regeneration with "try again" and alternative suggestions
- Design concept generation (3 Nuuge-suggested alternatives + user's own)
- Image generation via OpenAI gpt-image-1 (1024x1024, 1024x1536)
- Inside illustration selection with position control (top, bottom, full)
- Front text suggestions with font, size, and position customization
- Optional personal letter insert with font and size controls
- Draft auto-save to localStorage with resume capability
- Stale draft cleanup when a card is completed

### Card Editing (Complete)
- Edit message, front text, letter, and all font sizes
- Auto-save when navigating to print preview or e-card view
- "Create card" link to start fresh for the same recipient

### Print Preview (Complete)
- Three card sizes: 4x6, 5x7, 8.5x11
- Front + back on page 1, inside message on page 2, optional letter insert on page 3
- Letter insert with two-column layout, left-aligned, flowing left-to-right
- Font size controls for message, front text, and letter
- Duplex printing support with instructions and PDF workaround tip
- Print CSS with proper page breaks and landscape orientation

### E-Card Viewer (Complete)
- Animated envelope-opening experience (envelope → front → inside → letter)
- Responsive sizing (scales to device with min(90vw, 420px))
- Front text and inside message formatting matches print preview settings
- Letter displayed in scrollable, readable format with larger fonts
- Navigation between front, inside, and letter views
- Pill-button styled actions throughout

### People Management (Complete)
- Add, edit, and remove recipients with full profile data
- Profile fields: personality, interests, values, humor style, occupation, lifestyle, pets, children, favorites, dislikes, communication style
- Relationship types, important dates (recurring/one-time), milestones
- Link recipients to each other (spouse, parent, child, sibling, friend)
- Collapsible profile info on recipient detail page
- Circle of People dashboard with upcoming occasions and holidays

### User Profile & Onboarding (Complete)
- Multi-step onboarding collecting personality, writing style, interests
- Editable user profile (name, address, partner, preferences)
- Onboarding history tracked for context

### Dashboard / Home Page (Complete)
- Landing page for new users with hero, how-it-works, and CTAs
- Coming Up section: personal occasions and holidays within 30 days
- In-progress drafts section with resume/delete
- People in your circle with next-event indicators
- Usage stats modal (API calls, cost estimates, per-card breakdown)
- Nuuge AppHeader with account menu across all pages

### Data Management (Complete)
- Full backup/restore: exports profile, recipients, cards, images, usage as JSON
- Image storage: small images in localStorage, large (>50KB) in IndexedDB
- Image hydration on load for display
- Reset functionality for profile and recipients
- Seed data for development/testing

### UI/UX Consistency (Complete)
- Pill button styling applied across all pages and actions
- Design system: color tokens (cream, sage, charcoal, warm-gray, brand, error)
- Font system: heading, body, handwritten
- Card-surface component pattern
- Responsive layouts with Tailwind breakpoints

---

## Architecture Summary

```
Browser (Client)
├── Next.js App Router (React)
├── localStorage → profiles, recipients, cards, drafts
├── IndexedDB → large images, usage events
└── Tailwind CSS + CSS custom properties

Vercel (Server)
├── Next.js API Routes
├── OpenAI GPT-4o → text generation (messages, suggestions, chat)
├── OpenAI gpt-image-1 → card illustrations
└── No database — all persistence is client-side
```

### Key Dependencies
- Next.js 15 (App Router)
- React 19
- OpenAI Node SDK
- Tailwind CSS 4
- Deployed to Vercel

### Environment Variables Required
- `OPENAI_API_KEY` — required for all generation features
- `NEXT_PUBLIC_SUPABASE_URL` — configured but not yet used
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — configured but not yet used

---

## What's Missing — Categorized

### Must Have (Before Any Public Release)

| Item | Why It Matters |
|------|---------------|
| **Authentication** | Currently all data is stored locally with `user_id: "local"`. Anyone on the same browser shares the same data. No way to identify users for billing, support, or data recovery. Supabase client is configured but not wired up. |
| **Server-side persistence** | If a user clears their browser data, everything is gone — all cards, all profiles, all images. Manual backup exists but most users won't use it. Data needs to live in a database (Supabase is already stubbed). |
| **Shareable e-card URLs** | The e-card viewer only works locally (`/cards/view/[cardId]` reads from localStorage). There's no way to actually *send* someone an e-card. This is a core value proposition. Requires server-stored cards with public shareable links. |
| **Global error boundary** | If any React component crashes (e.g., bad data, null reference), the entire app goes white — no error message, no navigation, nothing. An error boundary is a React component that wraps the app and catches these crashes, showing a friendly "Something went wrong" message with a way to recover instead of a dead white screen. |
| **API key validation (gate)** | Currently, if the OpenAI API key is missing or invalid, the user only finds out after going through several steps of card creation — then they hit a red error. An API key gate checks on app load whether the key is working and shows a clear message upfront rather than letting users invest time in a flow that will fail. The `/api/health` endpoint exists but isn't used by the client. |

### Should Have (For a Quality MVP)

| Item | Why It Matters |
|------|---------------|
| **Rate limiting on API routes** | No throttling on any endpoint. A single user (or bot) could run up unlimited OpenAI costs. Basic rate limiting per IP or user session would prevent abuse. |
| **Loading/generation progress** | Image generation takes 10-30 seconds. Current UI shows a spinner but no progress indication. A progress bar or step-by-step status ("Generating your design...") would reduce perceived wait time. |
| **Confirmation before destructive actions** | Some delete/remove actions use `confirm()` (browser native) while others don't confirm at all. Consistent confirmation modals for removing people, deleting cards, and clearing drafts. |
| **Page-specific metadata** | Only the root layout has meta tags. Individual pages (e-card view especially) need proper titles and Open Graph tags for sharing. |
| **Keyboard navigation and focus management** | Basic aria attributes exist, but there's no focus trapping in modals, no keyboard shortcuts, and tab order in the multi-step wizard could be improved. |

### Nice to Have (Post-MVP Enhancements)

| Item | Why It Matters |
|------|---------------|
| **Physical mail delivery** | The UI mentions "Mail it — coming soon." Integration with a print/mail API (Lob, Stannp, etc.) would complete the delivery trifecta. |
| **Payment/billing** | No monetization yet. README mentions ~$10-20 pricing. Stripe integration for per-card or subscription billing. |
| **Email notifications** | Reminders for upcoming occasions ("Alyssa's birthday is in 7 days — create a card?"). Recipients have email fields but they aren't used. |
| **Analytics** | No third-party analytics. Internal usage tracking exists but only for cost estimation. PostHog or similar would help understand user behavior. |
| **Automated testing** | No test files exist. Critical flows (card creation, print layout, backup/restore) should have at least basic integration tests. |
| **Multi-device sync** | With server-side persistence, users could access their cards from any device. Currently locked to one browser. |

---

## Known Limitations

1. **Browser-only storage** — All data (profiles, cards, images) lives in localStorage and IndexedDB. Clearing browser data destroys everything. The backup/restore feature mitigates this but requires manual action.

2. **No authentication** — Single implicit user (`"local"`). No login, no accounts, no way to distinguish users.

3. **E-cards aren't sendable** — The e-card viewer is local-only. There are no shareable URLs. The "send as e-card" flow is effectively "show it on your screen."

4. **Duplex printing varies by browser/printer** — Some printer drivers (notably HP) don't respect duplex settings from `window.print()`. The workaround is documented: save as PDF first, then print from the PDF viewer.

5. **Image storage limits** — Large base64 images stored in IndexedDB. Browsers typically allow 50-100MB of IndexedDB storage. A prolific user creating many cards could hit limits.

6. **No offline support** — API routes require network access to OpenAI. Card viewing works offline (data is local) but creation does not.

7. **Single-language** — English only. No internationalization framework.

---

## Recommended MVP Scope

### Ship Now (Personal Use / Demo)
The app is fully functional for a single user creating cards on their own device. This is suitable for:
- Personal use by the developer/team
- Demo to potential investors or collaborators
- User testing sessions (supervised, with backup reminders)

### Ship After (Public Beta)
Before inviting real users, implement:
1. Authentication (Supabase auth — foundation is already there)
2. Server-side card and image storage (Supabase + storage bucket)
3. Shareable e-card URLs (public routes with server-stored data)
4. Global error boundary (prevents white-screen crashes)
5. API key gate and health check on app load
6. Basic rate limiting on generation endpoints

### Ship Later (Growth)
- Payment integration
- Physical mail delivery
- Email reminders for occasions
- Analytics
- Multi-device sync
- Automated tests

---

## File Inventory

| Directory | Contents |
|-----------|----------|
| `src/app/` | 10 page routes (home, onboarding, profile, recipients, cards CRUD, backup, reset, seed) |
| `src/app/api/` | 8 API routes (chat, generate-card, generate-image, suggest-designs, suggest-inside-designs, suggest-front-text, merge-scene, health) |
| `src/components/` | AppHeader, ProfileEditor, and shared UI |
| `src/lib/` | Store (localStorage/IndexedDB), card-recipes (prompt building), occasions, holidays, usage tracking, Supabase client |
| `src/types/` | TypeScript interfaces for Card, Recipient, UserProfile, PersonProfile |

---

*This document should be updated as features are added or priorities change.*
