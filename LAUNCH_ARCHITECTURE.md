# Nuuge — Launch Architecture Plan

> Created: Feb 17, 2026
> Status: Planning / Discussion Draft
> Target: Scalable multi-user product (1M+ users over time)

---

## Table of Contents

1. [Current State vs. Launch State](#1-current-state-vs-launch-state)
2. [Accounts & Authentication](#2-accounts--authentication)
3. [Data Architecture](#3-data-architecture)
4. [AI Access & Cost Management](#4-ai-access--cost-management)
5. [Billing & Monetization](#5-billing--monetization)
6. [Print Fulfillment](#6-print-fulfillment)
7. [Infrastructure Options](#7-infrastructure-options)
8. [Migration Path](#8-migration-path)
9. [Key Decisions Needed](#9-key-decisions-needed)

---

## 1. Current State vs. Launch State

### What exists today (Prototype)
| Layer | Current approach | Limitation |
|---|---|---|
| **Auth** | Simple passcode gate | No user accounts, no identity |
| **User data** | localStorage (browser) | Per-device, not portable, lost if cleared |
| **Card data** | localStorage + IndexedDB | Same — tied to one browser |
| **Images** | IndexedDB (base64 blobs) | ~50MB browser limit, not shareable |
| **AI access** | Direct OpenAI API via personal key | Single key, single billing account |
| **Usage tracking** | IndexedDB + Supabase dual-write | Works, but no per-user attribution |
| **Shared cards** | Supabase `shared_cards` table | This is the one server-side piece |
| **Print** | Browser print dialog (PDF) | No fulfillment, manual only |
| **Hosting** | Vercel (Next.js) | Works well, can scale |

### What launch requires
| Layer | Launch approach |
|---|---|
| **Auth** | Real accounts (email/password + OAuth) |
| **User data** | Server-side database, accessible from any device |
| **Card data** | Server-side with images in cloud storage |
| **Images** | Cloud object storage (S3/equivalent) + CDN |
| **AI access** | Per-user rate limiting, queued generation, cost tracking |
| **Usage tracking** | Server-side, tied to user accounts |
| **Billing** | Stripe subscriptions + credits + per-card purchases |
| **Print** | API integration with print fulfillment partners |
| **Hosting** | Scalable infrastructure with auto-scaling |

---

## 2. Accounts & Authentication

### Recommended: Supabase Auth (or Auth0 / Clerk as alternatives)

Supabase Auth is the simplest path since you're already on Supabase. It provides:
- Email/password signup with email verification
- OAuth providers (Google, Apple, Facebook) — one-click social login
- Magic link (passwordless email login)
- Session management with JWT tokens
- Row Level Security (RLS) — database rows automatically scoped to the logged-in user

### Free card anti-abuse
- Require email verification before the first free card can be generated
- Track by email (not device) — prevents multi-device abuse
- Flag accounts that sign up with disposable email domains
- Store a `free_card_used` boolean on the user profile

### User profile structure
```
users (managed by Supabase Auth)
├── id (UUID)
├── email
├── display_name
├── avatar_url
├── created_at
└── subscription_status

user_profiles (your custom table)
├── user_id (FK → users.id)
├── display_name
├── free_card_used (boolean)
├── credit_balance (numeric) — for EZPass model
├── subscription_tier
├── subscription_expires_at
└── settings (JSONB — preferences, defaults)
```

### Migration from current state
- On first login, offer to "import" existing localStorage data into their new account
- The backup/restore mechanism already exists — extend it to push to server

---

## 3. Data Architecture

### Database: PostgreSQL (via Supabase)

Supabase gives you a managed PostgreSQL database that scales to millions of rows. No need to move to AWS RDS unless you hit very specific performance needs.

### Core tables

```
recipients
├── id (UUID)
├── user_id (FK → users)
├── name, relationship_type, personality_tags
├── interests, important_dates, links
├── setup_complete, setup_step
├── created_at, updated_at

cards
├── id (UUID)
├── user_id (FK → users)
├── recipient_id (FK → recipients)
├── occasion, tone_used, message_text
├── front_image_url (→ cloud storage path)
├── inside_image_url
├── front_text, front_text_position, front_text_style
├── fonts, sizing settings
├── status (draft | completed | printed | sent)
├── created_at, updated_at

card_versions (for edit history / versioning)
├── id, card_id (FK), version_number
├── snapshot (JSONB — full card state at that point)
├── created_at

orders (print fulfillment)
├── id (UUID)
├── user_id, card_id
├── fulfillment_partner (enum)
├── shipping_address (JSONB)
├── status (pending | processing | shipped | delivered)
├── tracking_number
├── cost, payment_id
├── created_at, updated_at

usage_events (already exists — extend with user_id)
├── id, user_id, session_id
├── endpoint, model, call_type
├── estimated_cost, card_id
├── created_at
```

### Image storage: Supabase Storage (S3-compatible)

You already use Supabase Storage for shared cards. Extend this:
- **Bucket: `card-images`** — all generated front/inside images
- **Path convention:** `{user_id}/{card_id}/front.png`, `{user_id}/{card_id}/inside.png`
- Images served via Supabase CDN (or CloudFront if you move to AWS)
- Set lifecycle rules to delete draft images after 30 days if card is abandoned

**Current images are base64 in IndexedDB (~2-5MB per card).** At scale, this MUST move to cloud storage. A user with 50 cards would have 100-250MB of image data.

### CDN for delivery
- Supabase Storage includes a CDN automatically
- For higher performance at scale: add Cloudflare in front (free tier handles millions of requests)

---

## 4. AI Access & Cost Management

### Current: Single OpenAI API key
Your personal key, billed directly to your OpenAI account. Works for prototyping but not for a product.

### Launch options

#### Option A: OpenAI API with usage tiers (Recommended to start)
- **How it works:** You keep using the OpenAI API, but implement server-side controls
- **Rate limiting:** Per-user limits (e.g., 20 image generations/day, 50 text completions/day)
- **Cost tracking:** Every API call logged with user_id and estimated cost (you already do this)
- **Volume pricing:** OpenAI offers usage tiers — Tier 4/5 gets lower per-token pricing as your monthly spend increases
- **Estimated costs per card:**
  - GPT-4o text (message + suggestions): ~$0.03-0.05
  - gpt-image-1 (front image): ~$0.04-0.08
  - gpt-image-1 (inside illustration): ~$0.04-0.08
  - GPT-4o (front text suggestions): ~$0.02
  - **Total per card: ~$0.13-0.23** (assuming no regenerations)
  - With regenerations: ~$0.20-0.50 per completed card

#### Option B: Azure OpenAI Service (Better for scale)
- **How it works:** Same OpenAI models, hosted on Azure with enterprise SLAs
- **Advantages:** Reserved capacity (guaranteed throughput), lower per-call costs at volume, data residency options, enterprise support
- **When to consider:** When monthly AI spend exceeds ~$1,000/month consistently
- **Pricing:** Similar to OpenAI but with commitment discounts (provisioned throughput units)

#### Option C: Multi-model strategy (Future optimization)
- Use cheaper/faster models where quality is sufficient:
  - GPT-4o-mini for text suggestions (~10x cheaper than GPT-4o)
  - DALL-E 3 for simpler illustrations (cheaper than gpt-image-1)
  - GPT-4o for the primary message generation (quality matters most here)
- A/B test model quality to find the right cost/quality balance

### Abandoned card cost protection
Your "session tracking" system already handles this. At product scale:
- **Guardrails:** After N regenerations without saving, show a gentle prompt: "Still exploring? Save your favorite so far, or take a break."
- **Hard limits:** Cap regenerations per session (e.g., 10 image generations before requiring a save or explicit "start over")
- **Credits model naturally solves this:** Each generation costs credits, so users self-regulate

### Queue-based generation (important for scale)
At 1M users, you can't have every image generation as a synchronous API call:
- Put generation requests in a **job queue** (e.g., AWS SQS, or BullMQ with Redis)
- Workers process the queue, respecting rate limits
- Client polls for completion (or use WebSocket/SSE for real-time updates)
- This prevents thundering herd problems during peak usage

---

## 5. Billing & Monetization

### Payment processor: Stripe

Stripe handles subscriptions, one-time payments, credits/wallets, and webhooks. It's the industry standard for SaaS.

### Pricing models (can mix and match)

#### Model 1: Subscription tiers
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 card (requires email signup) |
| Starter | $4.99/month | 5 cards/month, basic styles |
| Plus | $9.99/month | 20 cards/month, all styles, priority generation |
| Pro | $19.99/month | Unlimited cards, all features, bulk send |

#### Model 2: Per-card pricing
| Type | Price |
|---|---|
| Digital e-card | $1.99 |
| Print at home | $2.49 |
| Nuuge print & send | $4.99 + shipping |

#### Model 3: EZPass / Credit wallet
- User pre-loads credits (e.g., $10 = 100 credits)
- Each action costs credits:
  - Generate a card: 10 credits
  - Regenerate image: 3 credits
  - Print & send: 25 credits
- Credits don't expire (or expire after 12 months)
- Bonus credits for larger purchases (buy $50, get 600 credits instead of 500)
- **Advantage:** Covers abandoned card costs naturally — regenerations cost credits regardless of completion

#### Recommended: Hybrid approach
- **Subscription** for regular users (predictable revenue, covers AI costs)
- **Per-card purchase** for occasional users (low barrier)
- **Credit top-ups** as an add-on for heavy users who exceed subscription limits
- **1 free card** for new signups (email required)

### Stripe implementation
```
Stripe Customer → linked to Supabase user_id
├── Subscription (if applicable)
│   ├── plan_id, status, current_period_end
│   └── usage tracking (cards created this period)
├── Payment methods on file
├── Credit balance (Stripe has built-in customer balance)
└── Payment history
```

Stripe webhooks notify your backend when:
- Subscription starts/renews/cancels
- Payment succeeds/fails
- Credit balance changes

---

## 6. Print Fulfillment

### Architecture: API-driven with pluggable partners

Design the print system as an internal API that can route to different fulfillment partners:

```
Your Backend
  └── Print Order API
       ├── Lob (US mail, postcards, letters)
       ├── Stannp (US/UK/EU, greeting cards)
       ├── Prodigi (global, various print products)
       ├── Click2Mail (US, bulk mail)
       └── Self-fulfillment (future, your own print operation)
```

### How it works

1. **User completes card** → clicks "Nuuge Print & Send"
2. **Address collection** — shipping address form (or pull from recipient profile)
3. **Print-ready file generation:**
   - Server renders card to a high-res PDF (front, inside, back)
   - Correct bleed, trim marks, CMYK-safe colors
   - Stored in cloud storage
4. **Order creation** → sent to fulfillment partner API
5. **Tracking** → webhook from partner updates order status
6. **User notification** — email when shipped, when delivered

### Fulfillment partner comparison

| Partner | Card types | Coverage | API quality | Approx. cost |
|---|---|---|---|---|
| **Lob** | Postcards, letters, checks | US only | Excellent, well-documented | $0.70-1.50 + postage |
| **Stannp** | Postcards, greeting cards, letters | US, UK, EU, AU | Good REST API | $1.00-2.50 + postage |
| **Prodigi** | Cards, prints, photo products | Global (100+ countries) | Good, webhooks | $1.50-3.00 + shipping |
| **Click2Mail** | Letters, postcards, bulk mail | US only | Functional but older | $0.50-1.00 + postage |

### Recommendation
Start with **Lob** (best API, US-focused) or **Stannp** (greeting card specific, broader geography). Build the abstraction layer so you can add partners or switch without changing your app.

### Print-ready PDF generation
Your current print preview already renders the card layout. For production:
- Use a server-side rendering service (Puppeteer on a Lambda/Cloud Function, or a dedicated service like PDFShift)
- Render at 300 DPI (the current screen preview is 72-96 DPI)
- Ensure images are high-resolution originals (not compressed browser versions)
- Add proper bleed margins per fulfillment partner specs

---

## 7. Infrastructure Options

### Option A: Vercel + Supabase (Recommended to start)

**Best for:** Launch through ~100K users. Simplest to operate.

```
┌─────────────────────────────────────────────────────┐
│                    Cloudflare CDN                     │
│              (DNS, caching, DDoS protection)          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  Vercel (Frontend)                    │
│  Next.js app — SSR, static pages, API routes         │
│  Auto-scales serverless functions                     │
│  Edge middleware for auth checks                      │
└──────┬───────────────┬──────────────────────────────┘
       │               │
       ▼               ▼
┌──────────────┐ ┌─────────────────────────────────────┐
│   OpenAI API  │ │         Supabase                     │
│  (AI models)  │ │  ├── PostgreSQL (all app data)       │
│               │ │  ├── Auth (accounts, sessions)       │
└──────────────┘ │  ├── Storage (card images, PDFs)      │
                 │  ├── Realtime (optional live updates)  │
                 │  └── Edge Functions (background jobs)  │
                 └─────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Print Partner API │
              │ (Lob / Stannp)   │
              └─────────────────┘
```

**Costs at scale (estimated, ~10K active users):**
| Service | Monthly cost |
|---|---|
| Vercel Pro | $20 + usage (~$50-100) |
| Supabase Pro | $25 + usage (~$50-200) |
| OpenAI API | $500-2,000 (depends on cards/month) |
| Cloudflare | Free tier (or $20/month for Pro) |
| **Total infrastructure** | **~$600-2,400/month** |

**Pros:** Minimal ops, auto-scaling, no servers to manage, fast iteration
**Cons:** Less control, costs can spike unpredictably, vendor lock-in

### Option B: AWS (Full control)

**Best for:** 100K+ users, when you need fine-grained control.

```
┌──────────────────────────────────────────────────────┐
│                  CloudFront CDN                       │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│           AWS Amplify or ECS/Fargate                  │
│           (Next.js app hosting)                       │
└──────┬───────────┬───────────┬───────────────────────┘
       │           │           │
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌───────────────────────────┐
│ OpenAI / │ │   SQS    │ │     AWS Services           │
│ Azure    │ │  (queue)  │ │  ├── RDS PostgreSQL        │
│ OpenAI   │ │     │     │ │  ├── S3 (images, PDFs)     │
└──────────┘ │     ▼     │ │  ├── Cognito (auth)        │
             │  Lambda   │ │  ├── ElastiCache (Redis)   │
             │ (workers) │ │  └── SES (email)            │
             └──────────┘ └───────────────────────────┘
```

**Costs at scale (estimated, ~10K active users):**
| Service | Monthly cost |
|---|---|
| ECS/Fargate or Amplify | $50-200 |
| RDS PostgreSQL | $50-150 |
| S3 + CloudFront | $20-50 |
| SQS + Lambda | $10-30 |
| Cognito | Free up to 50K MAU |
| OpenAI/Azure OpenAI | $500-2,000 |
| **Total infrastructure** | **~$630-2,430/month** |

**Pros:** Full control, predictable pricing at scale, reserved instances for cost savings, enterprise features
**Cons:** More complex to set up and operate, need DevOps knowledge, slower iteration

### Option C: Hybrid (Recommended growth path)

**Start with Vercel + Supabase, migrate specific pieces to AWS as needed.**

```
Phase 1 (Launch → 50K users): Vercel + Supabase + OpenAI
Phase 2 (50K → 200K users): Add AWS for image processing queue + S3
Phase 3 (200K → 1M users): Evaluate full AWS migration or stay hybrid
```

**Why this works:**
- Vercel + Supabase gets you to market fastest with lowest ops burden
- The pieces that need to scale first (image generation, storage) can move to AWS independently
- You avoid over-engineering before you have product-market fit
- The Next.js app itself is portable — it runs on Vercel, AWS, or anywhere

---

## 8. Migration Path

### From prototype to product (ordered by priority)

#### Phase 1: Foundation (Pre-launch)
1. **Supabase Auth** — add real accounts, email verification
2. **Database migration** — move recipients/cards from localStorage to Supabase tables
3. **Image storage** — move from IndexedDB base64 to Supabase Storage
4. **Import flow** — let existing users migrate their local data to an account
5. **Stripe integration** — subscription management, payment processing

#### Phase 2: Scale readiness (Launch)
6. **Per-user AI rate limiting** — server-side controls on generation frequency
7. **Credit/billing system** — track card creation against subscription or credit balance
8. **Print fulfillment API** — integrate with Lob/Stannp for physical card sending
9. **Email system** — transactional emails (verification, receipts, shipping notifications)
10. **Monitoring** — error tracking (Sentry), usage dashboards, cost alerts

#### Phase 3: Growth (Post-launch)
11. **Queue-based generation** — async image generation with job queue
12. **Multi-model optimization** — use cheaper models where quality is sufficient
13. **CDN optimization** — aggressive caching for card images
14. **Admin dashboard** — user management, order tracking, cost monitoring
15. **Mobile optimization** — PWA or native app wrapper

---

## 9. Key Decisions Needed

| Decision | Options | Impact |
|---|---|---|
| **Auth provider** | Supabase Auth vs. Auth0 vs. Clerk | Supabase Auth is simplest if staying on Supabase |
| **Primary billing model** | Subscription vs. Credits vs. Per-card | Affects user acquisition and AI cost recovery |
| **Print partner** | Lob vs. Stannp vs. Prodigi | Affects card quality, geography, pricing |
| **AI provider at scale** | OpenAI direct vs. Azure OpenAI | Azure offers reserved capacity and enterprise pricing |
| **When to migrate from Vercel** | At what user count or cost threshold? | Don't migrate prematurely — Vercel scales well |
| **Card data ownership** | Can users export their cards? | Important for trust, affects data architecture |
| **International support** | US-only at launch or global? | Affects print partners, payment processing, language |

---

## Cost Model: Revenue vs. AI Cost

### Break-even analysis (subscription model)

Assuming average user creates 3 cards/month:
- AI cost per card: ~$0.25 (with regenerations)
- AI cost per user/month: ~$0.75
- Infrastructure per user/month: ~$0.02 (at 10K users)
- **Total cost per user/month: ~$0.77**

A $4.99/month subscription covers costs with ~85% gross margin.
A $9.99/month subscription covers costs with ~92% gross margin.

### EZPass credit economics
- Sell 100 credits for $10 (10¢/credit)
- Card creation costs 10 credits ($1.00 to user) vs. $0.25 AI cost = 75% margin
- Regeneration costs 3 credits ($0.30 to user) vs. $0.06 AI cost = 80% margin
- Print & send costs 25 credits ($2.50 to user) vs. ~$2.00 fulfillment cost = 20% margin
  - Charge more for print: 40-50 credits ($4-5) for healthier margin

---

## 11. Planned improvements

### 11.1 Landing page account menu (returning users)

**Problem:** When the app loads fresh (new browser, cleared storage, or after a redeploy), the landing/onboarding page assumes a new user. There is no discoverable path to restore a backup unless the user manually navigates to `/backup`.

**Solution:** Add a small account/settings icon button in the top-right corner of the landing page. Tapping it opens a dropdown menu containing:
- **Restore backup** — navigates to `/backup`
- (Future) Export data, settings, etc.

**Design guidelines:**
- Use a subtle person or gear icon so it doesn't distract from the onboarding flow for genuinely new users
- The menu should be lightweight (no auth required — just utility links)
- Keep it consistent with the `AppHeader` pattern used on other pages
- This icon should appear on the landing/onboarding page only (other pages already have navigation)

**Status:** Implemented. Gear icon in top-right opens dropdown with Restore backup, Circle of People, My profile, and Usage stats.

### 11.1b Cross-account card copy loses decoration metadata

**Problem:** When a card with a motif/accent decoration (e.g., corner flourish) is manually copied between accounts, the `inside_image_position` and/or `accent_positions` fields may not transfer correctly. The edit page then treats the card as a banner type, trapping the user in banner-only options even though the original image was a motif.

**Fix:** Ensure the backup/restore and any manual card copy mechanism preserves all card fields including `inside_image_position`, `accent_positions`, and `card_type` exactly as stored.

**Status:** Documented, low priority (edge case). Fix alongside next backup/restore work.

### 11.2 "My News" — sender-centric announcement cards

**Problem:** The current flow assumes "I'm sending a card about something happening in someone else's life." But many occasions originate from the sender — loss of a pet, engagement, birth announcement, save-the-date. These don't fit naturally into the recipient-centric "What's the occasion for [name]?" model, and the AI wouldn't draw from the sender's context to craft the card.

**Two paths in Nuuge:**

- **Path 1 — "For them" (existing):** User taps a person in their circle, creates a card about that person's occasion. AI uses recipient's profile and interests. One card, one recipient.
- **Path 2 — "My News" (new):** User creates a card about their own event and sends it to one or many people. AI uses the sender's profile and the described event. One master card, multiple personalized sends.

**Home page evolution:**

The home page gains a second section below "My Circle":

- **My Circle** — existing recipient grid, unchanged
- **My News** — "Create an announcement card" button, plus a list of recent announcement cards showing send count

**My News categories:**

Joyful announcements:
- New baby / adoption
- Engagement
- Wedding (save the date / we got married)
- Graduation (self or child)
- New home / big move
- Retirement
- Promotion / new job

Difficult news:
- Loss of a pet
- Loss of a loved one
- Health update
- Difficult transition

Invitations / Save the dates:
- Party / gathering
- Holiday event
- Reunion

General:
- Life update / just sharing

**My News creation flow:**

1. What's your news? — category picker + free-text "Tell us more"
2. Tone and message — AI generates from sender's perspective using sender profile
3. Design — same art style / subject / image generation flow, informed by the news
4. Recipients — pick one or multiple from circle, or "Generic (no specific recipient)"
5. Personalize (optional, per recipient) — tweak salutation, add personal lines per person

**Master card + personalized copies model:**

- A **master card** stores the news, front image, base message, and design. It lives under "My News" and is not tied to a single recipient.
- **Personalized copies** are created per recipient at send time. Each copy can have a customized greeting, message tweaks, and closing, but shares the same front image and core content.
- Each copy links back to the master via a `master_card_id` field.
- The "My News" section shows each master as a single entry: "Remembering Moya — sent to 3 people" that expands to show individual sends.
- To send to an additional person later, user opens the master card, taps "Send to another person," picks someone, adjusts the salutation, and sends — no regeneration needed.

**Data model additions:**

- `Card.master_card_id` — optional, links a personalized copy back to its master
- `Card.card_type` — "circle" (existing) or "news" (new)
- `Card.news_category` — the selected category from the My News picker
- `Card.news_description` — free-text description of the sender's event

**AI prompt differences for Path 2:**

- Context source: sender's profile + the described news, not the recipient's profile
- Message framing: "I wanted to share some news..." rather than "Happy birthday to you..."
- Personalization per recipient: base message stays the same, closing/tone can adapt per person
- Image subject: informed by the news (memorial imagery for pet loss, celebratory for engagement)

**Status:** Documented, not yet implemented. Full multi-recipient with per-person customization from day one.

### 11.3 Image library — reuse generated images

**Problem:** The AI sometimes generates beautiful images that users want to reuse on other cards. Currently each image is locked inside its card. Regenerating costs $0.04-0.08 per image.

**Solution:** A personal image library that collects finalized card images for reuse.

**How it works:**

- During card creation, a "Pick from library" option appears alongside "Generate new image"
- Tapping it shows a grid of thumbnail images from previous cards
- Selecting one skips the entire generation step — straight to preview
- Cost per reuse: $0.00

**When images are saved:**

- Images are auto-saved to the library only when a card is finalized (saved/sent)
- Rejected drafts and abandoned experiments do not enter the library
- A manual "Save to library" button on the design preview step lets users keep an image they like even if they go a different direction with the card
- Inside decoration images (corners, banners, frames) are also saved for reuse

**Metadata per image:**

- Thumbnail (small, for fast grid loading)
- Full image (IndexedDB key or Supabase URL)
- Art style, subject category, original prompt
- Date created
- Auto-generated tags (occasion type, mood)

**Implementation phases:**

- Phase 1 (high value, simple): Auto-save finalized images to IndexedDB. Add "Pick from library" thumbnail grid during card creation. No filtering yet.
- Phase 2: Generate thumbnails for faster grid. Add filtering by art style or date. Favorite/delete from library.
- Phase 3 (with Supabase): Move to cloud storage. Cross-device access. Pre-built curated template images.

**Status:** Documented, not yet implemented. Phase 1 is highest priority.

### 11.4 Occasion picker page redesign

**Problem:** The current occasion picker uses small pill buttons in grouped rows with uppercase section headers. It feels cluttered and form-like rather than warm and inviting. Adding more options (for My News) would make it worse.

**Solution:** Replace the pill cloud with a cleaner layout:

- Full-width tap targets (one option per row or two-column grid) with a subtle icon on the left
- Reduce visual grouping noise — use light dividers instead of uppercase section headers
- Surface most-used occasions first (Birthday, Thank You)
- This redesign applies to the existing "their occasion" picker, not just My News

**Status:** Documented, not yet implemented. Should be done alongside or before My News.

### 11.5 E-card font size not matching print preview

**Problem:** Print preview, e-card view, and shared viewer showed different text wrapping — same font scale appeared different across views.

**Root cause:** Different text container proportions (fixed `rem` padding vs percentage) and different font units (`rem` vs `cqw`) across pages. Same font size rendered into different box shapes → different line breaks.

**Fix implemented (Feb 17, 2026):**

- **Unified padding:** Print, view, SharedCardViewer, and edit preview use percentage-based padding: `8% 10%` (default) or `6% 4%` (left/right images)
- **Unified font sizing:** All four use `cqw` with `remToCqw(rem, scale)` and `container-type: inline-size` on the card panel
- **Navigation:** Print and edit pages use `window.location.href` (not `router.push`) when navigating to view/print/edit so destinations load fresh from localStorage

**Status:** Implemented and verified working.

---

*This document will evolve as decisions are made. Next step: pick the decisions in Section 9 and start Phase 1 implementation.*
