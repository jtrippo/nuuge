import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it in Vercel under Settings → Environment Variables." },
      { status: 500 }
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }
  try {
    const body = await req.json();
    const {
      senderContext,
      recipientContext,
      occasion,
      tone,
      includeFaithBased = false,
      messageText,
      additionalNotes,
      pastDesignThemes,
      preferredSubject,
      preferredStyle,
      preferredMood,
      selectedInterests,
    }: {
      senderContext: string;
      recipientContext: string;
      occasion: string;
      tone: string;
      includeFaithBased?: boolean;
      messageText: string;
      additionalNotes: string;
      pastDesignThemes?: string[];
      preferredSubject?: string;
      preferredStyle?: string;
      preferredMood?: string;
      selectedInterests?: string[];
    } = body;

    const faithDesignNote = includeFaithBased
      ? `\nFAITH-BASED CARD: Use respectful, non-denominational imagery (e.g. soft light, peaceful motifs, nature, warmth, hope). Avoid humor, sarcasm, or edgy visuals. Keep all 3 concepts sincere and appropriate for a spiritual/faith-based occasion.\n`
      : "";

    const pastThemesBlock =
      pastDesignThemes && pastDesignThemes.length > 0
        ? `\nPAST CARD DESIGNS FOR THIS PERSON (do NOT repeat or closely resemble these themes):\n${pastDesignThemes.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n`
        : "";

    const systemPrompt = `You are Nuuge's card design engine. Suggest 3 DIVERSE card front designs.

ABOUT THE SENDER:
${senderContext}

ABOUT THE RECIPIENT:
${recipientContext}

OCCASION: ${occasion}
TONE: ${tone}
${faithDesignNote}
THE CARD MESSAGE: ${messageText}
${additionalNotes ? `ADDITIONAL NOTES: ${additionalNotes}` : ""}
${pastThemesBlock}
${preferredSubject || preferredStyle || preferredMood ? `USER PREFERENCES (incorporate these into ALL 3 concepts):
${preferredSubject ? `- Subject preference: ${preferredSubject}` : ""}
${preferredStyle ? `- Art style preference: ${preferredStyle}` : ""}
${preferredMood ? `- Mood preference: ${preferredMood}` : ""}
All 3 concepts should respect these preferences while still being diverse in their specific scenes.\n` : ""}
${selectedInterests && selectedInterests.length > 0 ? `USER-SELECTED INTERESTS FOR THIS IMAGE: ${selectedInterests.join(", ")}
Concept 1 MUST directly feature one of these interests as the PRIMARY scene element — not as background decoration, but as the central subject of the illustration. The other concepts should also draw from these interests where natural.\n` : ""}
DIVERSITY IS CRITICAL. The 3 concepts MUST come from different angles:

**Concept 1 — Personal detail**: ${selectedInterests && selectedInterests.length > 0 ? `Use one of the USER-SELECTED INTERESTS above as the primary scene element.` : `Pick ONE specific detail from the recipient's profile (an interest, hobby, or personality trait). Use it as inspiration for a scene.`} IMPORTANT: The recipient's profile may mention several interests — do NOT always pick the most "interesting" or unusual one. Rotate. If past designs already used a particular interest, pick a DIFFERENT one.

**Concept 2 — Relationship & occasion**: Focus on the relationship dynamic between sender and recipient, or the occasion itself. Draw from their shared experiences, the sender's personality/humor style, or the emotional core of the occasion. This should feel like it's about "us" or "this moment" — not about one hobby keyword.

**Concept 3 — Mood & atmosphere**: A broader, evocative scene that captures the tone and feeling without leaning on profile keywords. Think: a beautiful seasonal setting, an abstract warm scene, nature, humor, or a universal visual metaphor. Let the SENDER's personality and style influence the vibe (e.g. if the sender is sarcastic, maybe something playful or unexpected; if sentimental, something tender).

CRITICAL — PEOPLE IN ILLUSTRATIONS:
${preferredSubject?.toLowerCase().includes("people") ? `The user chose "People / Relationships" as their subject. You MAY include human figures, but ALWAYS describe them as silhouettes, abstract forms, or seen from behind. NEVER describe specific facial features, skin color, hair color, or ethnicity. Use phrases like "two silhouetted figures", "an abstract embrace", "shadows on a path", "hands reaching toward each other". The image generator cannot reliably render diverse human appearances, so keep figures universal and impressionistic.` : `Do NOT include people, human figures, faces, or body parts in ANY image_prompt. The image generator renders people poorly (cartoonish, wrong demographics). Instead, suggest the presence of people through objects: two coffee mugs, a pair of shoes by a door, a handwritten note, an empty swing still swaying, etc. This creates warmth without the risk of bad figure rendering.`}

Each concept should:
- Be LITERALLY and SPECIFICALLY describable so an image generator follows it exactly (e.g. "a cozy kitchen table with two mugs of coffee, morning light through a window, a small handwritten note" — not vague like "a warm scene")
- Describe a single, clear scene — no stock-photo clichés
- Style: original illustration, warm and hand-crafted (e.g. "soft watercolor", "colored pencil", "gouache illustration"). NOT photorealistic.
- Match the overall tone of the card

AGE-APPROPRIATE IMAGERY — calibrate the visual style to the recipient's age (check the "Age" or "Approximate age" line in ABOUT THE RECIPIENT above):
- Child (under 13): Bright, playful, whimsical. Cartoon-style animals, friendly characters, bold colors, storybook quality.
- Teen (13-18): Stylish, contemporary, cool. Graphic design influence, pop-culture-aware aesthetics, vibrant but not childish.
- Young adult (19-30): Modern, tasteful, energetic. Clean illustration styles, trendy color palettes, aspirational scenes.
- Adult (31-55): Sophisticated, atmospheric, refined. Rich textures, nuanced compositions. Animals should be depicted naturally or artistically (silhouettes, fine illustration) rather than as cartoons.
- Senior (55+): Elegant, classic, warm. Timeless compositions, gentle color palettes, serene scenes. Quality over novelty.
If no age information is provided, default to adult-appropriate imagery. Never mention the recipient's age in the image_prompt text itself.

For each concept, provide:
- A short title (2-4 words)
- A 1-2 sentence description the user will see
- A detailed image_prompt: very specific about scene, setting, colors, composition, and art style. The image generator must follow this literally.

Respond with ONLY valid JSON:
{
  "designs": [
    {
      "title": "Short Title",
      "description": "What the user sees.",
      "image_prompt": "Detailed DALL-E prompt with style, composition, colors, mood, specific elements."
    },
    {
      "title": "...",
      "description": "...",
      "image_prompt": "..."
    },
    {
      "title": "...",
      "description": "...",
      "image_prompt": "..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Suggest 3 card front design concepts." },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse design suggestions");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Design suggestion error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to suggest designs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
