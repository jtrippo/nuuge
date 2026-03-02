# Nuuge

Cards that actually sound like you. AI-powered personal cards created from context about you and the people you care about.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get your API keys

**OpenAI API Key:**
- Go to [platform.openai.com](https://platform.openai.com)
- Create an account (separate from ChatGPT)
- Navigate to API Keys and create a new key
- Add billing with ~$10-20 to start

**Supabase (optional for MVP — app works with local storage initially):**
- Go to [supabase.com](https://supabase.com)
- Create a project
- Copy the project URL and anon key from Settings > API

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your keys:
```
OPENAI_API_KEY=sk-your-key-here
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Onboarding** — Nuuge has a conversation with you to understand your personality, humor style, interests, and communication style
2. **Add recipients** — For each person you want to send cards to, Nuuge interviews you about them (interests, relationship dynamic, tone)
3. **Create cards** — Based on the context files built through conversation, Nuuge generates personalized messages and card designs
4. **Send** — Digital delivery, print at home, or mail via the service

## Architecture

- **Frontend:** Next.js + Tailwind CSS
- **AI Text:** OpenAI GPT-4o
- **AI Images:** OpenAI DALL-E 3 (Phase 2)
- **Database:** Local storage for MVP, Supabase PostgreSQL for production
- **Auth:** Supabase Auth (Phase 2)
