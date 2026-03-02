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
      userId,
    }: {
      imagePrompt: string;
      refinement?: string;
      userId: string;
    } = body;

    const fullPrompt = refinement
      ? `${imagePrompt}\n\nAdditional refinement: ${refinement}`
      : imagePrompt;

    const cardPrompt = `Create a greeting card front illustration. The image should be suitable for printing on a card — clean composition, no text or words in the image, visually appealing with some empty space for potential text overlay.\n\n${fullPrompt}`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: cardPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image returned from DALL-E");
    }

    trackUsage(userId, "image_generation", {
      prompt_length: fullPrompt.length,
      model: "dall-e-3",
      size: "1024x1024",
    });

    return NextResponse.json({
      imageUrl,
      revisedPrompt: response.data[0]?.revised_prompt,
    });
  } catch (error: unknown) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
