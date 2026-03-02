import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { trackUsage } from "@/lib/usage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imagePrompt,
      refinement,
      promptHistory,
      userId,
      isInsideIllustration,
      cardSize,
    }: {
      imagePrompt: string;
      refinement?: string;
      promptHistory?: { prompt: string; refinement?: string }[];
      userId: string;
      isInsideIllustration?: boolean;
      /** "4x6" | "5x7" — use portrait aspect ratio so image fills card front */
      cardSize?: "4x6" | "5x7";
    } = body;

    const historyBlock =
      promptHistory && promptHistory.length > 0
        ? `CRITICAL - The user has already requested changes. Follow their SPECIFIC description literally:\n${promptHistory
            .map(
              (h, i) =>
                `Previous request ${i + 1}: ${h.prompt}${h.refinement ? `\nTheir refinement: ${h.refinement}` : ""}`
            )
            .join("\n\n")}\n\nCurrent request (you MUST match this literally, do not substitute a different scene, culture, or setting):\n`
        : "";

    const fullPrompt = refinement
      ? `${imagePrompt}\n\nAdditional refinement: ${refinement}`
      : imagePrompt;

    const literalRules = `
STRICT RULES - follow the user's description LITERALLY:
- Do NOT substitute a different scene, location, or culture (e.g. if they say "hiking in Sierra Nevada" do NOT show desert or different clothing).
- Create an ORIGINAL illustration suitable for a greeting card — NOT a stock photo, NOT generic imagery.
- No text or words in the image unless the user explicitly asks for text.
- Style: warm, illustrated, hand-crafted feel — avoid photorealistic or clip-art stock look.`;

    const isPortraitCard = !isInsideIllustration && (cardSize === "4x6" || cardSize === "5x7");
    const size = isInsideIllustration ? "1024x1024" : isPortraitCard ? "1024x1792" : "1024x1024";

    const cardPrompt = isInsideIllustration
      ? `Create a small, subtle inside-card illustration that carries the same theme as the card. Simple, minimal, decorative — no text. Suitable for the inside of a folded greeting card.\n\n${literalRules}\n\n${historyBlock}${fullPrompt}`
      : `Create a greeting card FRONT illustration. The image will be printed as a portrait-format card (taller than wide). Compose so the art fills the full card with no important details at the very edges. Clean composition, no text in the image, visually appealing. Optional text may be overlaid later.${literalRules}\n\n${historyBlock}${fullPrompt}`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: cardPrompt,
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image returned from DALL-E");
    }

    trackUsage(userId, "image_generation", {
      prompt_length: fullPrompt.length,
      model: "dall-e-3",
      size,
    });

    return NextResponse.json({
      imageUrl,
      revisedPrompt: response.data?.[0]?.revised_prompt,
    });
  } catch (error: unknown) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
