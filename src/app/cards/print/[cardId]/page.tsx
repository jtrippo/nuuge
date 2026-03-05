"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients, hydrateCardImages, updateCard } from "@/lib/store";
import type { Card, Recipient } from "@/types/database";
import { fontCSS, positionCSS, textStyleCSS, messageSizing } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";

const FONT_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: "sans", label: "Clean" },
  { value: "script", label: "Elegant" },
  { value: "block", label: "Bold" },
];

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
];

const TEXT_STYLE_OPTIONS: { value: TextStyleChoice; label: string }[] = [
  { value: "plain", label: "Plain black" },
  { value: "white_box", label: "Black on white" },
  { value: "dark_box", label: "White on dark" },
];

export default function PrintCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;
  const [card, setCard] = useState<Card | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [duplex, setDuplex] = useState(true);

  const [printSize, setPrintSize] = useState<"4x6" | "5x7" | "8.5x11">("5x7");
  const [ftFont, setFtFont] = useState<FontChoice>("sans");
  const [ftPosition, setFtPosition] = useState("bottom-right");
  const [ftStyle, setFtStyle] = useState<TextStyleChoice>("dark_box");
  const [msgFont, setMsgFont] = useState<FontChoice>("sans");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setMounted(true);
    const all = getCards();
    const found = all.find((c) => c.id === cardId);
    if (found) {
      const recipients = getRecipients();
      const r = recipients.find((rec) => rec.id === found.recipient_id);
      if (r) setRecipient(r);

      setFtFont(found.front_text_font ?? "sans");
      setFtPosition(found.front_text_position ?? "bottom-right");
      setFtStyle(found.front_text_style ?? "dark_box");
      setMsgFont(found.font ?? "sans");
      if (found.card_size) setPrintSize(found.card_size as "4x6" | "5x7");

      hydrateCardImages(found).then((hydrated) => setCard(hydrated));
    }
  }, [cardId]);

  const imageUrls: string[] = card
    ? [card.image_url, card.inside_image_url].filter((u): u is string => Boolean(u))
    : [];

  useEffect(() => {
    if (imageUrls.length === 0) { setImagesLoaded(true); return; }
    let done = 0;
    const check = () => { done++; if (done >= imageUrls.length) setImagesLoaded(true); };
    imageUrls.forEach((src) => {
      const img = new Image();
      img.onload = check;
      img.onerror = check;
      img.src = src;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  function saveSettings() {
    if (!card) return;
    updateCard(card.id, {
      front_text_font: ftFont,
      front_text_position: ftPosition,
      front_text_style: ftStyle,
      font: msgFont,
    });
  }

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <p className="text-gray-500 mb-4">Card not found.</p>
        <button onClick={() => router.push("/")} className="text-indigo-600 font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.length > 2 ? messageParts.slice(1, -1).join("\n\n") : "";
  const closing = messageParts.length > 1 ? messageParts[messageParts.length - 1] : "";
  const totalChars = card.message_text.length;
  const sizing = messageSizing(totalChars);

  const insidePos = card.inside_image_position ?? "top";
  const frontFontStyle = fontCSS(ftFont);
  const messageFontStyle = fontCSS(msgFont);
  const ftPosCSS = positionCSS(ftPosition);
  const ftStyleCSS = textStyleCSS(ftStyle);

  // On-screen preview aspect ratios (landscape sheet with 2 portrait panels)
  const sheetAspect = printSize === "4x6" ? "8 / 6"
    : printSize === "5x7" ? "10 / 7"
      : "11 / 8.5";

  // Always use standard landscape paper so the printer can duplex reliably.
  // Use @page margins to create the correct content area for each card size.
  // On landscape letter (11" × 8.5"):
  //   8.5×11 → margin: 0           → content = 11" × 8.5"
  //   5×7    → margin: 0.75in 0.5in → content = 10" × 7"
  //   4×6    → margin: 1.25in 1.5in → content = 8"  × 6"
  const pageMargins = printSize === "4x6" ? "1.25in 1.5in"
    : printSize === "5x7" ? "0.75in 0.5in"
      : "0";

  // Explicit content-area height so print doesn't rely on 100vh
  // (some browsers resolve 100vh to full paper height, ignoring @page margins).
  const printHeight = printSize === "4x6" ? "6in"
    : printSize === "5x7" ? "7in"
      : "8.5in";

  return (
    <>
      <style>{`
        @page {
          size: landscape;
          margin: ${pageMargins};
        }

        .card-sheet {
          display: flex;
          flex-direction: row;
          width: 100%;
          aspect-ratio: ${sheetAspect};
          max-height: 60vh;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
          margin-bottom: 1rem;
          background: #fff;
        }
        .card-panel {
          width: 50%;
          height: 100%;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }
        .card-panel + .card-panel {
          border-left: 1px dashed #d1d5db;
        }

        .front-text-overlay {
          font-size: clamp(1.4rem, 4vw, 2.5rem);
          line-height: 1.2;
          text-align: center;
        }

        @media print {
          .no-print { display: none !important; }
          html, body {
            margin: 0; padding: 0; height: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .card-sheet {
            width: 100%;
            height: ${printHeight};
            max-height: ${printHeight};
            aspect-ratio: auto;
            border: none;
            border-radius: 0;
            margin: 0;
            padding: 0;
            overflow: hidden;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .card-sheet-1 {
            page-break-after: always;
            break-after: page;
          }
          .card-sheet-2 {
            page-break-after: avoid;
            break-after: avoid;
          }
          .card-panel {
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
          }
          .card-panel + .card-panel { border-left: none; }
          .front-text-overlay {
            font-size: clamp(1.6rem, 5vw, 3rem) !important;
          }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Dashboard
            </button>
            <button
              onClick={() => router.push(`/cards/edit/${cardId}`)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              &larr; Edit card
            </button>
            {recipient && (
              <button
                onClick={() => router.push(`/recipients/${recipient.id}`)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {recipient.name}&apos;s profile
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Size:</span>
              {(["4x6", "5x7", "8.5x11"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="printSize"
                    checked={printSize === s}
                    onChange={() => setPrintSize(s)}
                    className="text-indigo-600"
                  />
                  <span className="text-gray-700">
                    {s === "4x6" ? "4×6" : s === "5x7" ? "5×7" : "8.5×11"}
                  </span>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={duplex}
                onChange={(e) => setDuplex(e.target.checked)}
                className="text-indigo-600 rounded"
              />
              <span className="text-gray-600">Duplex</span>
            </label>

            <button
              onClick={() => setShowSettings((v) => !v)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {showSettings ? "Hide settings" : "Card settings"}
            </button>

            <button
              onClick={() => { saveSettings(); setTimeout(() => window.print(), 100); }}
              disabled={!imagesLoaded && imageUrls.length > 0}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium
                         hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Print card
            </button>
          </div>
        </div>
      </div>

      {/* ── Editable Settings Panel ── */}
      {showSettings && (
        <div className="no-print bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Front text position
                </label>
                <select
                  value={ftPosition}
                  onChange={(e) => setFtPosition(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                >
                  {POSITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Front text style
                </label>
                <select
                  value={ftStyle}
                  onChange={(e) => setFtStyle(e.target.value as TextStyleChoice)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                >
                  {TEXT_STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Front font
                </label>
                <select
                  value={ftFont}
                  onChange={(e) => setFtFont(e.target.value as FontChoice)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                >
                  {FONT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Message font
                </label>
                <select
                  value={msgFont}
                  onChange={(e) => setMsgFont(e.target.value as FontChoice)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                >
                  {FONT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => { saveSettings(); setShowSettings(false); }}
                className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Instructions ── */}
      <div className="no-print px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">
              How to print {duplex ? "(automatic two-sided)" : "(manual two-sided)"}
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>
                Card size:{" "}
                <strong>
                  {printSize === "4x6" ? "4\" × 6\""
                    : printSize === "5x7" ? "5\" × 7\""
                      : "5.5\" × 8.5\" (half letter)"}
                </strong>
                {" "} — folded card with two portrait panels.
              </li>
              <li>
                Load <strong>letter paper (8.5×11)</strong>
                {printSize !== "8.5x11" && " — card stock or regular paper for test prints"}.
              </li>
              <li>
                In the print dialog: <strong>Landscape</strong> orientation, <strong>Scale 100%</strong> (not &quot;Fit to page&quot;).
              </li>
              <li>
                <strong>Page 1 (outside):</strong> Left = back · Right = front cover
              </li>
              <li>
                <strong>Page 2 (inside):</strong> Left = blank · Right = message
              </li>
              {duplex ? (
                <>
                  <li>
                    Enable <strong>Two-sided / Duplex</strong> and set flip to <strong>&quot;Flip on short edge&quot;</strong>.
                  </li>
                  <li>
                    Hit print — both sides print on <strong>one sheet</strong> automatically.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Make sure <strong>Two-sided / Duplex is OFF</strong>.
                    Print <strong>page 1 only</strong>.
                  </li>
                  <li>
                    Re-insert the printed sheet <strong>face-down, rotated 180°</strong>,
                    then print <strong>page 2 only</strong>.
                  </li>
                </>
              )}
              <li>
                Fold right over left so the front cover is on the outside.
                {printSize !== "8.5x11" && " Trim to size if using letter paper."}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Sheet Previews ── */}
      <div className="print-wrapper max-w-4xl mx-auto px-6 pb-8">

        {/* Sheet 1 — Back (left) + Front (right) */}
        <p className="no-print text-xs text-gray-400 uppercase tracking-wide mb-1">
          Page 1 — Outside (back + front)
        </p>
        <div className="card-sheet card-sheet-1">
          <div className="card-panel flex flex-col items-center justify-end p-4">
            <p className="text-xs text-gray-400 pb-4">Created by Nuuge</p>
          </div>

          <div className="card-panel">
            {card.image_url ? (
              <>
                <img
                  src={card.image_url}
                  alt="Card front"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    display: "block",
                  }}
                />
                {card.front_text && (
                  <div
                    className="front-text-overlay"
                    style={{
                      position: "absolute",
                      ...ftPosCSS,
                      ...frontFontStyle,
                      ...ftStyleCSS,
                      maxWidth: "90%",
                    }}
                  >
                    {card.front_text}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <p className="text-indigo-400 text-lg font-medium">{card.occasion}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sheet 2 — Inside left (blank) + Inside right (message) */}
        <p className="no-print text-xs text-gray-400 uppercase tracking-wide mb-1 mt-4">
          Page 2 — Inside (blank + message)
        </p>
        <div className="card-sheet card-sheet-2">
          <div className="card-panel" />

          {/* Inside right — message + illustration */}
          <div
            className="card-panel"
            style={{
              ...messageFontStyle,
              position: "relative",
              display: "flex",
              flexDirection: insidePos === "left" || insidePos === "right" ? "row" : "column",
            }}
          >
            {/* ── Watermark: fills entire panel, text overlays on top ── */}
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
              <div style={{ width: "18%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "top" && card.inside_image_url && (
              <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {/* Message text — centered, adaptive sizing */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: insidePos === "left" || insidePos === "right"
                  ? "6% 4%"
                  : "8% 10%",
                overflow: "hidden",
                position: "relative",
                zIndex: 1,
                gap: sizing.gap,
              }}
            >
              {insidePos === "middle" && card.inside_image_url && (
                <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                  <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.25rem" }} />
                </div>
              )}

              <p
                className="text-gray-800 text-center"
                style={{ fontSize: sizing.greetingSize, fontWeight: 600, lineHeight: 1.3 }}
              >
                {greeting}
              </p>
              {body && (
                <p
                  className="text-gray-700 whitespace-pre-wrap text-center"
                  style={{ fontSize: sizing.bodySize, lineHeight: 1.55 }}
                >
                  {body}
                </p>
              )}
              {closing && (
                <p
                  className="text-gray-600 text-center"
                  style={{ fontSize: sizing.closingSize, fontStyle: "italic", lineHeight: 1.4 }}
                >
                  {closing}
                </p>
              )}
            </div>

            {insidePos === "bottom" && card.inside_image_url && (
              <div style={{ width: "100%", height: "16%", flexShrink: 0 }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {insidePos === "right" && card.inside_image_url && (
              <div style={{ width: "18%", flexShrink: 0, height: "100%" }}>
                <img src={card.inside_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {!imagesLoaded && imageUrls.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 bg-amber-100 text-amber-800 text-sm px-4 py-2 rounded-lg shadow">
          Loading images...
        </div>
      )}
    </>
  );
}
