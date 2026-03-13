import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { trackUsage } from "@/lib/usage";
import { GLOBAL_GUARDRAILS } from "@/lib/card-recipes";
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
  const rl = checkRateLimit(ip, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }
  try {
    const body = await req.json();
    const {
      imagePrompt,
      userId,
      isInsideIllustration,
      cardSize,
      existingImageBase64,
      insideImageSize,
      frontImageBase64,
      editInstruction,
    }: {
      imagePrompt: string;
      userId: string;
      isInsideIllustration?: boolean;
      cardSize?: "4x6" | "5x7";
      existingImageBase64?: string;
      insideImageSize?: "1536x1024" | "1024x1536" | "1024x1024";
      frontImageBase64?: string;
      editInstruction?: string;
    } = body;

    const avoidList = GLOBAL_GUARDRAILS.avoid.join("; ");
    const literalRules = `
STRICT RULES — follow the scene description LITERALLY:
- Depict EXACTLY the scene described. Do NOT change the location, add/remove elements, or substitute a different setting.
- Do NOT add human figures, faces, or body parts unless the scene description EXPLICITLY mentions people. If people are mentioned, render them ONLY as silhouettes, abstract shapes, or seen from behind — NEVER with detailed faces, skin tones, or ethnic features.
- ${GLOBAL_GUARDRAILS.alwaysInclude.join(". ")}.
- ${GLOBAL_GUARDRAILS.prefer.join(". ")}.
- AVOID: ${avoidList}.`;

    const isPortraitCard = !isInsideIllustration && (cardSize === "4x6" || cardSize === "5x7");
    const size = isInsideIllustration
      ? (insideImageSize || "1024x1024")
      : isPortraitCard
        ? "1024x1536" as const
        : "1024x1024";

    // For inside illustrations: always edit from a source image (front cover or existing inside image)
    // For front cover: edit existing if refining, otherwise generate fresh
    const sourceImageBase64 = isInsideIllustration
      ? (existingImageBase64 || frontImageBase64)
      : existingImageBase64;

    const isEditing = Boolean(sourceImageBase64);

    let imageBase64: string;

    if (isEditing && sourceImageBase64) {
      let editPrompt: string;
      if (isInsideIllustration && !existingImageBase64 && frontImageBase64) {
        editPrompt = `Using this greeting card front cover as the source, create a decorative inside-card element by extracting or re-composing elements from it.\n\n${imagePrompt}\n\nKeep the exact same art style, colors, and feel as the source image. The result should look like a detail or crop from the same artwork. No text.`;
      } else if (isInsideIllustration && editInstruction) {
        editPrompt = `IMPORTANT — MAKE THIS CHANGE TO THE IMAGE:\n${editInstruction}\n\nKeep everything else exactly the same. Do not change elements that weren't mentioned.\n\nFull scene for reference: ${imagePrompt}`;
      } else if (isInsideIllustration) {
        editPrompt = `Edit this inside-card illustration. Keep the same style and composition. Apply this change:\n\n${imagePrompt}`;
      } else if (editInstruction) {
        editPrompt = `IMPORTANT — MAKE THIS SPECIFIC CHANGE TO THE IMAGE:\n${editInstruction}\n\nKeep everything else exactly the same — same subject, same composition, same style. Only change what was requested above.\n\n${literalRules}\n\nFull scene for reference: ${imagePrompt}`;
      } else {
        editPrompt = `Edit this greeting card illustration. Keep the same overall composition, style, and artistic feel. Apply this change:\n\n${literalRules}\n\nUpdated scene: ${imagePrompt}`;
      }

      const rawBase64 = sourceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(rawBase64, "base64");
      const imageFile = await toFile(imageBuffer, "card.png", { type: "image/png" });

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt: editPrompt,
        size: size as "1024x1024" | "1024x1536",
        input_fidelity: "high",
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned from edit");
      imageBase64 = b64;

      trackUsage(userId, "image_edit", {
        prompt_length: imagePrompt.length,
        model: "gpt-image-1",
        size,
      });
    } else {
      const cardPrompt = `Greeting card FRONT illustration, portrait format (taller than wide). Full-bleed composition, no important details at the very edges. No text in image.\n\n${literalRules}\n\nScene: ${imagePrompt}`;

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: cardPrompt,
        n: 1,
        size: size as "1024x1024" | "1024x1536",
        quality: "medium",
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned from generation");
      imageBase64 = b64;

      trackUsage(userId, "image_generation", {
        prompt_length: imagePrompt.length,
        model: "gpt-image-1",
        size,
      });
    }

    const dataUrl = `data:image/png;base64,${imageBase64}`;

    return NextResponse.json({
      imageUrl: dataUrl,
      isEdit: isEditing,
    });
  } catch (error: unknown) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
