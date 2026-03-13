import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const json = (obj: Record<string, unknown>, status = 500) =>
    NextResponse.json(obj, { status, headers: { "Content-Type": "application/json" } });

  try {
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." });
    }

    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (clientErr) {
      console.error("Supabase client error:", clientErr);
      return json({ error: "Invalid Supabase configuration. Check your API key format." });
    }

    let cardJson: Record<string, unknown>;
    let shareId: string;
    let frontImageUrl: string | null;
    let insideImageUrl: string | null;
    try {
      const body = (await req.json()) as {
        cardJson?: unknown;
        shareId?: string;
        frontImageUrl?: string | null;
        insideImageUrl?: string | null;
      };
      const rawCardJson = body?.cardJson;
      cardJson = rawCardJson && typeof rawCardJson === "object" ? (rawCardJson as Record<string, unknown>) : {} as Record<string, unknown>;
      shareId = body?.shareId ?? "";
      frontImageUrl = body?.frontImageUrl ?? null;
      insideImageUrl = body?.insideImageUrl ?? null;
    } catch (parseErr) {
      console.error("Request body parse error:", parseErr);
      return json({ error: "Invalid request." });
    }

    if (!cardJson || Object.keys(cardJson).length === 0 || !shareId) {
      return json({ error: "cardJson and shareId are required." }, 400);
    }

    const { error: insertErr } = await supabase.from("shared_cards").insert({
      share_id: shareId,
      card_json: cardJson,
      front_image_url: frontImageUrl,
      inside_image_url: insideImageUrl,
    });

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      const msg = insertErr.message?.includes("relation") || insertErr.code === "42P01"
        ? "Database table not found. Create the shared_cards table in Supabase (see SUPABASE_SETUP.md)."
        : insertErr.message?.includes("policy") || insertErr.code === "42501"
          ? "Permission denied. Check Supabase RLS policies for shared_cards."
          : "Failed to save shared card. Check Supabase setup.";
      return json({ error: msg });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      req.headers.get("origin") ||
      req.nextUrl.origin;
    const shareUrl = `${baseUrl.replace(/\/$/, "")}/share/${shareId}`;

    return json({ shareId, shareUrl }, 200);
  } catch (err) {
    console.error("Share card error:", err);
    return json({ error: "Failed to share card." });
  }
}
