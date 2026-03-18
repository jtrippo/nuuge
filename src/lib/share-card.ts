import type { Card } from "@/types/database";
import { supabase } from "./supabase";

function generateShareId(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

/**
 * Shares a card by uploading images directly to Supabase Storage (client-side)
 * and saving metadata via the API. Avoids payload size limits.
 * @param senderNames Formatted sender string, e.g. "Jeff" or "Jeff & Linda" or "Jeff, Linda, & Kelsey"
 */
export async function shareCard(
  card: Card,
  recipientFirstName: string,
  senderNames: string
): Promise<{ shareUrl: string } | { error: string }> {
  const cardJson = {
    recipient_name: recipientFirstName,
    sender_name: senderNames,
    message_text: card.message_text,
    front_text: card.front_text ?? null,
    front_text_position: card.front_text_position ?? "bottom-right",
    front_text_font: card.front_text_font ?? undefined,
    front_text_style: card.front_text_style ?? "dark_box",
    inside_image_position: card.inside_image_position ?? "top",
    font: card.font ?? undefined,
    ft_font_scale: card.ft_font_scale ?? 1,
    msg_font_scale: card.msg_font_scale ?? 1.5,
    letter_font_scale: card.letter_font_scale ?? 1,
    letter_text: card.letter_text ?? null,
    letter_font: card.letter_font ?? "handwritten",
  };

  const shareId = generateShareId();
  let frontImageUrl: string | null = null;
  let insideImageUrl: string | null = null;

  const frontDataUrl = card.image_url?.startsWith("data:") ? card.image_url : null;
  const insideDataUrl = card.inside_image_url?.startsWith("data:") ? card.inside_image_url : null;

  if (frontDataUrl) {
    const blob = dataUrlToBlob(frontDataUrl);
    const { error } = await supabase.storage
      .from("share-card-images")
      .upload(`${shareId}/front.png`, blob, { contentType: "image/png", upsert: true });
    if (error) {
      return { error: `Image upload failed: ${error.message}` };
    }
    const { data: urlData } = supabase.storage.from("share-card-images").getPublicUrl(`${shareId}/front.png`);
    frontImageUrl = urlData.publicUrl;
  }

  if (insideDataUrl) {
    const blob = dataUrlToBlob(insideDataUrl);
    const { error } = await supabase.storage
      .from("share-card-images")
      .upload(`${shareId}/inside.png`, blob, { contentType: "image/png", upsert: true });
    if (error) {
      return { error: `Image upload failed: ${error.message}` };
    }
    const { data: urlData } = supabase.storage.from("share-card-images").getPublicUrl(`${shareId}/inside.png`);
    insideImageUrl = urlData.publicUrl;
  }

  let res: Response;
  try {
    res = await fetch("/api/share-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardJson, shareId, frontImageUrl, insideImageUrl }),
    });
  } catch (err) {
    return { error: "Network error. Check your connection and try again." };
  }

  const text = await res.text();
  let data: { shareUrl?: string; error?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status === 413) return { error: "Request too large. Try again." };
    return { error: `Server error (${res.status}). Check Vercel logs.` };
  }

  if (!res.ok) return { error: data.error || "Failed to share card." };
  if (!data.shareUrl) return { error: "Share succeeded but no URL was returned." };
  return { shareUrl: data.shareUrl };
}
