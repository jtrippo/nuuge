import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SharedCardViewer from "./SharedCardViewer";

interface SharedCard {
  share_id: string;
  card_json: Record<string, unknown>;
  front_image_url: string | null;
  inside_image_url: string | null;
}

async function getSharedCard(shareId: string): Promise<SharedCard | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("shared_cards")
    .select("share_id, card_json, front_image_url, inside_image_url")
    .eq("share_id", shareId)
    .single();

  if (error || !data) return null;
  return data as SharedCard;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const card = await getSharedCard(shareId);
  const name = (card?.card_json?.recipient_name as string) || "someone special";
  return {
    title: `A card for ${name} — Nuuge`,
    description: "You received a personal greeting card made with Nuuge.",
    openGraph: {
      title: `A card for ${name}`,
      description: "Open to see your card!",
      ...(card?.front_image_url ? { images: [card.front_image_url] } : {}),
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const card = await getSharedCard(shareId);

  if (!card) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6"
        style={{ background: "var(--color-cream)" }}
      >
        <h1
          className="text-2xl font-semibold mb-3"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
        >
          Card not found
        </h1>
        <p className="text-warm-gray text-sm mb-6">
          This link may have expired or the card was removed.
        </p>
        <a
          href="/"
          className="btn-primary px-5 py-2 rounded-full text-sm inline-block"
        >
          Visit Nuuge
        </a>
      </div>
    );
  }

  return (
    <SharedCardViewer
      cardJson={card.card_json}
      frontImageUrl={card.front_image_url}
      insideImageUrl={card.inside_image_url}
    />
  );
}
