# Nuuge — Cost Tracking & Billing Architecture

**Date:** February 17, 2026

---

## How the Cost Meter Works Today

### It's an estimate, not actual cost

The `~$0.35` displayed during card creation is a **hardcoded estimate**, not a live reading from OpenAI. Every time an API call fires, the code adds a fixed dollar amount to a running counter in React state.

| Operation | Hardcoded Estimate | Model | Notes |
|---|---|---|---|
| Image generate/edit | $0.08 | gpt-image-1 | OpenAI charges ~$0.08 for 1024x1536 |
| Message generation | $0.025 | GPT-4o | Rough average for ~2K token calls |
| Design suggestions | $0.025 | GPT-4o | Same estimate as message gen |
| Inside design suggestions | $0.025 | GPT-4o | Same estimate |
| Front text suggestions | $0.025 | GPT-4o | Same estimate |
| Scene merge (refinement) | $0.005 | GPT-4o-mini | Much cheaper model |

The estimates are reasonable ballpark figures but don't account for actual token counts. A short generation might cost $0.01; a long one with lots of context might cost $0.04. The app just says $0.025 every time.

### A typical card's actual cost

Based on a standard flow (generate message + suggest designs + generate image + suggest inside designs + suggest front text), a single card with no refinements costs roughly **$0.19–0.24**. Each image refinement adds ~$0.08. Message regeneration adds ~$0.025. A card with 2-3 refinements might reach **$0.35–0.50**.

---

## What's Tracked and Where

There are **two separate tracking systems**:

### 1. Session counter (in-memory, ephemeral)

- **What:** The `~$0.35` displayed in the card creation header.
- **Where:** React state variable `sessionCost` in `src/app/cards/create/[recipientId]/page.tsx`.
- **How:** Each API call adds its hardcoded cost estimate via `setSessionCost((c) => c + 0.025)`.
- **Persistence:** None — resets to zero every time you start a new card or refresh the page.
- **Purpose:** Gives the user a rough sense of AI cost during creation.

### 2. Usage log (IndexedDB + Supabase, persistent)

- **What:** Every API call is logged with endpoint, model, call type, estimated cost, card ID, recipient ID, and session ID.
- **Where:** Dual-write — browser's IndexedDB (database `nuuge_usage`, object store `events`) **and** Supabase (`usage_events` table).
- **Code:** `src/lib/usage-store.ts` — the `logApiCall()` function writes events to both stores, `getUsageStats()` reads from IndexedDB for the local dashboard.
- **Persistence:** IndexedDB survives page refreshes. Supabase persists server-side across all devices and users.
- **Purpose:** Powers the usage stats modal on the dashboard locally, and enables cross-user analytics, cost-per-card reporting, and abandoned session detection via Supabase SQL queries.

### 3. Session tracking (per card creation flow)

- **What:** A unique `session_id` is generated each time a user enters the card creation flow. Every AI call during that session is tagged with it.
- **Where:** React `useRef` in the create card page, stored alongside each usage event in IndexedDB and Supabase.
- **How it works:**
  - On page load, a `ses_` prefixed UUID is created.
  - All `logApiCall()` calls during creation pass this session ID.
  - When the card is saved, `tagSessionWithCardId()` batch-updates all events for that session with the new card ID — in both IndexedDB and Supabase.
  - If the user abandons (never saves), the events remain with a session ID but no card ID — making abandoned sessions visible in analytics.
- **Purpose:** Enables cost-per-card tracking (even though the card ID doesn't exist until save) and identifies wasted spend from abandoned sessions.

#### How to view the IndexedDB data directly

1. Open your browser's Developer Tools (F12 or Cmd+Option+I).
2. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox).
3. In the left sidebar, expand **IndexedDB**.
4. Look for a database called **`nuuge_usage`**.
5. Click the **`events`** object store to see all logged API calls with timestamps, endpoints, models, and cost estimates.

This is the raw data behind the usage stats modal. Each entry looks like:

```json
{
  "id": "1708012345678-abc123",
  "timestamp": "2026-02-17T14:30:00.000Z",
  "endpoint": "generate-image",
  "model": "gpt-image-1",
  "callType": "image_generate",
  "estimatedCost": 0.08,
  "cardId": "card-uuid-here",
  "recipientId": "recipient-uuid-here",
  "sessionId": "ses_1708012345678_a1b2c3d4"
}
```

**Note:** IndexedDB data is local to your browser. Supabase data persists server-side and can be queried across all users. See `SUPABASE_SETUP.md` for the full set of analytics queries (cost per session, abandoned sessions, excessive regeneration, etc.).

### Neither system reads actual usage from OpenAI

Both tracking mechanisms use local estimates. Neither connects to OpenAI's usage API to get real token counts or actual charges.

---

## How Costs Are Actually Paid Today

**You're paying OpenAI directly.** Your `OPENAI_API_KEY` in `.env.local` is tied to your OpenAI account. Every API call from Nuuge goes directly to OpenAI's API using that key, and OpenAI bills your account based on actual usage.

```
User creates card → Nuuge API route (Vercel) → OpenAI API (your key) → OpenAI bills your account
```

There is no intermediary. Nuuge doesn't have its own billing layer. Your OpenAI account absorbs all costs.

**To see real costs:** Visit [platform.openai.com/usage](https://platform.openai.com/usage) and log in with the account that owns the API key.

---

## Volume Pricing — Can You Get Lower Rates?

### OpenAI Usage Tiers (automatic)

As monthly spend increases, OpenAI automatically upgrades your tier (Tier 1 at $5/mo, up to Tier 5 at $1000+/mo). This increases **rate limits** (requests per minute) but **does not reduce per-token pricing**. Standard API pricing is the same regardless of tier.

### Committed Use Discounts (negotiated)

OpenAI offers custom enterprise agreements for high-volume users. If Nuuge is generating thousands of cards/month, you could negotiate volume pricing. This typically requires direct conversation with OpenAI's sales team.

### Model Selection Optimization (immediate lever)

The biggest cost lever available right now is switching lower-stakes calls to cheaper models:

| Call | Current Model | Cost | Could Use | Cost | Savings |
|------|--------------|------|-----------|------|---------|
| Design suggestions | GPT-4o | $0.025 | GPT-4o-mini | $0.005 | 80% |
| Inside design suggestions | GPT-4o | $0.025 | GPT-4o-mini | $0.005 | 80% |
| Front text suggestions | GPT-4o | $0.025 | GPT-4o-mini | $0.005 | 80% |
| Message generation | GPT-4o | $0.025 | Keep GPT-4o | $0.025 | 0% (quality matters here) |
| Image generation | gpt-image-1 | $0.08 | Keep gpt-image-1 | $0.08 | 0% (no alternative) |

Switching suggestion calls to GPT-4o-mini could cut per-card text generation costs by **60-70%** with minimal quality impact.

---

## What Changes at Launch

### Your API key = your bill

Today, every user's card creation costs you money via your single API key. At launch you need a billing layer (Stripe, etc.) between the user and the AI cost so you can charge per card or per subscription and cover the OpenAI expense.

### Rate limits become real

OpenAI rate limits are per-API-key. With 100 concurrent users generating images, you'd hit rate limits quickly. You'd need to manage queuing, retries, and potentially multiple API keys or an enterprise agreement with higher limits.

### The core architecture doesn't need to fundamentally change

The pattern of "server-side API route calls OpenAI" is sound and scales with Vercel's serverless infrastructure. What needs to be added:

1. **Authentication** — Know who is making calls.
2. **Server-side usage tracking** — Not just client-side estimates. Capture real token counts from OpenAI's response headers (`usage.prompt_tokens`, `usage.completion_tokens`) and compute actual cost per call.
3. **Billing/payment layer** — Stripe or similar to charge users and recover costs.
4. **Queue management** — For image generation concurrency. A simple queue prevents rate limit errors under load.

### Actual cost tracking becomes critical

At launch, you'd want to capture real token counts from OpenAI's API responses. Every OpenAI response includes a `usage` object:

```json
{
  "usage": {
    "prompt_tokens": 1250,
    "completion_tokens": 350,
    "total_tokens": 1600
  }
}
```

Multiply by published per-token rates to get exact cost per call. This is how you'd know your true margin per card — not estimates, but actual cost.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/usage-store.ts` | Dual-write usage logging (IndexedDB + Supabase) — `logApiCall()`, `tagSessionWithCardId()`, `getUsageStats()`, `backfillToSupabase()`, cost estimates |
| `src/lib/usage.ts` | Server-side usage tracking (writes to filesystem locally, console on Vercel) |
| `src/app/cards/create/[recipientId]/page.tsx` | Session cost counter (`sessionCost` state), session ID generation, all `logApiCall()` calls, card ID backfill on save |
| `SUPABASE_SETUP.md` | Table schema, RLS policies, migration steps, and analytics SQL queries for `usage_events` |
| `.env.local` | Contains `OPENAI_API_KEY` — the key that gets billed |

---

*This document should be updated as billing architecture evolves toward launch.*
