"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients, getUserProfile, hydrateCardImages } from "@/lib/store";
import type { Card } from "@/types/database";
import { getSenderNames } from "@/lib/signer-helpers";
import { fontCSS, positionCSS, textStyleCSS, frontTextAlign, messageSizing, msgSizeOptions, isAccentPosition, defaultAccentSlots, cornerStyle, cornerImgStyle, edgeStyle, edgeImgStyle, frameImgStyle } from "@/lib/card-ui-helpers";
import type { TextStyleChoice } from "@/lib/card-ui-helpers";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";

type ViewStage = "envelope_front" | "envelope_back" | "front" | "inside" | "letter";

export default function CardViewerPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipientFirstName, setRecipientFirstName] = useState<string>("");
  const [senderNames, setSenderNames] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");
  const [stage, setStage] = useState<ViewStage>("envelope_front");
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [flipVisible, setFlipVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === found.recipient_id);
      if (r) {
        setRecipientFirstName(r.first_name || r.display_name || r.name || "");
        setRecipientId(r.id);
        setRecipientName(r.name || r.display_name || r.first_name || "");
      }
      const profile = getUserProfile();
      const names = r ? getSenderNames(found, r, recipients, profile) : (profile?.first_name || profile?.display_name || "");
      setSenderNames(names);
      hydrateCardImages(found).then((hydrated) => setCard(hydrated));
    }
  }, [cardId]);

  const advanceFromEnvelopeFront = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setFlipVisible(true);
    // After flip animation completes, show back briefly then auto-advance
    setTimeout(() => {
      setStage("envelope_back");
      setAnimating(false);
    }, 600);
  }, [animating]);

  const advanceFromFront = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStage("inside");
      setAnimating(false);
    }, 500);
  }, [animating]);

  // Auto-advance from envelope_back after 1 second
  useEffect(() => {
    if (stage !== "envelope_back") return;
    const timer = setTimeout(() => {
      setStage("front");
      setFlipVisible(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [stage]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray">Card not found.</p>
      </div>
    );
  }

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.slice(1, -1).join("\n\n") || messageParts[1] || "";
  const closing = messageParts[messageParts.length - 1] || "";

  const insidePos = card.inside_image_position ?? "top";
  const msgFontStyle = fontCSS(card.font);
  const ftFontStyle = fontCSS(card.front_text_font);
  const ftPos = positionCSS(card.front_text_position ?? "bottom-right");
  const ftStyle = textStyleCSS((card.front_text_style ?? "plain_black") as TextStyleChoice);
  const ftScale = card.ft_font_scale ?? 1;
  const rawMsgScale = card.msg_font_scale ?? 0;
  const msgAutoValue = msgSizeOptions(card.message_text.length).find((o) => o.label === "Auto")!.value;
  const msgScale = rawMsgScale === 0 ? msgAutoValue : rawMsgScale;
  const baseSizing = messageSizing(card.message_text.length);
  const remToCqw = (rem: string, scale: number) => `${(parseFloat(rem) * scale * 3.81).toFixed(2)}cqw`;
  const sizing = {
    greetingSize: remToCqw(baseSizing.greetingSize, msgScale),
    bodySize: remToCqw(baseSizing.bodySize, msgScale),
    closingSize: remToCqw(baseSizing.closingSize, msgScale),
    gap: remToCqw(baseSizing.gap, msgScale),
  };

  const hasLetter = Boolean(card.letter_text?.trim());
  const letterFontStyle = fontCSS(card.letter_font || "handwritten");

  // Parse letter parts if present
  async function handleShare() {
    if (!card || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const hydrated = await hydrateCardImages(card);
      const result = await shareCard(hydrated, recipientFirstName, senderNames);
      if ("error" in result) {
        setShareError(result.error);
      } else {
        setShareUrl(result.shareUrl);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to share. Check your connection and try again.");
    } finally {
      setSharing(false);
    }
  }

  const letterParts = (card.letter_text || "").split("\n\n");
  const letterGreeting = letterParts[0] || "";
  const letterBody = letterParts.length > 2 ? letterParts.slice(1, -1).join("\n\n") : (letterParts[1] || "");
  const letterClosing = letterParts.length > 1 ? letterParts[letterParts.length - 1] : "";

  // Nuuge wax seal SVG (reusable)
  const waxSeal = (
    <svg viewBox="0 0 56 56" width="56" height="56">
      <circle cx="28" cy="28" r="26" fill="#f87171" stroke="#dc2626" strokeWidth="2" />
      <defs>
        <path id="nuuge-arc" d="M 10,28 A 18,18 0 0,1 46,28" fill="none" />
      </defs>
      <text fill="#fff" fontSize="7.5" fontWeight="700" letterSpacing="1.5" textAnchor="middle">
        <textPath href="#nuuge-arc" startOffset="50%">NUUGE</textPath>
      </text>
      <text x="28" y="36" fill="#fff" fontSize="16" fontWeight="800" textAnchor="middle" dominantBaseline="central">
        N
      </text>
    </svg>
  );

  return (
    <div className={`flex flex-col items-center min-h-screen px-4 py-6 ${stage === "letter" ? "justify-start overflow-y-auto" : "justify-center"}`} style={{ background: "var(--color-cream)" }}>
      <style>{`
        @keyframes envelopeFlip {
          0% { transform: perspective(1200px) rotateY(0deg); }
          100% { transform: perspective(1200px) rotateY(180deg); }
        }
        @keyframes cardSlideUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes cardFadeIn {
          0% { opacity: 0; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes letterFallOut {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .envelope-flip-container {
          perspective: 1200px;
          width: min(90vw, 420px);
          height: calc(min(90vw, 420px) * 0.65);
        }
        .envelope-flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s ease-in-out;
          transform-style: preserve-3d;
        }
        .envelope-flip-inner.flipped {
          transform: rotateY(180deg);
        }
        .envelope-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 0.5rem;
        }
        .envelope-back-face {
          transform: rotateY(180deg);
        }
        .slide-up {
          animation: cardSlideUp 0.6s ease-out forwards;
        }
        .card-fade-in {
          animation: cardFadeIn 0.5s ease-out forwards;
        }
        .letter-fall {
          animation: letterFallOut 0.6s ease-out forwards;
        }
        .ecard-panel {
          width: min(90vw, 420px);
          container-type: inline-size;
        }
      `}</style>

      {/* ── Stage 1: Envelope Front (clean addressed face) ── */}
      {(stage === "envelope_front" || stage === "envelope_back") && (
        <div
          onClick={stage === "envelope_front" ? advanceFromEnvelopeFront : undefined}
          className={stage === "envelope_front" ? "cursor-pointer select-none" : "select-none"}
        >
          <div className="envelope-flip-container">
            <div className={`envelope-flip-inner ${flipVisible ? "flipped" : ""}`}>
              {/* Front face — addressed letter */}
              <div
                className="envelope-face shadow-lg"
                style={{ background: "#faf7f2", border: "1px solid #e8e0d4" }}
              >
                {/* Sender name — upper left (supports line breaks) */}
                {senderNames && (
                  <div className="absolute top-4 left-5 text-xs leading-relaxed max-w-[45%]" style={{ color: "#8b7d6b", fontFamily: "var(--font-handwritten), cursive" }}>
                    {senderNames.split("\n").map((line, i) => (
                      <span key={i}>{line}{i < senderNames.split("\n").length - 1 ? <br /> : null}</span>
                    ))}
                  </div>
                )}

                {/* Stamp — upper right */}
                <div className="absolute top-3 right-4" style={{ width: 36, height: 44, border: "1.5px solid #c4b8a8", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "#fefcf8" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#c4b8a8" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>

                {/* Recipient name — centered */}
                <div className="absolute inset-0 flex items-center justify-center px-8">
                  <p
                    className="text-center leading-tight"
                    style={{
                      fontFamily: "var(--font-handwritten), cursive",
                      fontSize: "clamp(1.6rem, 5vw, 2.8rem)",
                      color: "#3d3529",
                      fontWeight: 500,
                    }}
                  >
                    {recipientFirstName}
                  </p>
                </div>

                {/* Subtle decorative line under name */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ width: 60, height: 1, background: "#d4c9b8" }} />
              </div>

              {/* Back face — Nuuge wax seal */}
              <div
                className="envelope-face envelope-back-face shadow-lg"
                style={{ background: "#f0e8db", border: "1px solid #e8e0d4" }}
              >
                {/* Envelope flap triangle */}
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{
                    height: "45%",
                    background: "#e8dfd0",
                    clipPath: "polygon(0 0, 50% 100%, 100% 0)",
                    borderBottom: "1px solid #d4c9b8",
                  }}
                />
                {/* Wax seal centered */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16">
                  {waxSeal}
                </div>
              </div>
            </div>
          </div>

          {stage === "envelope_front" && (
            <p className="text-center text-sm text-warm-gray mt-6 animate-pulse">
              Tap to open
            </p>
          )}
          {stage === "envelope_back" && (
            <p className="text-center text-sm text-warm-gray mt-6">
              Opening...
            </p>
          )}
        </div>
      )}

      {/* ── Stage 3: Card Front (slides up) ── */}
      {stage === "front" && (
        <div
          onClick={advanceFromFront}
          className="cursor-pointer select-none slide-up"
        >
          <div className="relative ecard-panel card-surface overflow-hidden" style={{ aspectRatio: "5 / 7" }}>
            {card.image_url ? (
              <>
                <img src={card.image_url} alt="Card front" className="w-full h-full object-cover" />
                {card.front_text && (
                  <div
                    style={{
                      position: "absolute",
                      ...ftPos,
                      ...ftFontStyle,
                      ...ftStyle,
                      width: "84%",
                      padding: "0.5rem",
                      boxSizing: "border-box",
                      fontSize: `calc(clamp(1.4rem, 4vw, 2.5rem) * ${ftScale})`,
                      lineHeight: 1.25,
                      textAlign: frontTextAlign(card.front_text_position ?? "bottom-right"),
                      whiteSpace: "pre-line",
                    }}
                  >
                    {card.front_text}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-brand-light)" }}>
                <p className="text-4xl" style={{ color: "var(--color-brand)" }}>&#127912;</p>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-warm-gray mt-6 animate-pulse">
            Tap to open the card
          </p>
        </div>
      )}

      {/* ── Stage 4: Card Inside ── */}
      {stage === "inside" && (
        <div className="card-fade-in">
          <div
            onClick={hasLetter ? () => setStage("letter") : undefined}
            className={`ecard-panel card-surface overflow-hidden flex ${hasLetter ? "cursor-pointer" : ""}`}
            style={{
              aspectRatio: "5 / 7",
              ...msgFontStyle,
              flexDirection: insidePos === "left" || insidePos === "right" ? "row" : "column",
              position: "relative",
            }}
          >
            {insidePos === "behind" && card.inside_image_url && (
              <img src={card.inside_image_url} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.12, pointerEvents: "none" }} />
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
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              return slots.includes(1) ? (
                <div style={edgeStyle(1)}>
                  <img src={card.inside_image_url} alt="" style={edgeImgStyle()} />
                </div>
              ) : null;
            })()}

            <div
              className="flex flex-col justify-center items-center text-center"
              style={{
                flex: 1,
                padding: insidePos === "left" || insidePos === "right" ? "6% 4%" : "8% 10%",
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
                gap: sizing.gap,
              }}
            >
              {insidePos === "middle" && card.inside_image_url && (
                <div style={{ width: "100%", height: "14%", flexShrink: 0 }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.25rem" }} />
                </div>
              )}
              <p className="text-charcoal" style={{ ...msgFontStyle, fontSize: sizing.greetingSize, fontWeight: 600, lineHeight: 1.3 }}>
                {greeting}
              </p>
              {body && (
                <p className="text-charcoal whitespace-pre-wrap" style={{ ...msgFontStyle, fontSize: sizing.bodySize, lineHeight: 1.55 }}>
                  {body}
                </p>
              )}
              {closing && (
                <p className="text-warm-gray whitespace-pre-line" style={{ ...msgFontStyle, fontSize: sizing.closingSize, fontStyle: "italic", lineHeight: 1.4 }}>
                  {closing}
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
            {insidePos === "corner_flourish" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("corner_flourish");
              return slots.map((slot) => (
                <div key={slot} style={cornerStyle(slot)}>
                  <img src={card.inside_image_url!} alt="" style={cornerImgStyle()} />
                </div>
              ));
            })()}
            {insidePos === "frame" && card.inside_image_url && (
              <img src={card.inside_image_url} alt="" style={frameImgStyle()} />
            )}
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              return slots.includes(2) ? (
                <div style={edgeStyle(2)}>
                  <img src={card.inside_image_url!} alt="" style={edgeImgStyle()} />
                </div>
              ) : null;
            })()}
          </div>

          <div className="mt-6 space-y-3">
            {hasLetter && (
              <p className="text-sm animate-pulse text-center" style={{ color: "var(--color-brand)" }}>
                A letter fell out — tap anywhere to read it
              </p>
            )}
            <p className="text-xs text-warm-gray text-center">Created by Nuuge</p>
            <div className="flex flex-nowrap items-center gap-3 justify-center overflow-x-auto">
              <button
                onClick={() => setStage("front")}
                className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors flex-shrink-0"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                View front
              </button>
              <button
                onClick={() => { setStage("envelope_front"); setFlipVisible(false); }}
                className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors flex-shrink-0"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                View again
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                {sharing ? "Sharing..." : "Share e-card"}
              </button>
              {!hasLetter && (
                <button
                  onClick={() => { window.location.href = `/cards/print/${cardId}`; }}
                  className="btn-primary px-5 py-2 rounded-full text-sm flex-shrink-0"
                >
                  Print preview
                </button>
              )}
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={() => recipientId ? router.push(`/recipients/${recipientId}`) : router.push("/")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                {recipientName || "Circle of People"}
              </button>
            </div>
            {shareUrl && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-xl" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs bg-transparent outline-none text-charcoal"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(shareUrl);
                    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {shareError && (
              <div className="mt-2 p-3 rounded-lg text-sm text-center" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>{shareError}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage 5: Letter Insert ── */}
      {stage === "letter" && (
        <div className="card-fade-in flex flex-col flex-1 w-full min-h-0 max-w-xl">
          <div
            className="letter-fall flex-1 min-h-[45vh] overflow-y-auto rounded-xl"
            style={{
              background: "#fefcf8",
              border: "1px solid #e8e0d4",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              position: "relative",
            }}
          >
            {/* Paper texture hint — subtle lines */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.03, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, #8b7d6b 28px)", pointerEvents: "none" }} />

            <div
              className="flex flex-col relative"
              style={{ padding: "2.5rem 2.25rem", ...letterFontStyle, zIndex: 1, textAlign: "left", gap: "1.25rem" }}
            >
              {letterGreeting && (
                <p className="text-charcoal" style={{ fontSize: "1.4rem", fontWeight: 500, lineHeight: 1.3 }}>
                  {letterGreeting}
                </p>
              )}
              {letterBody && (
                <p className="text-charcoal whitespace-pre-wrap" style={{ fontSize: "1.25rem", lineHeight: 1.7 }}>
                  {letterBody}
                </p>
              )}
              {letterClosing && (
                <p className="text-charcoal whitespace-pre-line" style={{ fontSize: "1.25rem", fontStyle: "italic", lineHeight: 1.5 }}>
                  {letterClosing}
                </p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 mt-6 pb-8 space-y-3">
            <p className="text-xs text-warm-gray text-center">Created by Nuuge</p>
            <div className="flex flex-nowrap items-center gap-3 justify-center overflow-x-auto">
              <button
                onClick={() => setStage("front")}
                className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors flex-shrink-0"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                View front
              </button>
              <button
                onClick={() => setStage("inside")}
                className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors flex-shrink-0"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                View inside
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
              >
                {sharing ? "Sharing..." : "Share e-card"}
              </button>
              <button
                onClick={() => { window.location.href = `/cards/print/${cardId}`; }}
                className="btn-primary px-5 py-2 rounded-full text-sm flex-shrink-0"
              >
                Print preview
              </button>
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={() => recipientId ? router.push(`/recipients/${recipientId}`) : router.push("/")}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                style={{ border: "1.5px solid var(--color-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                {recipientName || "Circle of People"}
              </button>
            </div>
            {shareUrl && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-xl" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs bg-transparent outline-none text-charcoal"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(shareUrl);
                    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {shareError && (
              <div className="mt-2 p-3 rounded-lg text-sm text-center" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>{shareError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
