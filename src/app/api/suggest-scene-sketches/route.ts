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
  const rl = checkRateLimit(ip, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const {
      subjects,
      mood,
      occasion,
      tone,
      recipientAge,
      recipientRelationship,
      interests,
    }: {
      subjects: string[];
      mood: string;
      occasion: string;
      tone: string;
      recipientAge?: string;
      recipientRelationship?: string;
      interests?: string[];
    } = body;

    if (!subjects?.length || !mood || !occasion) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const ageGuidance = recipientAge
      ? `The recipient's approximate age range is "${recipientAge}". Calibrate ALL scene ideas to be age-appropriate:
- Child (under 13): Bright, playful, whimsical scenes. Cartoon animals, friendly characters, bold colors.
- Teen (13-18): Cool, contemporary, stylish. Pop-culture-aware but not childish.
- Young adult (19-30): Modern, aspirational, energetic. Clean styles, trendy palettes.
- Adult (31-55): Sophisticated, atmospheric, refined. No childish characters or cartoons. Animals depicted naturally or artistically.
- Senior (55+): Elegant, classic, warm. Timeless quality, gentle palettes.`
      : "No age information — default to adult-appropriate imagery.";

    const interestsGuidance = interests && interests.length > 0
      ? `\nRECIPIENT INTERESTS: ${interests.join(", ")}
Scene ideas MUST relate to these interests whenever the subject allows it. At least 2 of the 3 ideas per subject should incorporate or be inspired by these interests. For example, if interests include "rock climbing" and the subject is "Nature / Landscapes", suggest climbing-related nature scenes rather than generic gardens or islands.`
      : "";

    const systemPrompt = `You are Nuuge's scene idea generator. For each subject category provided, suggest exactly 3 short scene ideas that could inspire a greeting card illustration.

OCCASION: ${occasion}
TONE: ${tone}
MOOD: ${mood.replace(/_/g, " ")}
${recipientRelationship ? `RELATIONSHIP: ${recipientRelationship}` : ""}
${interestsGuidance}

${ageGuidance}

Each scene idea should be:
- One concise sentence (8-20 words)
- Specific and visually concrete (not vague)
- Matched to the mood and tone
- Age-appropriate per the guidance above
- Style: illustration / hand-crafted feel, NOT photorealistic

Respond with ONLY valid JSON. Use EXACTLY these keys — do NOT rename, expand, or modify them:
{
  "sketches": {
${subjects.map((s) => `    "${s}": ["scene idea 1", "scene idea 2", "scene idea 3"]`).join(",\n")}
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate scene ideas." },
      ],
      temperature: 0.95,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse scene sketch suggestions");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize keys: the model may return expanded names instead of the exact IDs we sent
    if (parsed.sketches && typeof parsed.sketches === "object") {
      const normalized: Record<string, string[]> = {};
      const returnedKeys = Object.keys(parsed.sketches);
      for (const expectedId of subjects) {
        // Exact match first
        if (parsed.sketches[expectedId]) {
          normalized[expectedId] = parsed.sketches[expectedId];
          continue;
        }
        // Fuzzy: find a returned key that starts with or contains the expected ID
        const fuzzy = returnedKeys.find(
          (k) => k.startsWith(expectedId) || expectedId.startsWith(k) || k.replace(/[_\s]/g, "").includes(expectedId.replace(/[_\s]/g, ""))
        );
        if (fuzzy && Array.isArray(parsed.sketches[fuzzy])) {
          normalized[expectedId] = parsed.sketches[fuzzy];
        }
      }
      parsed.sketches = normalized;
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Scene sketch suggestion error:", error);
    const message = error instanceof Error ? error.message : "Failed to suggest scene sketches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
