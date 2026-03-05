import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it in Vercel under Settings → Environment Variables." },
      { status: 500 }
    );
  }
  try {
    const body = await req.json();
    const {
      senderContext,
      recipientContext,
      occasion,
      tone,
      messageText,
      additionalNotes,
      pastDesignThemes,
      preferredSubject,
      preferredStyle,
      preferredMood,
    }: {
      senderContext: string;
      recipientContext: string;
      occasion: string;
      tone: string;
      messageText: string;
      additionalNotes: string;
      pastDesignThemes?: string[];
      preferredSubject?: string;
      preferredStyle?: string;
      preferredMood?: string;
    } = body;

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
THE CARD MESSAGE: ${messageText}
${additionalNotes ? `ADDITIONAL NOTES: ${additionalNotes}` : ""}
${pastThemesBlock}
${preferredSubject || preferredStyle || preferredMood ? `USER PREFERENCES (incorporate these into ALL 3 concepts):
${preferredSubject ? `- Subject preference: ${preferredSubject}` : ""}
${preferredStyle ? `- Art style preference: ${preferredStyle}` : ""}
${preferredMood ? `- Mood preference: ${preferredMood}` : ""}
All 3 concepts should respect these preferences while still being diverse in their specific scenes.\n` : ""}
DIVERSITY IS CRITICAL. The 3 concepts MUST come from different angles:

**Concept 1 — Personal detail**: Pick ONE specific detail from the recipient's profile (an interest, hobby, or personality trait). Use it as inspiration for a scene. IMPORTANT: The recipient's profile may mention several interests — do NOT always pick the most "interesting" or unusual one. Rotate. If past designs already used a particular interest, pick a DIFFERENT one.

**Concept 2 — Relationship & occasion**: Focus on the relationship dynamic between sender and recipient, or the occasion itself. Draw from their shared experiences, the sender's personality/humor style, or the emotional core of the occasion. This should feel like it's about "us" or "this moment" — not about one hobby keyword.

**Concept 3 — Mood & atmosphere**: A broader, evocative scene that captures the tone and feeling without leaning on profile keywords. Think: a beautiful seasonal setting, an abstract warm scene, nature, humor, or a universal visual metaphor. Let the SENDER's personality and style influence the vibe (e.g. if the sender is sarcastic, maybe something playful or unexpected; if sentimental, something tender).

Each concept should:
- Be LITERALLY and SPECIFICALLY describable so an image generator follows it exactly (e.g. "a cozy kitchen table with two mugs of coffee, morning light through a window, a small handwritten note" — not vague like "a warm scene")
- Describe a single, clear scene — no stock-photo clichés
- Style: original illustration, warm and hand-crafted (e.g. "soft watercolor", "colored pencil", "gouache illustration"). NOT photorealistic.
- Match the overall tone of the card

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
