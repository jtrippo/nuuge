import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const POSITIONS = ["bottom-right", "bottom-center", "top-center", "top-left", "bottom-left"];

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it in Vercel under Settings → Environment Variables." },
      { status: 500 }
    );
  }
  try {
    const body = await req.json();
    const {
      occasion,
      tone,
      recipientName,
    }: {
      occasion: string;
      tone: string;
      recipientName: string;
    } = body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You suggest short wording for the front of a greeting card (e.g. "Happy Birthday!", "With Love", "Congratulations!"). One short phrase only. Also suggest placement. Occasion: ${occasion}. Tone: ${tone}. Recipient: ${recipientName}. Reply with JSON only: { "wording": "the phrase", "position": "one of: bottom-right, bottom-center, top-center, top-left, bottom-left" }`,
        },
        { role: "user", content: "Suggest front text and position." },
      ],
      temperature: 0.6,
      max_tokens: 100,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        wording: occasion === "Birthday" ? "Happy Birthday!" : occasion === "Anniversary" ? "Celebrating You" : "Thinking of You",
        position: "bottom-right",
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const position = POSITIONS.includes(parsed.position) ? parsed.position : "bottom-right";
    return NextResponse.json({
      wording: typeof parsed.wording === "string" ? parsed.wording.trim() : "Thinking of You",
      position,
    });
  } catch (error: unknown) {
    console.error("Front text suggestion error:", error);
    return NextResponse.json(
      { wording: "Thinking of You", position: "bottom-right" },
      { status: 200 }
    );
  }
}
