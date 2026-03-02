"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCards } from "@/lib/store";
import type { Card } from "@/types/database";

type ViewStage = "envelope" | "front" | "inside";

export default function CardViewerPage() {
  const params = useParams();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [stage, setStage] = useState<ViewStage>("envelope");
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) setCard(found);
  }, [cardId]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-amber-50 to-white">
        <p className="text-gray-500">Card not found.</p>
      </div>
    );
  }

  function advanceStage() {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      if (stage === "envelope") setStage("front");
      else if (stage === "front") setStage("inside");
      setAnimating(false);
    }, 600);
  }

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.slice(1, -1).join("\n\n") || messageParts[1] || "";
  const closing = messageParts[messageParts.length - 1] || "";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-amber-50 to-rose-50 px-4">
      {/* Envelope stage */}
      {stage === "envelope" && (
        <div
          onClick={advanceStage}
          className="cursor-pointer select-none transition-all duration-500 hover:scale-105"
        >
          <div
            className={`relative w-80 h-52 transition-transform duration-600
                        ${animating ? "scale-110 opacity-0" : ""}`}
          >
            {/* Envelope body */}
            <div className="absolute inset-0 bg-amber-100 rounded-lg border-2 border-amber-200 shadow-lg" />
            {/* Envelope flap */}
            <div
              className="absolute top-0 left-0 right-0 h-24 bg-amber-200 rounded-t-lg border-2 border-amber-300"
              style={{
                clipPath: "polygon(0 0, 50% 100%, 100% 0)",
              }}
            />
            {/* Seal */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-10 h-10 bg-red-400 rounded-full border-2 border-red-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            {/* Recipient name */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <p className="text-amber-800 font-medium italic text-lg">
                {card.occasion}
              </p>
            </div>
          </div>
          <p className="text-center text-sm text-amber-600 mt-6 animate-pulse">
            Click to open
          </p>
        </div>
      )}

      {/* Card front stage */}
      {stage === "front" && (
        <div
          onClick={advanceStage}
          className={`cursor-pointer select-none transition-all duration-500 hover:scale-[1.02]
                      ${animating ? "rotate-y-90 opacity-0" : "animate-fade-in"}`}
        >
          <div className="w-80 bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
            {card.image_url ? (
              <img
                src={card.image_url}
                alt="Card front"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <p className="text-4xl text-indigo-300">&#127912;</p>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6 animate-pulse">
            Click to open the card
          </p>
        </div>
      )}

      {/* Card inside stage */}
      {stage === "inside" && (
        <div className="animate-fade-in">
          <div className="w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-8">
            <p className="text-lg font-medium text-gray-800 mb-4">
              {greeting}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">
              {body}
            </p>
            <p className="text-sm text-gray-600 italic">
              {closing}
            </p>
            {card.co_signed_with && (
              <p className="text-xs text-gray-400 mt-2">
                &amp; {card.co_signed_with}
              </p>
            )}
          </div>
          <div className="text-center mt-6">
            <p className="text-xs text-gray-400 mb-3">
              Made with Nuuge
            </p>
            <button
              onClick={() => setStage("envelope")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              View again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
