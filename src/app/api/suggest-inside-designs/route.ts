import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      frontTitle,
      frontDescription,
      frontImagePrompt,
      occasion,
      tone,
    }: {
      frontTitle: string;
      frontDescription: string;
      frontImagePrompt: string;
      occasion: string;
      tone: string;
    } = body;

    const systemPrompt = `You suggest small inside-card illustrations that carry the same theme as the card front. These appear on the inside left (or top) of a folded greeting card — subtle, decorative, no text.

FRONT OF CARD: "${frontTitle}" — ${frontDescription}
(Full front concept: ${frontImagePrompt})
OCCASION: ${occasion}
TONE: ${tone}

Suggest exactly 3 inside illustration concepts that echo the front. Examples:
- If the front has stars → a shooting star, or small constellation, or starfield corner
- If the front has mountains/hiking → a small trail marker, pine branch, or mountain silhouette
- If the front has flowers → a single stem or small bouquet detail
- If the front has a scene with two people → a small symbolic detail (e.g. two birds, two leaves)

Each concept should be: minimal, one main visual element, same color/mood as front, suitable for the inside of a card (not overwhelming).

Respond with ONLY valid JSON:
{
  "designs": [
    {
      "title": "Short name",
      "description": "What the user sees.",
      "image_prompt": "Detailed DALL-E prompt: small inside-card illustration, single decorative element, [specific description], minimal, no text, same mood as front."
    },
    { "title": "...", "description": "...", "image_prompt": "..." },
    { "title": "...", "description": "...", "image_prompt": "..." }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Suggest 3 inside illustration concepts." },
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse inside design suggestions");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Inside design suggestion error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to suggest inside designs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
