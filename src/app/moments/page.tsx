"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSharedMomentCards, getUserProfile, hydrateCardImages } from "@/lib/store";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";
import { getDisplayOccasion } from "@/lib/occasions";
import { getDefaultUserDisplayName } from "@/lib/signer-helpers";
import AppHeader from "@/components/AppHeader";
import type { Card } from "@/types/database";

type NewsCard = Card & { card_type?: string; news_category?: string; envelope_label?: string | null };

export default function MomentsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<NewsCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const raw = getSharedMomentCards() as NewsCard[];
    const sorted = [...raw].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    Promise.all(sorted.map((c) => hydrateCardImages(c))).then((hydrated) => {
      setCards(hydrated as NewsCard[]);
    });
  }, []);

  if (!mounted) return null;

  async function handleShare(card: NewsCard) {
    if (sharingId) return;
    setSharingId(card.id);
    setShareError(null);
    try {
      const profile = getUserProfile();
      const senderName = getDefaultUserDisplayName(profile) || "Someone";
      const recipientName = card.envelope_label || card.news_category || "Friend";
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
              Moments Shared
            </h1>
            <p className="text-warm-gray mt-1">
              {cards.length === 0 ? "No moments shared yet." : `${cards.length} card${cards.length === 1 ? "" : "s"} shared`}
            </p>
          </div>
          <button
            onClick={() => router.push("/cards/create/share")}
            className="btn-primary px-6 py-2.5"
          >
            Create shared card
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
            <h2 className="text-xl font-semibold text-charcoal mb-2">Share your first moment</h2>
            <p className="text-warm-gray mb-6 max-w-md mx-auto">
              Announcements, thank yous, life updates — create a card once and share it with everyone.
            </p>
            <button
              onClick={() => router.push("/cards/create/share")}
              className="btn-primary px-8 py-3"
            >
              Create shared card
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => {
              const occasion = getDisplayOccasion(card);
              const category = card.news_category || occasion;
              const label = card.envelope_label;
              const date = formatDate(card.created_at);
              const hasImage = !!card.image_url;
              const url = shareUrls[card.id];

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
                          <h3 className="text-base font-semibold text-charcoal">{category}</h3>
                          {label && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--color-brand-light)", color: "var(--color-brand)" }}>
                              {label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-warm-gray whitespace-nowrap">{date}</span>
                      </div>
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
