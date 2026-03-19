"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCards, getRecipients, getUserProfile, hydrateCardImages, updateCard, deleteCard } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import type { Card, Recipient } from "@/types/database";
import { getDisplayOccasion } from "@/lib/occasions";
import { fontCSS, positionCSS, textStyleCSS, frontTextAlign, messageSizing, maxMsgScale, msgSizeOptions, FONT_OPTIONS, isAccentPosition, defaultAccentSlots, cornerStyle, cornerImgStyle, edgeStyle, edgeImgStyle, frameImgStyle, DEFAULT_ACCENT_OPACITY, DEFAULT_FRAME_OPACITY } from "@/lib/card-ui-helpers";
import type { FontChoice, TextStyleChoice } from "@/lib/card-ui-helpers";
import { shareCard } from "@/lib/share-card";
import { copyToClipboard } from "@/lib/clipboard";
import { getSenderNames, getRecipientDisplayName } from "@/lib/signer-helpers";

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
  { value: "plain_black", label: "Plain black" },
  { value: "plain_white", label: "Plain white" },
  { value: "black_white_border", label: "Black / white outline" },
  { value: "white_black_border", label: "White / black outline" },
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLetterEditor, setShowLetterEditor] = useState(false);
  const [showPrintInfo, setShowPrintInfo] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [letterFont, setLetterFont] = useState<string>("handwritten");
  const [letterSizeScale, setLetterSizeScale] = useState<number>(1);

  const [printSize, setPrintSize] = useState<"4x6" | "5x7" | "8.5x11">("5x7");
  const [ftFont, setFtFont] = useState<string>("sans");
  const [ftPosition, setFtPosition] = useState("bottom-right");
  const [ftStyle, setFtStyle] = useState<TextStyleChoice>("plain_black");
  const [msgFont, setMsgFont] = useState<string>("sans");
  const [insidePos, setInsidePos] = useState<"top" | "middle" | "bottom" | "left" | "right" | "behind" | "corner_flourish" | "top_edge_accent" | "frame">("top");
  const [msgSizeScale, setMsgSizeScale] = useState<number>(0);
  const [ftSizeScale, setFtSizeScale] = useState<number>(1);
  const loadedRef = useRef(false);

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
      setFtStyle(found.front_text_style ?? "plain_black");
      setMsgFont(found.font ?? "sans");
      setInsidePos((found.inside_image_position as typeof insidePos) ?? "top");
      if (found.card_size) setPrintSize(found.card_size as "4x6" | "5x7");
      if (found.msg_font_scale != null) setMsgSizeScale(found.msg_font_scale);
      if (found.ft_font_scale != null) setFtSizeScale(found.ft_font_scale);
      if (found.letter_text) setLetterText(found.letter_text);
      if (found.letter_font) setLetterFont(found.letter_font);
      if (found.letter_font_scale != null) setLetterSizeScale(found.letter_font_scale);

      hydrateCardImages(found).then((hydrated) => {
        setCard(hydrated);
        loadedRef.current = true;
      });
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

  useEffect(() => {
    if (!card || !loadedRef.current) return;
    updateCard(card.id, {
      front_text_font: ftFont,
      front_text_position: ftPosition,
      front_text_style: ftStyle,
      font: msgFont,
      inside_image_position: insidePos,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font: letterFont,
      letter_font_scale: letterSizeScale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftFont, ftPosition, ftStyle, msgFont, insidePos, msgSizeScale, ftSizeScale, letterFont, letterSizeScale]);

  if (!mounted) return null;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: "var(--color-cream)" }}>
        <p className="text-warm-gray mb-4">Card not found.</p>
        <button onClick={() => router.push("/")} style={{ color: "var(--color-brand)" }} className="font-medium">
          Back to Home
        </button>
      </div>
    );
  }

  function saveSettings() {
    if (!card) return;
    updateCard(card.id, {
      front_text_font: ftFont,
      front_text_position: ftPosition,
      front_text_style: ftStyle,
      font: msgFont,
      inside_image_position: insidePos,
      msg_font_scale: msgSizeScale,
      ft_font_scale: ftSizeScale,
      letter_font: letterFont,
      letter_font_scale: letterSizeScale,
    });
  }

  const messageParts = card.message_text.split("\n\n");
  const greeting = messageParts[0] || "";
  const body = messageParts.length > 2 ? messageParts.slice(1, -1).join("\n\n") : "";
  const closing = messageParts.length > 1 ? messageParts[messageParts.length - 1] : "";
  const totalChars = card.message_text.length;
  const baseSizing = messageSizing(totalChars);

  const sizeOpts = msgSizeOptions(totalChars);
  const autoValue = sizeOpts.find((o) => o.label === "Auto")!.value;
  const effectiveMsgScale = msgSizeScale === 0 ? autoValue : msgSizeScale;
  const remToCqw = (rem: string) => `${(parseFloat(rem) * effectiveMsgScale * 3.81).toFixed(2)}cqw`;
  const sizing = {
    greetingSize: remToCqw(baseSizing.greetingSize),
    bodySize: remToCqw(baseSizing.bodySize),
    closingSize: remToCqw(baseSizing.closingSize),
    gap: remToCqw(baseSizing.gap),
  };

  const frontFontStyle = fontCSS(ftFont);
  const messageFontStyle = fontCSS(msgFont);
  const ftPosCSS = positionCSS(ftPosition);
  const ftStyleCSS = textStyleCSS(ftStyle);
  // Print-safe inline styles: PDF renderers turn ANY text-shadow into visible
  // rectangles, so we strip text-shadow from every style for print output.
  // Only dark_box keeps its background/padding (the user explicitly chose a box).
  const ftStyleCSSForPrint: React.CSSProperties = (() => {
    switch (ftStyle) {
      case "dark_box":
        return {
          color: ftStyleCSS.color,
          backgroundColor: ftStyleCSS.backgroundColor,
          borderRadius: ftStyleCSS.borderRadius,
          padding: ftStyleCSS.padding,
        };
      case "black_white_border":
        return {
          color: "#000",
          WebkitTextStroke: "1.5px #fff",
          paintOrder: "stroke fill",
        };
      case "white_black_border":
        return {
          color: "#fff",
          WebkitTextStroke: "1.5px #000",
          paintOrder: "stroke fill",
        };
      case "plain_white":
        return { color: "#fff" };
      case "plain_black":
        return { color: "#111" };
      case "plain":
        return { color: "#111" };
      case "white_box":
      default:
        return { color: "#111" };
    }
  })();

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
          border: 1px solid var(--color-light-gray);
          border-radius: 0.5rem;
          overflow: hidden;
          margin-bottom: 1rem;
          background: var(--color-white);
        }
        .card-panel {
          width: 50%;
          height: 100%;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          container-type: inline-size;
        }
        .card-panel + .card-panel {
          border-left: 1px dashed var(--color-light-gray);
        }

        .front-text-overlay {
          font-size: calc(clamp(1.4rem, 4vw, 2.5rem) * var(--ft-scale, 1));
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
          .card-sheet-3 {
            page-break-before: always;
            break-before: page;
            page-break-after: avoid;
            break-after: avoid;
            column-rule: none !important;
          }
          .card-panel {
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
          }
          .card-panel + .card-panel { border-left: none; }
          .front-text-overlay {
            font-size: calc(clamp(1.6rem, 5vw, 3rem) * var(--ft-scale, 1)) !important;
          }
        }
      `}</style>

      <AppHeader title={card ? (() => {
        const ct = (card as Card & { card_type?: string }).card_type;
        const qName = (card as Card & { quick_recipient_name?: string | null }).quick_recipient_name;
        if (ct === "news") return `${getDisplayOccasion(card)} — Share a moment`;
        if (ct === "beyond" && qName) return `${getDisplayOccasion(card)} card for ${qName}`;
        return `${getDisplayOccasion(card)} card for ${recipient?.name ?? "recipient"}`;
      })() : undefined}>
        <button
          onClick={() => { saveSettings(); const ct = (card as Card & { card_type?: string })?.card_type; (ct === "news" || ct === "beyond") ? router.push("/") : (recipient ? router.push(`/recipients/${recipient.id}`) : router.push("/")); }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          {recipient?.name ?? "Home"}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => { saveSettings(); window.location.href = `/cards/edit/${cardId}`; }}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          Edit card
        </button>
        <button
          onClick={() => setShowLetterEditor(true)}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          {letterText.trim() ? "Edit letter" : "Add letter"}
        </button>
        <button
          onClick={() => { saveSettings(); window.location.href = `/cards/view/${cardId}`; }}
          className="px-4 py-1.5 rounded-full text-sm text-warm-gray hover:text-charcoal transition-colors"
          style={{ border: "1.5px solid var(--color-sage)" }}
        >
          View e-card
        </button>
        <button
          onClick={async () => {
            if (!card || sharing) return;
            saveSettings();
            setSharing(true);
            setShareError(null);
            try {
              const profile = getUserProfile();
              const recipients = getRecipients();
              const rName = getRecipientDisplayName(card, recipient);
              const sName = getSenderNames(card, recipient, recipients, profile);
              const hydrated = await hydrateCardImages(card);
              const result = await shareCard(hydrated, rName, sName);
              if ("error" in result) { setShareError(result.error); }
              else { setShareUrl(result.shareUrl); }
            } catch (err) {
              setShareError(err instanceof Error ? err.message : "Failed to share. Check your connection and try again.");
            } finally {
              setSharing(false);
            }
          }}
          disabled={sharing}
          className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ color: "var(--color-brand)", border: "1.5px solid var(--color-sage)" }}
        >
          {sharing ? "Sharing..." : "Share e-card"}
        </button>
      </AppHeader>

      {/* Share URL banner */}
      {shareUrl && (
        <div className="no-print max-w-4xl mx-auto px-6 pt-3">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--color-brand-light)", border: "1px solid var(--color-sage)" }}>
            <span className="text-xs text-charcoal font-medium">Shareable link:</span>
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
        </div>
      )}
      {shareError && (
        <div className="no-print max-w-4xl mx-auto px-6 pt-2">
          <div className="p-3 rounded-lg text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>{shareError}</div>
        </div>
      )}

      {/* ── Print controls (above Page 1) ── */}
      <div className="no-print print-wrapper max-w-4xl mx-auto px-6 pt-4 flex items-center justify-between gap-4">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-1.5 rounded-full text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--color-error)", border: "1.5px solid var(--color-error)" }}
        >
          Delete
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {(["4x6", "5x7", "8.5x11"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setPrintSize(s)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  printSize === s
                    ? "font-medium"
                    : "text-warm-gray hover:text-charcoal"
                }`}
                style={printSize === s
                  ? { background: "var(--color-brand-light)", color: "var(--color-brand)", border: "1.5px solid var(--color-brand)" }
                  : { border: "1.5px solid var(--color-sage)" }
                }
              >
                {s === "4x6" ? "4×6" : s === "5x7" ? "5×7" : "8.5×11"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="rounded"
              style={{ accentColor: "var(--color-brand)" }}
            />
            <span className="text-warm-gray">Duplex</span>
          </label>
          <div className="relative">
            <button
              onClick={() => setShowPrintInfo(!showPrintInfo)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-charcoal transition-colors"
              style={{ border: "1.5px solid var(--color-sage)" }}
              title="Print instructions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            {showPrintInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPrintInfo(false)} />
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl shadow-lg p-4 text-sm"
                  style={{ background: "var(--color-white)", border: "1px solid var(--color-light-gray)" }}
                >
                  <p className="font-medium text-charcoal mb-2">
                    How to print {duplex ? "(automatic two-sided)" : "(manual two-sided)"}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-warm-gray">
                    <li>
                      Card size: <strong className="text-charcoal">
                        {printSize === "4x6" ? "4\" × 6\"" : printSize === "5x7" ? "5\" × 7\"" : "5.5\" × 8.5\""}
                      </strong>
                    </li>
                    <li>Load <strong className="text-charcoal">letter paper (8.5×11)</strong></li>
                    <li>Print dialog: <strong className="text-charcoal">Landscape</strong>, <strong className="text-charcoal">Scale 100%</strong></li>
                    <li><strong className="text-charcoal">Page 1:</strong> Left = back · Right = front</li>
                    <li><strong className="text-charcoal">Page 2:</strong> Left = blank · Right = message</li>
                    {duplex ? (
                      <>
                        <li>Enable <strong className="text-charcoal">Duplex</strong> → <strong className="text-charcoal">Flip on short edge</strong></li>
                        <li>Both sides print on one sheet</li>
                      </>
                    ) : (
                      <>
                        <li><strong className="text-charcoal">Duplex OFF</strong> — print page 1 first</li>
                        <li>Re-insert face-down, rotated 180°, print page 2</li>
                      </>
                    )}
                    <li>Fold right over left{printSize !== "8.5x11" && ", trim to size"}</li>
                  </ul>
                  <p className="text-warm-gray mt-3 pt-2" style={{ borderTop: "1px solid var(--color-light-gray)", fontSize: "0.8rem" }}>
                    <strong className="text-charcoal">Tip:</strong> If duplex doesn&apos;t work from the browser, save as PDF first, then print from the PDF viewer — this fixes duplex on most printers.
                  </p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => { window.print(); }}
            disabled={!imagesLoaded && imageUrls.length > 0}
            className="btn-primary px-5 py-2 rounded-full text-sm disabled:opacity-50"
          >
            Print card
          </button>
        </div>
      </div>

      {/* ── Sheet Previews ── */}
      <div className="print-wrapper max-w-4xl mx-auto px-6 pt-4 pb-8">

        {/* Sheet 1 — Back (left) + Front (right) */}
        <p className="no-print section-label mb-1">
          Page 1 — Outside (back + front)
        </p>
        <div className="card-sheet card-sheet-1">
          <div className="card-panel flex flex-col items-center justify-end p-4">
            <p className="text-xs text-warm-gray pb-4">Created by Nuuge</p>
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
                      ...ftStyleCSSForPrint,
                      width: "84%",
                      padding: "0.5rem",
                      boxSizing: "border-box",
                      textAlign: frontTextAlign(ftPosition),
                      whiteSpace: "pre-line",
                      ...({ "--ft-scale": ftSizeScale } as React.CSSProperties),
                    }}
                  >
                    {card.front_text}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-brand-light)" }}>
                <p className="text-lg font-medium" style={{ color: "var(--color-brand)" }}>{getDisplayOccasion(card)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Front cover settings ── */}
        {card.front_text && (
          <div className="no-print rounded-lg p-4 mb-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
            <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Front text settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-warm-gray mb-1">Position</label>
                <select
                  value={ftPosition}
                  onChange={(e) => { setFtPosition(e.target.value); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {POSITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Style</label>
                <select
                  value={ftStyle}
                  onChange={(e) => { setFtStyle(e.target.value as TextStyleChoice); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {TEXT_STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Font</label>
                <select
                  value={ftFont}
                  onChange={(e) => { setFtFont(e.target.value); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  {FONT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warm-gray mb-1">Text size</label>
                <select
                  value={ftSizeScale}
                  onChange={(e) => { setFtSizeScale(parseFloat(e.target.value)); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  <option value={0.7}>Small</option>
                  <option value={0.85}>Medium</option>
                  <option value={1}>Auto</option>
                  <option value={1.2}>Large</option>
                  <option value={1.4}>Extra Large</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Sheet 2 — Inside left (blank) + Inside right (message) */}
        <p className="no-print section-label mb-1 mt-4">
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
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.includes(1) ? (
                <div style={edgeStyle(1)}>
                  <img src={card.inside_image_url!} alt="" style={edgeImgStyle(ao ?? undefined)} />
                </div>
              ) : null;
            })()}

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
                className="text-charcoal text-center"
                style={{ ...messageFontStyle, fontSize: sizing.greetingSize, fontWeight: 600, lineHeight: 1.3 }}
              >
                {greeting}
              </p>
              {body && (
                <p
                  className="text-charcoal whitespace-pre-wrap text-center"
                  style={{ ...messageFontStyle, fontSize: sizing.bodySize, lineHeight: 1.55 }}
                >
                  {body}
                </p>
              )}
              {closing && (
                <p
                  className="text-charcoal text-center whitespace-pre-line"
                  style={{ ...messageFontStyle, fontSize: sizing.closingSize, fontStyle: "italic", lineHeight: 1.4 }}
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
            {insidePos === "corner_flourish" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("corner_flourish");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.map((slot) => (
                <div key={slot} style={cornerStyle(slot)}>
                  <img src={card.inside_image_url!} alt="" style={cornerImgStyle(ao ?? undefined)} />
                </div>
              ));
            })()}
            {insidePos === "frame" && card.inside_image_url && (
              <img src={card.inside_image_url} alt="" style={frameImgStyle((card as { accent_opacity?: number }).accent_opacity ?? undefined)} />
            )}
            {insidePos === "top_edge_accent" && card.inside_image_url && (() => {
              const slots = (card as { accent_positions?: number[] }).accent_positions ?? defaultAccentSlots("top_edge_accent");
              const ao = (card as { accent_opacity?: number }).accent_opacity;
              return slots.includes(2) ? (
                <div style={edgeStyle(2)}>
                  <img src={card.inside_image_url!} alt="" style={edgeImgStyle(ao ?? undefined)} />
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* ── Message settings ── */}
        <div className="no-print rounded-lg p-4 mt-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
          <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Message settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-warm-gray mb-1">Font</label>
              <select
                value={msgFont}
                onChange={(e) => { setMsgFont(e.target.value); }}
                className="w-full text-sm input-field px-2 py-1.5"
              >
                {FONT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-warm-gray mb-1">Text size</label>
              <select
                value={msgSizeScale}
                onChange={(e) => { setMsgSizeScale(parseFloat(e.target.value)); }}
                className="w-full text-sm input-field px-2 py-1.5"
              >
                {sizeOpts.map((o) => (
                  <option key={o.label} value={o.label === "Auto" ? 0 : o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {card.inside_image_url && (
              <div>
                <label className="block text-xs text-warm-gray mb-1">Decoration position</label>
                <select
                  value={insidePos}
                  onChange={(e) => { setInsidePos(e.target.value as typeof insidePos); }}
                  className="w-full text-sm input-field px-2 py-1.5"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="behind">Behind (watermark)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Sheet 3 — Letter Insert (optional) ── */}
        {letterText.trim() && (() => {
          const letterFontStyle = fontCSS((letterFont || "handwritten") as FontChoice);
          const baseFontSize = 0.75 * letterSizeScale;
          const greetingSize = `${(0.85 * letterSizeScale).toFixed(3)}rem`;
          const bodySize = `${baseFontSize.toFixed(3)}rem`;
          const closingSize = `${baseFontSize.toFixed(3)}rem`;
          return (
            <>
              <p className="no-print section-label mb-1 mt-4">
                Page 3 — Letter insert
              </p>
              <div className="card-sheet card-sheet-3" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                <div
                  style={{
                    ...letterFontStyle,
                    width: "100%",
                    height: "100%",
                    columnCount: 2,
                    columnFill: "auto" as const,
                    columnGap: "2rem",
                    columnRule: "1px dashed var(--color-light-gray)",
                    padding: "6% 6%",
                    boxSizing: "border-box",
                    position: "relative",
                    textAlign: "left",
                  }}
                >
                  {/* Subtle paper lines */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, #8b7d6b 28px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <p className="text-charcoal" style={{ fontSize: greetingSize, fontWeight: 500, lineHeight: 1.4, marginBottom: "0.6em" }}>
                      {letterText.split("\n\n")[0]}
                    </p>
                    {letterText.split("\n\n").length > 2 && (
                      <div className="text-charcoal whitespace-pre-wrap" style={{ fontSize: bodySize, lineHeight: 1.65, marginBottom: "0.6em" }}>
                        {letterText.split("\n\n").slice(1, -1).join("\n\n")}
                      </div>
                    )}
                    {letterText.split("\n\n").length > 1 && (
                      <p className="text-charcoal whitespace-pre-line" style={{ fontSize: closingSize, fontStyle: "italic", lineHeight: 1.5 }}>
                        {letterText.split("\n\n")[letterText.split("\n\n").length - 1]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Letter settings ── */}
              <div className="no-print rounded-lg p-4 mt-2" style={{ background: "var(--color-faint-gray)", border: "1px solid var(--color-light-gray)" }}>
                <p className="text-xs font-medium text-warm-gray uppercase tracking-wide mb-2">Letter settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Font</label>
                    <select
                      value={letterFont}
                      onChange={(e) => { setLetterFont(e.target.value); }}
                      className="w-full text-sm input-field px-2 py-1.5"
                    >
                      {FONT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-warm-gray mb-1">Text size</label>
                    <select
                      value={letterSizeScale}
                      onChange={(e) => { setLetterSizeScale(parseFloat(e.target.value)); }}
                      className="w-full text-sm input-field px-2 py-1.5"
                    >
                      <option value={0.8}>Small</option>
                      <option value={0.9}>Medium</option>
                      <option value={1}>Auto</option>
                      <option value={1.15}>Large</option>
                      <option value={1.3}>Extra Large</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      </div>

      {!imagesLoaded && imageUrls.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 text-sm px-4 py-2 rounded-lg shadow" style={{ background: "var(--color-amber-light)", color: "var(--color-charcoal)" }}>
          Loading images...
        </div>
      )}

      {showLetterEditor && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowLetterEditor(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4"
            style={{ background: "var(--color-white)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-charcoal mb-1">Personal letter insert</h3>
            <p className="text-sm text-warm-gray mb-4">
              Write a personal note that will print as a separate page tucked inside the card.
            </p>
            <textarea
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              rows={6}
              placeholder="Dear friend, I wanted to add a personal note..."
              className="input-field rounded-xl w-full mb-3 text-base"
              style={fontCSS(letterFont as FontChoice)}
            />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-warm-gray">Font:</span>
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLetterFont(f.id)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    letterFont === f.id
                      ? "border-brand bg-brand-light font-medium"
                      : "border-light-gray hover:border-sage"
                  }`}
                  style={fontCSS(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLetterEditor(false)}
                className="px-4 py-2 text-sm rounded-lg font-medium text-charcoal"
                style={{ border: "1px solid var(--color-light-gray)" }}
              >
                Cancel
              </button>
              {letterText.trim() && (
                <button
                  onClick={() => {
                    setLetterText("");
                    if (card) {
                      updateCard(card.id, { letter_text: null, letter_font: null });
                      setCard({ ...card, letter_text: null, letter_font: null });
                    }
                    setShowLetterEditor(false);
                  }}
                  className="px-4 py-2 text-sm rounded-lg font-medium"
                  style={{ color: "var(--color-error)", border: "1px solid var(--color-error)" }}
                >
                  Remove letter
                </button>
              )}
              <button
                onClick={() => {
                  if (card) {
                    const updates = {
                      letter_text: letterText.trim() || null,
                      letter_font: letterFont,
                    };
                    updateCard(card.id, updates);
                    setCard({ ...card, ...updates });
                  }
                  setShowLetterEditor(false);
                }}
                className="btn-primary px-4 py-2 text-sm rounded-lg"
              >
                {letterText.trim() ? "Save letter" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            style={{ background: "var(--color-white)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-charcoal mb-2">Delete this card?</h3>
            <p className="text-sm text-warm-gray mb-6">
              This will permanently remove the card and its message. This can&apos;t be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg font-medium text-charcoal"
                style={{ border: "1px solid var(--color-light-gray)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCard(cardId);
                  router.push("/");
                }}
                className="px-4 py-2 text-sm rounded-lg font-medium text-white"
                style={{ background: "var(--color-error)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
