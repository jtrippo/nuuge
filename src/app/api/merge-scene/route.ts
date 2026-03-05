import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 500 }
    );
  }

  try {
    const { currentScene, change }: { currentScene: string; change: string } =
      await req.json();

    const { choices } = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You merge a user's change into an existing scene description, classify the change type, and write a focused edit instruction.

Rules for merging:
- Keep everything from the current scene UNLESS the user's change contradicts it.
- Apply the change literally: add what they want added, remove what they want removed.
- Keep it concise (2-4 sentences). Plain language, no flowery prose.
- Do NOT invent new elements the user didn't ask for.

Rules for classification:
- "refine" = small edits the AI image editor can handle on the existing image: add/remove an element, change a color, adjust lighting, reposition something.
- "redesign" = the user is asking for a fundamentally different image that cannot be achieved by editing: changing the entire art style (e.g. "make it a sketch"), switching the subject entirely, requesting a completely different scene, changing from color to black-and-white, etc.

Rules for editInstruction:
- Write a short, forceful, specific instruction that tells an image editor EXACTLY what to change.
- Lead with the most important change. Be explicit about what to ADD and what to REMOVE.
- Mention specific colors, lighting, elements by name. Example: "Replace the warm yellow/golden background with a pure clean white background. Remove all warm color tinting and golden glow."
- Do NOT describe the whole scene — only describe what is DIFFERENT from the current image.
- Keep it to 1-3 sentences, imperative tone.

Respond in JSON: { "mergedScene": "...", "changeType": "refine" | "redesign", "editInstruction": "..." }
Output ONLY valid JSON, no markdown fences, no explanation.`,
        },
        {
          role: "user",
          content: `Current scene: ${currentScene}\n\nUser's change: ${change}`,
        },
      ],
      max_tokens: 500,
    });

    const raw = choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("No response from merge");

    let mergedScene: string;
    let changeType: "refine" | "redesign" = "refine";
    let editInstruction: string = "";

    try {
      const parsed = JSON.parse(raw);
      mergedScene = parsed.mergedScene;
      changeType = parsed.changeType === "redesign" ? "redesign" : "refine";
      editInstruction = parsed.editInstruction || "";
    } catch {
      mergedScene = raw;
    }

    return NextResponse.json({ mergedScene, changeType, editInstruction });
  } catch (error: unknown) {
    console.error("Merge scene error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to merge scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
