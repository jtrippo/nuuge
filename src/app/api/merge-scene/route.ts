import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
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
    const {
      currentScene,
      change,
      currentInterests = [],
      recipientAge,
      recipientAgeBand,
      recipientRelationship,
    }: {
      currentScene: string;
      change: string;
      currentInterests?: string[];
      recipientAge?: number | null;
      recipientAgeBand?: string | null;
      recipientRelationship?: string;
    } = await req.json();

    const interestsNote =
      currentInterests.length > 0
        ? `\n\nCurrent interests to use (only these): ${currentInterests.join(", ")}. In the output, any "Personal touch" or interests line must reference only these, or omit if none fit the scene.`
        : "\n\nNo interests list provided — omit or minimalize any Personal touch line in the output.";

    let recipientNote = "";
    if (recipientAge != null || recipientAgeBand || recipientRelationship) {
      const parts: string[] = [];
      if (recipientRelationship) parts.push(`Relationship: ${recipientRelationship}`);
      if (recipientAge != null) parts.push(`Age: ${recipientAge}`);
      else if (recipientAgeBand) parts.push(`Approximate age: ${recipientAgeBand}`);
      recipientNote = `\n\nRECIPIENT CONTEXT: ${parts.join(". ")}. If the user's change involves depicting people (e.g. "father and son"), render them at the CORRECT ages based on this context — do NOT default to showing a child unless the recipient IS a child.`;
    }

    const { choices } = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You merge a user's change into an existing FULL image prompt and output a complete prompt. The output will be used to GENERATE A NEW IMAGE from scratch (not to edit an existing image).

OUTPUT: Return the FULL prompt with the same structure as the input (guardrails, Recipient, Scene, Composition, Lighting, Palette, Art style, Texture, Composition feel, Personal touch/context, Occasion, AVOID). Do not truncate sections.

CRITICAL — Scene section:
- INTEGRATE the user's change INTO the "Scene:" section. Do NOT append the change at the end of the whole prompt.
- Rewrite ONLY the Scene paragraph so it is one coherent description that includes both the existing scene and the requested change.
- Use GENERATION-FRIENDLY wording: we are generating a new image from this text. So convert "remove X" / "no X" into positive constraints, e.g. "No people in the scene", "No figures", "No hiker". Do not use edit-language like "Remove the hiker" — use "Scene has no people" or "No human figures" instead.
- Add what the user asked for (e.g. campsite, fire ring, tents, smoke) as part of the same Scene description. Keep it concise but clear.

Other sections:
- Keep Recipient, Composition, Lighting, Palette, Art style, Texture, Line quality, Composition feel, Occasion, AVOID exactly as in the input unless the user's change explicitly asks to change them.
- Personal touch / interests: use only the current interests list provided; if none or empty, omit or minimalize that line.

Classification:
- "refine" = add/remove an element, small tweak, same style and subject.
- "redesign" = fundamentally different style, subject, or scene.

editInstruction: One short sentence summarizing what will change (for UI display only). Use generation-friendly phrasing, e.g. "Scene will have no people; add campsite in distance with fire ring, smoke, and two tents."

Respond in JSON: { "mergedScene": "<full prompt text>", "changeType": "refine" | "redesign", "editInstruction": "..." }
Output ONLY valid JSON, no markdown fences, no explanation. Escape any quotes inside mergedScene.`,
        },
        {
          role: "user",
          content: `Current full prompt:\n${currentScene}\n\nUser's change: ${change}${interestsNote}${recipientNote}`,
        },
      ],
      max_tokens: 1200,
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
