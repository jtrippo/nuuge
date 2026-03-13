import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
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
      senderContext,
      recipientContext,
      occasion,
      tone,
      includeFaithBased = false,
      additionalNotes,
      cardHistory,
      coSignWith,
      relationshipType,
      regenerationCount,
      rejectedMessages,
    }: {
      senderContext: string;
      recipientContext: string;
      occasion: string;
      tone: string;
      includeFaithBased?: boolean;
      additionalNotes: string;
      cardHistory: string[];
      coSignWith: string | null;
      relationshipType?: string;
      regenerationCount?: number;
      rejectedMessages?: string[];
    } = body;

    const historySection =
      cardHistory.length > 0
        ? `\nPREVIOUS CARDS SENT TO THIS PERSON (do NOT repeat or closely resemble these):\n${cardHistory.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
        : "";

    const rejectedSection =
      rejectedMessages && rejectedMessages.length > 0
        ? `\nREJECTED MESSAGES (the sender already saw these and didn't like them — write something DIFFERENT, using different details and angles):\n${rejectedMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n`
        : "";

    const rel = (relationshipType || "").toLowerCase();
    const isFamilyChild =
      /niece|nephew|daughter|son|grandchild|granddaughter|grandson|godchild|goddaughter|godson|child|kid|teen/i.test(rel);
    const isFamily =
      isFamilyChild ||
      /parent|mother|father|mom|dad|aunt|uncle|grandmother|grandfather|grandma|grandpa|sibling|brother|sister|cousin|in-law|family/i.test(rel);
    const isRomantic =
      /partner|spouse|wife|husband|boyfriend|girlfriend|fiancé|fiancée|significant other|lover/i.test(rel);

    let relationshipGuardrail = "";
    if (isFamilyChild) {
      relationshipGuardrail = `
RELATIONSHIP GUARDRAIL — THIS IS CRITICAL:
The recipient is the sender's ${relationshipType}. This is a family relationship with a younger family member.
- Use warm, familial language (proud of you, watching you grow, you light up the room, etc.)
- NEVER use romantic, intimate, or lover-like language (no "you mean the world to me in ways I can't express", "my heart is yours", "can't wait to hold you", etc.)
- Keep affection appropriate: loving but clearly uncle/aunt-to-niece/nephew (or equivalent). Think how a proud family member speaks, NOT how a partner speaks.
- "Love" in a sign-off is fine (e.g. "Love, Uncle Jay") — but the body should not read like a love letter.`;
    } else if (isFamily && !isRomantic) {
      relationshipGuardrail = `
RELATIONSHIP GUARDRAIL:
The recipient is the sender's ${relationshipType}. This is a family relationship.
- Use warm, familial language appropriate for this specific family relationship.
- Do NOT use romantic or intimate language. Affection should feel familial, not like a partner or lover.`;
    } else if (!isRomantic) {
      relationshipGuardrail = `
RELATIONSHIP NOTE:
The recipient is the sender's ${relationshipType}. Keep the tone appropriate for this relationship — warm and personal, but not romantic or intimate unless the relationship type suggests otherwise.`;
    }

    const regenCount = regenerationCount ?? 0;
    let contextEmphasis = "";
    if (regenCount === 0) {
      contextEmphasis = `Draw on the recipient's profile details shown above — weave in specifics naturally without over-indexing on any single interest.`;
    } else if (regenCount === 1) {
      contextEmphasis = `The sender didn't like the first batch. Use DIFFERENT profile details than the rejected messages. If any profile details were removed by the sender, do NOT reference them at all. Put more weight on the occasion and tone.`;
    } else if (regenCount === 2) {
      contextEmphasis = `The sender has regenerated and is reducing specific interests/factual details. Use FEWER interests and concrete details from the profile — but KEEP matching the REQUESTED TONE and the recipient's personality/humor style. Focus on occasion and tone; only lightly reference interests or hobbies.`;
    } else {
      contextEmphasis = `The sender has regenerated ${regenCount} times. Focus primarily on OCCASION and TONE. You may write something more universal and minimal; profile details (including personality/humor) are now de-emphasized. Still match the requested tone where possible. Try a simple, honest, human message — a short punchy observation or heartfelt universal sentiment. Less is more.`;
    }

    const faithModifier = includeFaithBased
      ? `
FAITH-BASED MODIFIER (CRITICAL):
The sender chose to include faith-based or spiritual themes. You MUST:
- Use respectful, non-denominational spiritual language where appropriate (e.g. "keeping you in my prayers", "may you feel surrounded by love and peace", "sending blessings your way"). Do NOT assume a specific religion or deity unless the occasion clearly indicates one.
- Do NOT use humor, sarcasm, or playful wit. Keep the tone sincere, warm, and genuine throughout all 3 options.
- Energy should be warm, emotional, or comforting — never flippant or edgy.
- All 3 options should feel appropriate for a faith-based card; vary the angle (e.g. blessing, comfort, gratitude, hope) but stay within that range.`
      : "";

    const optionsInstruction = includeFaithBased
      ? `Make the 3 options meaningfully different from each other, but ALL must stay sincere and faith-appropriate (no humor or sarcasm):
- Option 1: A straightforward, heartfelt version — warm and personal
- Option 2: A version that emphasizes blessing, gratitude, or hope
- Option 3: Another sincere angle — perhaps comfort, peace, or connection — still respectful and non-denominational`
      : `Make the 3 options meaningfully different from each other:
- Option 1: The most straightforward, heartfelt version
- Option 2: A version that leans into humor or playfulness (using the recipient's interests or personality)
- Option 3: A creative or unexpected angle — maybe a reference to a shared interest, an inside-joke-style observation, or a clever twist`;

    const systemPrompt = `You are Nuuge's card writing engine. Your job is to generate personal, specific greeting card messages based on deep context about the sender and recipient.

ABOUT THE SENDER:
${senderContext}

ABOUT THE RECIPIENT:
${recipientContext}
${historySection}
${rejectedSection}
OCCASION: ${occasion}
REQUESTED TONE: ${tone}
${additionalNotes ? `ADDITIONAL NOTES FROM SENDER: ${additionalNotes}` : ""}
${coSignWith ? `CO-SIGNING: This card is from BOTH the sender and ${coSignWith} together. Throughout the entire message, use "we", "our", and "us" instead of "I", "my", and "me". The greeting, body, and closing should all reflect that two people are writing — e.g. "We love you", "We're so proud", "Our favorite memory". Sign off with both names.` : ""}
${relationshipGuardrail}
${faithModifier}

CONTEXT EMPHASIS: ${contextEmphasis}

YOUR TASK:
Generate exactly 3 different card message options. Each should:
- Sound like it was written by the sender, not by an AI
- Reference specific details about the recipient — but spread across DIFFERENT details, not all repeating the same one
- Match the requested tone
- Be appropriate for both the occasion AND the relationship type
- Feel personal and specific — never generic

Each message should have:
- A greeting line
- The body (2-4 sentences)
- A closing/sign-off: put a newline after the closing phrase so the sender name(s) appear on the next line. Use \\n in the closing string. Example: "Love,\\nJane" or "With gratitude,\\nJane & John". Never put the name on the same line as the phrase.

${optionsInstruction}

Each option should draw from DIFFERENT details in the profile. If option 1 mentions dancing, options 2 and 3 should NOT mention dancing.

Keep messages concise. Real card messages are not essays.

Respond with ONLY valid JSON in this exact format:
{
  "messages": [
    {
      "label": "Heartfelt",
      "greeting": "the greeting line",
      "body": "the message body",
      "closing": "closing phrase,\\nSender Name"
    },
    {
      "label": "Playful",
      "greeting": "...",
      "body": "...",
      "closing": "..."
    },
    {
      "label": "Creative",
      "greeting": "...",
      "body": "...",
      "closing": "..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the 3 card message options." },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content || "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse card messages from AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Card generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
