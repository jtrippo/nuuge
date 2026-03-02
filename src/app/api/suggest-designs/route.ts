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
- Be visually describable so an AI image generator could produce it
- Range from more traditional to more creative/unexpected

For each concept, provide:
- A short title (2-4 words)
- A 1-2 sentence description the user will see to understand the concept
- A detailed visual prompt that would be sent to an image generator (the user won't see this — be specific about style, composition, colors, mood)

Think creatively. If the recipient loves fishing, don't just draw a fish — maybe two fishing rods crossed like a toast for an anniversary. If they love cooking, maybe a birthday cake made of their favorite ingredients. Use the context to make connections.

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
