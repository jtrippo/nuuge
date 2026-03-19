"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBeyondCircleCards, getUserProfile, hydrateCardImages, saveRecipient } from "@/lib/store";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";
import { getDisplayOccasion } from "@/lib/occasions";
import { getDefaultUserDisplayName } from "@/lib/signer-helpers";
import AppHeader from "@/components/AppHeader";
import type { Card } from "@/types/database";

type BeyondCard = Card & {
  card_type?: string;
  quick_recipient_name?: string | null;
  quick_recipient_relationship?: string | null;
  quick_recipient_traits?: string[] | null;
};

export default function BeyondPage() {
  const router = useRouter();
  const [cards, setCards] = useState<BeyondCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [shareError, setShareError] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    const raw = getBeyondCircleCards() as BeyondCard[];
    const sorted = [...raw].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    Promise.all(sorted.map((c) => hydrateCardImages(c))).then((hydrated) => {
      setCards(hydrated as BeyondCard[]);
    });
  }, []);

  if (!mounted) return null;

  async function handleShare(card: BeyondCard) {
    if (sharingId) return;
    setSharingId(card.id);
    setShareError(null);
    try {
      const profile = getUserProfile();
      const senderName = getDefaultUserDisplayName(profile) || "Someone";
      const recipientName = card.quick_recipient_name || "Friend";
      const hydrated = await hydrateCardImages(card);
      const result = await shareCard(hydrated, recipientName, senderName);
      if ("error" in result) {
        setShareError(result.error);
      } else {
        setShareUrls((prev) => ({ ...prev, [card.id]: result.shareUrl }));
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setSharingId(null);
    }
  }

  function handleAddToCircle(card: BeyondCard) {
    if (!card.quick_recipient_name) return;
    saveRecipient({
      name: card.quick_recipient_name,
      personality: card.quick_recipient_traits?.join(", ") || "",
      relationship_type: card.quick_recipient_relationship || "other",
      setup_complete: false,
    });
    setPromotedIds((prev) => new Set(prev).add(card.id));
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-cream)" }}>
      <AppHeader>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Home
        </button>
      </AppHeader>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}>
              People Beyond My Circle
            </h1>
            <p className="text-warm-gray mt-1">
              {cards.length === 0 ? "No quick cards yet." : `${cards.length} card${cards.length === 1 ? "" : "s"} created`}
            </p>
          </div>
          <button
            onClick={() => router.push("/cards/create/quick")}
            className="btn-primary px-6 py-2.5"
          >
            Create quick card
          </button>
        </div>

        {shareError && (
          <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
            {shareError}
          </div>
        )}

        {cards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">&#9993;</div>
            <h2 className="text-xl font-semibold text-charcoal mb-2">Create your first quick card</h2>
            <p className="text-warm-gray mb-6 max-w-md mx-auto">
              For a vet, a teacher, a neighbor — anyone you want to thank without creating a full profile.
            </p>
            <button
              onClick={() => router.push("/cards/create/quick")}
              className="btn-primary px-8 py-3"
            >
              Create quick card
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => {
              const occasion = getDisplayOccasion(card);
              const name = card.quick_recipient_name || "Someone";
              const relationship = card.quick_recipient_relationship;
              const traits = card.quick_recipient_traits;
              const date = formatDate(card.created_at);
              const hasImage = !!card.image_url;
              const url = shareUrls[card.id];
              const promoted = promotedIds.has(card.id);

              return (
                <div
                  key={card.id}
                  className="rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                  style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
                >
                  <div className="flex gap-4 p-4">
                    {hasImage && (
                      <div className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--color-light-gray)" }}>
                        <img src={card.image_url!} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-charcoal">{name}</h3>
                          {relationship && (
                            <span className="text-sm text-warm-gray">{relationship}</span>
                          )}
                          <span className="inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--color-brand-light)", color: "var(--color-brand)" }}>
                            {occasion}
                          </span>
                        </div>
                        <span className="text-xs text-warm-gray whitespace-nowrap">{date}</span>
                      </div>
                      {traits && traits.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {traits.map((t) => (
                            <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-faint-gray)", color: "var(--color-warm-gray)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-warm-gray mt-2 line-clamp-2">
                        {card.message_text.slice(0, 120)}{card.message_text.length > 120 ? "..." : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => router.push(`/cards/view/${card.id}`)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/cards/print/${card.id}`)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                          style={{ color: "var(--color-warm-gray)", border: "1.5px solid var(--color-light-gray)" }}
                        >
                          Print
                        </button>
                        <button
                          onClick={() => router.push(`/cards/edit/${card.id}`)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                          style={{ color: "var(--color-warm-gray)", border: "1.5px solid var(--color-light-gray)" }}
                        >
                          Edit
                        </button>
                        {url ? (
                          <button
                            onClick={() => copyToClipboard(url)}
                            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                            style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)", background: "var(--color-brand-light)" }}
                          >
                            Copy link
                          </button>
                        ) : (
                          <button
                            onClick={() => handleShare(card)}
                            disabled={sharingId === card.id}
                            className="px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
                            style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                          >
                            {sharingId === card.id ? "Sharing..." : "Share"}
                          </button>
                        )}
                        {!promoted ? (
                          <button
                            onClick={() => handleAddToCircle(card)}
                            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                            style={{ color: "var(--color-warm-gray)", border: "1.5px solid var(--color-light-gray)" }}
                          >
                            Add to circle
                          </button>
                        ) : (
                          <span className="px-3 py-1 text-xs font-medium" style={{ color: "var(--color-brand)" }}>
                            Added to circle
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
