# Supabase Setup

This document covers all Supabase tables and buckets needed for Nuuge.

---

# Part A — Shareable E-Cards

These steps must be completed in the Supabase dashboard **before** the share feature will work.

**Project:** Use the Supabase project whose URL and anon key are already in your `.env.local`.

---

## 1. Create the `shared_cards` table

Go to **Table Editor** → **New table** and create:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `share_id` | text | — | Unique, not null. 8-char short ID used in URLs |
| `card_json` | jsonb | — | Not null. All card data needed to render the e-card |
| `front_image_url` | text | — | Nullable. Supabase Storage public URL for front image |
| `inside_image_url` | text | — | Nullable. Supabase Storage public URL for inside image |
| `created_at` | timestamptz | `now()` | Auto-set on insert |

Then add a **unique index** on `share_id`:

```sql
CREATE UNIQUE INDEX shared_cards_share_id_idx ON shared_cards (share_id);
```

### RLS (Row Level Security)

Enable RLS on the table, then add two policies:

```sql
-- Anyone can read shared cards (needed for public /share/[id] page)
CREATE POLICY "Public read" ON shared_cards
  FOR SELECT USING (true);

-- Allow inserts from the anon key (used by the share API route)
CREATE POLICY "Anon insert" ON shared_cards
  FOR INSERT WITH CHECK (true);
```

---

## 2. Create the storage bucket

Go to **Storage** → **New bucket**:

- **Name:** `share-card-images`
- **Public:** Yes (toggle on)

### Storage Policies

After creating the bucket, add policies:

```sql
-- Anyone can read images (needed for public e-card rendering)
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'share-card-images');

-- Allow uploads from the anon key
CREATE POLICY "Anon upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'share-card-images');
```

---

## 3. Verify environment variables

Make sure these are set in both `.env.local` (for local dev) and in Vercel (Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

---

## 4. Test

After completing the above, the share flow should work:
1. Open any card → View e-card → tap "Share e-card"
2. The app uploads images to the bucket and inserts a row
3. A shareable URL like `your-app.vercel.app/share/abc12345` is displayed
4. Opening that URL in any browser (even without the access code) shows the e-card

---

# Part B — Usage Analytics (usage_events)

Server-side storage of all AI API calls for cost tracking, usage analytics, and UX insights across all users/testers.

## 1. Create the `usage_events` table

Go to **SQL Editor** in the Supabase dashboard and run:

```sql
CREATE TABLE usage_events (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_id text NOT NULL,
  user_name text,
  endpoint text NOT NULL,
  model text NOT NULL,
  call_type text NOT NULL,
  estimated_cost numeric(10, 6) NOT NULL DEFAULT 0,
  card_id text,
  recipient_id text,
  user_agent text
);

-- Index for querying by device and time
CREATE INDEX usage_events_device_idx ON usage_events (device_id, created_at DESC);

-- Index for querying by endpoint (for analytics)
CREATE INDEX usage_events_endpoint_idx ON usage_events (endpoint, created_at DESC);
```

## 2. Enable RLS and add policies

```sql
-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Allow inserts from the anon key (client-side logging)
CREATE POLICY "Anon insert" ON usage_events
  FOR INSERT WITH CHECK (true);

-- Allow reads from the anon key (for future analytics dashboard)
CREATE POLICY "Anon read" ON usage_events
  FOR SELECT USING (true);
```

## 3. Verify it's working

After creating the table:
1. Create a card in Nuuge (any flow that triggers AI generation).
2. In the Supabase dashboard, go to **Table Editor** → **usage_events**.
3. You should see rows appearing with endpoint, model, cost, device_id, and user_name.

## 4. Useful queries

Run these in the **SQL Editor** to analyze usage:

### Total cost and calls by user
```sql
SELECT user_name, device_id,
       COUNT(*) AS total_calls,
       ROUND(SUM(estimated_cost)::numeric, 4) AS total_cost
FROM usage_events
GROUP BY user_name, device_id
ORDER BY total_cost DESC;
```

### Cost breakdown by endpoint
```sql
SELECT endpoint, model,
       COUNT(*) AS calls,
       ROUND(SUM(estimated_cost)::numeric, 4) AS total_cost,
       ROUND(AVG(estimated_cost)::numeric, 4) AS avg_cost
FROM usage_events
GROUP BY endpoint, model
ORDER BY total_cost DESC;
```

### Cost per card
```sql
SELECT card_id, user_name,
       COUNT(*) AS calls,
       ROUND(SUM(estimated_cost)::numeric, 4) AS card_cost
FROM usage_events
WHERE card_id IS NOT NULL
GROUP BY card_id, user_name
ORDER BY card_cost DESC;
```

### Detect potential UX problems (excessive regeneration)
```sql
SELECT card_id, user_name, endpoint,
       COUNT(*) AS call_count
FROM usage_events
WHERE card_id IS NOT NULL
GROUP BY card_id, user_name, endpoint
HAVING COUNT(*) > 5
ORDER BY call_count DESC;
```

### Daily usage trend
```sql
SELECT DATE(created_at) AS day,
       COUNT(*) AS calls,
       ROUND(SUM(estimated_cost)::numeric, 4) AS daily_cost
FROM usage_events
GROUP BY DATE(created_at)
ORDER BY day DESC;
```
