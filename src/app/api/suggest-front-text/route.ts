import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const POSITIONS = ["bottom-right", "bottom-center", "top-center", "top-left", "bottom-left"];

interface FrontTextSuggestion {
  wording: string;
  position: string;
}

function fallbackSuggestions(occasion: string): FrontTextSuggestion[] {
  const w1 = occasion === "Birthday" ? "Happy Birthday!" : occasion === "Anniversary" ? "Celebrating You" : "Thinking of You";
  return [
    { wording: w1, position: "bottom-right" },
    { wording: "With Love", position: "bottom-center" },
    { wording: "For You", position: "top-center" },
  ];
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it in Vercel under Settings → Environment Variables." },
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
    const body = await req.json();
    const {
      occasion,
      tone,
      recipientName,
      relationshipType,
      previousWordings,
      messageText,
      artStyle,
      imageSubject,
    }: {
      occasion: string;
      tone: string;
      recipientName: string;
      relationshipType?: string;
      previousWordings?: string[];
      messageText?: string;
      artStyle?: string;
      imageSubject?: string;
    } = body;

    const avoidClause =
      previousWordings && previousWordings.length > 0
        ? `\nDo NOT reuse any of these previously suggested phrases (or close variations): ${previousWordings.map((w) => `"${w}"`).join(", ")}. Be creative and offer completely different options.`
        : "";

    const messageContext = messageText
      ? `\nThe inside message reads:\n"${messageText.slice(0, 500)}"`
      : "";

    const imageContext = (artStyle || imageSubject)
      ? `\nThe card image is ${artStyle ? `${artStyle} style` : ""}${artStyle && imageSubject ? ", " : ""}${imageSubject ? `featuring ${imageSubject}` : ""}.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You write short front-cover text for a greeting card. The text overlays the card's artwork, so it should complement the image and feel cohesive with the inside message.

Guidelines:
- Give exactly 3 options, each 1–5 words.
- Avoid generic filler phrases like "Thinking of You", "With Love", "Celebrating You", "For You", or "Cheers to Us". These are overused and feel impersonal.
- Instead, draw from the specific message content, the relationship, and the occasion to craft something that feels personal and intentional.
- Options should vary: one can be warm/sincere, one playful or evocative, one can reference the image subject or a theme from the message.
- Match the overall tone the sender chose. If the tone is funny, the front text can be witty. If heartfelt, it should feel genuine — not saccharine.
- Consider how the text looks on the artwork. Suggest placement that complements the image composition.

Context:
- Occasion: ${occasion}
- Tone: ${tone}
- Recipient: ${recipientName}${relationshipType ? ` (sender's ${relationshipType.toLowerCase()})` : ""}${imageContext}${messageContext}${avoidClause}

Reply with JSON only:
{ "suggestions": [
  { "wording": "phrase 1", "position": "one of: bottom-right, bottom-center, top-center, top-left, bottom-left" },
  { "wording": "phrase 2", "position": "..." },
  { "wording": "phrase 3", "position": "..." }
] }`,
        },
        { role: "user", content: "Suggest 3 front text options." },
      ],
      temperature: 1.0,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ suggestions: fallbackSuggestions(occasion) });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 1) {
      const suggestions: FrontTextSuggestion[] = parsed.suggestions.slice(0, 3).map((s: { wording?: string; position?: string }) => ({
        wording: typeof s.wording === "string" ? s.wording.trim() : "Thinking of You",
        position: POSITIONS.includes(s.position ?? "") ? s.position! : "bottom-right",
      }));
      while (suggestions.length < 3) {
        suggestions.push({ wording: "For You", position: "bottom-center" });
      }
      return NextResponse.json({ suggestions });
    }

    if (typeof parsed.wording === "string") {
      const position = POSITIONS.includes(parsed.position) ? parsed.position : "bottom-right";
      return NextResponse.json({
        suggestions: [
          { wording: parsed.wording.trim(), position },
          ...fallbackSuggestions(occasion).slice(1),
        ],
      });
    }

    return NextResponse.json({ suggestions: fallbackSuggestions(occasion) });
  } catch (error: unknown) {
    console.error("Front text suggestion error:", error);
    return NextResponse.json(
      { suggestions: fallbackSuggestions("") },
      { status: 200 }
    );
  }
}
