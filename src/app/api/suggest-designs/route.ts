import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      senderContext,
      recipientContext,
      occasion,
      tone,
      messageText,
      additionalNotes,
    }: {
      senderContext: string;
      recipientContext: string;
      occasion: string;
      tone: string;
      messageText: string;
      additionalNotes: string;
    } = body;

    const systemPrompt = `You are Nuuge's card design engine. Your job is to suggest creative, personal card front designs based on deep context about the sender, recipient, and occasion.

ABOUT THE SENDER:
${senderContext}

ABOUT THE RECIPIENT:
${recipientContext}

OCCASION: ${occasion}
TONE: ${tone}
THE CARD MESSAGE: ${messageText}
${additionalNotes ? `ADDITIONAL NOTES: ${additionalNotes}` : ""}

YOUR TASK:
Suggest exactly 3 different card front design concepts. Each should:
- Be deeply personal — reference the recipient's specific interests, hobbies, or personality
- Match the tone of the card message
- Be LITERALLY and SPECIFICALLY describable so an image generator follows it exactly (e.g. "two people hiking on a mountain trail in the Sierra Nevada, casual American outdoor clothing, pine trees, clear sky" — not vague like "two people in nature")
- Describe a single, clear scene — no stock-photo clichés or generic imagery. Avoid substituting unrelated cultures, settings, or styles (e.g. if the context is hiking in US mountains, do not suggest desert or traditional dress)
- Style: original illustration, warm and hand-crafted feel — NOT photorealistic stock photo
- Range from more traditional to more creative/unexpected

For each concept, provide:
- A short title (2-4 words)
- A 1-2 sentence description the user will see
- A detailed image_prompt: be VERY specific about scene, location, clothing, colors, composition. The image generator must follow this literally. Include style cues like "watercolor illustration" or "soft colored pencil style" to avoid a generic stock look.

Respond with ONLY valid JSON:
{
  "designs": [
    {
      "title": "Short Title",
      "description": "What the user sees — a plain description of the concept.",
      "image_prompt": "Detailed prompt for DALL-E: style, composition, colors, mood, specific elements. Should be a complete image generation prompt."
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
