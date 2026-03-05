import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildOnboardingMessages, buildRecipientMessages } from "@/lib/ai/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      mode,
      conversationHistory,
      userContext,
    }: {
      mode: "onboarding" | "recipient";
      conversationHistory: { role: "assistant" | "user"; content: string }[];
      userContext?: string;
    } = body;

    let messages;
    if (mode === "onboarding") {
      messages = buildOnboardingMessages(conversationHistory);
    } else {
      messages = buildRecipientMessages(
        userContext || "No user context available yet.",
        conversationHistory
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || "";

    const isComplete = reply.includes("[CONTEXT_COMPLETE]");
    let extractedContext = null;

    if (isComplete) {
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          extractedContext = JSON.parse(jsonMatch[1]);
        } catch {
          // JSON parsing failed — continue without extracted context
        }
      }
    }

    const cleanReply = reply
      .replace(/\[CONTEXT_COMPLETE\]/, "")
      .replace(/```json[\s\S]*?```/, "")
      .trim();

    return NextResponse.json({
      reply: cleanReply,
      isComplete,
      extractedContext,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get AI response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
