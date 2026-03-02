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
      additionalNotes,
      cardHistory,
      coSignWith,
    }: {
      senderContext: string;
      recipientContext: string;
      occasion: string;
      tone: string;
      additionalNotes: string;
      cardHistory: string[];
      coSignWith: string | null;
    } = body;

    const historySection =
      cardHistory.length > 0
        ? `\nPREVIOUS CARDS SENT TO THIS PERSON (do NOT repeat or closely resemble these):\n${cardHistory.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
        : "";

    const systemPrompt = `You are Nuuge's card writing engine. Your job is to generate personal, specific greeting card messages based on deep context about the sender and recipient.

ABOUT THE SENDER:
${senderContext}

ABOUT THE RECIPIENT:
${recipientContext}
${historySection}

OCCASION: ${occasion}
REQUESTED TONE: ${tone}
${additionalNotes ? `ADDITIONAL NOTES FROM SENDER: ${additionalNotes}` : ""}
${coSignWith ? `CO-SIGNING: The card should be signed from both the sender and ${coSignWith}. Use both names in the closing/sign-off (e.g., "Love, [sender] & ${coSignWith}").` : ""}

YOUR TASK:
Generate exactly 3 different card message options. Each should:
- Sound like it was written by the sender, not by an AI
- Reference specific details about the recipient (their interests, personality, shared experiences)
- Match the requested tone
- Be appropriate for the occasion
- Feel personal and specific — never generic

Each message should have:
- A greeting line
- The body (2-4 sentences)
- A closing/sign-off

Make the 3 options meaningfully different from each other:
- Option 1: The most straightforward, heartfelt version
- Option 2: A version that leans into humor or playfulness (using the recipient's interests or personality)
- Option 3: A creative or unexpected angle — maybe a reference to a shared interest, an inside-joke-style observation, or a clever twist

Keep messages concise. Real card messages are not essays.

Respond with ONLY valid JSON in this exact format:
{
  "messages": [
    {
      "label": "Heartfelt",
      "greeting": "the greeting line",
      "body": "the message body",
      "closing": "the sign-off"
    },
    {
      "label": "Playful",
      "greeting": "...",
      "body": "...",
      "closing": "..."
    },
    {
      "label": "Creative",
      "greeting": "...",
      "body": "...",
      "closing": "..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the 3 card message options." },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content || "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse card messages from AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Card generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
