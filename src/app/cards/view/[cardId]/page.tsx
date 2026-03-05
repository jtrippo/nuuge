"use client";

import { useEffect, useState, CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients, hydrateCardImages } from "@/lib/store";
import type { Card } from "@/types/database";

type ViewStage = "envelope" | "front" | "inside";
type FontChoice = "sans" | "script" | "block";
type TextStyleChoice = "dark_box" | "white_box" | "plain";

function fontCSS(font: FontChoice | undefined): CSSProperties {
  switch (font) {
    case "script":
      return { fontFamily: "'Georgia', 'Palatino', 'Times New Roman', serif", fontStyle: "italic" };
    case "block":
      return { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" };
    default:
      return { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" };
  }
}

function positionCSS(pos: string): CSSProperties {
  switch (pos) {
    case "top-left": return { top: "6%", left: "6%" };
    case "top-center": return { top: "6%", left: "50%", transform: "translateX(-50%)" };
    case "top-right": return { top: "6%", right: "6%" };
    case "center": return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom-left": return { bottom: "6%", left: "6%" };
    case "bottom-center": return { bottom: "6%", left: "50%", transform: "translateX(-50%)" };
    default: return { bottom: "6%", right: "6%" };
  }
}

function textStyleCSS(style: TextStyleChoice): CSSProperties {
  switch (style) {
    case "dark_box":
      return {
        color: "#fff",
        textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)",
        backgroundColor: "rgba(0,0,0,0.35)",
        borderRadius: "0.5rem",
        padding: "0.5rem 1rem",
      };
    case "white_box":
      return {
        color: "#111",
        backgroundColor: "rgba(255,255,255,0.75)",
        borderRadius: "0.5rem",
        padding: "0.5rem 1rem",
      };
    default:
      return {
        color: "#111",
        textShadow: "0 1px 4px rgba(255,255,255,0.6)",
      };
  }
}

export default function CardViewerPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [stage, setStage] = useState<ViewStage>("envelope");
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === found.recipient_id);
      if (r) setRecipientName(r.name);
      hydrateCardImages(found).then((hydrated) => setCard(hydrated));
    }
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

  const insidePos = card.inside_image_position ?? "top";
  const msgFontStyle = fontCSS(card.font);
  const ftFontStyle = fontCSS(card.front_text_font);
  const ftPos = positionCSS(card.front_text_position ?? "bottom-right");
  const ftStyle = textStyleCSS((card.front_text_style ?? "dark_box") as TextStyleChoice);

  const envelopeLabel = [card.occasion, card.tone_used]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-amber-50 to-rose-50 px-4 py-8">
      {/* ── Envelope ── */}
      {stage === "envelope" && (
        <div
          onClick={advanceStage}
          className="cursor-pointer select-none transition-all duration-500 hover:scale-105"
        >
          <div
            className={`relative w-80 h-52 transition-transform duration-600
                        ${animating ? "scale-110 opacity-0" : ""}`}
          >
            <div className="absolute inset-0 bg-amber-100 rounded-lg border-2 border-amber-200 shadow-lg" />
            <div
              className="absolute top-0 left-0 right-0 h-24 bg-amber-200 rounded-t-lg border-2 border-amber-300"
              style={{ clipPath: "polygon(0 0, 50% 100%, 100% 0)" }}
            />
            {/* Seal with arc "Nuuge" text */}
            <div className="absolute top-14 left-1/2 -translate-x-1/2 w-14 h-14">
              <svg viewBox="0 0 56 56" width="56" height="56">
                <circle cx="28" cy="28" r="26" fill="#f87171" stroke="#dc2626" strokeWidth="2" />
                <defs>
                  <path id="nuuge-arc" d="M 10,28 A 18,18 0 0,1 46,28" fill="none" />
                </defs>
                <text
                  fill="#fff"
                  fontSize="7.5"
                  fontWeight="700"
                  letterSpacing="1.5"
                  textAnchor="middle"
                >
                  <textPath href="#nuuge-arc" startOffset="50%">NUUGE</textPath>
                </text>
                <text
                  x="28" y="36"
                  fill="#fff"
                  fontSize="16"
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  N
                </text>
              </svg>
            </div>
            {/* Label: occasion + tone */}
            <div className="absolute bottom-6 left-0 right-0 text-center px-4">
              <p className="text-amber-800 font-medium italic text-base leading-snug">
                {envelopeLabel}
              </p>
              {recipientName && (
                <p className="text-amber-600 text-sm mt-1">
                  for {recipientName}
                </p>
              )}
            </div>
          </div>
          <p className="text-center text-sm text-amber-600 mt-6 animate-pulse">
            Tap to open
          </p>
        </div>
      )}

      {/* ── Card Front (5:7 portrait) ── */}
      {stage === "front" && (
        <div
          onClick={advanceStage}
          className={`cursor-pointer select-none transition-all duration-500 hover:scale-[1.02]
                      ${animating ? "rotate-y-90 opacity-0" : "animate-fade-in"}`}
        >
          <div className="relative w-72 bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200"
               style={{ aspectRatio: "5 / 7" }}>
            {card.image_url ? (
              <>
                <img
                  src={card.image_url}
                  alt="Card front"
                  className="w-full h-full object-cover"
                />
                {card.front_text && (
                  <div
                    style={{
                      position: "absolute",
                      ...ftPos,
                      ...ftFontStyle,
                      ...ftStyle,
                      maxWidth: "88%",
                      fontSize: "clamp(1rem, 4vw, 1.6rem)",
                      lineHeight: 1.25,
                      textAlign: "center",
                    }}
                  >
                    {card.front_text}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <p className="text-4xl text-indigo-300">&#127912;</p>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6 animate-pulse">
            Tap to open the card
          </p>
        </div>
      )}

      {/* ── Card Inside (5:7 portrait) ── */}
      {stage === "inside" && (
        <div className="animate-fade-in">
          <div
            className="w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex"
            style={{
              aspectRatio: "5 / 7",
              ...msgFontStyle,
              flexDirection: insidePos === "left" || insidePos === "right" ? "row" : "column",
              position: "relative",
            }}
          >
            {/* Watermark behind — fills entire panel edge-to-edge */}
            {insidePos === "behind" && card.inside_image_url && (
              <img
                src={card.inside_image_url}
                alt=""
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.12,
                  pointerEvents: "none",
                }}
              />
            )}

            {insidePos === "left" && card.inside_image_url && (
              <div style={{ width: "20%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "top" && card.inside_image_url && (
              <div style={{ width: "100%", height: "15%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            <div
              className="flex flex-col justify-center items-center text-center"
              style={{
                flex: 1,
                padding: insidePos === "left" || insidePos === "right" ? "1rem 0.6rem" : "1.25rem",
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
              }}
            >
              {insidePos === "middle" && card.inside_image_url && (
                <div style={{ width: "100%", height: "14%", flexShrink: 0, marginBottom: "0.5rem" }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.25rem" }} />
                </div>
              )}

              <p className="text-gray-800 mb-2" style={{ fontSize: "1rem", fontWeight: 600 }}>
                {greeting}
              </p>
              {body && (
                <p className="text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap" style={{ fontSize: "0.8rem" }}>
                  {body}
                </p>
              )}
              {closing && (
                <p className="text-gray-600" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
                  {closing}
                </p>
              )}
              {card.co_signed_with && (
                <p className="text-gray-400 mt-1" style={{ fontSize: "0.65rem" }}>
                  &amp; {card.co_signed_with}
                </p>
              )}
            </div>

            {insidePos === "bottom" && card.inside_image_url && (
              <div style={{ width: "100%", height: "15%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "right" && card.inside_image_url && (
              <div style={{ width: "20%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>

          <div className="text-center mt-6 space-y-3">
            <p className="text-xs text-gray-400">Created by Nuuge</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => router.push(`/recipients/${card.recipient_id}`)}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Done — back to {recipientName ?? "recipient"}
              </button>
              <button
                onClick={() => setStage("envelope")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                View again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
